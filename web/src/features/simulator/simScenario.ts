/**
 * 通用工厂仿真场景：与「工厂全景」流程图同一套业务数据（generic-factory）。
 * 点流程节点 → 沙盒预载该节点对应的工厂切片，画布上的字就是流程图上的字。
 * 这是「工厂全局辅助学习」在仿真侧的落地：沙盒不再是陌生示例，而是流程图同一个工厂。
 */
import { createNode } from './simReducer';
import { NODE_LIBRARY } from './simTypes';
import type { SimState, SimNode, SimEdge } from './simTypes';

/** 贯穿 SQL 数据集 ↔ 仿真日志的共享工单号（知识闭环：先查后看它流转）。 */
export const WO_DEMO = 'WO-2026-001';

/** 流程节点 key 顺序 = 在 node_resources 里的 sim 实战 ref_id（1..12）。 */
export const FLOW_ORDER = [
  'cust-order', 'order-review', 'mps', 'mrp', 'purchase', 'bom-route',
  'picking', 'dispatch', 'shopfloor', 'qc', 'stock-in', 'shipping',
] as const;
export type FlowKey = typeof FLOW_ORDER[number];

export const FLOW_KEYS = new Set<string>(FLOW_ORDER);

/** sim 实战 ref_id：与后端 node_resources(ref_id) 一一对应，进度才能落对坑。 */
export const SIM_REF_ID: Record<string, number> = Object.fromEntries(
  FLOW_ORDER.map((k, i) => [k, i + 1]),
);

/** 节点中文名（与流程图 node.label 同源），用于「你正从 X 进入」横幅。 */
export const FLOW_LABELS: Record<string, string> = Object.fromEntries(
  FLOW_ORDER.map((k) => [k, NODE_LIBRARY[k]?.label ?? k]),
);

/** 节点画布坐标（左→右对齐流程图主线；purchase / bom-route 分上下两支）。 */
const POS: Record<FlowKey, { x: number; y: number }> = {
  'cust-order':   { x: 20,   y: 200 },
  'order-review': { x: 160,  y: 200 },
  'mps':          { x: 300,  y: 200 },
  'mrp':          { x: 440,  y: 200 },
  'purchase':     { x: 580,  y: 120 },
  'bom-route':    { x: 580,  y: 280 },
  'picking':      { x: 720,  y: 200 },
  'dispatch':     { x: 860,  y: 200 },
  'shopfloor':    { x: 1000, y: 200 },
  'qc':           { x: 1140, y: 200 },
  'stock-in':     { x: 1280, y: 200 },
  'shipping':     { x: 1420, y: 200 },
};

/** 主线连线（与流程图 flow_edges 一致；mrp 分叉到 purchase / bom-route，再汇到 picking）。 */
const EDGES: Array<[FlowKey, FlowKey, boolean]> = [
  ['cust-order', 'order-review', false],
  ['order-review', 'mps', false],
  ['mps', 'mrp', false],
  ['mrp', 'purchase', false],
  ['mrp', 'bom-route', false],
  ['purchase', 'picking', false],
  ['bom-route', 'picking', false],
  ['picking', 'dispatch', false],
  ['dispatch', 'shopfloor', false],
  ['shopfloor', 'qc', false],
  ['qc', 'stock-in', false],
  ['stock-in', 'shipping', false],
];

function buildNodes(): SimNode[] {
  return FLOW_ORDER.map((key) => {
    const n = createNode(key, POS[key].x, POS[key].y);
    if (!n) return null;
    n.id = `gf-${key}`; // 确定性 id，便于高亮来源节点
    return n;
  }).filter((n): n is SimNode => n !== null);
}

function buildEdges(): SimEdge[] {
  return EDGES.map(([f, t, dashed]) => ({
    id: `e-${f}-${t}`,
    from: `gf-${f}`,
    to: `gf-${t}`,
    dashed,
  }));
}

/**
 * 构造「通用工厂」单工厂 / 单线状态。
 * @param fromKey 来源流程节点 key（来自 ?from=）；命中则预选中并高亮该节点。
 */
export function buildGenericFactory(fromKey?: string | null): SimState {
  const selectedId = fromKey && FLOW_KEYS.has(fromKey) ? `gf-${fromKey}` : null;
  return {
    factories: [{
      id: 'gf',
      name: '通用工厂',
      lines: [{ id: 'gfl', name: '通用工厂主线', nodes: buildNodes(), edges: buildEdges() }],
    }],
    activeFactoryId: 'gf',
    activeLineId: 'gfl',
    selectedId,
    selectedEdgeId: null,
    connectingFrom: null,
    connectingPort: null,
  };
}
