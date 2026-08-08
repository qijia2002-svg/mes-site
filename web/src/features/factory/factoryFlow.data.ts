/**
 * 工厂全景的静态数据与布局算法（从 FactoryFlow 抽出，主文件只做编排）。
 * 视觉常量（颜色/间距）仍随组件内联 <style>，这里只放数据与拓扑算法。
 */
import type { FlowNodeDTO, FlowEdgeDTO, NodeResourceDTO } from '../../api/endpoints';
import type { IconName } from '../../components/Icon';

export type Phase = 'plan' | 'production' | 'qc' | 'logistics';

export const PHASES: Phase[] = ['plan', 'production', 'qc', 'logistics'];
export const PHASE_LABEL: Record<Phase, string> = {
  plan: '计划/仓储',
  production: '生产执行',
  qc: '质量检验',
  logistics: '物流出库',
};

/** 兜底工厂流（与 worker 种子一致）。x/y 仅作后端兼容，布局不再使用。 */
export const DEFAULT_FLOW: {
  nodes: (FlowNodeDTO & { phase: Phase })[];
  edges: FlowEdgeDTO[];
  resources: NodeResourceDTO[];
} = {
  nodes: [
    { id: 1, key: 'cust-order', label: '客户下单', kind: 'entry', icon: 'shopping-cart', x: 0, y: 200, description: '销售订单录入：客户要什么、多少、何时要。', phase: 'plan' },
    { id: 2, key: 'order-review', label: '订单评审', kind: 'process', icon: 'clipboard-check', x: 150, y: 200, description: '评审交期、产能、物料齐套性，决定是否接单与承诺交期。', phase: 'plan' },
    { id: 3, key: 'mps', label: '主生产计划', kind: 'process', icon: 'calendar', x: 300, y: 200, description: '把订单转成可执行的月度/周生产计划（MPS）。', phase: 'plan' },
    { id: 4, key: 'mrp', label: '物料需求计划', kind: 'process', icon: 'calculator', x: 450, y: 200, description: '按 BOM 展开，算出自制/外购物料的需求量与时间（MRP）。', phase: 'plan' },
    { id: 5, key: 'purchase', label: '采购与供应商', kind: 'process', icon: 'truck', x: 620, y: 110, description: '下采购单、跟供应商交期、到货与进料检验（IQC）。', phase: 'plan' },
    { id: 6, key: 'bom-route', label: 'BOM 与工艺路线', kind: 'process', icon: 'git-branch', x: 620, y: 290, description: '定义产品物料清单（BOM）与每道工序的工艺路线。', phase: 'plan' },
    { id: 7, key: 'picking', label: '领料发料', kind: 'process', icon: 'package', x: 790, y: 200, description: '仓储按工单发料到线边仓/工位（WMS）。', phase: 'plan' },
    { id: 8, key: 'dispatch', label: '生产派工', kind: 'process', icon: 'send', x: 940, y: 200, description: '把生产指令下达到具体工作中心/产线（MES 工单）。', phase: 'production' },
    { id: 9, key: 'shopfloor', label: '车间执行', kind: 'process', icon: 'factory', x: 1090, y: 200, description: '工序加工、报工（扫码/PDA/工单电脑）、在制品跟踪（MES）。', phase: 'production' },
    { id: 10, key: 'qc', label: '质量检验', kind: 'process', icon: 'check-circle', x: 1240, y: 200, description: '首检/巡检/终检，SPC 与质量追溯（QMS）。', phase: 'qc' },
    { id: 11, key: 'stock-in', label: '生产入库', kind: 'process', icon: 'warehouse', x: 1390, y: 200, description: '成品入库，更新库存（WMS）。', phase: 'logistics' },
    { id: 12, key: 'shipping', label: '发货出库', kind: 'exit', icon: 'log-out', x: 1540, y: 200, description: '按发货单拣货、装车、物流交付给客户。', phase: 'logistics' },
  ],
  edges: [
    { from: 'cust-order', to: 'order-review', label: '' },
    { from: 'order-review', to: 'mps', label: '' },
    { from: 'mps', to: 'mrp', label: '' },
    { from: 'mrp', to: 'purchase', label: '外购件' },
    { from: 'mrp', to: 'bom-route', label: '自制件 BOM' },
    { from: 'purchase', to: 'picking', label: '' },
    { from: 'bom-route', to: 'picking', label: '' },
    { from: 'picking', to: 'dispatch', label: '' },
    { from: 'dispatch', to: 'shopfloor', label: '' },
    { from: 'shopfloor', to: 'qc', label: '' },
    { from: 'qc', to: 'stock-in', label: '' },
    { from: 'stock-in', to: 'shipping', label: '' },
  ],
  resources: [],
};

/** 节点 key → phase（后端无 phase 字段时回退用）。 */
export const PHASE_BY_KEY: Record<string, Phase> = Object.fromEntries(
  DEFAULT_FLOW.nodes.map((n) => [n.key, n.phase]),
);

/** 横切系统提示：节点上挂的系统（谓语），不是主干。 */
export const SYSTEM_HINTS: Record<string, string[]> = {
  'cust-order': ['销售', 'CRM'],
  'order-review': ['销售', '计划'],
  mps: ['ERP', '计划'],
  mrp: ['ERP', '物料'],
  purchase: ['ERP', '采购', 'SRM'],
  'bom-route': ['ERP', '工程', 'PLM'],
  picking: ['WMS'],
  dispatch: ['MES'],
  shopfloor: ['MES'],
  qc: ['QMS'],
  'stock-in': ['WMS'],
  shipping: ['WMS', '物流'],
};

/** 横切全流程的系统卡片（工具，不是孤立入口）。 */
export const SYSTEMS: { id: string; name: string; icon: IconName; role: string; body: string }[] = [
  { id: 'mes', name: 'MES 制造执行', icon: 'equipment', role: '管「怎么把东西做出来」',
    body: '下工单、报工、工序流转、设备数据采集、质量节点卡控。是工厂的「神经中枢」，横贯原料→生产→质检→仓储→发货每个环节。' },
  { id: 'erp', name: 'ERP 企业资源', icon: 'sql', role: '管「要花多少、值多少」',
    body: '销售订单、BOM、采购、库存价值、成本核算。回答「生产什么、备多少料、花多少钱」，把计划层和执行层连起来。' },
  { id: 'wms', name: 'WMS 仓储管理', icon: 'package', role: '管「东西放哪、怎么拣」',
    body: '原料与成品的库位、上架策略、拣货波次。库存准不准，取决于和 MES 的实时同步。' },
  { id: 'qms', name: 'QMS 质量管理', icon: 'quiz', role: '管「合不合格、为什么」',
    body: '检验标准、不合格品隔离与偏差流程、质量追溯。把「质量」从一道工序变成贯穿全流程的能力。' },
];

export type LaidNode = FlowNodeDTO & { phase: Phase };

// BLOCK-01 修复：用白名单而非黑名单。新增资源类型（sim/micro...）必须显式加入本集合才进完成度分母，
// 否则配 useNodeStatus 的 .every(isDone) 会让节点永久卡在「未完成」。
// 导出给 useStageProgress：阶段级口径（flow_stages.practice_types）必须与本白名单**取交集**，
// 否则后端多下发一个没实现的类型就会凭空进分母，阶段永远练不完。
export const PRACTICE_TYPES: ReadonlySet<string> = new Set(['quiz', 'sql', 'sim', 'micro']);

/**
 * 「什么算实战」的全项目单点定义：只有 PRACTICE_TYPES 里的类型才算实战入口。
 * 完成度语义（C1：只认动手练）依赖它——要改判据只改 PRACTICE_TYPES 这一处，不要在组件里各写各的。
 */
export function practicesOf(res: NodeResourceDTO[]): NodeResourceDTO[] {
  return res.filter((r) => PRACTICE_TYPES.has(r.type));
}

/**
 * 按最长路径算深度，把节点切成「步骤」。深度相同 = 流程上并行的分支。
 * 有环或数据异常时回退为「按输入顺序每个节点一步」，保证永远能渲染。
 */
export function buildSteps(nodes: LaidNode[], edges: FlowEdgeDTO[]): LaidNode[][] {
  const keys = new Set(nodes.map((n) => n.key));
  const valid = edges.filter((e) => keys.has(e.from) && keys.has(e.to));
  const outs = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  nodes.forEach((n) => {
    outs.set(n.key, []);
    indeg.set(n.key, 0);
  });
  valid.forEach((e) => {
    outs.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  });

  const depth = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((n) => {
    if ((indeg.get(n.key) ?? 0) === 0) {
      depth.set(n.key, 0);
      queue.push(n.key);
    }
  });

  let seen = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    seen += 1;
    const d = depth.get(cur) ?? 0;
    for (const nx of outs.get(cur) ?? []) {
      depth.set(nx, Math.max(depth.get(nx) ?? 0, d + 1));
      const left = (indeg.get(nx) ?? 0) - 1;
      indeg.set(nx, left);
      if (left === 0) queue.push(nx);
    }
  }

  // 有环 / 未全部遍历到 → 退化为线性步骤，宁可朴素也不能不显示。
  if (seen !== nodes.length) return nodes.map((n) => [n]);

  const byDepth = new Map<number, LaidNode[]>();
  nodes.forEach((n) => {
    const d = depth.get(n.key) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  });
  return [...byDepth.keys()].sort((a, b) => a - b).map((d) => byDepth.get(d)!);
}
