import type { SimNode, SimEdge } from './simTypes';

/** 节点右边缘中点（OUT 端口位置） */
export function outPortPos(n: SimNode): { x: number; y: number } {
  return { x: n.x + n.w, y: n.y + n.h / 2 };
}

/** 节点左边缘中点（IN 端口位置） */
export function inPortPos(n: SimNode): { x: number; y: number } {
  return { x: n.x, y: n.y + n.h / 2 };
}

/** 第二个 IN 端口（装配节点左边缘偏上，用于第 2 个输入） */
export function inPort2Pos(n: SimNode): { x: number; y: number } {
  return { x: n.x, y: n.y + n.h * 0.3 };
}

/** 正交折线路径 SVG d 属性。
 *  拐直角，加 4px 圆角软化转角。*/
export function edgePath(fromNode: SimNode, toNode: SimNode): string {
  const from = outPortPos(fromNode);
  const to = inPortPos(toNode);
  const midX = (from.x + to.x) / 2;
  const r = 4; // 拐角圆角半径

  return `M ${from.x} ${from.y}
    L ${midX - r} ${from.y}
    Q ${midX} ${from.y} ${midX} ${from.y + r}
    L ${midX} ${to.y - r}
    Q ${midX} ${to.y} ${midX + r} ${to.y}
    L ${to.x} ${to.y}`.replace(/\n\s+/g, ' ');
}

/** 计算连线跨越的节点列表（按 from→to 顺序） */
export function edgeNodes(state: { nodes: SimNode[]; edges: SimEdge[] }): { edge: SimEdge; from: SimNode; to: SimNode }[] {
  const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
  return state.edges
    .map((e) => {
      const from = nodeMap.get(e.from);
      const to = nodeMap.get(e.to);
      return from && to ? { edge: e, from, to } : null;
    })
    .filter(Boolean) as { edge: SimEdge; from: SimNode; to: SimNode }[];
}
