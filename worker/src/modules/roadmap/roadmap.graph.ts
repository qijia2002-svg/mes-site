import type { Ctx } from '../../core/context';
import { roadmapRepo, type ReqRow } from '../../data/repositories/roadmap.repo';
import { getContentVersion, cachedJson, contentCacheKey, buildProgress, clone, type Progress } from './roadmap.shared';

/**
 * 职业路线图路径图聚合（API §5）。
 *
 * 骨架（career + nodes 静态部分 + edges + 各 level 的 total）走 L2 缓存；
 * 进度（done/percent/state/summary）在缓存之外逐请求叠加，叠加前深拷贝骨架，
 * 否则会把 A 的进度写进被 B 复用的缓存对象。
 *
 * 节点顺序：先全部 stage（按 stage 升序），再全部 level（按 track_sort、level 升序）。
 * level 节点已按 level_id 去重：同一能力等级被多阶段要求只出一个节点、多条边。
 */

export interface GraphCareer { slug: string; title: string; tagline: string; icon: string; }
export interface GraphStageNode {
  id: string;
  type: 'stage';
  stage: number;
  title: string;
  duration: string;
  goal: string;
  milestone: string;
  icon: string;
}
export interface GraphLevelNode {
  id: string;
  type: 'level';
  trackSlug: string;
  trackTitle: string;
  trackIcon: string;
  trackKind: string;
  level: number;
  levelName: string;
  hours: number;
  progress: Progress;
}
export type GraphNode = GraphStageNode | GraphLevelNode;
export interface GraphEdge { id: string; from: string; to: string; importance: string; note: string; }
export interface GraphSummary {
  authenticated: boolean;
  stageCount: number;
  levelCount: number;
  chapterDone: number;
  chapterTotal: number;
  percent: number;
}
export interface GraphData {
  career: GraphCareer;
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: GraphSummary;
}

export async function getRoadmapGraphSvc(c: Ctx, career: string): Promise<GraphData | null> {
  const cv = await getContentVersion(c);
  const skeleton = await cachedJson(contentCacheKey(`roadmap/graph/${career}`, cv), 300, async () => {
    const cp = await roadmapRepo.getCareerBySlug(c.db, career);
    if (!cp) return null;
    const stages = await roadmapRepo.listStages(c.db, cp.id);
    const reqs = await roadmapRepo.listRequirements(c.db, cp.id);

    // level 节点按 level_id 去重（保留首条），再按 (track_sort, level) 升序
    const uniqueReqs = new Map<number, ReqRow>();
    const totals = new Map<number, number>();
    for (const r of reqs) {
      if (!uniqueReqs.has(r.level_id)) uniqueReqs.set(r.level_id, r);
      totals.set(r.level_id, r.total);
    }
    const levelReqs = [...uniqueReqs.values()].sort((a, b) => a.track_sort - b.track_sort || a.level - b.level);

    const stageNodes: GraphStageNode[] = stages.map((s) => ({
      id: `stage:${s.id}`,
      type: 'stage',
      stage: s.stage,
      title: s.title,
      duration: s.duration,
      goal: s.goal,
      milestone: s.milestone,
      icon: 'stage',
    }));

    const levelNodes: GraphLevelNode[] = levelReqs.map((r) => ({
      id: `level:${r.level_id}`,
      type: 'level',
      trackSlug: r.track_slug,
      trackTitle: r.track_title,
      trackIcon: r.track_icon,
      trackKind: r.track_kind,
      level: r.level,
      levelName: r.level_name,
      hours: r.hours,
      progress: buildProgress(0, r.total),
    }));

    const edges: GraphEdge[] = reqs.map((r) => ({
      id: `edge:${r.stage_id}:${r.level_id}`,
      from: `stage:${r.stage_id}`,
      to: `level:${r.level_id}`,
      importance: r.importance,
      note: r.note,
    }));

    const chapterTotal = [...totals.values()].reduce((a, b) => a + b, 0);
    return {
      career: { slug: cp.slug, title: cp.title, tagline: cp.tagline, icon: cp.icon },
      nodes: [...stageNodes, ...levelNodes],
      edges,
      summary: {
        authenticated: false,
        stageCount: stages.length,
        levelCount: levelNodes.length,
        chapterDone: 0,
        chapterTotal,
        percent: 0,
      },
    };
  });

  if (!skeleton) return null;

  const data = clone(skeleton) as GraphData;
  const authenticated = !!c.auth;

  const levelIds = data.nodes
    .filter((n): n is GraphLevelNode => n.type === 'level')
    .map((n) => Number(n.id.slice('level:'.length)));

  const doneMap = new Map<number, number>();
  if (authenticated) {
    // 一条语句取本岗位涉及的全部 level 的已完成章节数；未登录不发查询（省一条语句）
    const done = await roadmapRepo.doneCountByLevels(c.db, c.auth!.sub, levelIds);
    for (const d of done) doneMap.set(d.level_id, d.done);
  }

  for (const node of data.nodes) {
    if (node.type === 'level') {
      const id = Number(node.id.slice('level:'.length));
      node.progress = buildProgress(doneMap.get(id) ?? 0, node.progress.total);
    }
  }

  let chapterDone = 0;
  for (const id of levelIds) chapterDone += doneMap.get(id) ?? 0;
  const chapterTotal = data.summary.chapterTotal;
  data.summary = {
    ...data.summary,
    authenticated,
    chapterDone,
    percent: chapterTotal === 0 ? 0 : Math.round((chapterDone / chapterTotal) * 100),
  };
  return data;
}
