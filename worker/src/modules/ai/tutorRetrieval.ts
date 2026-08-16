import type { DbSession } from '../../data/db';
import { dictRepo } from '../../data/repositories/dict.repo';
import { knowledgeRepo } from '../knowledge/knowledge.repo';

/**
 * 导师 RAG 接地（轻量、无向量库）
 *
 * 思路：把学员当前问题（含 topic / term）转成若干检索词，对 D1 中已沉淀的
 * 站点知识做 LIKE 检索——术语表(dict_data) / 知识图概念(concepts) / 节点讲解
 * (node_explainers)——把命中片段作为「参考资料」喂给 LLM，让它基于站内知识作答，
 * 而非凭空编。规模小（70 概念 + 几百词条），LIKE + 关键词命中足够，零新基础设施。
 *
 * 返回两层结构：
 *  - references：已格式化的参考文本数组，拼进 prompt 要求模型标注 [n] 引用；
 *  - sources：结构化来源（类型 + id + 文案 + 跳转链接），供前端「来源面板」展示。
 */

export type TutorSourceType = 'glossary' | 'concept' | 'explainer' | 'topic' | 'micro';

export interface TutorSource {
  type: TutorSourceType;
  id: number;
  label: string;
  href?: string;
}

export interface RetrievedItem {
  source: TutorSource;
  text: string;
}

export interface RetrieveInput {
  message: string;
  term?: string;
  topic?: string;
}

function likePattern(s: string): string {
  // 防 LIKE 注入：转义 % _ ；截断避免超长模式
  return `%${s.replace(/[%/_]/g, '\\$&').slice(0, 24)}%`;
}

function hrefFor(type: TutorSourceType, id: number, label: string): string {
  switch (type) {
    case 'glossary':
      return '/dictionary';
    case 'concept':
      return '/knowledge-graph';
    case 'explainer':
      return '/courses';
    default:
      return '/';
  }
}

export async function retrieveTutorSources(
  db: DbSession,
  input: RetrieveInput,
): Promise<{ references: string[]; sources: TutorSource[] }> {
  const references: string[] = [];
  const sources: TutorSource[] = [];
  const seen = new Set<string>();
  const MAX = 10;

  const push = (s: TutorSource, text: string) => {
    if (sources.length >= MAX) return;
    const k = `${s.type}:${s.id}`;
    if (seen.has(k)) return;
    seen.add(k);
    sources.push(s);
    references.push(text);
  };

  // 1) 收集检索词：term / topic（结构化，最可靠）+ 消息中的拉丁缩写 + 中文短语兜底
  const queries = new Set<string>();
  if (input.term) queries.add(input.term);
  if (input.topic) queries.add(input.topic);
  for (const m of input.message.match(/[A-Za-z]{2,}/g) ?? []) queries.add(m.toUpperCase());
  const cn = input.message.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 12);
  if (cn.length >= 2) queries.add(cn);
  // 控制检索规模：最多取 6 个检索词
  const terms = [...queries].slice(0, 6);

  // 2) 术语表（dict_data）：精确 + LIKE，覆盖行业缩写与中文释义
  const dictHits = new Map<number, any>();
  if (input.term) {
    const exact = await dictRepo.findByValue(db, input.term).catch(() => null);
    if (exact) dictHits.set(exact.id, exact);
  }
  for (const q of terms) {
    const rows = await db
      .all<any>(
        `SELECT id, type_key, value, zh, example, example_zh, category, detail
         FROM dict_data WHERE value LIKE ?1 OR zh LIKE ?1 OR detail LIKE ?1 OR example LIKE ?1
         LIMIT 6`,
        likePattern(q),
      )
      .catch(() => []);
    for (const r of rows) dictHits.set(r.id, r);
  }
  for (const d of dictHits.values()) {
    const parts = [`【术语 ${d.value || d.zh || '词条'}】`];
    if (d.zh) parts.push(d.zh);
    if (d.detail) parts.push(`释义：${d.detail}`);
    if (d.example) parts.push(`例句：${d.example}${d.example_zh ? `（${d.example_zh}）` : ''}`);
    push(
      { type: 'glossary', id: d.id, label: d.value || d.zh || '词条', href: hrefFor('glossary', d.id, d.value) },
      parts.join(' '),
    );
  }

  // 3) 知识图概念（concepts）：topic 精确 + LIKE，给出零基础定义
  const conceptHits = new Map<number, any>();
  if (input.topic) {
    const c = await knowledgeRepo
      .getConceptByKey(db, input.topic.toLowerCase())
      .catch(() => null);
    if (c) conceptHits.set(c.id, c);
  }
  for (const q of terms) {
    const rows = await db
      .all<any>(
        `SELECT id, key, label, definition, zero_basis_def FROM concepts
         WHERE label LIKE ?1 OR key LIKE ?1 OR definition LIKE ?1 OR zero_basis_def LIKE ?1
         LIMIT 5`,
        likePattern(q),
      )
      .catch(() => []);
    for (const r of rows) conceptHits.set(r.id, r);
  }
  for (const c of conceptHits.values()) {
    const def = c.zero_basis_def || c.definition || '';
    push(
      {
        type: 'concept',
        id: c.id,
        label: c.label || c.key,
        href: hrefFor('concept', c.id, c.label || c.key),
      },
      `【概念 ${c.label || c.key}】${def}`,
    );
  }

  // 4) 节点讲解（node_explainers）：标题/正文 LIKE，给出现成讲解入口
  for (const q of terms) {
    const rows = await db
      .all<any>(
        `SELECT id, title, node_id FROM node_explainers
         WHERE title LIKE ?1 OR body_md LIKE ?1 LIMIT 3`,
        likePattern(q),
      )
      .catch(() => []);
    for (const e of rows) {
      push(
        { type: 'explainer', id: e.id, label: e.title || '讲解', href: hrefFor('explainer', e.id, e.title) },
        `【讲解 ${e.title || '节点讲解'}】`,
      );
    }
  }

  return { references, sources };
}
