import type { SimState, SimAction, SimNode, SimEdge, SimProject, SimNodeProps } from './simTypes';
import { NODE_LIBRARY, SHAPE_SIZE } from './simTypes';

let _id = 1;
function uid(): string { return `n${_id++}`; }
function eid(): string { return `e${_id++}`; }

export function createNode(nodeType: string, x: number, y: number): SimNode | null {
  const def = NODE_LIBRARY[nodeType];
  if (!def) return null;
  const size = SHAPE_SIZE[def.shape];
  return {
    id: uid(), nodeType, label: def.label,
    x: x - size.w / 2, y: y - size.h / 2,
    w: size.w, h: size.h, props: {},
  };
}

export function createEdge(from: string, to: string): SimEdge {
  return { id: eid(), from, to, dashed: false };
}

export function initialSimState(): SimState {
  return { projectName: '未命名方案', nodes: [], edges: [], selectedId: null, connectingFrom: null, connectingPort: null };
}

/**
 * 默认示例工厂：离散制造工艺路线。
 * 来料 → 来料检验 → 焊接 → 电气检测 → 组装 → 发货，
 * 两个检验节点的不合格品回流到「焊接」返工（虚线回流边）。
 * 打开仿真沙盒且无本地存档时自动加载，保证画布非空、开箱即用。
 */
export function seedExampleProject(): SimProject {
  const mk = (id: string, nodeType: string, x: number, y: number, props: SimNodeProps = {}): SimNode => {
    const def = NODE_LIBRARY[nodeType];
    const size = SHAPE_SIZE[def.shape];
    return { id, nodeType, label: def.label, x, y, w: size.w, h: size.h, props };
  };
  const nodes: SimNode[] = [
    mk('seed-material', 'material', 24, 176),
    mk('seed-incoming', 'i_incoming', 150, 150, { defectRate: 8 }),
    mk('seed-weld', 'weld', 272, 172, { hours: 12 }),
    mk('seed-elec', 'i_elec', 398, 150, { defectRate: 5 }),
    mk('seed-assembly', 'assembly', 520, 172, { hours: 20 }),
    mk('seed-ship', 'ship', 642, 176),
  ];
  const e = (from: string, to: string, dashed: boolean): SimEdge => ({ id: `seed-${from}-${to}`, from, to, dashed });
  const edges: SimEdge[] = [
    e('seed-material', 'seed-incoming', false),
    e('seed-incoming', 'seed-weld', false),
    e('seed-incoming', 'seed-weld', true),
    e('seed-weld', 'seed-elec', false),
    e('seed-elec', 'seed-assembly', false),
    e('seed-elec', 'seed-weld', true),
    e('seed-assembly', 'seed-ship', false),
  ];
  return { name: '示例 · 离散制造工艺路线', nodes, edges, version: 1 };
}

/** 示例工厂对应的画布状态 */
export function seedExampleState(): SimState {
  const p = seedExampleProject();
  return { ...initialSimState(), projectName: p.name, nodes: p.nodes, edges: p.edges };
}

export function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.node] };
    case 'MOVE_NODE':
      return { ...state, nodes: state.nodes.map((n) => n.id === action.id ? { ...n, x: action.x, y: action.y } : n) };
    case 'UPDATE_PROPS':
      return { ...state, nodes: state.nodes.map((n) => n.id === action.id ? { ...n, props: { ...n.props, ...action.props } } : n) };
    case 'UPDATE_LABEL':
      return { ...state, nodes: state.nodes.map((n) => n.id === action.id ? { ...n, label: action.label } : n) };
    case 'DELETE_NODE':
      return { ...state, nodes: state.nodes.filter((n) => n.id !== action.id), edges: state.edges.filter((e) => e.from !== action.id && e.to !== action.id), selectedId: state.selectedId === action.id ? null : state.selectedId };
    case 'ADD_EDGE':
      // 从 out2（不合格）端口连出的边默认标记为回流线（虚线）
      return { ...state, edges: [...state.edges, { ...action.edge, dashed: state.connectingPort === 'out2' }], connectingFrom: null, connectingPort: null };
    case 'TOGGLE_EDGE':
      return { ...state, edges: state.edges.map((e) => e.id === action.id ? { ...e, dashed: !e.dashed } : e) };
    case 'SELECT':
      return { ...state, selectedId: action.id, connectingFrom: null, connectingPort: null };
    case 'START_CONNECT':
      return { ...state, connectingFrom: action.fromId, connectingPort: action.port, selectedId: null };
    case 'CANCEL_CONNECT':
      return { ...state, connectingFrom: null, connectingPort: null };
    case 'LOAD_PROJECT':
      return { ...initialSimState(), projectName: action.project.name, nodes: action.project.nodes, edges: action.project.edges };
    case 'CLEAR':
      return { ...initialSimState(), projectName: state.projectName };
    case 'SET_NAME':
      return { ...state, projectName: action.name };
    default:
      return state;
  }
}
