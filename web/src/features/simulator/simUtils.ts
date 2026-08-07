import type { SimNode, SimEdge, SimNodeDef } from './simTypes';
import { NODE_LIBRARY } from './simTypes';

/** 取节点定义：优先用节点自带 def（自定义工序已随节点持久化），否则回退 NODE_LIBRARY */
function nodeDef(n: SimNode): SimNodeDef | undefined {
  return n.def ?? NODE_LIBRARY[n.nodeType];
}

/** 节点中心点 */
function center(n: SimNode) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

/** OUT 端口：节点右边缘中点 */
export function outPort(n: SimNode) {
  const def = nodeDef(n);
  if (def?.shape === 'diamond') return { x: n.x + n.w, y: n.y + n.h / 2 };
  return { x: n.x + n.w, y: n.y + n.h / 2 };
}

/** IN 端口：节点左边缘中点 */
export function inPort(n: SimNode) {
  const def = nodeDef(n);
  if (def?.shape === 'diamond') return { x: n.x, y: n.y + n.h / 2 };
  return { x: n.x, y: n.y + n.h / 2 };
}

/** 第二个 IN 端口（组装用，左边缘偏上） */
export function inPort2(n: SimNode) {
  return { x: n.x, y: n.y + n.h * 0.3 };
}

/** 检验节点第二个 OUT 端口（底部，不合格回流用） */
export function outPort2(n: SimNode) {
  const def = nodeDef(n);
  if (def?.shape === 'diamond') return { x: n.x + n.w / 2, y: n.y + n.h };
  return { x: n.x + n.w / 2, y: n.y + n.h };
}

/** 直连线路径（平滑贝塞尔曲线，B 档视觉升级） */
export function straightPath(fromNode: SimNode, toNode: SimNode): string {
  const from = outPort(fromNode);
  const to = inPort(toNode);
  const dx = Math.max(48, (to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

/** 边标签锚点（两端口中点略上移） */
export function edgeLabelPos(fromNode: SimNode, toNode: SimNode): { x: number; y: number } {
  const from = outPort(fromNode);
  const to = inPort(toNode);
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 9 };
}

/** 回流线路径：从检验节点底部第2出口 → 下方折回 → 目标工序 */
export function reworkPath(fromNode: SimNode, toNode: SimNode, offset: number): string {
  const start = outPort2(fromNode);
  const end = inPort(toNode);
  const y0 = start.y + offset;
  return `M ${start.x} ${start.y} L ${start.x} ${y0} L ${end.x - 20} ${y0} L ${end.x - 20} ${end.y} L ${end.x} ${end.y}`;
}

/** 所有连线对应的节点对 */
export function edgePairs(state: { nodes: SimNode[]; edges: SimEdge[] }) {
  const map = new Map(state.nodes.map((n) => [n.id, n]));
  return state.edges.map((e) => {
    const from = map.get(e.from);
    const to = map.get(e.to);
    return from && to ? { edge: e, from, to } : null;
  }).filter(Boolean) as { edge: SimEdge; from: SimNode; to: SimNode }[];
}
