/** 工序节点类型 */
export type SimNodeType = 'raw_cut' | 'machining' | 'welding' | 'inspection' | 'assembly' | 'warehouse';

/** 节点端口信息：哪些边有 IN/OUT 端口 */
export const NODE_DEF: Record<SimNodeType, { label: string; icon: string; ports: { in: number; out: number } }> = {
  raw_cut:    { label: '下料',   icon: 'routing',    ports: { in: 0, out: 1 } },
  machining:  { label: '机加工', icon: 'workshop',   ports: { in: 1, out: 1 } },
  welding:    { label: '焊接',   icon: 'workshop',   ports: { in: 1, out: 1 } },
  inspection: { label: '质检',   icon: 'report',     ports: { in: 1, out: 1 } },
  assembly:   { label: '装配',   icon: 'equipment',  ports: { in: 2, out: 1 } },
  warehouse:  { label: '入库',   icon: 'sql',        ports: { in: 1, out: 0 } },
};

/** 画布节点 */
export interface SimNode {
  id: string;
  type: SimNodeType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props: SimNodeProps;
}

export interface SimNodeProps {
  hours?: number;
  defectRate?: number;
  forceInspect?: boolean;
  line?: string;
}

/** 连线 */
export interface SimEdge {
  id: string;
  from: string;
  to: string;
}

/** 完整项目 */
export interface SimProject {
  name: string;
  nodes: SimNode[];
  edges: SimEdge[];
  version: number;
}

/** 画布状态 */
export interface SimState {
  projectName: string;
  nodes: SimNode[];
  edges: SimEdge[];
  selectedId: string | null;
  connectingFrom: string | null; // 正在连线的源节点 id
}

/** Action */
export type SimAction =
  | { type: 'ADD_NODE'; node: SimNode }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'UPDATE_NODE_PROPS'; id: string; props: Partial<SimNodeProps> }
  | { type: 'UPDATE_NODE_LABEL'; id: string; label: string }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'ADD_EDGE'; edge: SimEdge }
  | { type: 'DELETE_EDGE'; id: string }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'START_CONNECT'; fromId: string }
  | { type: 'CANCEL_CONNECT' }
  | { type: 'LOAD_PROJECT'; project: SimProject }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_NAME'; name: string };

export const NODE_W = 140;
export const NODE_H = 64;
