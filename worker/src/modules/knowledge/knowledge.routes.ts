import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { flowchartRepo } from '../../data/repositories/flowchart.repo';
import { knowledgeRepo, KgFlowNodeRow } from './knowledge.repo';

/**
 * 知识点连线图 API（Obsidian 式）。
 *
 *   GET /api/v1/knowledge-graph?flowId=generic-factory
 *     -> { nodes, links }  整张图：工厂过程节点 + 概念节点 + 工件指认
 *   GET /api/v1/knowledge-graph/concept/:key
 *     -> { concept, backlinks }  某概念的局部图 + 反链清单（点开概念用）
 *
 * 公开读取（无需登录）。
 */

type NodeKind = 'concept' | 'node' | 'explainer' | 'micro' | 'glossary' | 'topic' | 'sql_ex';

export interface KgNode {
  id: string;
  kind: NodeKind;
  label: string;
  degree?: number;
  refId?: number;
  nodeKey?: string;
  definition?: string;
}

export interface KgLink {
  source: string;
  target: string;
  relation: 'process' | 'about';
}

export interface KgBacklink {
  kind: string;
  refId: number;
  title: string;
  nodeKey: string | null;
}

const DEFAULT_FLOW = 'generic-factory';

function groupByType(links: { source_type: string; source_ref: number }[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const l of links) {
    (out[l.source_type] ||= []).push(l.source_ref);
  }
  return out;
}

export async function getKnowledgeGraph(c: Ctx): Promise<Response> {
  const slug = c.url.searchParams.get('flowId') || DEFAULT_FLOW;
  const flow = await flowchartRepo.getBySlug(c.db, slug);
  if (!flow) return fail(c, Err.notFound());

  const [flowNodes, flowEdges, concepts, kgLinks] = await Promise.all([
    knowledgeRepo.getFlowNodes(c.db, flow.id),
    knowledgeRepo.getFlowEdges(c.db, flow.id),
    knowledgeRepo.getConcepts(c.db),
    knowledgeRepo.getLinks(c.db),
  ]);

  const nodeKeyById = new Map<number, string>();
  for (const n of flowNodes) nodeKeyById.set(n.id, n.node_key);

  const nodes: KgNode[] = [];
  const seen = new Set<string>();
  const addNode = (n: KgNode) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  };

  // 1) 工厂过程节点 + process 边
  for (const n of flowNodes) {
    addNode({ id: `node:${n.node_key}`, kind: 'node', label: n.label, nodeKey: n.node_key });
  }
  const outLinks: KgLink[] = [];
  for (const e of flowEdges) {
    outLinks.push({ source: `node:${e.from_key}`, target: `node:${e.to_key}`, relation: 'process' });
  }

  // 2) 概念节点
  const conceptKeyById = new Map<number, string>();
  for (const cst of concepts) {
    addNode({ id: `concept:${cst.key}`, kind: 'concept', label: cst.label, definition: cst.definition ?? undefined });
    conceptKeyById.set(cst.id, cst.key);
  }

  // 3) 工件指认 ->  artifact 节点 + about 边
  const byType = groupByType(kgLinks);
  const [explainers, micros, glossaries, topics, sqlExs] = await Promise.all([
    knowledgeRepo.getExplainersByIds(c.db, byType['explainer'] || []),
    knowledgeRepo.getMicrosByIds(c.db, byType['micro'] || []),
    knowledgeRepo.getGlossaryByIds(c.db, byType['glossary'] || []),
    knowledgeRepo.getTopicsByIds(c.db, byType['topic'] || []),
    knowledgeRepo.getSqlExByIds(c.db, byType['sql_ex'] || []),
  ]);
  const explainerById = new Map(explainers.map((e) => [e.id, e]));
  const microById = new Map(micros.map((m) => [m.id, m]));
  const glossaryById = new Map(glossaries.map((g) => [g.id, g]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const sqlExById = new Map(sqlExs.map((s) => [s.id, s]));

  const degree = new Map<string, number>();

  for (const l of kgLinks) {
    const conceptKey = conceptKeyById.get(l.concept_id);
    if (!conceptKey) continue;
    const target = `concept:${conceptKey}`;

    if (l.source_type === 'node') {
      const nk = nodeKeyById.get(l.source_ref);
      if (!nk) continue;
      outLinks.push({ source: `node:${nk}`, target, relation: 'about' });
      degree.set(target, (degree.get(target) || 0) + 1);
      continue;
    }

    let label = '';
    let nodeKey: string | undefined;
    let useRef = true;
    if (l.source_type === 'explainer') {
      const r = explainerById.get(l.source_ref);
      if (!r) continue;
      label = r.title;
      nodeKey = nodeKeyById.get(r.node_id);
    } else if (l.source_type === 'micro') {
      const r = microById.get(l.source_ref);
      if (!r) continue;
      label = `微练习 #${r.id}`;
      nodeKey = nodeKeyById.get(r.node_id);
    } else if (l.source_type === 'glossary') {
      const r = glossaryById.get(l.source_ref);
      if (!r) continue;
      label = r.value;
    } else if (l.source_type === 'topic') {
      const r = topicById.get(l.source_ref);
      if (!r) continue;
      label = r.title;
    } else if (l.source_type === 'sql_ex') {
      const r = sqlExById.get(l.source_ref);
      if (!r) continue;
      label = r.title;
    } else {
      continue;
    }

    const srcId = `${l.source_type}:${l.source_ref}`;
    addNode({ id: srcId, kind: l.source_type as NodeKind, label, refId: useRef ? l.source_ref : undefined, nodeKey });
    outLinks.push({ source: srcId, target, relation: 'about' });
    degree.set(target, (degree.get(target) || 0) + 1);
  }

  for (const n of nodes) {
    if (n.kind === 'concept' && degree.has(n.id)) n.degree = degree.get(n.id);
  }

  return ok(c, { nodes, links: outLinks });
}

export async function getKnowledgeConcept(c: Ctx): Promise<Response> {
  const key = c.params.key;
  const concept = await knowledgeRepo.getConceptByKey(c.db, key);
  if (!concept) return fail(c, Err.notFound());

  const flow = await flowchartRepo.getBySlug(c.db, DEFAULT_FLOW);
  const flowId = flow ? flow.id : 0;
  const [links, flowNodes] = await Promise.all([
    knowledgeRepo.getLinksForConcept(c.db, concept.id),
    flowId ? knowledgeRepo.getFlowNodes(c.db, flowId) : Promise.resolve([] as KgFlowNodeRow[]),
  ]);
  const nodeKeyById = new Map(flowNodes.map((n) => [n.id, n.node_key]));

  const byType = groupByType(links);
  const [explainers, micros, glossaries, topics, sqlExs] = await Promise.all([
    knowledgeRepo.getExplainersByIds(c.db, byType['explainer'] || []),
    knowledgeRepo.getMicrosByIds(c.db, byType['micro'] || []),
    knowledgeRepo.getGlossaryByIds(c.db, byType['glossary'] || []),
    knowledgeRepo.getTopicsByIds(c.db, byType['topic'] || []),
    knowledgeRepo.getSqlExByIds(c.db, byType['sql_ex'] || []),
  ]);
  const explainerById = new Map(explainers.map((e) => [e.id, e]));
  const microById = new Map(micros.map((m) => [m.id, m]));
  const glossaryById = new Map(glossaries.map((g) => [g.id, g]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const sqlExById = new Map(sqlExs.map((s) => [s.id, s]));

  const backlinks: KgBacklink[] = [];
  for (const l of links) {
    let title = '';
    let nodeKey: string | null = null;
    if (l.source_type === 'explainer') {
      const r = explainerById.get(l.source_ref);
      if (!r) continue;
      title = r.title;
      nodeKey = nodeKeyById.get(r.node_id) ?? null;
    } else if (l.source_type === 'micro') {
      const r = microById.get(l.source_ref);
      if (!r) continue;
      title = `微练习 #${r.id}`;
      nodeKey = nodeKeyById.get(r.node_id) ?? null;
    } else if (l.source_type === 'glossary') {
      const r = glossaryById.get(l.source_ref);
      if (!r) continue;
      title = r.value;
    } else if (l.source_type === 'topic') {
      const r = topicById.get(l.source_ref);
      if (!r) continue;
      title = r.title;
    } else if (l.source_type === 'sql_ex') {
      const r = sqlExById.get(l.source_ref);
      if (!r) continue;
      title = r.title;
    } else if (l.source_type === 'node') {
      const nk = nodeKeyById.get(l.source_ref);
      if (!nk) continue;
      title = nk;
      nodeKey = nk;
    } else {
      continue;
    }
    backlinks.push({ kind: l.source_type, refId: l.source_ref, title, nodeKey });
  }

  return ok(c, {
    concept: { key: concept.key, label: concept.label, definition: concept.definition ?? '', zeroBasisDef: concept.zero_basis_def ?? '' },
    backlinks,
  });
}
