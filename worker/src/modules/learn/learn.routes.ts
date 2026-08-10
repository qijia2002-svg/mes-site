import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import * as svc from './learn.service';

/**
 * 零基础重学 v1 —— 微练习端点（SQL 前那级台阶，计入完成度）。
 *
 *   GET  /api/v1/micro-practices/:id        -> 题面（不含答案）
 *   POST /api/v1/micro-practices/:id/grade  -> 服务端判分，只回 correct + feedback
 *
 * 判分只在服务端做：answer 留库里，前端只提交作答、只收对错与反馈，
 * 绝不在前端比对答案（答案出网 = 判题基准失效）。
 * 公开读取/提交（noAuth）：练习不要求登录，匿名也能练。
 */
export async function getMicroPractice(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getMicroSvc(c, id);
  if (!d) return fail(c, Err.notFound());
  return ok(c, d);
}

export async function gradeMicroPractice(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const answer = body.answer as svc.MicroAnswer | undefined;
  if (answer === undefined || answer === null) return fail(c, Err.paramMissing());
  const result = await svc.gradeMicroSvc(c, id, answer as svc.MicroAnswer);
  return ok(c, result);
}

/**
 * 查询串里的整数参数。
 *
 * 不能直接 Number(searchParams.get(x))：参数缺失时 get() 回 null，Number(null) === 0，
 * Number.isInteger(0) 为真——漏参会被当成 id=0 放行，静默查一个不存在的节点回空数组，
 * 前端只看到「没内容」，永远不知道自己少传了参数。空串同理（Number('') === 0）。
 */
function intParam(c: Ctx, name: string): number | null {
  const raw = c.url.searchParams.get(name);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

const TIERS = ['overview', 'detail'] as const;
const HINT_TARGET_TYPES = ['quiz', 'sql', 'sim', 'micro'] as const;

/**
 * GET /api/v1/node-explainers?node_id=&tier= —— 节点进阶详解列表（公开读）。
 *
 * node_id 必填整数；tier 可选，给了就必须是 overview | detail。
 * 返回 { items: [] }（可为空数组，生产 D1 当前 0 行，空不是错误）。
 */
export async function getNodeExplainers(c: Ctx): Promise<Response> {
  const nodeId = intParam(c, 'node_id');
  if (nodeId === null) return fail(c, Err.paramMissing());

  const rawTier = c.url.searchParams.get('tier');
  let tier: svc.ExplainerTier | undefined;
  if (rawTier !== null && rawTier !== '') {
    if (!(TIERS as readonly string[]).includes(rawTier)) return fail(c, Err.schemaRejected('tier'));
    tier = rawTier as svc.ExplainerTier;
  }

  const items = await svc.listNodeExplainersSvc(c, nodeId, tier);
  return ok(c, { items });
}

/**
 * GET /api/v1/practice-hints?target_type=&target_id=&level= —— 单条分级提示（公开读）。
 *
 * 三个参数全必填。命中返回单个对象（不是数组），未命中 404。
 * 一次只回一个 level 的正文；下一级只以 hasNext 布尔体现（ADR-019 防剧透）。
 */
export async function getPracticeHint(c: Ctx): Promise<Response> {
  const rawType = c.url.searchParams.get('target_type');
  if (rawType === null || !(HINT_TARGET_TYPES as readonly string[]).includes(rawType)) {
    return fail(c, Err.schemaRejected('target_type'));
  }
  const targetType = rawType as svc.HintTargetType;

  const targetId = intParam(c, 'target_id');
  if (targetId === null) return fail(c, Err.paramMissing());

  const rawLevel = intParam(c, 'level');
  if (rawLevel !== 1 && rawLevel !== 2 && rawLevel !== 3) return fail(c, Err.schemaRejected('level'));
  const level: svc.HintLevel = rawLevel;

  const d = await svc.getPracticeHintSvc(c, targetType, targetId, level);
  if (!d) return fail(c, Err.notFound());
  return ok(c, d);
}
