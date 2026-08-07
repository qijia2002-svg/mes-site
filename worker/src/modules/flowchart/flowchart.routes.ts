import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { flowchartRepo } from '../../data/repositories/flowchart.repo';

/**
 * 工厂流程图 API（factory-first 导航主干）。
 *
 *   GET /api/v1/flowchart/:slug -> { flow, nodes, edges, resources }
 *
 * 公开读取（无需登录）：流程图是导航骨架，匿名用户也要能逛。
 */
export async function getFlowchart(c: Ctx): Promise<Response> {
  const slug = c.params.slug;
  if (!slug) return fail(c, Err.paramMissing());

  const flow = await flowchartRepo.getBySlug(c.db, slug);
  if (!flow) return fail(c, Err.notFound());

  const [nodes, edges] = await Promise.all([
    flowchartRepo.listNodes(c.db, flow.id),
    flowchartRepo.listEdges(c.db, flow.id),
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
    nodes: nodes.map((n) => ({
      id: n.id,
      key: n.node_key,
      label: n.label,
      kind: n.kind,
      icon: n.icon,
      x: n.x,
      y: n.y,
      description: n.description,
    })),
    edges: edges.map((e) => ({ from: e.from_key, to: e.to_key, label: e.label })),
    resources: resources.map((r) => ({
      id: r.id,
      nodeId: r.node_id,
      type: r.res_type,
      refId: r.ref_id,
      title: r.title,
    })),
  });
}
