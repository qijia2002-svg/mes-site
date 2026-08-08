import type { DbSession } from '../db';

/** 工厂流程图仓储（factory-first 导航主干）。 */

export interface FlowchartRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  status: string;
  sort: number;
  created_at: number;
  updated_at: number;
}

export interface FlowNodeRow {
  id: number;
  flow_id: number;
  node_key: string;
  label: string;
  kind: string;
  icon: string;
  x: number;
  y: number;
  description: string;
  sort: number;
  /** 归属 6 站主线（learn-redesign 迁移增列，默认 '' = 未分配）。 */
  stage_key: string;
  /** 大白话一句话（learn-redesign 迁移增列）。 */
  one_liner: string;
}

export interface FlowStageRow {
  id: number;
  flow_id: number;
  stage_key: string;
  title: string;
  subtitle: string;
  goal: string;
  icon: string;
  /** JSON 数组字符串：本阶段计入完成度分母的实战类型（BLOCK-02）。 */
  practice_types: string;
  sort: number;
}

export interface FlowEdgeRow {
  id: number;
  flow_id: number;
  from_key: string;
  to_key: string;
  label: string;
}

export interface NodeResourceRow {
  id: number;
  node_id: number;
  res_type: string;
  ref_id: number;
  title: string;
  sort: number;
}

export const flowchartRepo = {
  /** 按 slug 取一套流程图（导航主干）。 */
  getBySlug(db: DbSession, slug: string): Promise<FlowchartRow | null> {
    return db.first<FlowchartRow>(`SELECT * FROM flowcharts WHERE slug = ?1`, slug);
  },

  listNodes(db: DbSession, flowId: number): Promise<FlowNodeRow[]> {
    return db.all<FlowNodeRow>(
      `SELECT id, flow_id, node_key, label, kind, icon, x, y, description, sort, stage_key, one_liner
       FROM flow_nodes WHERE flow_id = ?1 ORDER BY sort ASC, id ASC`,
      flowId,
    );
  },

  /** 6 站主线阶段（flow_stages），按 sort 升序。空表 → 前端回落现有全景。 */
  listStages(db: DbSession, flowId: number): Promise<FlowStageRow[]> {
    return db.all<FlowStageRow>(
      `SELECT id, flow_id, stage_key, title, subtitle, goal, icon, practice_types, sort
       FROM flow_stages WHERE flow_id = ?1 ORDER BY sort ASC, id ASC`,
      flowId,
    );
  },

  listEdges(db: DbSession, flowId: number): Promise<FlowEdgeRow[]> {
    return db.all<FlowEdgeRow>(
      `SELECT id, flow_id, from_key, to_key, label FROM flow_edges WHERE flow_id = ?1`,
      flowId,
    );
  },

  /** 一次性取多节点的挂载资源（节点数少，IN 查询可接受）。 */
  listResources(db: DbSession, nodeIds: number[]): Promise<NodeResourceRow[]> {
    if (!nodeIds.length) return Promise.resolve([]);
    const placeholders = nodeIds.map(() => '?').join(',');
    return db.all<NodeResourceRow>(
      `SELECT id, node_id, res_type, ref_id, title, sort
       FROM node_resources WHERE node_id IN (${placeholders}) ORDER BY node_id ASC, sort ASC`,
      ...nodeIds,
    );
  },
};
