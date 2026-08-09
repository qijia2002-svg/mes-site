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

/** 题面素材里的一项。前端 MicroPractice.tsx 只认这两个字段。 */
interface MicroItem {
  id: string;
  text: string;
}

/**
 * 把一项素材归一成 { id, text }。
 *
 * 库里躺着三种写法：早期种子写的裸字符串、通用工厂 12 个节点写的 { key, label }、
 * 以及现在约定的 { id, text }。前端只读 id / text，字段对不上时选项会渲染成一片空白，
 * 学员看到四个空按钮——不报错，纯静默失效。
 *
 * 这里只换字段名，不动值：answer 比对的是 id（或裸字符串本身），值一变判分就全错了。
 */
function toMicroItem(raw: unknown): MicroItem | null {
  if (typeof raw === 'string') return { id: raw, text: raw };
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.key ?? o.value;
  if (idRaw === null || idRaw === undefined) return null;
  const textRaw = o.text ?? o.label ?? o.title ?? idRaw;
  return { id: String(idRaw), text: String(textRaw) };
}

/** 整数组都能归一才替换，有一项认不出就整组维持原样，宁可不改也不改坏。 */
function toMicroItems(raw: unknown): MicroItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MicroItem[] = [];
  for (const item of raw) {
    const one = toMicroItem(item);
    if (!one) return null;
    out.push(one);
  }
  return out;
}

/** 归一化 payload，只碰 options / items / left / right 这四个已知字段。 */
function normalizeMicroPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw ?? {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  for (const key of ['options', 'items', 'left', 'right'] as const) {
    const items = toMicroItems(src[key]);
    if (items) out[key] = items;
  }
  return out;
}

/** 单条微练习详情（不含 answer），payload 已解析并归一为 { id, text }。 */
export async function getMicroSvc(c: Ctx, id: number): Promise<MicroPracticeDTO | null> {
  const r = await learnRepo.getMicro(c.db, id);
  if (!r) return null;
  const kind = r.kind === 'order' || r.kind === 'pick' || r.kind === 'match' ? r.kind : 'pick';
  return {
    id: r.id,
    nodeId: r.node_id,
    kind,
    prompt: r.prompt,
    payload: normalizeMicroPayload(parseJson(r.payload)),
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
