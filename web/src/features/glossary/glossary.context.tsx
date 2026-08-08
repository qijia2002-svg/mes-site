/**
 * 名词上下文（GlossaryProvider）。
 *
 * 一次加载全量词典（useDict 缓存 5 分钟），向前端提供：
 *  - termPattern：用于正文行内术语高亮的正则（按词典词构建，长词优先）。
 *  - lookup(term)：O(1) 查词（大小写归一）。
 *  - explain(term)：本地命中即返；未命中走 AI explain-word 兜底（搜索框用）。
 *
 * 设计约束（P0-3 / 安全）：
 *  - 术语高亮发生在 markdown-it(html:false) + DOMPurify 之后、由前端 JS 注入，
 *    绝不把不可信的 Markdown 当成术语来源，也不在渲染管线里混入词典数据。
 *  - 组件颜色一律 var(--token)，禁硬编码 hex；图标走 Icon 体系，禁 emoji。
 */
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useDict } from '../../lib/dict';
import { api, type DictData, type ExplainWordResult } from '../../api/endpoints';

/** 行内匹配的最小词长：排除单字（如「工」「单」）造成的过度高亮。 */
const MIN_TERM_LEN = 2;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** DictData（含 AI 兜底伪条目）统一视图，供弹卡渲染。 */
export interface GlossaryEntry extends DictData {
  /** typeKey === 'ai' 表示云端未命中、由 Workers AI 生成。 */
  fromAi?: boolean;
}

function explainToEntry(r: ExplainWordResult): GlossaryEntry {
  return {
    id: -1,
    typeKey: 'ai',
    value: r.word,
    pos: r.pos,
    zh: r.zh,
    example: r.example,
    exampleZh: r.exampleZh,
    category: r.category,
    detail: r.detail,
    sort: 0,
    status: 1,
    fromAi: true,
  };
}

interface GlossaryCtx {
  ready: boolean;
  lookup: (term: string) => GlossaryEntry | undefined;
  explain: (term: string) => Promise<GlossaryEntry | null>;
  /** 行内匹配正则；词典为空时为 null（不高亮）。 */
  termPattern: RegExp | null;
}

const Ctx = createContext<GlossaryCtx | null>(null);

function buildIndex(items: DictData[]): { map: Map<string, GlossaryEntry>; pattern: RegExp | null } {
  const map = new Map<string, GlossaryEntry>();
  for (const d of items) map.set(d.value.trim().toLowerCase(), d as GlossaryEntry);

  const vals = items
    .map((d) => d.value.trim())
    .filter((v) => v.length >= MIN_TERM_LEN)
    .sort((a, b) => b.length - a.length); // 长词优先，避免短词先切走

  if (vals.length === 0) return { map, pattern: null };

  const parts = vals.map((v) => {
    const re = escapeRe(v);
    // 纯 ASCII 词包 \b 词边界（避免 SELECT 误中 SELECTED）；
    // 含非 ASCII（中文等）按子串匹配（中文无词边界）。
    return /^[\x00-\x7f]+$/.test(v) ? `\\b${re}\\b` : re;
  });
  const pattern = new RegExp(`(${parts.join('|')})`, 'gi');
  return { map, pattern };
}

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const dictQ = useDict();
  const built = useMemo(() => buildIndex(dictQ.data?.data ?? []), [dictQ.data]);
  // 词典短暂为空/重新拉取时，不要掉回 null 把已注入的高亮拆掉：保留上一次有效结果。
  const lastGood = useRef<{ map: Map<string, GlossaryEntry>; pattern: RegExp | null } | null>(null);
  if (built.pattern && built.map.size > 0) lastGood.current = built;
  const map = built.map.size > 0 ? built.map : (lastGood.current?.map ?? built.map);
  const pattern = built.pattern ?? lastGood.current?.pattern ?? null;

  const lookup = useCallback(
    (term: string): GlossaryEntry | undefined => {
      if (!term) return undefined;
      return map.get(term.trim().toLowerCase());
    },
    [map],
  );

  const explain = useCallback(
    async (term: string): Promise<GlossaryEntry | null> => {
      const clean = term.trim();
      if (!clean) return null;
      const hit = lookup(clean);
      if (hit) return hit; // 本地命中优先，省一次请求
      try {
        const r = await api.explainWord({ word: clean });
        return explainToEntry(r);
      } catch {
        return null;
      }
    },
    [lookup],
  );

  const value = useMemo<GlossaryCtx>(
    () => ({ ready: !dictQ.isLoading, lookup, explain, termPattern: pattern }),
    [dictQ.isLoading, lookup, explain, pattern],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 必须在 GlossaryProvider 内使用（名词弹卡、搜索框调用）。 */
export function useGlossary(): GlossaryCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGlossary 必须在 <GlossaryProvider> 内使用');
  return c;
}

/** 安全版：无 Provider 时返回 null（供 TermAwareHtml 等可能被复用处降级渲染原文）。 */
export function useGlossarySafe(): GlossaryCtx | null {
  return useContext(Ctx);
}
