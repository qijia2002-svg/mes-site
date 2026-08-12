#!/usr/bin/env node
/**
 * scripts/shadow-test.mjs — AI 模型影子测试（Shadow Traffic）离线评估器
 *
 * 作用（自进化架构师 Phase 3/4）：
 *   把生产真实请求取样后，用「候选模型」与「当前基线模型」分别产出输出，
 *   经确定性 LLM-as-Judge 评分，对比通过率 / 平均分 / 估算成本，
 *   产出「是否将路由权重升级到候选模型」的结论。全程不干扰线上。
 *
 * 用法：
 *   1) 采集样本：用 `wrangler tail` 或日志把真实 prompt + 两模型输出落盘为 JSON：
 *      [{ "route": "ai:study-tip", "output": "一句话建议...", "model": "@cf/meta/llama-3.2-3b-instruct", "pricePer1M": 0.01 }, ...]
 *      explain-word 的 output 为对象或 JSON 字符串。
 *   2) 运行：
 *      node scripts/shadow-test.mjs --baseline samples/baseline.json --candidate samples/candidate.json
 *   无参数则跑内置 DEMO，演示报告格式。
 *
 * 依赖：无（仅 Node 内置）。评分逻辑与 worker/src/modules/ai/ai.judge.ts 保持一致。
 */

import { readFileSync } from 'node:fs';

/* ---------- 确定性判官（与 ai.judge.ts 同口径） ---------- */

function estimateTokens(text) {
  const cjk = (text.match(/[一-龥]/g) || []).length;
  const words = (text.match(/[A-Za-z]+/g) || []).length;
  return Math.ceil(cjk * 1.5 + words * 1.3 + 8);
}
function estimateCost(tokens, pricePer1M) {
  return (tokens / 1_000_000) * (pricePer1M ?? 0.01);
}

function judgeStudyTip(text) {
  const reasons = [];
  let score = 0;
  const cleaned = (text ?? '').replace(/^["'【】\s]+|["'】\s]+$/g, '').trim();
  if (!cleaned) return { score: 0, pass: false, reasons: ['输出为空'] };
  score += 20; reasons.push('+20 非空');
  const len = [...cleaned].length;
  if (len <= 40) { score += 20; reasons.push('+20 长度≤40'); }
  else if (len <= 80) { score += 10; reasons.push('+10 长度41-80'); }
  const cjk = (cleaned.match(/[一-龥]/g) || []).length;
  const r = len ? cjk / len : 0;
  if (r >= 0.6) { score += 20; reasons.push('+20 中文≥60%'); }
  else if (r >= 0.3) { score += 10; reasons.push('+10 中文30-60%'); }
  if (!/[`*#]/.test(cleaned)) { score += 15; reasons.push('+15 无markdown'); }
  if (!/^["'「『]/.test(cleaned) && !/[」』"']$/.test(cleaned)) { score += 10; reasons.push('+10 无引号'); }
  if (/(建议|学|练|记|复习|先|可以|试试|每天|重点)/.test(cleaned)) { score += 15; reasons.push('+15 建议语气'); }
  return { score: Math.min(100, score), pass: score >= 70, reasons };
}

function judgeExplainWord(obj) {
  const reasons = [];
  let score = 0;
  const o = obj || {};
  const zh = typeof o.zh === 'string' ? o.zh.trim() : '';
  const example = typeof o.example === 'string' ? o.example.trim() : '';
  if (zh || example) { score += 40; reasons.push('+40 含zh/example'); }
  else return { score: 0, pass: false, reasons: ['缺失zh/example'] };
  if (zh && [...zh].length <= 30) { score += 20; reasons.push('+20 zh≤30'); }
  if (example && example.length <= 50) { score += 10; reasons.push('+10 example≤50'); }
  const cat = typeof o.category === 'string' ? o.category.trim() : '';
  if (cat && [...cat].length <= 8) { score += 10; reasons.push('+10 category'); }
  const d = typeof o.detail === 'string' ? o.detail.trim() : '';
  if (d && [...d].length <= 50) { score += 10; reasons.push('+10 detail'); }
  if (typeof o.pos === 'string' && o.pos.trim()) { score += 10; reasons.push('+10 pos'); }
  return { score: Math.min(100, score), pass: score >= 60, reasons };
}

function judgeRoute(route, output) {
  if (route === 'ai:study-tip') return judgeStudyTip(typeof output === 'string' ? output : '');
  if (route === 'ai:explain-word') {
    if (typeof output === 'string') {
      try { return judgeExplainWord(JSON.parse(output)); } catch { return { score: 0, pass: false, reasons: ['JSON解析失败'] }; }
    }
    return judgeExplainWord(output);
  }
  return { score: 0, pass: false, reasons: [`未知路由 ${route}`] };
}

/* ---------- 汇总 + 对比 ---------- */

function summarize(route, samples) {
  const results = samples.map((s) => judgeRoute(route, s.output));
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const avg = total ? results.reduce((s, r) => s + r.score, 0) / total : 0;
  const price = samples[0]?.pricePer1M ?? 0.01;
  const avgTok = total
    ? samples.reduce((s, x) => s + estimateTokens(typeof x.output === 'string' ? x.output : JSON.stringify(x.output)), 0) / total
    : 0;
  return {
    route,
    total,
    passed,
    passRate: total ? passed / total : 0,
    avgScore: Math.round(avg * 10) / 10,
    estCostPerCall: +estimateCost(avgTok, price).toFixed(8),
    model: samples[0]?.model ?? 'unknown',
  };
}

function recommend(base, cand) {
  const betterQuality = cand.passRate >= base.passRate - 0.02 && cand.avgScore >= base.avgScore - 2;
  const cheaper = cand.estCostPerCall <= base.estCostPerCall + 1e-9;
  if (betterQuality && cheaper) {
    const saving = base.estCostPerCall > 0 ? ((1 - cand.estCostPerCall / base.estCostPerCall) * 100).toFixed(1) : '0.0';
    return `✅ 建议升级：候选在质量持平/更优下成本更低（约省 ${saving}%），把路由权重切到 ${cand.model}。`;
  }
  if (betterQuality && !cheaper) {
    return `⚠️ 候选质量更优但更贵，需业务权衡是否值得（${base.model} → ${cand.model}）。`;
  }
  return `❌ 维持基线：候选质量未达阈值，不升级路由（${base.model} 保持不变）。`;
}

/* ---------- 内置 DEMO ---------- */

const DEMO_BASE = [
  { route: 'ai:study-tip', output: '每天固定时段学一章，比突击更高效。', model: '@cf/meta/llama-3.2-3b-instruct', pricePer1M: 0.01 },
  { route: 'ai:study-tip', output: '建议把刚学的工序画成流程图，记得更牢。', model: '@cf/meta/llama-3.2-3b-instruct', pricePer1M: 0.01 },
  { route: 'ai:explain-word', output: { pos: 'v.', zh: '从数据库中查询数据', example: 'SELECT * FROM t', exampleZh: '查询所有', category: '查询', detail: 'SELECT 是查询关键字' }, model: '@cf/meta/llama-3.2-3b-instruct', pricePer1M: 0.01 },
  { route: 'ai:explain-word', output: { zh: '制造执行系统', category: '制造' }, model: '@cf/meta/llama-3.2-3b-instruct', pricePer1M: 0.01 },
];
const DEMO_CAND = [
  { route: 'ai:study-tip', output: '建议每天学一章，比突击高效。', model: '@cf/meta/llama-3.1-8b-instruct', pricePer1M: 0.02 },
  { route: 'ai:study-tip', output: '把刚学的工序画成流程图，记得更牢。', model: '@cf/meta/llama-3.1-8b-instruct', pricePer1M: 0.02 },
  { route: 'ai:explain-word', output: { pos: 'v.', zh: '从数据库查询数据', example: 'SELECT * FROM t', exampleZh: '查询全部', category: '查询', detail: 'SELECT 用于查询' }, model: '@cf/meta/llama-3.1-8b-instruct', pricePer1M: 0.02 },
  { route: 'ai:explain-word', output: { zh: '制造执行系统', category: '制造' }, model: '@cf/meta/llama-3.1-8b-instruct', pricePer1M: 0.02 },
];

/* ---------- 主流程 ---------- */

function loadArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const bFile = loadArg('--baseline');
  const cFile = loadArg('--candidate');
  const base = bFile ? JSON.parse(readFileSync(bFile, 'utf8')) : DEMO_BASE;
  const cand = cFile ? JSON.parse(readFileSync(cFile, 'utf8')) : DEMO_CAND;

  const routes = [...new Set([...base, ...cand].map((s) => s.route))];
  console.log('=== AI 影子测试报告 ===');
  for (const route of routes) {
    const b = base.filter((s) => s.route === route);
    const c = cand.filter((s) => s.route === route);
    if (!b.length || !c.length) {
      console.log(`\n[${route}] 跳过：基线或候选样本缺失`);
      continue;
    }
    const sb = summarize(route, b);
    const sc = summarize(route, c);
    console.log(`\n[${route}]`);
    console.log('  基线  ', sb.model, `通过率 ${(sb.passRate * 100).toFixed(0)}% / 均分 ${sb.avgScore} / 单call≈$${sb.estCostPerCall}`);
    console.log('  候选  ', sc.model, `通过率 ${(sc.passRate * 100).toFixed(0)}% / 均分 ${sc.avgScore} / 单call≈$${sc.estCostPerCall}`);
    console.log('  结论  ', recommend(sb, sc));
  }
}

main();
