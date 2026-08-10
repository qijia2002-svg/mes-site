/**
 * 初学者学习路径（零经验者专用）。
 *
 * 这条路径不走后端 node_resources，而是前端自包含：每个节点一份
 * 业务背景 → 初级知识卡 → 自测题 → SQL 案例。SQL 案例全部对着
 * sql-sandbox/dataset.ts 的真实样例表写，保证在浏览器 sql.js 里能跑通。
 *
 * 设计目标（来自产品 brief）：
 *   1) 先看业务背景，知道"学这个能干嘛"
 *   2) 用大白话知识卡入门，不跳章节
 *   3) 做几道自测题检验理解
 *   4) 进 SQL 案例：业务背景 + 逐行注释 + 语法提示卡 + 可复制参考解答 + 出错自动解析
 *   工厂模拟（sim）不在此路径内，留给进阶用户。
 */

export interface SqlAnnotation {
  /** 对应 referenceSql 的行号（1 起）。 */
  line: number;
  text: string;
}

export interface BeginnerSqlCase {
  /** 业务背景：这条 SQL 在车间里是干嘛用的（对应"不知道学这个能干嘛"）。 */
  businessBackground: string;
  /** 任务描述：你要写出一条什么查询。 */
  prompt: string;
  /** 表结构提示（可选，默认展示全部样例表芯片）。 */
  schemaHint?: string;
  /** 参考解答：可复制先跑通再看（对应"怕写错，先复制参考解答"）。 */
  referenceSql: string;
  /** 逐行注释（对应"SQL 太陌生看不懂"）。 */
  annotations: SqlAnnotation[];
}

export interface BeginnerQuizQuestion {
  stem: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface BeginnerNodePath {
  /** 初级知识卡，多段用空行分隔。 */
  knowledge: string;
  /** 这一步会落到哪些系统（一句话）。 */
  systems: string;
  quiz: BeginnerQuizQuestion[];
  sql: BeginnerSqlCase;
}

export const BEGINNER_PATH: Record<string, BeginnerNodePath> = {
  'cust-order': {
    knowledge:
      '工厂的一切，都从一张"客户订单"开始。\n订单里写着：客户要什么产品、要多少、什么时候要。\n在系统里，这张单叫"工单（work_orders）"——它是后面所有计划、采购、生产的源头。',
    systems: '销售 / CRM 接单，ERP 落为工单',
    quiz: [
      {
        stem: '工厂生产活动的"源头"通常是哪张单据？',
        options: ['工单（work_orders）', '采购单', '质检记录', '领料单'],
        answerIndex: 0,
        explanation: '客户订单进厂后落为工单，计划、采购、生产都围绕工单展开。',
      },
    ],
    sql: {
      businessBackground: '班里来新订单了，先把所有工单看一遍：客户要什么、要多少、何时要。',
      prompt: '列出全部工单的订单号、产品编号、计划数量和交付日期，按录入顺序排。',
      referenceSql: `SELECT wo_no AS 订单号, product_id AS 产品编号, qty_plan AS 计划数量, due_date AS 交付日期
FROM work_orders
ORDER BY wo_id;`,
      annotations: [
        { line: 1, text: 'SELECT 后面跟"要显示的列"；AS 起中文别名，只影响显示，不影响数据。' },
        { line: 2, text: 'FROM 指定数据从哪张表来，这里是工单表 work_orders。' },
        { line: 3, text: 'ORDER BY 排序；wo_id 是工单主键，按它排就是按录入先后。' },
      ],
    },
  },

  'order-review': {
    knowledge:
      '接到单不能照单全收。订单评审要回答三个问题：交期赶不赶？产能够不够？物料齐不齐？\n哪一关卡住，这单就可能接不了，或要谈交期。',
    systems: '销售 + 计划 共同评审',
    quiz: [
      {
        stem: '订单评审主要评估什么？',
        options: ['交期 / 产能 / 物料齐套', '谁出差旅费', '员工工资', '天气情况'],
        answerIndex: 0,
        explanation: '评审聚焦交期、产能、物料齐套性，决定能否接单与承诺交期。',
      },
    ],
    sql: {
      businessBackground: '月底要交一批单，先挑出交付日期最早、最紧急的工单优先评审。',
      prompt: '列出交付日期早于 2026-08-15 的工单（订单号、计划数量、交付日期），按交付日期升序。',
      referenceSql: `SELECT wo_no AS 订单号, qty_plan AS 计划数量, due_date AS 交付日期
FROM work_orders
WHERE due_date < '2026-08-15'
ORDER BY due_date;`,
      annotations: [
        { line: 1, text: 'SELECT 选三列：订单号、计划数量、交付日期。' },
        { line: 2, text: 'FROM work_orders 工单表。' },
        { line: 3, text: "WHERE 加筛选：due_date < '2026-08-15' 表示交付日早于这个截止日。" },
        { line: 4, text: 'ORDER BY due_date 升序，最紧急的排最前。' },
      ],
    },
  },

  mps: {
    knowledge:
      'MPS（主生产计划）把零散的订单，排成"每个月/每周造多少"的可执行计划。\n它回答：我到底要产出多少台？这是连接"客户要什么"和"工厂造什么"的关键一步。',
    systems: 'ERP 计划模块',
    quiz: [
      {
        stem: 'MPS 主要解决什么问题？',
        options: ['把订单排成可执行的产量计划', '买多少螺丝', '谁去送货', '质检标准'],
        answerIndex: 0,
        explanation: 'MPS 把订单转化为"各产品计划产量"，是计划层的核心输出。' },
    ],
    sql: {
      businessBackground: '生产计划员问：把工单按产品归类，算每个产品"计划造多少台"？',
      prompt: '按产品分组，统计每个产品的计划总产量，从高到低排。',
      referenceSql: `SELECT p.name AS 产品, SUM(w.qty_plan) AS 计划总量
FROM work_orders w
JOIN products p ON w.product_id = p.product_id
GROUP BY p.product_id
ORDER BY 计划总量 DESC;`,
      annotations: [
        { line: 1, text: 'SUM(w.qty_plan) 把多张工单的数量加总；AS 起别名"计划总量"。' },
        { line: 2, text: 'FROM work_orders w：给表起短别名 w，后面写起来更短。' },
        { line: 3, text: "JOIN products p ON ...：关联产品表，ON 写两表如何对应（外键 = 主键）。" },
        { line: 4, text: 'GROUP BY 按产品分组，配合 SUM 得到"每个产品一行合计"。' },
        { line: 5, text: 'ORDER BY 计划总量 DESC：DESC 表示降序，产量高的排前面。' },
      ],
    },
  },

  mrp: {
    knowledge:
      'MRP（物料需求计划）顺着 BOM（物料清单）往下拆：造一台减速机要用哪些料、每台用多少、加上损耗该备多少。\n它直接算出"该买什么、买多少、什么时候要"。',
    systems: 'ERP 物料模块',
    quiz: [
      {
        stem: 'MRP 展开计算主要依赖哪张表？',
        options: ['BOM 物料清单', '工单表', '质检表', '供应商表'],
        answerIndex: 0,
        explanation: 'MRP 按 BOM 把产品一层层拆成所需物料及用量。' },
    ],
    sql: {
      businessBackground: '要投产产品编号 1（减速机），先看清它用了哪些物料、单台用量和损耗率。',
      prompt: '查产品 1 的 BOM：列出物料名称、单台用量、损耗率，按单台用量从高到低排。',
      referenceSql: `SELECT m.name AS 物料名称, b.qty_per AS 单台用量, b.loss_rate AS 损耗率
FROM bom b
JOIN materials m ON b.material_id = m.material_id
WHERE b.product_id = 1
ORDER BY b.qty_per DESC;`,
      annotations: [
        { line: 1, text: 'SELECT 取物料名、单台用量、损耗率三列。' },
        { line: 2, text: 'FROM bom b：BOM 表，别名 b。' },
        { line: 3, text: 'JOIN materials m：关联物料主数据，拿到物料中文名。' },
        { line: 4, text: 'WHERE b.product_id = 1：只看产品 1 的 BOM。' },
        { line: 5, text: 'ORDER BY b.qty_per DESC：用量大的排前面。' },
      ],
    },
  },

  purchase: {
    knowledge:
      '料不够就要买。采购单（purchase_orders）记着：向谁买、买什么、买多少、承诺哪天到。\n"到货日期为空"通常意味着还没到——这是跟单员最该盯的。',
    systems: 'ERP 采购 / SRM',
    quiz: [
      {
        stem: '怎么在采购单里找出"还没到货"的？',
        options: ['筛选 arrive_date 为空', '筛选 qty_order 最大', '看 po_no', '看供应商名'],
        answerIndex: 0,
        explanation: 'arrive_date 为空代表实际到货日期未填，即尚未到货。' },
    ],
    sql: {
      businessBackground: '跟单员每天第一件事：把还没到货的采购单拉出来，挨个催供应商。',
      prompt: '列出所有"尚未到货"的采购单（采购单号、物料编号、订购量、到货日期）。',
      referenceSql: `SELECT po_no AS 采购单号, material_id AS 物料编号, qty_order AS 订购量, arrive_date AS 到货日期
FROM purchase_orders
WHERE arrive_date IS NULL;`,
      annotations: [
        { line: 1, text: 'SELECT 选采购单号、物料编号、订购量、到货日期。' },
        { line: 2, text: 'FROM purchase_orders 采购订单表。' },
        { line: 3, text: 'WHERE arrive_date IS NULL：NULL 表示"还没有值"，即未到货。' },
      ],
    },
  },

  'bom-route': {
    knowledge:
      'BOM 解决"用什么料"，工艺路线解决"按什么顺序做"。\n两者合起来才驱动后面的齐套、派工、报工。先吃透 BOM，路线是进阶话题。',
    systems: 'ERP 工程 / PLM',
    quiz: [
      {
        stem: 'BOM 与工艺路线分别回答什么？',
        options: ['用什么料 / 按什么顺序做', '买多少 / 卖给谁', '合格否 / 不良否', '入库否 / 出库否'],
        answerIndex: 0,
        explanation: 'BOM=物料构成，工艺路线=加工顺序，二者是齐套与排产的基础。' },
    ],
    sql: {
      businessBackground: '工艺员在定 BOM，先确认产品 1 都用到了哪些物料及其用量。',
      prompt: '查产品 1 的物料构成：物料名称、单件用量、损耗率，按单件用量降序。',
      referenceSql: `SELECT m.name AS 物料名称, b.qty_per AS 单件用量, b.loss_rate AS 损耗率
FROM bom b
JOIN materials m ON b.material_id = m.material_id
WHERE b.product_id = 1
ORDER BY b.qty_per DESC;`,
      annotations: [
        { line: 1, text: 'SELECT 取物料名、单件用量、损耗率。' },
        { line: 2, text: 'FROM bom b 关联物料表。' },
        { line: 3, text: 'JOIN materials m ON b.material_id = m.material_id 拿中文名。' },
        { line: 4, text: 'WHERE b.product_id = 1 只取产品 1。' },
      ],
    },
  },

  picking: {
    knowledge:
      '仓储按工单发料到产线（领料单 pick_lists）。\n"应发"是按 BOM 算出来的，"实发"是实际发出的；实发少于应发，就是缺料，产线会卡住。',
    systems: 'WMS 仓储',
    quiz: [
      {
        stem: '领料单里"实发 < 应发"说明什么？',
        options: ['缺料，没发齐', '发多了', '已完工', '已质检'],
        answerIndex: 0,
        explanation: 'qty_issued < qty_required 表示物料没发齐，产线可能缺料待料。' },
    ],
    sql: {
      businessBackground: '仓管晨会：先把"没发齐"的领料单挑出来，赶紧补料，别让产线停。',
      prompt: '列出实发数量少于应发数量的领料单（领料单号、工单、应发、实发）。',
      referenceSql: `SELECT pick_no AS 领料单号, wo_id AS 工单, qty_required AS 应发, qty_issued AS 实发
FROM pick_lists
WHERE qty_issued < qty_required;`,
      annotations: [
        { line: 1, text: 'SELECT 取领料单号、工单、应发、实发四列。' },
        { line: 2, text: 'FROM pick_lists 领料单表。' },
        { line: 3, text: 'WHERE qty_issued < qty_required：实发小于应发，即没发齐（缺料）。' },
      ],
    },
  },

  dispatch: {
    knowledge:
      '派工把生产指令下达到具体产线（MES 工单）。\n工单状态 state 有 created / released / running / finished / closed，running 就是"正在车间干"。',
    systems: 'MES 制造执行',
    quiz: [
      {
        stem: '工单状态 running 表示什么？',
        options: ['正在车间加工', '还没创建', '已完工入库', '已发货'],
        answerIndex: 0,
        explanation: 'state=running 表示工单已下到产线、正在加工。' },
    ],
    sql: {
      businessBackground: '班组长接早会：先看今天有哪些工单正在产线上跑。',
      prompt: '列出当前正在执行（running）的工单：工单号、车间、计划量、已做量。',
      referenceSql: `SELECT wo_no AS 工单号, workshop AS 车间, qty_plan AS 计划, qty_done AS 已做
FROM work_orders
WHERE state = 'running';`,
      annotations: [
        { line: 1, text: 'SELECT 取工单号、车间、计划、已做。' },
        { line: 2, text: 'FROM work_orders 工单表。' },
        { line: 3, text: "WHERE state = 'running'：筛出正在加工的工单。" },
      ],
    },
  },

  shopfloor: {
    knowledge:
      '车间里每道工序完工要"报工"：合格多少、不良多少、谁做的。\n良率 = 合格 ÷（合格+不良），是衡量操作工稳不稳定的关键指标。',
    systems: 'MES 车间执行',
    quiz: [
      {
        stem: '良率（合格率）怎么算？',
        options: ['合格 ÷（合格 + 不良）', '不良 ÷ 合格', '合格 × 不良', '合格 - 不良'],
        answerIndex: 0,
        explanation: '良率 = 合格数 / 总数量（合格+不良），是质量与效率的核心比值。' },
    ],
    sql: {
      businessBackground: '班组长要算每个操作工的良率，谁最稳、谁要再培训，一目了然。',
      prompt: '按操作工分组，算每人合格数、不良数和良率（百分比，保留两位小数），按良率降序。',
      referenceSql: `SELECT operator AS 操作工, SUM(qty_ok) AS 合格, SUM(qty_ng) AS 不良,
       ROUND(100.0 * SUM(qty_ok) / (SUM(qty_ok) + SUM(qty_ng)), 2) AS 良率
FROM production_records
GROUP BY operator
ORDER BY 良率 DESC;`,
      annotations: [
        { line: 1, text: 'SELECT operator 操作工，SUM(qty_ok) 合格合计、SUM(qty_ng) 不良合计。' },
        { line: 2, text: 'ROUND(..., 2) 把良率四舍五入保留两位小数；100.0 的 .0 保证做小数除法。' },
        { line: 3, text: 'FROM production_records 生产记录表。' },
        { line: 4, text: 'GROUP BY operator：每人一行汇总。' },
        { line: 5, text: 'ORDER BY 良率 DESC：良率高的排前面。' },
      ],
    },
  },

  qc: {
    knowledge:
      '质检（QMS）在首检/巡检/终检卡质量关。\nquality_checks 里 result 是"合格/不合格"，不合格的要记 defect_type（缺陷类型）以便追溯。',
    systems: 'QMS 质量管理',
    quiz: [
      {
        stem: '质检记录里哪个字段表示"合不合格"？',
        options: ['result', 'wo_no', 'operator', 'qty_plan'],
        answerIndex: 0,
        explanation: 'quality_checks.result 取值"合格/不合格"，是不合格品追溯的入口。' },
    ],
    sql: {
      businessBackground: '质量工程师复盘：哪些工单被检出了不合格？要逐一追缺陷类型。',
      prompt: '列出质检结果为"不合格"的记录：工单 ID、工单号、结果、缺陷类型，按检查 ID 排。',
      referenceSql: `SELECT q.wo_id AS 工单, w.wo_no AS 工单号, q.result AS 结果, q.defect_type AS 缺陷
FROM quality_checks q
JOIN work_orders w ON q.wo_id = w.wo_id
WHERE q.result = '不合格'
ORDER BY q.check_id;`,
      annotations: [
        { line: 1, text: 'SELECT 从两张表取字段：质检的工单、结果、缺陷，关联出工单号。' },
        { line: 2, text: 'FROM quality_checks q 质检表别名 q。' },
        { line: 3, text: 'JOIN work_orders w ON q.wo_id = w.wo_id：用外键 wo_id 关联工单表。' },
        { line: 4, text: "WHERE q.result = '不合格'：只保留不合格记录。" },
      ],
    },
  },

  'stock-in': {
    knowledge:
      '合格成品要入库，库存才"长"出来（WMS）。\n工单 state 到 finished 表示已完工，qty_done 就是实际入库的合格数量。',
    systems: 'WMS 仓储',
    quiz: [
      {
        stem: '成品入库通常对应工单的哪个状态？',
        options: ['finished 已完工', 'created 新建', 'running 进行中', 'closed 已关闭'],
        answerIndex: 0,
        explanation: 'state=finished 表示工单已完工，成品可入库更新库存。' },
    ],
    sql: {
      businessBackground: '仓管盘入库：今天有哪些工单完工了、各入了多少。',
      prompt: '列出已完工（finished）的工单：工单号、完工数量、所属车间。',
      referenceSql: `SELECT wo_no AS 工单号, qty_done AS 完工数量, workshop AS 车间
FROM work_orders
WHERE state = 'finished';`,
      annotations: [
        { line: 1, text: 'SELECT 取工单号、完工数量、车间。' },
        { line: 2, text: 'FROM work_orders 工单表。' },
        { line: 3, text: "WHERE state = 'finished'：筛已完工工单。" },
      ],
    },
  },

  shipping: {
    knowledge:
      '最后一步：按发货单拣货、装车、物流交付客户。\n工单 state 到 closed 表示全流程走完、已发货。到这里，一张订单才算真正闭环。',
    systems: 'WMS + 物流',
    quiz: [
      {
        stem: '工单全流程走完、已发货，对应哪个状态？',
        options: ['closed', 'running', 'released', 'created'],
        answerIndex: 0,
        explanation: 'state=closed 表示工单已发货、流程闭环。' },
    ],
    sql: {
      businessBackground: '物流主管看板：今天有哪些工单已经发货了。',
      prompt: '列出已发货（closed）的工单：工单号、发货数量、应交期。',
      referenceSql: `SELECT wo_no AS 工单号, qty_done AS 发货数量, due_date AS 应交期
FROM work_orders
WHERE state = 'closed';`,
      annotations: [
        { line: 1, text: 'SELECT 取工单号、发货数量（即完工数量）、应交期。' },
        { line: 2, text: 'FROM work_orders 工单表。' },
        { line: 3, text: "WHERE state = 'closed'：筛已发货工单。" },
      ],
    },
  },
};

/** 取节点的初学者路径；缺失时返回 undefined，由调用方兜底。 */
export function beginnerPathOf(key: string): BeginnerNodePath | undefined {
  return BEGINNER_PATH[key];
}
