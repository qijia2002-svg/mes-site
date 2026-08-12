import type { DbSession } from '../../data/db';

/** 知识点连线图（Obsidian 式）· 概念连接层仓储。 */

export interface KgConceptRow {
  id: number;
  key: string;
  label: string;
  definition: string | null;
  topic_id: number | null;
}

export interface KgLinkRow {
  id: number;
  concept_id: number;
  source_type: string;
  source_ref: number;
  relation: string;
  weight: number;
}

export interface KgFlowNodeRow {
  id: number;
  node_key: string;
  label: string;
  kind: string;
}

export interface KgFlowEdgeRow {
  from_key: string;
  to_key: string;
  label: string;
}

function inPlaceholders(ids: number[]): string {
  return ids.map(() => '?').join(',');
}

export const knowledgeRepo = {
  getConcepts(db: DbSession): Promise<KgConceptRow[]> {
    return db.all<KgConceptRow>(
      `SELECT id, key, label, definition, topic_id FROM concepts ORDER BY sort, id`,
    );
  },

  getLinks(db: DbSession): Promise<KgLinkRow[]> {
    return db.all<KgLinkRow>(
      `SELECT id, concept_id, source_type, source_ref, relation, weight FROM knowledge_links`,
    );
  },

  getFlowNodes(db: DbSession, flowId: number): Promise<KgFlowNodeRow[]> {
    return db.all<KgFlowNodeRow>(
      `SELECT id, node_key, label, kind FROM flow_nodes WHERE flow_id = ?1 ORDER BY id`,
      flowId,
    );
  },

  getFlowEdges(db: DbSession, flowId: number): Promise<KgFlowEdgeRow[]> {
    return db.all<KgFlowEdgeRow>(
      `SELECT from_key, to_key, label FROM flow_edges WHERE flow_id = ?1`,
      flowId,
    );
  },

  getExplainersByIds(db: DbSession, ids: number[]): Promise<{ id: number; title: string; node_id: number }[]> {
    if (!ids.length) return Promise.resolve([]);
    return db.all(
      `SELECT id, title, node_id FROM node_explainers WHERE id IN (${inPlaceholders(ids)})`,
      ...ids,
    );
  },

  getMicrosByIds(db: DbSession, ids: number[]): Promise<{ id: number; node_id: number }[]> {
    if (!ids.length) return Promise.resolve([]);
    return db.all(
      `SELECT id, node_id FROM micro_practices WHERE id IN (${inPlaceholders(ids)})`,
      ...ids,
    );
  },

  getGlossaryByIds(db: DbSession, ids: number[]): Promise<{ id: number; value: string }[]> {
    if (!ids.length) return Promise.resolve([]);
    return db.all(
      `SELECT id, value FROM dict_data WHERE id IN (${inPlaceholders(ids)})`,
      ...ids,
    );
  },

  getTopicsByIds(db: DbSession, ids: number[]): Promise<{ id: number; title: string }[]> {
    if (!ids.length) return Promise.resolve([]);
    return db.all(
      `SELECT id, title FROM topics WHERE id IN (${inPlaceholders(ids)})`,
      ...ids,
    );
  },

  getSqlExByIds(db: DbSession, ids: number[]): Promise<{ id: number; title: string }[]> {
    if (!ids.length) return Promise.resolve([]);
    return db.all(
      `SELECT id, title FROM sql_exercises WHERE id IN (${inPlaceholders(ids)})`,
      ...ids,
    );
  },

  getConceptByKey(db: DbSession, key: string): Promise<KgConceptRow | null> {
    return db.first<KgConceptRow>(
      `SELECT id, key, label, definition, topic_id FROM concepts WHERE key = ?1`,
      key,
    );
  },

  getLinksForConcept(db: DbSession, conceptId: number): Promise<KgLinkRow[]> {
    return db.all<KgLinkRow>(
      `SELECT id, concept_id, source_type, source_ref, relation, weight
       FROM knowledge_links WHERE concept_id = ?1`,
      conceptId,
    );
  },
};
