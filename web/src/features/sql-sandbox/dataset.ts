// 沙箱样例库：单一事实源是同目录 dataset.sql，此处只做 ?raw 引入，绝不另抄一份。
// 后端 seed 计算 answer_hash 时必须读取同一个 dataset.sql 建库。
import datasetSql from './dataset.sql?raw';

export const SANDBOX_DATASET_SQL: string = datasetSql;

/** 沙箱内可用的表，用于结构提示与重置。 */
export const SANDBOX_TABLES = [
  'products',
  'materials',
  'bom',
  'equipment',
  'work_orders',
  'production_records',
  'quality_checks',
  'suppliers',
  'purchase_orders',
  'pick_lists',
] as const;

/** 未绑定题目时的默认演示查询。 */
export const SANDBOX_SAMPLE_QUERY = `SELECT p.name AS 产品, SUM(w.qty_plan) AS 计划总量
FROM work_orders w
JOIN products p ON w.product_id = p.product_id
GROUP BY p.product_id
ORDER BY 计划总量 DESC;`;

/** 表结构参考（用于表参考芯片） */
export const TABLE_SCHEMAS: Record<string, { name: string; fields: { name: string; type: string; desc: string }[] }> = {
  products: {
    name: '产品主数据',
    fields: [
      { name: 'product_id', type: 'INTEGER', desc: '产品ID (PK)' },
      { name: 'code', type: 'TEXT', desc: '产品编码' },
      { name: 'name', type: 'TEXT', desc: '产品名称' },
      { name: 'spec', type: 'TEXT', desc: '规格型号' },
      { name: 'unit', type: 'TEXT', desc: '单位' },
    ],
  },
  materials: {
    name: '物料主数据',
    fields: [
      { name: 'material_id', type: 'INTEGER', desc: '物料ID (PK)' },
      { name: 'code', type: 'TEXT', desc: '物料编码' },
      { name: 'name', type: 'TEXT', desc: '物料名称' },
      { name: 'unit', type: 'TEXT', desc: '单位' },
      { name: 'stock_qty', type: 'INTEGER', desc: '库存数量' },
    ],
  },
  bom: {
    name: 'BOM 物料清单',
    fields: [
      { name: 'bom_id', type: 'INTEGER', desc: 'BOM ID (PK)' },
      { name: 'product_id', type: 'INTEGER', desc: '产品ID (FK)' },
      { name: 'material_id', type: 'INTEGER', desc: '物料ID (FK)' },
      { name: 'qty_per', type: 'INTEGER', desc: '单件用量' },
      { name: 'loss_rate', type: 'REAL', desc: '损耗率' },
    ],
  },
  equipment: {
    name: '设备主数据',
    fields: [
      { name: 'equip_id', type: 'INTEGER', desc: '设备ID (PK)' },
      { name: 'code', type: 'TEXT', desc: '设备编码' },
      { name: 'name', type: 'TEXT', desc: '设备名称' },
      { name: 'workshop', type: 'TEXT', desc: '所属车间' },
      { name: 'status', type: 'TEXT', desc: '状态 (运行/停机/故障)' },
    ],
  },
  work_orders: {
    name: '工单',
    fields: [
      { name: 'wo_id', type: 'INTEGER', desc: '工单ID (PK)' },
      { name: 'wo_no', type: 'TEXT', desc: '工单号' },
      { name: 'product_id', type: 'INTEGER', desc: '产品ID (FK)' },
      { name: 'qty_plan', type: 'INTEGER', desc: '计划数量' },
      { name: 'qty_done', type: 'INTEGER', desc: '完成数量' },
      { name: 'due_date', type: 'TEXT', desc: '交付日期' },
      { name: 'state', type: 'TEXT', desc: '状态 (created/released/running/finished/closed)' },
      { name: 'workshop', type: 'TEXT', desc: '所属车间' },
    ],
  },
  production_records: {
    name: '生产记录',
    fields: [
      { name: 'rec_id', type: 'INTEGER', desc: '记录ID (PK)' },
      { name: 'wo_id', type: 'INTEGER', desc: '工单ID (FK)' },
      { name: 'equip_id', type: 'INTEGER', desc: '设备ID (FK)' },
      { name: 'operator', type: 'TEXT', desc: '操作工' },
      { name: 'qty_ok', type: 'INTEGER', desc: '合格数' },
      { name: 'qty_ng', type: 'INTEGER', desc: '不良数' },
      { name: 'report_time', type: 'TEXT', desc: '报工时间' },
    ],
  },
  quality_checks: {
    name: '质检记录',
    fields: [
      { name: 'check_id', type: 'INTEGER', desc: '检查ID (PK)' },
      { name: 'wo_id', type: 'INTEGER', desc: '工单ID (FK)' },
      { name: 'check_time', type: 'TEXT', desc: '检查时间' },
      { name: 'result', type: 'TEXT', desc: '结果 (合格/不合格)' },
      { name: 'defect_type', type: 'TEXT', desc: '缺陷类型 (可空)' },
    ],
  },
  suppliers: {
    name: '供应商主数据',
    fields: [
      { name: 'supplier_id', type: 'INTEGER', desc: '供应商ID (PK)' },
      { name: 'code', type: 'TEXT', desc: '供应商编码' },
      { name: 'name', type: 'TEXT', desc: '供应商名称' },
      { name: 'contact', type: 'TEXT', desc: '对接人' },
      { name: 'lead_time_days', type: 'INTEGER', desc: '承诺交期天数' },
    ],
  },
  purchase_orders: {
    name: '采购订单',
    fields: [
      { name: 'po_id', type: 'INTEGER', desc: '采购单ID (PK)' },
      { name: 'po_no', type: 'TEXT', desc: '采购单号' },
      { name: 'supplier_id', type: 'INTEGER', desc: '供应商ID (FK)' },
      { name: 'material_id', type: 'INTEGER', desc: '物料ID (FK)' },
      { name: 'qty_order', type: 'INTEGER', desc: '订购数量' },
      { name: 'qty_received', type: 'INTEGER', desc: '已收数量' },
      { name: 'order_date', type: 'TEXT', desc: '下单日期' },
      { name: 'promise_date', type: 'TEXT', desc: '承诺到货日期' },
      { name: 'arrive_date', type: 'TEXT', desc: '实际到货日期 (空 = 未到货)' },
      { name: 'state', type: 'TEXT', desc: '状态 (created/approved/shipped/received)' },
    ],
  },
  pick_lists: {
    name: '领料单',
    fields: [
      { name: 'pick_id', type: 'INTEGER', desc: '领料单ID (PK)' },
      { name: 'pick_no', type: 'TEXT', desc: '领料单号' },
      { name: 'wo_id', type: 'INTEGER', desc: '工单ID (FK)' },
      { name: 'material_id', type: 'INTEGER', desc: '物料ID (FK)' },
      { name: 'qty_required', type: 'INTEGER', desc: '应发数量 (按 BOM 含损耗算)' },
      { name: 'qty_issued', type: 'INTEGER', desc: '实发数量 (小于应发 = 缺料)' },
      { name: 'pick_time', type: 'TEXT', desc: '领料时间' },
      { name: 'state', type: 'TEXT', desc: '状态 (pending/partial/done)' },
    ],
  },
};

/**
 * 引导式挑战（纯前端，无判题哈希）。让空白编辑器变成「有任务的练习场」：
 * 选一个场景 → 载入模板 → 在 TODO 处补全 → 运行看结果。
 * 与后端 sql_exercises（带 answer_hash 的判题题，走 /sql-space/:id）互补。
 */
export interface SandboxChallenge {
  id: string;
  category: '基础查询' | '关联查询' | '聚合统计' | '综合实战';
  difficulty: '入门' | '进阶' | '高级';
  title: string;
  scenario: string;
  starterSql: string;
  expected: string;
}

export const SANDBOX_CHALLENGES: SandboxChallenge[] = [
  {
    id: 'c1',
    category: '基础查询',
    difficulty: '入门',
    title: '仓库里谁快见底了',
    scenario: '车间主任路过：『库存低于 300 件的物料有哪些？给我拉个清单。』',
    starterSql: 'SELECT code, name, stock_qty\nFROM materials\nWHERE stock_qty < 300\nORDER BY stock_qty ASC;',
    expected: '应列出 控制主板(96)、定子组件(210)。',
  },
  {
    id: 'c2',
    category: '基础查询',
    difficulty: '入门',
    title: '工单进度一眼看',
    scenario: '班前会要贴一张表：每张工单计划做多少、已经做了多少、现在什么状态。',
    starterSql: 'SELECT wo_no, qty_plan, qty_done, state\nFROM work_orders\nORDER BY wo_id;',
    expected: '6 张工单，状态分别是 released / running / finished 等。',
  },
  {
    id: 'c3',
    category: '关联查询',
    difficulty: '进阶',
    title: '每个产品计划总产量',
    scenario: '生产计划员问：把工单按产品归类，算每个产品「计划造多少台」？',
    starterSql: 'SELECT p.name AS 产品, SUM(w.qty_plan) AS 计划总量\nFROM work_orders w\nJOIN products p ON w.product_id = p.product_id\n-- TODO: 补上 GROUP BY，让每个产品一行\nORDER BY 计划总量 DESC;',
    expected: '减速机 320、伺服电机 100、PLC控制器 150、变频器 80（按样例数据）。',
  },
  {
    id: 'c4',
    category: '关联查询',
    difficulty: '进阶',
    title: '哪些工单被检出了不合格',
    scenario: '质量工程师要复盘：哪些工单的质检结果是「不合格」？',
    starterSql: "SELECT q.wo_id, w.wo_no, q.result, q.defect_type\nFROM quality_checks q\nJOIN work_orders w ON q.wo_id = w.wo_id\nWHERE q.result = '不合格'\nORDER BY q.check_id;",
    expected: '应命中 4 条，涉及工单 WO-01、WO-04（两次）、WO-03。',
  },
  {
    id: 'c5',
    category: '聚合统计',
    difficulty: '进阶',
    title: '各车间完成量排行',
    scenario: '厂长要看各车间「已完成工单的合计完成数量」，谁最能打？',
    starterSql: "SELECT workshop AS 车间, SUM(qty_done) AS 已完成合计\nFROM work_orders\n-- TODO: 只统计已 finished 的工单（WHERE state = ?）\nGROUP BY workshop\nORDER BY 已完成合计 DESC;",
    expected: '一号车间 80（仅 WO-05 为 finished），其余车间暂无 finished 工单为 0。',
  },
  {
    id: 'c6',
    category: '聚合统计',
    difficulty: '进阶',
    title: '缺陷类型次数盘点',
    scenario: '质量月报：每种缺陷类型出现了几次？',
    starterSql: "SELECT defect_type, COUNT(*) AS 次数\nFROM quality_checks\nWHERE defect_type IS NOT NULL\nGROUP BY defect_type\nORDER BY 次数 DESC;",
    expected: '尺寸超差 2、外观划伤 1、装配错位 1。',
  },
  {
    id: 'c7',
    category: '综合实战',
    difficulty: '高级',
    title: '算 BOM 物料需求',
    scenario: '要投产 200 台减速机(产品 1)：每种物料净需求多少？算上损耗率后该备多少？',
    starterSql: 'SELECT m.name AS 物料,\n       b.qty_per * 200 AS 净需求,\n       -- TODO: 加上损耗，向上取整到整数\n       CAST(b.qty_per * 200 * (1 + b.loss_rate) AS INTEGER) AS 含损耗\nFROM bom b\nJOIN materials m ON b.material_id = m.material_id\nWHERE b.product_id = 1;',
    expected: '减速机(产品1)用 铸铁箱体、轴承：净需求 200 / 800，含损耗约 204 / 808。',
  },
  {
    id: 'c8',
    category: '综合实战',
    difficulty: '高级',
    title: '操作工良率排行',
    scenario: '班组长要算每个操作工的良率（合格数 / 总数量），谁最稳？',
    starterSql: 'SELECT operator AS 操作工,\n       SUM(qty_ok) AS 合格,\n       SUM(qty_ng) AS 不良,\n       -- TODO: 计算良率百分比，保留两位小数\n       ROUND(100.0 * SUM(qty_ok) / (SUM(qty_ok) + SUM(qty_ng)), 2) AS 良率\nFROM production_records\nGROUP BY operator\nORDER BY 良率 DESC;',
    expected: '陆明辉、甘若彤、邱敬川三人，按良率从高到低。',
  },
];
