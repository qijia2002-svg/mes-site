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
  custom?: boolean; // 用户自定义工序，需随节点一起持久化
}

export const NODE_LIBRARY: Record<string, SimNodeDef> = {
  // ═══ 通用加工（矩形）═══
  print:     { type: 'print',     label: '喷码打印', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  weld:      { type: 'weld',      label: '焊接',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  rivet:     { type: 'rivet',     label: '铆合',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  assembly:  { type: 'assembly',  label: '组装',     shape: 'rect', category: 'process', ports: { in: 2, out: 1 } },
  aging:     { type: 'aging',     label: '老化测试', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  packing:   { type: 'packing',   label: '包装',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  // ═══ 汽车零部件（auto）═══
  casting:   { type: 'casting',   label: '铸造',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  forging:   { type: 'forging',   label: '锻造',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  cnc:       { type: 'cnc',       label: 'CNC加工',  shape: 'rect', category: 'process', critical: true, ports: { in: 1, out: 1 } },
  heat_treat:{ type: 'heat_treat',label: '热处理',   shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  surface:   { type: 'surface',   label: '表面处理', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  i_dim:     { type: 'i_dim',     label: '尺寸检测', shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_hardness:{ type: 'i_hardness',label: '硬度测试', shape: 'diamond', category: 'inspect', ports: { in: 1, out: 2 } },
  // ═══ 电子产品（electronics）═══
  smt:       { type: 'smt',       label: 'SMT贴片',  shape: 'rect', category: 'process', critical: true, ports: { in: 1, out: 1 } },
  reflow:    { type: 'reflow',    label: '回流焊',   shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  wave:      { type: 'wave',      label: '波峰焊',   shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  i_aoi:     { type: 'i_aoi',     label: 'AOI检测',  shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_ict:     { type: 'i_ict',     label: 'ICT测试',  shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_fct:     { type: 'i_fct',     label: '功能测试', shape: 'diamond', category: 'inspect', ports: { in: 1, out: 2 } },
  // ═══ 医药制剂（pharma）═══
  weighing:  { type: 'weighing',  label: '称量配料', shape: 'rect', category: 'process', critical: true, ports: { in: 1, out: 1 } },
  mixing:    { type: 'mixing',    label: '混合制粒', shape: 'rect', category: 'process', ports: { in: 2, out: 1 } },
  tableting: { type: 'tableting', label: '压片',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  coating:   { type: 'coating',   label: '薄膜包衣', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  filling:   { type: 'filling',   label: '灌装',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  sterilize: { type: 'sterilize', label: '灭菌',     shape: 'rect', category: 'process', critical: true, ports: { in: 1, out: 1 } },
  i_visual:  { type: 'i_visual',  label: '灯检',     shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  // ═══ 食品饮料（food）═══
  raw_mat:   { type: 'raw_mat',   label: '原料处理', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  blending:  { type: 'blending',  label: '调配',     shape: 'rect', category: 'process', ports: { in: 2, out: 1 } },
  pasteur:   { type: 'pasteur',   label: '巴氏杀菌', shape: 'rect', category: 'process', critical: true, ports: { in: 1, out: 1 } },
  capping:   { type: 'capping',   label: '封盖',     shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  labeling:  { type: 'labeling',  label: '贴标喷码', shape: 'rect', category: 'process', ports: { in: 1, out: 1 } },
  i_metal:   { type: 'i_metal',   label: '金属探测', shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_seal:    { type: 'i_seal',    label: '密封检测', shape: 'diamond', category: 'inspect', ports: { in: 1, out: 2 } },
  // ═══ 检验类（通用菱形）═══
  i_incoming:{ type: 'i_incoming',label: '来料检验', shape: 'diamond', category: 'inspect', critical: true, ports: { in: 1, out: 2 } },
  i_process: { type: 'i_process', label: '过程检验', shape: 'diamond', category: 'inspect', ports: { in: 1, out: 2 } },
  i_final:   { type: 'i_final',   label: '成品检验', shape: 'diamond', category: 'inspect', ports: { in: 1, out: 2 } },
  // ═══ 仓储类（圆角矩形）═══
  wh_in:     { type: 'wh_in',     label: '入库',     shape: 'storage', category: 'storage', ports: { in: 1, out: 1 } },
  wh_out:    { type: 'wh_out',    label: '发料',     shape: 'storage', category: 'storage', ports: { in: 1, out: 1 } },
  wh_mid:    { type: 'wh_mid',    label: '中间库',   shape: 'storage', category: 'storage', ports: { in: 1, out: 1 } },
  // ═══ 起止类（椭圆）═══
  material:  { type: 'material',  label: '来料',     shape: 'oval', category: 'endpoint', ports: { in: 0, out: 1 } },
  ship:      { type: 'ship',      label: '发货',     shape: 'oval', category: 'endpoint', ports: { in: 1, out: 0 } },
  // ═══ 通用工厂主线（与 flowchart generic-factory 同源，仿真沙盒即流程图）═══
  'cust-order':  { type: 'cust-order',  label: '客户下单',       shape: 'oval',    category: 'endpoint', ports: { in: 0, out: 1 } },
  'order-review':{ type: 'order-review',label: '订单评审',       shape: 'rect',    category: 'process',  ports: { in: 1, out: 1 } },
  'mps':         { type: 'mps',         label: '主生产计划',     shape: 'rect',    category: 'process',  ports: { in: 1, out: 1 } },
  'mrp':         { type: 'mrp',         label: '物料需求计划',   shape: 'rect',    category: 'process',  ports: { in: 1, out: 1 } },
  'purchase':    { type: 'purchase',    label: '采购与供应商',   shape: 'rect',    category: 'process',  ports: { in: 1, out: 1 } },
  'bom-route':   { type: 'bom-route',   label: 'BOM 与工艺路线', shape: 'rect',    category: 'process',  ports: { in: 1, out: 1 } },
  'picking':     { type: 'picking',     label: '领料发料',       shape: 'storage', category: 'storage',  ports: { in: 1, out: 1 } },
  'dispatch':    { type: 'dispatch',    label: '生产派工',       shape: 'rect',    category: 'process',  ports: { in: 1, out: 1 } },
  'shopfloor':   { type: 'shopfloor',   label: '车间执行',       shape: 'rect',    category: 'process', critical: true, ports: { in: 1, out: 1 } },
  'qc':          { type: 'qc',          label: '质量检验',       shape: 'diamond', category: 'inspect',  ports: { in: 1, out: 2 } },
  'stock-in':    { type: 'stock-in',    label: '生产入库',       shape: 'storage', category: 'storage',  ports: { in: 1, out: 1 } },
  'shipping':    { type: 'shipping',    label: '发货出库',       shape: 'oval',    category: 'endpoint', ports: { in: 1, out: 0 } },
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
  def?: SimNodeDef; // 自定义工序的自我描述，随节点持久化，刷新后不丢
}

export interface SimNodeProps {
  hours?: number;
  defectRate?: number;
  forceInspect?: boolean;
  capacity?: number; // 产能（件/小时），C 档瓶颈分析用；缺省按工时估算
}

/** 连线 */
export interface SimEdge {
  id: string;
  from: string;
  to: string;
  dashed: boolean; // 实线/虚线（回流返工）
  ratio?: number; // 分流比率（出边多条时按比率分配，默认等权）
  label?: string; // 边标签（如「良率 95%」），B 档可视化用
}

/** 完整项目（单条产线导出/导入用） */
export interface SimProject {
  name: string;
  nodes: SimNode[];
  edges: SimEdge[];
  version: number;
}

/** 产线：一条独立工艺路线（含节点与连线），可自由编辑工序。 */
export interface SimLine {
  id: string;
  name: string;
  nodes: SimNode[];
  edges: SimEdge[];
}

/** 工厂：可含多条产线，用户自行增删工厂与产线。 */
export interface SimFactory {
  id: string;
  name: string;
  lines: SimLine[];
}

/** 画布状态：多工厂 / 多产线，画布只渲染「当前激活产线」。 */
export interface SimState {
  factories: SimFactory[];
  activeFactoryId: string;
  activeLineId: string;
  selectedId: string | null;
  selectedEdgeId: string | null;
  connectingFrom: string | null;
  connectingPort: 'out' | 'out2' | null;
}

/** 仿真运行状态（与画布设计态分离） */
export interface SimRunState {
  active: boolean;
  activeNodeId: string | null;
  logs: import('./simEngine').SimLogEntry[];
  metrics: import('./simEngine').SimMetrics | null;
  progress: number; // 0~1
  /** A 档起：仿真终态的流量分布，供连线可视化 / 瓶颈分析使用 */
  edgeFlow?: Record<string, number>;
  nodeInflow?: Record<string, number>;
  nodeOutflow?: Record<string, number>;
  bottleneckId?: string | null;
  /** C 档：瓶颈工序分析结果（产能最低的在制工序），供 KPI 卡片展示 */
  bottleneck?: import('./simEngine').SimBottleneck | null;
}

/** Action */
export type SimAction =
  | { type: 'ADD_NODE'; node: SimNode }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'UPDATE_PROPS'; id: string; props: Partial<SimNodeProps> }
  | { type: 'UPDATE_LABEL'; id: string; label: string }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'ADD_EDGE'; edge: SimEdge }
  | { type: 'UPDATE_EDGE'; id: string; patch: Partial<Pick<SimEdge, 'ratio' | 'label' | 'dashed'>> }
  | { type: 'DELETE_EDGE'; id: string }
  | { type: 'TOGGLE_EDGE'; id: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'SELECT_EDGE'; id: string | null }
  | { type: 'START_CONNECT'; fromId: string; port: 'out' | 'out2' }
  | { type: 'CANCEL_CONNECT' }
  | { type: 'AUTO_LAYOUT' }
  | { type: 'LOAD_PROJECT'; project: SimProject }
  | { type: 'LOAD_STATE'; state: SimState }
  | { type: 'CLEAR' }
  // 工厂 / 产线管理
  | { type: 'ADD_FACTORY'; name: string }
  | { type: 'RENAME_FACTORY'; id: string; name: string }
  | { type: 'DELETE_FACTORY'; id: string }
  | { type: 'ADD_LINE'; factoryId: string; name: string }
  | { type: 'RENAME_LINE'; id: string; name: string }
  | { type: 'DELETE_LINE'; id: string }
  | { type: 'SWITCH_LINE'; factoryId: string; lineId: string };

/** 形状对应的默认尺寸 */
export const SHAPE_SIZE: Record<SimShape, { w: number; h: number }> = {
  rect:    { w: 120, h: 56 },
  diamond: { w: 100, h: 100 },
  oval:    { w: 80, h: 48 },
  storage: { w: 120, h: 48 },
};
