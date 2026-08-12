/**
 * modules/ai/ai.judge.ts — LLM-as-Judge（确定性数学评分）
 *
 * 原则（自进化架构师硬性要求）：绝对不做主观评分。所有标准都是可计算的。
 * 这里用确定性规则代替「再调一次 AI 来评 AI」（免费套餐下不花第二份钱）。
 * 评分函数同时被：① 线上自检端点（可选）② 离线影子测试脚本 scripts/shadow-test.mjs 复用。
 *
 * 评分维度在代码里显式成点，便于日后调整权重而不动调用方。
 */

/* ============================ study-tip ============================ */

export interface JudgeResult {
  score: number; // 0-100
  pass: boolean; // 是否达到上线/采纳阈值
  reasons: string[]; // 扣分/加分说明，便于调参与审计
}

const STUDY_TIP_PASS = 70;

export function judgeStudyTip(text: string): JudgeResult {
  const reasons: string[] = [];
  let score = 0;

  const cleaned = (text ?? '').replace(/^["'【】\s]+|["'】\s]+$/g, '').trim();
  if (!cleaned) {
    return { score: 0, pass: false, reasons: ['输出为空'] };
  }
  score += 20;
  reasons.push('+20 非空');

  const len = [...cleaned].length;
  if (len <= 40) {
    score += 20;
    reasons.push('+20 长度≤40字（理想区间）');
  } else if (len <= 80) {
    score += 10;
    reasons.push('+10 长度41-80字（偏长）');
  } else {
    reasons.push('-0 长度>80字（超出上限，建议裁剪）');
  }

  const cjk = (cleaned.match(/[一-龥]/g) ?? []).length;
  const cjkRatio = len > 0 ? cjk / len : 0;
  if (cjkRatio >= 0.6) {
    score += 20;
    reasons.push('+20 中文占比≥60%');
  } else if (cjkRatio >= 0.3) {
    score += 10;
    reasons.push('+10 中文占比30-60%');
  } else {
    reasons.push('-0 中文占比过低');
  }

  if (!/[`*#]/.test(cleaned) && !/```/.test(cleaned)) {
    score += 15;
    reasons.push('+15 无 markdown 标记');
  } else {
    reasons.push('-0 含 markdown 标记');
  }

  if (!/^["'「『]/.test(cleaned) && !/[」』"']$/.test(cleaned)) {
    score += 10;
    reasons.push('+10 无包裹引号');
  } else {
    reasons.push('-0 含包裹引号');
  }

  const isAdvice = /(建议|学|练|记|复习|先|可以|试试|每天|重点)/.test(cleaned);
  if (isAdvice) {
    score += 15;
    reasons.push('+15 呈建议/指导语气');
  } else {
    reasons.push('-0 未呈现建议语气');
  }

  return { score: Math.min(100, score), pass: score >= STUDY_TIP_PASS, reasons };
}

/* ============================ explain-word ============================ */

const WORD_PASS = 60;

export function judgeExplainWord(obj: unknown): JudgeResult {
  const reasons: string[] = [];
  let score = 0;
  const o = (obj ?? {}) as Record<string, unknown>;

  const zh = typeof o.zh === 'string' ? o.zh.trim() : '';
  const example = typeof o.example === 'string' ? o.example.trim() : '';
  if (zh || example) {
    score += 40;
    reasons.push('+40 含 zh 或 example（必填项）');
  } else {
    return { score: 0, pass: false, reasons: ['缺失必填项 zh/example'] };
  }

  if (zh && [...zh].length <= 30) {
    score += 20;
    reasons.push('+20 zh 长度≤30字');
  } else if (zh) {
    reasons.push('-0 zh 超长');
  }

  if (example && example.length <= 50) {
    score += 10;
    reasons.push('+10 example 长度≤50字符');
  }

  const category = typeof o.category === 'string' ? o.category.trim() : '';
  if (category && [...category].length <= 8) {
    score += 10;
    reasons.push('+10 category 合规');
  }

  const detail = typeof o.detail === 'string' ? o.detail.trim() : '';
  if (detail && [...detail].length <= 50) {
    score += 10;
    reasons.push('+10 detail 合规');
  }

  if (typeof o.pos === 'string' && o.pos.trim()) {
    score += 10;
    reasons.push('+10 含 pos 词性');
  }

  return { score: Math.min(100, score), pass: score >= WORD_PASS, reasons };
}

/* ============================ 汇总（影子测试用） ============================ */

export interface JudgeSummary {
  total: number;
  passed: number;
  passRate: number; // 0-1
  avgScore: number;
  route: string;
}

export function summarize(route: string, results: JudgeResult[]): JudgeSummary {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const avgScore = total ? results.reduce((s, r) => s + r.score, 0) / total : 0;
  return {
    total,
    passed,
    passRate: total ? passed / total : 0,
    avgScore: Math.round(avgScore * 10) / 10,
    route,
  };
}
