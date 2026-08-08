/**
 * 6 站主线的静态兜底（SPEC §6「内容播种计划」逐行誊抄，不是前端自创）。
 *
 * 为什么前端要留一份：`GET /api/v1/flowchart/:flowId` 目前只回 {flow,nodes,edges,resources}，
 * `stages` 与节点的 `stage_key` / `one_liner` 要等后端 ALTER + 种子回填才有。
 * 后端一旦下发，接口数据**永远优先**，这里只在缺失时兜底（BLOCK-04 中间态回落）。
 *
 * 铁律：兜底只补「结构」，不补「内容正文」。micro/quiz 题目与讲解一律来自后端。
 */
import type { FlowStageDTO } from '../../api/endpoints';

/** 6 站按业务流排序，stage_key 与 SPEC §6 flow_stages 种子表一一对应。 */
export const DEFAULT_STAGES: FlowStageDTO[] = [
  { stageKey: 'tour', title: '先走一圈', subtitle: '用一张订单，把工厂全貌看一遍',
    icon: 'compass', practiceTypes: ['micro', 'quiz'], sort: 1 },
  { stageKey: 'plan', title: '计划订单', subtitle: '这张单怎么变成可生产的计划',
    icon: 'clipboard-check', practiceTypes: ['micro', 'quiz'], sort: 2 },
  { stageKey: 'procure', title: '采购齐套', subtitle: '物料怎么买齐、怎么验收入库',
    icon: 'truck', practiceTypes: ['micro', 'quiz', 'sql', 'sim'], sort: 3 },
  { stageKey: 'produce', title: '生产工单', subtitle: '计划怎么下到产线、怎么报工',
    icon: 'factory', practiceTypes: ['micro', 'quiz', 'sql', 'sim'], sort: 4 },
  { stageKey: 'quality', title: '质量检验', subtitle: '怎么做首检巡检、怎么追溯',
    icon: 'check-circle', practiceTypes: ['micro', 'quiz', 'sql', 'sim'], sort: 5 },
  { stageKey: 'ship', title: '仓储发运', subtitle: '成品怎么入库、怎么发到客户手上',
    icon: 'log-out', practiceTypes: ['micro', 'quiz', 'sql', 'sim'], sort: 6 },
];

/** 节点 key → 所属站（SPEC §6 映射表）。后端 stage_key 缺失时兜底。 */
export const STAGE_BY_NODE: Record<string, string> = {
  'cust-order': 'tour',
  'order-review': 'plan',
  mps: 'plan',
  mrp: 'plan',
  purchase: 'procure',
  'bom-route': 'procure',
  picking: 'produce',
  dispatch: 'produce',
  shopfloor: 'produce',
  qc: 'quality',
  'stock-in': 'ship',
  shipping: 'ship',
};

/** 节点 key → 大白话一句话（SPEC §6 one_liner 列）。抽屉第一行用它，不用 description。 */
export const ONE_LINER_BY_NODE: Record<string, string> = {
  'cust-order': '一张订单进厂：客户要什么、多少、何时要',
  'order-review': '评审交期、产能、物料齐套，决定接不接这单',
  mps: '把订单排成可执行的月度/周生产计划（MPS）',
  mrp: '按 BOM 展开，算出自制/外购物料的需求量与时间',
  purchase: '下采购单、跟供应商交期、到货与进料检（IQC）',
  'bom-route': '定 BOM 与工艺路线，驱动齐套',
  picking: '仓储按工单发料到线边仓（WMS）',
  dispatch: '把生产指令下到产线（MES 工单）',
  shopfloor: '工序加工、报工、在制品跟踪（MES）',
  qc: '首检/巡检/终检，质量追溯（QMS）',
  'stock-in': '成品入库，更新库存（WMS）',
  shipping: '拣货、装车、物流交付客户',
};

/**
 * 取节点所属站。**空串按「未分配」处理并回落静态映射**——BLOCK-04 的核心：
 * 绝不把空串默认成 'tour'，那会让一整批节点被静默算进入门段的完成度口径。
 */
export function stageKeyOf(node: { key: string; stageKey?: string }): string {
  const fromApi = (node.stageKey ?? '').trim();
  if (fromApi) return fromApi;
  return STAGE_BY_NODE[node.key] ?? '';
}

/** 取节点一句话；后端未回填时用静态兜底，再兜底给空串（调用方决定要不要渲染）。 */
export function oneLinerOf(node: { key: string; oneLiner?: string }): string {
  const fromApi = (node.oneLiner ?? '').trim();
  if (fromApi) return fromApi;
  return ONE_LINER_BY_NODE[node.key] ?? '';
}
