/** 节点形状 */
export type SimShape = 'rect' | 'diamond' | 'oval' | 'storage';

/** 工序分类 */
export type SimCategory = 'process' | 'inspect' | 'storage' | 'endpoint';

/** 节点定义 */
export interface SimNodeDef {
  type: string;
  label: string;
  shape: SimShape;
  category: SimCategory;
  critical?: boolean; // 关键工序 ⭐
  ports: { in: number; out: number };
}

export const NODE_LIBRARY: Record<string, SimNodeDef> = {
  // 加工类（矩形）
  print:     { type: 'print',     label: '喷码打印', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  weld:      { type: 'weld',      label: '焊接',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  rivet:     { type: 'rivet',     label: '铆合',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  padprint:  { type: 'padprint',  label: '移印',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  assembly:  { type: 'assembly',  label: '组装',     shape: 'rect', category: 'process', ports: { in: 2, out: 1 } },
  aging:     { type: 'aging',     label: '老化',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  // 检验类（菱形）
  i_incoming:{ type: 'i_incoming',label: '来料检验', shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_elec:    { type: 'i_elec',    label: '电气检测', shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_voltage: { type: 'i_voltage', label: '耐压测试', shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_final:   { type: 'i_final',   label: '成品检验', shape: 'diamond', category: 'inspect', ports: { in: 1, out: 2 } },
  // 仓储类（圆角矩形）
  wh_in:     { type: 'wh_in',     label: '入库',     shape: 'storage', category: 'storage', ports: { in: 1, out: 1 } },
  wh_out:    { type: 'wh_out',    label: '发料',     shape: 'storage', category: 'storage', ports: { in: 1, out: 1 } },
  // 起止类（椭圆）
  material:  { type: 'material',  label: '来料',     shape: 'oval', category: 'endpoint', ports: { in: 0, out: 1 } },
  ship:      { type: 'ship',      label: '发货',     shape: 'oval', category: 'endpoint', ports: { in: 1, out: 0 } },
};

/** 画布节点 */
export interface SimNode {
  id: string;
  nodeType: string; // key in NODE_LIBRARY
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
}

/** 连线 */
export interface SimEdge {
  id: string;
  from: string;
  to: string;
  dashed: boolean; // 实线/虚线
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
  connectingFrom: string | null;
}

/** Action */
export type SimAction =
  | { type: 'ADD_NODE'; node: SimNode }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'UPDATE_PROPS'; id: string; props: Partial<SimNodeProps> }
  | { type: 'UPDATE_LABEL'; id: string; label: string }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'ADD_EDGE'; edge: SimEdge }
  | { type: 'TOGGLE_EDGE'; id: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'START_CONNECT'; fromId: string }
  | { type: 'CANCEL_CONNECT' }
  | { type: 'LOAD_PROJECT'; project: SimProject }
  | { type: 'CLEAR' }
  | { type: 'SET_NAME'; name: string };

/** 形状对应的默认尺寸 */
export const SHAPE_SIZE: Record<SimShape, { w: number; h: number }> = {
  rect:    { w: 120, h: 56 },
  diamond: { w: 100, h: 100 },
  oval:    { w: 80, h: 48 },
  storage: { w: 120, h: 48 },
};
