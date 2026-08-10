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
 *
 * v3 追加（动机前置 + 知识卡结构化）：
 *   · motivation —— 抽屉顶部的非步骤横幅：不学的代价（pain）/ 学完能干什么（gain）。
 *     只作动机，**不做关卡**：任何时候都能直接往下走（关卡只提示不拦截）。
 *   · knowledge  —— 由一整段字符串改为 KnowledgeBlock[]，四种块型与
 *     node_explainers.kind 枚举严格同名（plain / example / mapping / misconception），
 *     以便后端「进阶详解」上线后前后端用同一套渲染，不再各写一套。
 *   bodyMd 是 Markdown，渲染必须过 renderChapterMarkdown（markdown-it html:false + DOMPurify）。
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

/**
 * 知识块四型（与 API 的 NodeExplainerDTO.kind 同枚举，别改名）：
 *   plain         大白话把概念说清楚
 *   example       样例库里的一条真数据，让概念落到具体行
 *   mapping       车间里的真实动作 ↔ 系统里的真实记录（讲系统，不打生活比方）
 *   misconception 零基础最常踩的那个坑，先点破再往下走
 */
export type KnowledgeKind = 'plain' | 'example' | 'mapping' | 'misconception';

export interface KnowledgeBlock {
  kind: KnowledgeKind;
  title: string;
  /** Markdown 正文。渲染前必须过 renderChapterMarkdown，不允许直出。 */
  bodyMd: string;
}

/** 动机前置：先说清「不懂的代价」和「懂了能干什么」，再进第一步。 */
export interface NodeMotivation {
  /** 不理解这个环节，会在工作里付出什么代价。 */
  pain: string;
  /** 学完这一节，你具体能做成哪件事。 */
  gain: string;
}

export interface BeginnerNodePath {
  /** 抽屉顶部动机横幅（非步骤，不拦截）。 */
  motivation: NodeMotivation;
  /** 初级知识卡，按块渲染。 */
  knowledge: KnowledgeBlock[];
  /** 这一步会落到哪些系统（一句话）。 */
  systems: string;
  quiz: BeginnerQuizQuestion[];
  sql: BeginnerSqlCase;
}

export const BEGINNER_PATH: Record<string, BeginnerNodePath> = {
  'cust-order': {
    motivation: {
      pain: '不知道活是从哪来的，后面的计划、采购、排产就成了无源之水——车间问"这批为什么急"，你答不上来。',
      gain: '拿到任何一条生产任务，都能反查回它那张订单：客户要什么、要多少、哪天要。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '订单是整座工厂的起跑线',
        bodyMd:
          '工厂的一切都从一张客户订单开始。订单只回答三件事：**要什么产品**、**要多少**、**什么时候要**。\n\n'
          + '订单进厂后不会一直叫"订单"。它会被落成系统里的一行**工单**（`work_orders`）——后面的计划、采购、发料、报工、质检，全部挂在这张工单上。',
      },
      {
        kind: 'example',
        title: '样例库里的一张真工单',
        bodyMd:
          '`WO-20260801-02`：产品 2、计划 60 台、交期 `2026-08-12`、二号车间。\n\n'
          + '"客户要 60 台，8 月 12 号要"在系统里就长这样——一行记录，四个字段。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 销售接到客户电话并确认 → `work_orders` 新增一行，`state = \'created\'`\n'
          + '- 谈定要 60 台 → `qty_plan = 60`\n'
          + '- 答应 8 月 12 号交货 → `due_date = \'2026-08-12\'`\n'
          + '- 一台还没做 → `qty_done = 0`',
      },
      {
        kind: 'misconception',
        title: '别把订单当合同',
        bodyMd:
          '合同管的是钱和责任，工单管的是**造多少、什么时候造完**。\n\n'
          + '一份合同经常被拆成好几张工单分批投产，所以查生产进度永远查**工单号**，查不到就是这单还没落到生产口。',
      },
    ],
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
    motivation: {
      pain: '照单全收，结果交期排不下、物料等两周——最后是车间加班、客户索赔，两头都不落好。',
      gain: '拿到一张新单能当场判断：这单能不能接、要不要谈交期，卡点卡在哪一关。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '评审就是接单前问三句话',
        bodyMd:
          '接到单不能照单全收。订单评审只回答三个问题：\n\n'
          + '1. **交期赶不赶**——从今天到交期还剩几天？\n'
          + '2. **产能够不够**——这几天车间还有空吗？\n'
          + '3. **物料齐不齐**——料在库里，还是要现买？\n\n'
          + '哪一关卡住，这单就要么接不了，要么得回头跟客户谈交期。',
      },
      {
        kind: 'example',
        title: '哪张单该先评',
        bodyMd:
          '样例库里 `WO-20260802-02` 交期 `2026-08-09`，比 `WO-20260802-01` 的 `2026-08-15` 早 6 天。\n\n'
          + '评审排序就按 `due_date` 升序：**最早交的最先评**，晚交的可以往后放一放。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 评审会上说"这单接"→ 工单 `state` 从 `created` 推到 `released`\n'
          + '- 评审会上说"交期得往后挪"→ 改的是 `due_date` 这一个字段\n'
          + '- 评审会上说"先等料"→ 工单先不 `released`，停在 `created`',
      },
      {
        kind: 'misconception',
        title: '评审不是走个签字流程',
        bodyMd:
          '很多人以为评审就是在纸上签个名。真正决定成败的是**齐套与产能这两笔账**：\n\n'
          + '签字签得再快，料没到、线排满，交期照样崩。评审的产出是一个**能兑现的交期**，不是一个签名。',
      },
    ],
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
    motivation: {
      pain: '订单一张张来，车间就一张张插，谁急插谁——设备来回换型，产能全耗在切换上。',
      gain: '把一堆零散订单合成"每个产品这周造多少台"的一张计划表，车间照着排就行。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: 'MPS 把订单合成产量',
        bodyMd:
          'MPS（主生产计划）把零散订单排成"每周 / 每月造多少台"的可执行计划。\n\n'
          + '它只回答一个问题：**我到底要产出多少台**。这是连接"客户要什么"和"工厂造什么"的那一步。',
      },
      {
        kind: 'example',
        title: '同一个产品的两张单要合并算',
        bodyMd:
          '样例库里产品 1 挂着两张工单：`WO-20260801-01` 计划 120 台、`WO-20260802-01` 计划 200 台。\n\n'
          + 'MPS 看的不是两张单，是**产品 1 合计 320 台**——这就是 `GROUP BY` 产品再 `SUM(qty_plan)` 的业务含义。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 计划员"把同产品的单归堆"→ `GROUP BY product_id`\n'
          + '- "这个产品一共要造多少"→ `SUM(qty_plan)`\n'
          + '- "先看量最大的那个产品"→ `ORDER BY 计划总量 DESC`',
      },
      {
        kind: 'misconception',
        title: 'MPS 不是排到人和机台',
        bodyMd:
          'MPS 定的是**产品级的产量与时间段**，不是"3 号机床周三下午干哪张单"。\n\n'
          + '那一层叫排产 / 派工，在后面两站。这里把量定错，后面排得再细都是白排。',
      },
    ],
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
    motivation: {
      pain: '凭经验拍脑袋备料：有的堆成山占着钱，有的临投产才发现少两件，整条线停着等。',
      gain: '给一个产量数字，就能顺着 BOM 算出该买什么、买多少、什么时候必须到。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: 'MRP 就是顺着 BOM 往下拆',
        bodyMd:
          'MRP（物料需求计划）顺着 **BOM（物料清单）** 往下拆：造一台要用哪些料、每台用多少、加上损耗该备多少。\n\n'
          + '一句话：**产量 × 单台用量 ÷ (1 − 损耗率) = 该备的量**，再减去库存，剩下的就是要买的。',
      },
      {
        kind: 'example',
        title: '损耗率不是可以忽略的小数',
        bodyMd:
          '`bom` 表里每行有 `qty_per`（单台用量）和 `loss_rate`（损耗率）。\n\n'
          + '单台用 4 件、损耗 5%，造 200 台就不是 800 件而是约 843 件。少算这一截，就是投产到一半停线补料。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- "这个产品用哪些料"→ `bom` 表按 `product_id` 筛出的那几行\n'
          + '- "每台用几件"→ `bom.qty_per`\n'
          + '- "要多备一点"→ `bom.loss_rate`\n'
          + '- "库里还剩多少"→ `materials.stock_qty`',
      },
      {
        kind: 'misconception',
        title: 'BOM 错一个字段，全厂跟着错',
        bodyMd:
          'MRP 本身只是乘除法，它不会验证 BOM 对不对。\n\n'
          + 'BOM 里 `qty_per` 填错一位，采购就照着错的量下单、仓库照着错的量发料——**没人会中途察觉**，直到产线缺件。所以查 MRP 的问题，先查 BOM。',
      },
    ],
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
    motivation: {
      pain: '单下出去就当完事，没人盯到货——投产当天才发现关键件还在供应商仓库里。',
      gain: '每天一条查询就能拉出"下了单还没到"的清单，按交期挨个催，不靠记性。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '采购单记的是四件事',
        bodyMd:
          '料不够就要买。采购单（`purchase_orders`）只记四件事：**向谁买、买什么、买多少、哪天到**。\n\n'
          + '下单之后真正的工作才开始——跟单，就是盯着"承诺到的日子"和"实际到没到"这两个字段的差。',
      },
      {
        kind: 'example',
        title: '空值就是"还没到"',
        bodyMd:
          '`purchase_orders.arrive_date` 为空（`NULL`），代表实际到货日还没人填，也就是**这批料还没进厂**。\n\n'
          + '跟单员每天第一件事，就是把 `arrive_date IS NULL` 的行拉出来打电话。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 采购员下单 → `purchase_orders` 新增一行，`arrive_date` 留空\n'
          + '- 供应商答应 7 天到 → `suppliers.lead_time_days = 7`\n'
          + '- 货到、仓库点收 → 填上 `arrive_date`\n'
          + '- 进料检验合格 → 库存 `materials.stock_qty` 才往上加',
      },
      {
        kind: 'misconception',
        title: '`NULL` 不是 0，也不是空字符串',
        bodyMd:
          '`NULL` 的意思是"这里还没有值"，不是"值等于 0"。\n\n'
          + '所以筛未到货只能写 `WHERE arrive_date IS NULL`，写成 `= NULL` 或 `= \'\'` 一行都查不出来——而且**不报错**，你会以为全到齐了。',
      },
    ],
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
    motivation: {
      pain: '把"用什么料"和"按什么顺序做"混成一团，齐套算不准、工序派不下去，两边都对不上账。',
      gain: '看到一个产品，能分别说清它的物料构成和加工顺序，知道后面每一步各取哪一份数据。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '两份数据，各管一件事',
        bodyMd:
          '**BOM** 解决"用什么料"，**工艺路线**解决"按什么顺序做"。\n\n'
          + '两者合起来才驱动后面的齐套、派工、报工。先吃透 BOM——它是缺料、成本、齐套三笔账的共同底稿；路线是进阶话题。',
      },
      {
        kind: 'example',
        title: 'BOM 的一行是什么',
        bodyMd:
          '`bom` 表里一行 = **一个产品用到的一种物料**：`product_id`（哪个产品）、`material_id`（哪种料）、`qty_per`（单件用量）、`loss_rate`（损耗率）。\n\n'
          + '一个产品用 5 种料，`bom` 里就有 5 行。查一个产品的物料构成，就是按 `product_id` 筛这几行。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 工艺员"定这个产品用哪些料"→ 往 `bom` 插几行\n'
          + '- "这料一台用几件"→ `bom.qty_per`\n'
          + '- 想看料的中文名而不是编号 → `JOIN materials` 把名字取出来\n'
          + '- "先干哪道工序"→ 工艺路线，不在 `bom` 里',
      },
      {
        kind: 'misconception',
        title: 'BOM 不是仓库库存表',
        bodyMd:
          '`bom` 说的是"造一台**应该**用多少"，`materials.stock_qty` 说的是"库里**现在**有多少"。\n\n'
          + '两张表回答的是两个问题。缺料 = 拿 BOM 算出的应发量，去和库存比——**只看其中一张，永远算不出缺不缺**。',
      },
    ],
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
    motivation: {
      pain: '料看着"发过了"就以为齐了，产线干到一半才发现少发 20 件，整条线停在那等补料。',
      gain: '一条查询就能挑出所有没发齐的领料单，早上补料，而不是下午停线。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '应发与实发，差的就是缺料',
        bodyMd:
          '仓储按工单把料发到产线，凭据是**领料单**（`pick_lists`）。\n\n'
          + '- **应发**（`qty_required`）：按 BOM 算出来的，理论上该给这么多\n'
          + '- **实发**（`qty_issued`）：仓库实际发出去的\n\n'
          + '两者相减就是缺口。`qty_issued < qty_required` = 没发齐，产线随时会卡。',
      },
      {
        kind: 'example',
        title: '齐套是"全部发齐"，不是"发了大部分"',
        bodyMd:
          '一张工单要 5 种料，4 种发齐、1 种差 20 件——这张工单**不齐套**，照样开不了工。\n\n'
          + '齐套判断没有"百分之八十"这种中间态：只要有一行 `qty_issued < qty_required`，整张工单就是缺料。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 计划下发料指令 → `pick_lists` 新增行，写上 `qty_required`\n'
          + '- 仓管拣货出库 → 填 `qty_issued`\n'
          + '- 库里不够只发了一部分 → `qty_issued` 小于 `qty_required`\n'
          + '- 补料补齐 → 把 `qty_issued` 追到与 `qty_required` 相等',
      },
      {
        kind: 'misconception',
        title: '"发过料"不等于"料发齐"',
        bodyMd:
          '很多缺料事故都出在这句话上：系统里有领料单，就默认料到位了。\n\n'
          + '有没有发和发没发齐是两件事。判断要看**两个数量字段的比较**，不是看这张单存不存在。',
      },
    ],
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
    motivation: {
      pain: '分不清工单是"已下达"还是"已开工"，早会上报的在制数量永远和车间实际对不上。',
      gain: '看一眼状态字段就知道每张工单走到哪一步，能准确说出此刻线上到底在干几张单。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '派工 = 把指令下到具体产线',
        bodyMd:
          '派工把生产指令下达到具体的工作中心 / 产线，落到系统里就是**工单状态往前推一格**。\n\n'
          + '`work_orders.state` 的五个值是一条单行道：\n\n'
          + '`created` 新建 → `released` 已下达 → `running` 加工中 → `finished` 已完工 → `closed` 已关闭',
      },
      {
        kind: 'example',
        title: '同一时刻的三种状态',
        bodyMd:
          '样例库里：`WO-20260801-01` 是 `released`（下达了，还没动手），`WO-20260801-02` 是 `running`（正在二号车间干），`WO-20260803-01` 是 `finished`（做完了）。\n\n'
          + '班组长问"今天线上在干什么"，要的就是 `state = \'running\'` 这一撮。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 计划把单下到车间 → `state` 改成 `released`\n'
          + '- 操作工按下开工 → `state` 改成 `running`\n'
          + '- 最后一件做完报工 → `state` 改成 `finished`\n'
          + '- 结算关单 → `state` 改成 `closed`',
      },
      {
        kind: 'misconception',
        title: '`released` 不等于已经在做',
        bodyMd:
          '`released` 只表示"指令已经下到车间"，人和机台可能还没动。\n\n'
          + '统计在制品只能数 `running`。把 `released` 也算进去，在制数量会虚高一大截，产能分析跟着全错。',
      },
    ],
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
    motivation: {
      pain: '只统计产量不看不良，谁的活稳、谁需要再培训全靠印象——问题攒到客户投诉才暴露。',
      gain: '按人算出合格数、不良数和良率，用数字说清"这周谁最稳"，而不是凭感觉。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '报工报的是三个数',
        bodyMd:
          '车间里每道工序做完要**报工**，报的就是三件事：**合格多少、不良多少、谁做的**。\n\n'
          + '良率 = 合格 ÷（合格 + 不良）。它衡量的不是快慢，是**稳不稳定**——这是质量和成本的共同源头。',
      },
      {
        kind: 'example',
        title: '一条报工记录',
        bodyMd:
          '`production_records` 一行 = **一次报工**：`operator`（谁）、`qty_ok`（合格）、`qty_ng`（不良）、`report_time`（什么时候报的）。\n\n'
          + '同一个人一天报好几次，所以算个人良率必须先 `GROUP BY operator` 把他的记录汇总，不能只看某一条。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 操作工扫码报工 → `production_records` 新增一行\n'
          + '- "这批做了 40 个好的"→ `qty_ok = 40`\n'
          + '- "有 2 个废了"→ `qty_ng = 2`\n'
          + '- 工单累计完成量 → `work_orders.qty_done` 跟着往上走',
      },
      {
        kind: 'misconception',
        title: '整数相除会把良率算成 0',
        bodyMd:
          'SQL 里 `40 / 42` 两个整数相除，结果是 **0** 不是 0.95——小数部分被直接截断，而且**不报错**。\n\n'
          + '所以要写 `100.0 * SUM(qty_ok) / (...)`：那个 `.0` 强制走小数除法。这是零基础最容易踩、也最难自己发现的一个坑。',
      },
    ],
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
    motivation: {
      pain: '不合格只记一句"这批不行"，不记缺陷类型——想复盘时无从追起，同一个问题下个月照犯。',
      gain: '能把不合格记录连回工单，说清是哪张单、哪种缺陷，让复盘有据可查。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '质检卡三道关',
        bodyMd:
          '质检（QMS）在**首检 / 巡检 / 终检**三个时点卡质量：开工先验一件、过程中抽查、完工前全检。\n\n'
          + '`quality_checks.result` 只有"合格 / 不合格"两个值；判为不合格的必须填 `defect_type`（缺陷类型），否则这条记录事后没有任何追溯价值。',
      },
      {
        kind: 'example',
        title: '缺陷类型可以为空，但不该为空',
        bodyMd:
          '`quality_checks` 里合格记录的 `defect_type` 天然为空；不合格记录如果也空着，就等于只留下"有问题"三个字。\n\n'
          + '复盘时真正有用的那一列，恰恰是最容易被现场省略的那一列。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 质检员抽检一批 → `quality_checks` 新增一行，带 `wo_id`\n'
          + '- 判不合格 → `result = \'不合格\'` + 填 `defect_type`\n'
          + '- 想知道是哪张工单的问题 → `JOIN work_orders` 用 `wo_id` 把工单号取出来\n'
          + '- 不合格品隔离返修 → 后续流程，不在这张表里',
      },
      {
        kind: 'misconception',
        title: '质检不是最后一道关',
        bodyMd:
          '把质量寄托在终检上，等于让不良品先做完再挑出来——料和工时已经花掉了。\n\n'
          + '质检的价值在**尽早发现**：首检拦住的是一整批，终检拦住的只是这一批的最后一眼。',
      },
    ],
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
    motivation: {
      pain: '做完了没及时入库，账面上库存永远是零——销售不敢答应发货，成品却堆在车间角落。',
      gain: '能对上"完工数量"和"入库数量"这两笔账，说清今天到底有多少台真正变成了可发的库存。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '入库了，库存才"长"出来',
        bodyMd:
          '合格成品要办入库，库存数字才会增加（WMS）。\n\n'
          + '工单 `state` 走到 `finished` 表示已完工，`qty_done` 就是实际做出来的合格数量——这个数才是可以入库、可以发货的数。',
      },
      {
        kind: 'example',
        title: '完工的工单长什么样',
        bodyMd:
          '样例库里 `WO-20260803-01`：`qty_plan = 80`、`qty_done = 80`、`state = \'finished\'`。\n\n'
          + '计划 80、做了 80、状态已完工——三个字段互相对得上，这才是一张干净的完工单。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 最后一件报完工 → `state` 改成 `finished`\n'
          + '- "一共做出来多少台"→ `qty_done`\n'
          + '- 成品送到仓库点收 → 成品库存增加\n'
          + '- 结算关单 → `state` 改成 `closed`',
      },
      {
        kind: 'misconception',
        title: '`qty_done` 不一定等于 `qty_plan`',
        bodyMd:
          '计划 100 台，最后完工 96 台是常态——中间有报废、有返修不及。\n\n'
          + '所以统计产出只能用 `qty_done`，用 `qty_plan` 当产出会**系统性高估**，而且报表上完全看不出错在哪。',
      },
    ],
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
    motivation: {
      pain: '发完货就不管了，没人回头比对承诺交期——月底客户拿着晚交清单上门，你才第一次看到这些单。',
      gain: '能把发货记录和当初承诺的交期对上，主动发现哪几批晚了、晚在哪一环。',
    },
    knowledge: [
      {
        kind: 'plain',
        title: '闭环在发货这一步合上',
        bodyMd:
          '最后一步：按发货单拣货、装车、交付客户。工单 `state` 走到 `closed`，表示全流程走完。\n\n'
          + '到这里一张订单才算真正闭环——从 `created` 到 `closed`，绕工厂一整圈回到了起点那个客户。',
      },
      {
        kind: 'example',
        title: '准不准时，就看两个日期',
        bodyMd:
          '判断是否晚交，比的是**实际发货日**和当初承诺的 `due_date`。\n\n'
          + '`WO-20260802-02` 的 `due_date` 是 `2026-08-09`——8 月 9 号之后才发出去的，就是晚交，不管中间理由是什么。',
      },
      {
        kind: 'mapping',
        title: '车间动作 ↔ 系统记录',
        bodyMd:
          '- 仓库按单拣货装车 → 成品库存减少\n'
          + '- 货发出去 → 工单 `state` 改成 `closed`\n'
          + '- "这批发了多少"→ `qty_done`\n'
          + '- "当初答应哪天交"→ `due_date`',
      },
      {
        kind: 'misconception',
        title: '`closed` 不等于按时交付',
        bodyMd:
          '`closed` 只说明"这单走完了"，一个字都没说准不准时。\n\n'
          + '准时率必须拿实际发货日去比 `due_date` 才算得出来。只数 `closed` 的条数，报表会好看得离谱，而客户的感受完全相反。',
      },
    ],
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
