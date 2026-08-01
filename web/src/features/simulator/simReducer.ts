import type { SimState, SimAction, SimNode, SimEdge } from './simTypes';
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
  return { projectName: '未命名方案', nodes: [], edges: [], selectedId: null, connectingFrom: null };
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
      return { ...state, edges: [...state.edges, action.edge], connectingFrom: null };
    case 'TOGGLE_EDGE':
      return { ...state, edges: state.edges.map((e) => e.id === action.id ? { ...e, dashed: !e.dashed } : e) };
    case 'SELECT':
      return { ...state, selectedId: action.id, connectingFrom: null };
    case 'START_CONNECT':
      return { ...state, connectingFrom: action.fromId, selectedId: null };
    case 'CANCEL_CONNECT':
      return { ...state, connectingFrom: null };
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
