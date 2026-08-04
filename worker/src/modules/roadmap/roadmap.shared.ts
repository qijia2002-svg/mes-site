import type { Ctx } from '../../core/context';
import { cachedJson, contentCacheKey } from '../../core/cache';

/**
 * 职业路线图共享纯函数：L2 缓存键（content_version）、JSON 解析、进度计算、深拷贝。
 * 无业务 DTO 逻辑，供 roadmap.service / roadmap.graph 共用，避免单文件超 300 行门禁。
 */

let cvCache: { v: number; exp: number } | null = null;
export async function getContentVersion(c: Ctx): Promise<number> {
  const now = Date.now();
  if (cvCache && cvCache.exp > now) return cvCache.v;
  const row = await c.db.first<{ v: number }>(
    `SELECT CAST(value AS INTEGER) AS v FROM platform_config WHERE key = 'content_version'`,
  );
  cvCache = { v: row?.v ?? 1, exp: now + 60_000 };
  return cvCache.v;
}

export { cachedJson, contentCacheKey };

const IMP_RANK: Record<string, number> = { core: 3, important: 2, optional: 1 };
export function maxImportance(a: string, b: string): string {
  return (IMP_RANK[a] ?? 0) >= (IMP_RANK[b] ?? 0) ? a : b;
}

/** 解析 JSON 字符串列 → string[]；失败降级为 []，绝不抛异常（照 lp.service.parseIds） */
export function parseStrArray(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** planned_chapters：[{title, desc}]；解析失败降级 [] */
export function parsePlanned(s: unknown): { title: string; desc: string }[] {
  if (typeof s !== 'string') return [];
  try {
    const a = JSON.parse(s);
    if (!Array.isArray(a)) return [];
    return a
      .filter((x): x is { title?: unknown; desc?: unknown } => x && typeof x === 'object')
      .map((x) => ({ title: typeof x.title === 'string' ? x.title : '', desc: typeof x.desc === 'string' ? x.desc : '' }))
      .filter((x) => x.title !== '');
  } catch {
    return [];
  }
}

export type ProgressState = 'planned' | 'not_started' | 'in_progress' | 'completed';
export interface Progress {
  done: number;
  total: number;
  percent: number;
  state: ProgressState;
}

export function buildProgress(done: number, total: number): Progress {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  let state: ProgressState;
  if (total === 0) state = 'planned';
  else if (done === 0) state = 'not_started';
  else if (done >= total) state = 'completed';
  else state = 'in_progress';
  return { done, total, percent, state };
}

/** 深拷贝骨架，避免把 A 的进度写进被 B 复用的缓存对象（API §5） */
export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}
