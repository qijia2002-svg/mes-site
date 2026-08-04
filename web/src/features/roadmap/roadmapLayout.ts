/**
 * 矩阵布局与 SVG 连线的纯函数层。**无 React、无 DOM 读写**，便于单测。
 *
 * 契约（docs/api/career-roadmap-api.md §5）：
 *  - 边只有 stage → level 一种方向，不会有悬空边；
 *  - level 节点已按 level_id 去重，同一能力被多个阶段要求时只出一个节点、多条边。
 * 因此矩阵把每个 level 落在**最早要求它的阶段行**上：这是"什么时候必须学到"的答案，
 * 重复画在每个引用阶段只会让同一能力看起来要学三遍。
 *
 * 列 = 能力路线（稳定纵轴），行 = 成长阶段（稳定横轴），等级递进 = 一条垂直直线。
 */
import type {
  GraphEdge,
  GraphLevelNode,
  GraphStageNode,
  Importance,
  RoadmapGraph,
  TrackKind,
} from '../../api/roadmap';
import { IMPORTANCE_RANK, strongerImportance } from './roadmapLabels';

/** 桌面矩阵列数上限：超过就按 core → important → optional 截断，溢出折叠展示。 */
export const MAX_COLUMNS = 6;

export interface PlacedNode {
  node: GraphLevelNode;
  /** 最早要求它的阶段（行下标） */
  rowIndex: number;
  importance: Importance;
  note: string;
}

export interface TrackColumn {
  slug: string;
  title: string;
  icon: string;
  kind: TrackKind;
  /** 该列所有节点里最强的一档重要度，用于超列截断排序 */
  importance: Importance;
}

export interface StageRow {
  node: GraphStageNode;
  index: number;
  done: number;
  total: number;
}

export interface RoadmapMatrix {
  stages: StageRow[];
  columns: TrackColumn[];
  /** 超出 MAX_COLUMNS 被折叠的路线（按 importance 排序后的尾部） */
  overflowColumns: TrackColumn[];
  /** key = `${rowIndex}|${trackSlug}` */
  cells: Map<string, PlacedNode>;
  placed: PlacedNode[];
  /** 「你在这里」：第一个进行中的节点，没有就取第一个未开始的 */
  currentId: string | null;
  nodeDone: number;
  nodeTotal: number;
}

export function cellKey(rowIndex: number, trackSlug: string): string {
  return `${rowIndex}|${trackSlug}`;
}

interface Owner {
  rowIndex: number;
  importance: Importance;
  note: string;
}

/** 每个 level 节点归属到「最早要求它的阶段」，重要度取所有边里最强的一档。 */
function resolveOwners(edges: GraphEdge[], rowOf: Map<string, number>): Map<string, Owner> {
  const owners = new Map<string, Owner>();
  for (const edge of edges) {
    const rowIndex = rowOf.get(edge.from);
    if (rowIndex === undefined) continue; // 契约保证不会发生，脏数据时静默丢弃这条边
    const prev = owners.get(edge.to);
    if (!prev) {
      owners.set(edge.to, { rowIndex, importance: edge.importance, note: edge.note });
      continue;
    }
    owners.set(edge.to, {
      rowIndex: Math.min(prev.rowIndex, rowIndex),
      importance: strongerImportance(prev.importance, edge.importance),
      // note 跟随最早的那个阶段：那才是"为什么这时候要学它"
      note: rowIndex < prev.rowIndex ? edge.note : prev.note,
    });
  }
  return owners;
}

export function buildMatrix(graph: RoadmapGraph, maxColumns = MAX_COLUMNS): RoadmapMatrix {
  const nodes = graph.nodes ?? [];
  const stageNodes = nodes
    .filter((n): n is GraphStageNode => n.type === 'stage')
    .sort((a, b) => a.stage - b.stage);
  const levelNodes = nodes.filter((n): n is GraphLevelNode => n.type === 'level');

  const rowOf = new Map<string, number>();
  stageNodes.forEach((s, i) => rowOf.set(s.id, i));

  const owners = resolveOwners(graph.edges ?? [], rowOf);

  const placed: PlacedNode[] = [];
  for (const node of levelNodes) {
    const owner = owners.get(node.id);
    // 无边的孤儿节点仍然显示在第一阶段，宁可位置粗糙也不让能力凭空消失
    placed.push({
      node,
      rowIndex: owner?.rowIndex ?? 0,
      importance: owner?.importance ?? 'optional',
      note: owner?.note ?? '',
    });
  }
  placed.sort((a, b) => a.rowIndex - b.rowIndex || a.node.level - b.node.level);

  // 列：按 nodes 原始顺序（后端已按 tracks.sort、level 升序）首次出现定序
  const columnMap = new Map<string, TrackColumn>();
  for (const p of placed) {
    const exist = columnMap.get(p.node.trackSlug);
    if (exist) {
      exist.importance = strongerImportance(exist.importance, p.importance);
      continue;
    }
    columnMap.set(p.node.trackSlug, {
      slug: p.node.trackSlug,
      title: p.node.trackTitle,
      icon: p.node.trackIcon,
      kind: p.node.trackKind,
      importance: p.importance,
    });
  }
  const ordered = [...columnMap.values()];
  let columns = ordered;
  let overflowColumns: TrackColumn[] = [];
  if (ordered.length > maxColumns) {
    const byImportance = [...ordered].sort(
      (a, b) =>
        IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] ||
        ordered.indexOf(a) - ordered.indexOf(b),
    );
    const keep = new Set(byImportance.slice(0, maxColumns).map((c) => c.slug));
    columns = ordered.filter((c) => keep.has(c.slug));
    overflowColumns = ordered.filter((c) => !keep.has(c.slug));
  }

  const cells = new Map<string, PlacedNode>();
  for (const p of placed) cells.set(cellKey(p.rowIndex, p.node.trackSlug), p);

  const stages: StageRow[] = stageNodes.map((node, index) => {
    const inRow = placed.filter((p) => p.rowIndex === index);
    return {
      node,
      index,
      done: inRow.filter((p) => p.node.progress?.state === 'completed').length,
      total: inRow.length,
    };
  });

  return {
    stages,
    columns,
    overflowColumns,
    cells,
    placed,
    currentId: pickCurrentId(placed),
    nodeDone: placed.filter((p) => p.node.progress?.state === 'completed').length,
    nodeTotal: placed.length,
  };
}

/** 「你在这里」：优先第一个进行中的节点，其次第一个有内容但未开始的。 */
export function pickCurrentId(placed: PlacedNode[]): string | null {
  const doing = placed.find((p) => p.node.progress?.state === 'in_progress');
  if (doing) return doing.node.id;
  const next = placed.find((p) => p.node.progress?.state === 'not_started');
  return next ? next.node.id : null;
}

/** 默认展开的阶段（移动端 accordion）：第一个未完成的阶段，全完成则展开最后一个。 */
export function defaultOpenStage(stages: StageRow[]): number {
  const idx = stages.findIndex((s) => s.total === 0 || s.done < s.total);
  if (idx >= 0) return idx;
  return stages.length > 0 ? stages.length - 1 : 0;
}

// ---------------------------------------------------------------------------
// SVG 连线：只用正交折线（水平/垂直段 + 圆角拐角），禁贝塞尔曲线
// ---------------------------------------------------------------------------

export interface NodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EdgeGeom {
  id: string;
  d: string;
  arrow: string;
  importance: Importance;
  isCurrent: boolean;
}

/** 正交折线：起点底部中心 → 终点顶部中心，中段在垂直方向折返。 */
export function elbowPath(x1: number, y1: number, x2: number, y2: number, r = 6): string {
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const my = (y1 + y2) / 2;
  const dir = x2 > x1 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${my - r}`,
    `Q ${x1} ${my} ${x1 + dir * r} ${my}`,
    `L ${x2 - dir * r} ${my}`,
    `Q ${x2} ${my} ${x2} ${my + r}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

const ARROW_H = 6;
const ARROW_W = 4;

function arrowPoints(x: number, y: number): string {
  return `${x - ARROW_W},${y - ARROW_H} ${x + ARROW_W},${y - ARROW_H} ${x},${y}`;
}

/**
 * 同一路线的等级递进连线：同列 → 垂直直线，读者不需要追踪走向。
 * 线型由**目标节点**的重要度决定（"要走到这一级，这条依赖有多硬"）。
 */
export function buildEdgeGeoms(
  matrix: RoadmapMatrix,
  rects: Record<string, NodeRect>,
  currentId: string | null,
): EdgeGeom[] {
  const geoms: EdgeGeom[] = [];
  for (const column of matrix.columns) {
    const chain = matrix.placed
      .filter((p) => p.node.trackSlug === column.slug)
      .sort((a, b) => a.rowIndex - b.rowIndex || a.node.level - b.node.level);
    for (let i = 1; i < chain.length; i += 1) {
      const from = rects[chain[i - 1].node.id];
      const to = rects[chain[i].node.id];
      if (!from || !to) continue;
      const x1 = from.x + from.w / 2;
      const y1 = from.y + from.h;
      const x2 = to.x + to.w / 2;
      const y2 = to.y;
      if (y2 - y1 < ARROW_H) continue; // 重叠/换行时不画，避免出现倒着走的线
      geoms.push({
        id: `${chain[i - 1].node.id}->${chain[i].node.id}`,
        d: elbowPath(x1, y1, x2, y2 - ARROW_H),
        arrow: arrowPoints(x2, y2),
        importance: chain[i].importance,
        isCurrent: currentId !== null && chain[i].node.id === currentId,
      });
    }
  }
  return geoms;
}
