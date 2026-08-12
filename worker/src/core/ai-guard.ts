/**
 * core/ai-guard.ts — AI 调用护栏（Governor 接入层）
 *
 * 设计目标（对应「自进化架构师」职责）：
 *  1. 超时：每次 AI 调用强制超时，绝不让 Worker 请求被 AI 拖死。
 *  2. 受限重试 + 分级路由：失败按 models 顺序升级（便宜→贵），但调用次数有硬上限。
 *  3. 熔断：单路由连续失败达到阈值即熔断一段时间，期间直接转兜底，停止打 AI。
 *  4. 成本预算：进程内日预算软告警，避免免费额度被静默榨干。
 *  5. 异常/Bot 防护：滑动窗口检测流量突增（默认 5 倍基线），命中即熔断 + 告警。
 *  6. 遥测：每次调用产出结构化 telemetry（模型 / 延迟 / 估算 token / 估算成本 / 状态）。
 *
 * 状态说明：进程内 Map（单实例隔离，冷启动归零）。免费套餐下足以做热防护；
 * 若需跨实例持久化（多实例部署），后续可把 breakers / rateWindows / dayCost
 * 迁移到 D1 或 KV，接口保持不变。
 *
 * 注意：护栏只负责「安全与成本」，不负责「业务兜底」。兜底（静态文案 / D1 词典 /
 * {audio:''}）仍由各端点 handler 在原逻辑里处理。
 */

import type { Env } from '../env';
import type { Logger } from './logger';

/* ============================ 类型 ============================ */

export interface AiRunInput {
  prompt: string;
  temperature?: number;
  [k: string]: unknown;
}

export interface GuardedAiOptions {
  /** 路由 key，用于熔断 / 异常计数，建议形如 'ai:study-tip' */
  route: string;
  /** 分级路由：从便宜到贵，依次尝试 */
  models: string[];
  /** AI 输入（含 prompt / temperature 等） */
  input: AiRunInput;
  /** 结构化日志器（可选，用于遥测落盘） */
  log?: Logger;
  /** 单次调用超时（ms），默认 5000 */
  timeoutMs?: number;
  /** 每模型失败重试上限（不含首次），默认 1 */
  maxRetries?: number;
  /** 单请求 AI 调用硬上限（默认 = models.length），用于砍掉 explain-word 式双倍计费 */
  maxCallsPerRequest?: number;
  /** 日预算软上限（USD），默认 0.05 */
  maxCostPerDayUsd?: number;
  /** 估算单价（USD / 1M tokens），按实际账单校准，默认 0.01（llama-3.2-3b 量级） */
  pricePer1MTokens?: number;
}

export interface AiTelemetry {
  route: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  estTokens: number;
  estCostUsd: number;
  breakerTripped: boolean;
  budgetExceeded: boolean;
  anomalous: boolean;
  calls: number;
  error?: string;
}

export interface GuardedResult {
  /** AI.run 原始返回；任何失败路径为 null */
  result: unknown | null;
  telemetry: AiTelemetry;
}

/* ============================ 配置 ============================ */

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_RETRIES = 1;
const BREAKER_THRESHOLD = 5; // 连续失败 5 次熔断
const BREAKER_COOLDOWN_MS = 60_000; // 熔断后 60s 半开试探
const WINDOW_MS = 60_000; // 异常检测滑动窗口 1 分钟
const BASELINE_PER_MIN = 10; // 单路由每分钟基线调用数（按需调）
const ANOMALY_MULT = 5; // 较基线突增 5 倍即判异常（Bot 刷额度特征）
const DEFAULT_PRICE_PER_1M = 0.01;

/* ============================ 进程内状态 ============================ */

interface Breaker {
  failures: number;
  openedAt: number | null;
}
const breakers = new Map<string, Breaker>();
const rateWindows = new Map<string, number[]>();
let dayWindowStart = 0;
let dayCostUsd = 0;

/* ============================ 工具 ============================ */

/** 粗估 token：中文每字 ~1.5，英文每词 ~1.3，固定开销 8。仅用于相对计量与预算。 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[一-龥]/g) ?? []).length;
  const words = (text.match(/[A-Za-z]+/g) ?? []).length;
  return Math.ceil(cjk * 1.5 + words * 1.3 + 8);
}

function estimateCost(tokens: number, pricePer1M: number): number {
  return (tokens / 1_000_000) * pricePer1M;
}

class TimeoutError extends Error {
  constructor() {
    super('ai call timeout');
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError()), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

function breakerIsOpen(route: string): boolean {
  const b = breakers.get(route);
  if (!b || b.openedAt === null) return false;
  return Date.now() - b.openedAt < BREAKER_COOLDOWN_MS;
}

function recordFailure(route: string): void {
  const b = breakers.get(route) ?? { failures: 0, openedAt: null };
  b.failures += 1;
  if (b.failures >= BREAKER_THRESHOLD) b.openedAt = Date.now();
  breakers.set(route, b);
}

function recordSuccess(route: string): void {
  const b = breakers.get(route);
  if (b) {
    b.failures = 0;
    b.openedAt = null;
    breakers.set(route, b);
  }
}

function forceTrip(route: string): void {
  breakers.set(route, { failures: BREAKER_THRESHOLD, openedAt: Date.now() });
}

/** 滑动窗口异常检测：窗口内调用数 > 基线 * 倍数 即异常。 */
function detectAnomaly(route: string): boolean {
  const now = Date.now();
  const arr = (rateWindows.get(route) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  rateWindows.set(route, arr);
  return arr.length > BASELINE_PER_MIN * ANOMALY_MULT;
}

function budgetExceeded(preCostUsd: number, limit: number): boolean {
  const now = Date.now();
  if (now - dayWindowStart > 24 * 3600 * 1000) {
    dayWindowStart = now;
    dayCostUsd = 0;
  }
  return dayCostUsd + preCostUsd > limit;
}

/* ============================ 主入口 ============================ */

export async function guardedAiRun(env: Env, opts: GuardedAiOptions): Promise<GuardedResult> {
  const { route, models, input } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxCalls = opts.maxCallsPerRequest ?? Math.max(1, models.length);
  const dailyBudget = opts.maxCostPerDayUsd ?? 0.05;
  const price = opts.pricePer1MTokens ?? DEFAULT_PRICE_PER_1M;
  const log = opts.log;

  const tel: AiTelemetry = {
    route,
    model: '',
    ok: false,
    latencyMs: 0,
    estTokens: 0,
    estCostUsd: 0,
    breakerTripped: false,
    budgetExceeded: false,
    anomalous: false,
    calls: 0,
  };

  const finish = (result: unknown | null): GuardedResult => {
    if (tel.ok) dayCostUsd += tel.estCostUsd;
    log?.info({
      msg: 'ai.telemetry',
      route: tel.route,
      ok: tel.ok,
      model: tel.model,
      latencyMs: tel.latencyMs,
      estTokens: tel.estTokens,
      estCostUsd: +tel.estCostUsd.toFixed(8),
      breakerTripped: tel.breakerTripped,
      budgetExceeded: tel.budgetExceeded,
      anomalous: tel.anomalous,
      calls: tel.calls,
      error: tel.error,
    });
    return { result, telemetry: tel };
  };

  // 1) 日预算：先按输入粗估成本，超预算直接转兜底，不再打 AI
  const preCost = estimateCost(estimateTokens(input.prompt), price);
  if (budgetExceeded(preCost, dailyBudget)) {
    tel.budgetExceeded = true;
    log?.warn({ msg: 'ai budget exceeded', route, dayCostUsd: +dayCostUsd.toFixed(6), limit: dailyBudget });
    return finish(null);
  }

  // 2) 异常 / Bot 防护：流量突增即熔断 + 告警，切兜底
  if (detectAnomaly(route)) {
    tel.anomalous = true;
    forceTrip(route);
    log?.warn({ msg: 'ai anomaly trip', route, windowCount: rateWindows.get(route)?.length });
    return finish(null);
  }

  // 3) 熔断：熔断期内直接转兜底，停止消耗 AI 额度
  if (breakerIsOpen(route)) {
    tel.breakerTripped = true;
    log?.warn({ msg: 'ai breaker open', route });
    return finish(null);
  }

  // 4) 分级路由 + 受限重试
  const ai = env.AI as unknown as {
    run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
  };
  let lastErr: string | undefined;

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries && tel.calls < maxCalls; attempt++) {
      tel.calls += 1;
      const t0 = Date.now();
      try {
        const res = await withTimeout(ai.run(model, input as Record<string, unknown>), timeoutMs);
        tel.model = model;
        tel.latencyMs = Date.now() - t0;
        const text =
          typeof (res as { response?: unknown }).response === 'string'
            ? (res as { response: string }).response
            : '';
        tel.estTokens = estimateTokens(input.prompt + text);
        tel.estCostUsd = estimateCost(tel.estTokens, price);
        tel.ok = true;
        recordSuccess(route);
        return finish(res);
      } catch (e) {
        lastErr = e instanceof Error ? `${e.name}:${e.message}` : String(e);
        recordFailure(route);
      }
    }
  }

  tel.error = lastErr;
  log?.error({ msg: 'ai all attempts failed', route, error: lastErr });
  return finish(null);
}
