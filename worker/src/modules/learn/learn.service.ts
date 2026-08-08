import type { Ctx } from '../../core/context';
import { Err } from '../../core/errors';
import { learnRepo } from './learn.repo';

/** 微练习提交作答。match 为 { 左id: 右id }；order / pick 为有序 id 数组。 */
export type MicroAnswer = Record<string, string> | string[];

export interface MicroPracticeDTO {
  id: number;
  nodeId: number;
  kind: 'match' | 'order' | 'pick';
  prompt: string;
  /** 题面素材（选项/配对候选/排序项），不含答案。 */
  payload: unknown;
}

export interface MicroGradeResult {
  correct: boolean;
  feedback: string;
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** 单条微练习详情（不含 answer），payload 已解析为对象。 */
export async function getMicroSvc(c: Ctx, id: number): Promise<MicroPracticeDTO | null> {
  const r = await learnRepo.getMicro(c.db, id);
  if (!r) return null;
  const kind = r.kind === 'order' || r.kind === 'pick' || r.kind === 'match' ? r.kind : 'pick';
  return {
    id: r.id,
    nodeId: r.node_id,
    kind,
    prompt: r.prompt,
    payload: parseJson(r.payload) ?? {},
  };
}

/** 两个字符串数组是否作为无序集合相等（长度 + 元素一致，与顺序无关）。 */
function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

/**
 * 服务端判分：比对用户作答与库内 answer（answer 永不出网）。
 *
 * 三种 kind 的判定：
 *  - order：严格有序比对（用户数组逐项等于正确数组）。
 *  - match：用户提交 { 左id: 右id }，转为 "左=>右" 集合后与正确集合比对（顺序无关）。
 *  - pick ：用户提交选中 id 数组，作为集合与正确集合比对（顺序无关）。
 *
 * 答错返回 feedback_bad（只给方向，不给答案）；答对返回 feedback_ok。
 * stored answer 解析失败或形状异常 → 判错并回 feedback_bad，绝不抛 500 把学员卡死。
 */
export async function gradeMicroSvc(c: Ctx, id: number, userAnswer: MicroAnswer): Promise<MicroGradeResult> {
  const r = await learnRepo.getMicroAnswer(c.db, id);
  if (!r) throw Err.notFound();

  const correct = parseJson(r.answer);
  if (!Array.isArray(correct)) {
    return { correct: false, feedback: r.feedback_bad };
  }
  const correctArr = (correct as unknown[]).map(String);

  let ok: boolean;
  if (r.kind === 'order') {
    const userArr = Array.isArray(userAnswer) ? userAnswer.map(String) : [];
    ok = userArr.length === correctArr.length && userArr.every((v, i) => v === correctArr[i]);
  } else if (r.kind === 'match') {
    if (Array.isArray(userAnswer)) {
      ok = false;
    } else {
      const userArr = Object.entries(userAnswer as Record<string, string>).map(([k, v]) => `${k}=>${v}`);
      ok = setsEqual(userArr, correctArr);
    }
  } else {
    // pick：集合比对，顺序无关
    const userArr = Array.isArray(userAnswer) ? userAnswer.map(String) : [];
    ok = setsEqual(userArr, correctArr);
  }

  return ok
    ? { correct: true, feedback: r.feedback_ok }
    : { correct: false, feedback: r.feedback_bad };
}
