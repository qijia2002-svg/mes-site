import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { flowchartRepo } from '../../data/repositories/flowchart.repo';

/** practice_types 是 JSON 数组字符串，容错解析；异常/空 → 空数组（前端回落全集）。 */
function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * 工厂流程图 API（factory-first 导航主干）。
 *
 *   GET /api/v1/flowchart/:slug -> { flow, stages, nodes, edges, resources }
 *
 * 公开读取（无需登录）：流程图是导航骨架，匿名用户也要能逛。
 */
export async function getFlowchart(c: Ctx): Promise<Response> {
  const slug = c.params.slug;
  if (!slug) return fail(c, Err.paramMissing());

  const flow = await flowchartRepo.getBySlug(c.db, slug);
  if (!flow) return fail(c, Err.notFound());

  const [nodes, edges, stages] = await Promise.all([
    flowchartRepo.listNodes(c.db, flow.id),
    flowchartRepo.listEdges(c.db, flow.id),
    flowchartRepo.listStages(c.db, flow.id),
  ]);
  const resources = await flowchartRepo.listResources(
    c.db,
    nodes.map((n) => n.id),
  );

  return ok(c, {
    flow: {
      id: flow.id,
      slug: flow.slug,
      title: flow.title,
      description: flow.description,
      status: flow.status,
    },
    /** 6 站主线（flow_stages）。缺失时前端回落静态 DEFAULT_STAGES。 */
    stages: stages.map((s) => ({
      stageKey: s.stage_key,
      title: s.title,
      subtitle: s.subtitle,
      goal: s.goal,
      icon: s.icon,
      practiceTypes: parseJsonArray(s.practice_types),
      sort: s.sort,
    })),
    nodes: nodes.map((n) => ({
      id: n.id,
      key: n.node_key,
      label: n.label,
      kind: n.kind,
      icon: n.icon,
      x: n.x,
      y: n.y,
      description: n.description,
      // learn-redesign 迁移增列；未迁移时这两列在 DB 不存在，会抛错——
      // 因此迁移必须先于本接口上线（见 migration-learn-redesign-alter.sql）。
      stageKey: n.stage_key,
      oneLiner: n.one_liner,
    })),
    edges: edges.map((e) => ({ from: e.from_key, to: e.to_key, label: e.label })),
    resources: resources.map((r) => ({
      id: r.id,
      nodeId: r.node_id,
      type: r.res_type,
      refId: r.ref_id,
      title: r.title,
      sort: r.sort,
    })),
  });
}
