-- ============================================================================
-- 种子：工厂主线「剩余 9 个学习工位」的专属内容
-- ----------------------------------------------------------------------------
-- 配套 seed-flowchart-generic-resources.sql（先跑那个挂 purchase/picking/qc），
-- 本文件挂其余 9 个节点：cust-order / order-review / mps / mrp / bom-route /
-- dispatch / shopfloor / stock-in / shipping。
--
-- 设计约束（架构师裁定，勿违）：
--   C1  节点完成度只认「做过实战」，知识卡片读完不算完成。
--   C2  node_resources.title 必须是祈使句 —— 学员看到的是一个动作，不是一个名词。
--   C3  没内容就不出行。绝不用通用兜底链接充数。
--
-- 判题哈希来源：node scripts/gen-answer-hash.mjs --batch tmp/node-sql-items-9.json
--   九道题的 answer_hash 由 web/src/features/sql-sandbox/dataset.sql 本地复算得出，
--   与前端 web/src/lib/resultHash.ts 同算法。改 dataset.sql 后必须重跑：
--   node scripts/gen-answer-hash.mjs --regress
--
-- 显式 id（9xxx 预留段）的理由：学习进度按 `${type}:${refId}` 落在 userData 的
--   factory.progress 里。若用 AUTOINCREMENT，每次重跑 seed 章节 id 都会漂移，进度被清零。
--
-- 重跑安全：先按业务键清掉本 seed 管辖的行，再插入。不碰 purchase/picking/qc 的内容。
--
-- 部署：
--   node scripts/d1q.mjs --file worker/src/migrations/seed-flowchart-generic-resources-9more.sql
-- ============================================================================

PRAGMA foreign_keys = OFF;

DELETE FROM node_resources
 WHERE node_id IN (
   SELECT id FROM flow_nodes
    WHERE flow_id IN (SELECT id FROM flowcharts WHERE slug = 'generic-factory')
      AND node_key IN ('cust-order','order-review','mps','mrp','bom-route',
                       'dispatch','shopfloor','stock-in','shipping')
 );
DELETE FROM questions      WHERE id BETWEEN 9204 AND 9212;
DELETE FROM sql_exercises  WHERE id BETWEEN 9304 AND 9312;
DELETE FROM chapters       WHERE id BETWEEN 9104 AND 9112;

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- 章节 9104 · 客户下单
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9104, 9001, '客户下单：工厂全景的起点', 4, 'published',
'# 客户下单：工厂全景的起点

客户在系统里录一张销售订单，工厂这才知道要生产什么、多少、何时要。这一环本身不难，难的是交期——客户要的日期，往往早于工厂真实能交付的日期。

## 订单在系统里对应什么

| 动作 | 主责系统 | 落到哪张表 |
|---|---|---|
| 录入客户要货 | CRM / 销售 | `sales_orders` |
| 客户档案与分级 | CRM | `customers` |
| 评审交期与产能 | ERP 计划 | 订单评审状态 |

## 交期是命门

销售订单里最该盯的字段是 `due_date`（客户要货日）。它通常早于工厂能交付的日期。在评审之前没有任何人拦这道关，所以急单往往在录单那一刻就已经埋下。

## 分级影响处置优先级

`customers.tier` 标记客户重要度（A/B/C）。同样逾期，A 类客户的单子要先救。但无论哪类，第一步都是先把它从海量订单里揪出来。

## 动手之前

样例库有 12 张订单，其中几张还没评审、交期却已经逼近。先别信汇报，自己查出来。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9105 · 订单评审
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9105, 9001, '订单评审：接了不等于做得出', 5, 'published',
'# 订单评审：接了不等于做得出

评审决定一张订单接不接、承诺什么交期。常见埋雷：销售为业绩把单子评审通过了（review_status 是 approved），但生产计划侧根本没排产（plan_status 是 none），交期一路逼近却没人动。

## 两个状态字段要一起看

| 字段 | 含义 |
|---|---|
| review_status | 评审结论：pending / approved / rejected |
| plan_status | 排产状态：none / planned / producing / done |

只盯 review_status 会误以为都安排好了。approved 加 none 的组合才是真正的风险：口头接了，手里没动作。

## 为什么会这样

销售有接单压力，评审容易变成走过场；计划排产慢半拍，中间的空档没人负责。实施时这两个状态应做成联动校验，approved 必须触发排产任务。

## 动手之前

样例库里有几张 approved 却 none 的订单，交期各不相同。先把它们捞出来，按交期排，最急的先排产。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9106 · 主生产计划
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9106, 9001, '主生产计划：把订单变成可执行的排产', 6, 'published',
'# 主生产计划（MPS）：把订单变成可执行的排产

MPS 是把评审通过的订单，聚合成每月、每周产什么、产多少的计划。它是需求与产能之间的桥梁，往下喂给 MRP 算物料，往上承接销售承诺。

## MPS 回答的问题

不是某张工单怎么做，而是各产品在什么时间段计划产多少。所以 MPS 的核心动作就是按产品聚合。

## 聚合就是 GROUP BY

把评审通过的订单按 `product_id` 分组，数一数有多少张单、加一加总数量，一张主生产计划就出来了。订单多的时候，这个聚合能一眼看出哪个产品是产出大头。

## 动手之前

样例库里已评审通过的订单横跨 4 个产品。把它们按产品汇总，看计划产量排出来是什么样。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9107 · 物料需求计划
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9107, 9001, '物料需求计划：要买多少不是拍脑袋', 7, 'published',
'# 物料需求计划（MRP）：要买多少不是拍脑袋

MPS 给出产品需求，MRP 把它按 BOM 展开成自制件、外购物料的需求量，再减去现有库存，得到净需求。净需求大于 0 才要采购——这是采购量的唯一合理来源。

## 三个数算出净需求

| 概念 | 来源 |
|---|---|
| 毛需求 | 订单量 × BOM 单件用量 ×（1 + 损耗率） |
| 现有库存 | `materials.stock_qty` |
| 净需求 | 毛需求 − 现有库存（取正数） |

损耗率这一项绝不能省。做 100 台要 100 个箱体是错的，要按 BOM 的损耗加上去，否则永远差一点。

## 为什么要自己算

ERP 有 MRP 跑出来的需求建议表，但口径是系统定的。采购员自己写一句 SQL，能验证系统的数，也能在系统没覆盖的场景下独立判断。

## 动手之前

样例库里已评审订单对部分物料的净需求是正的。把它们算出来，按净需求从大到小排。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9108 · BOM 与工艺路线
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9108, 9001, 'BOM：一个物料被多少产品共用', 8, 'published',
'# BOM 与工艺路线：一个物料被多少产品共用

BOM（物料清单）描述一个产品由哪些物料组成，每层用量多少。它是 MRP 展开的起点，也是工艺路线的依据。

## 共用料是风险放大器

有些物料被很多产品共用（比如轴承），一旦这种料短缺，会连累一大片产品同时停线。识别高共用度物料，是缺料风险预警的第一课。

## 怎么看共用度

对 `bom` 表按物料分组，数一数它出现在几个不同的 `product_id` 下。出现次数越多，牵一发而动全身的威力越大。

## 动手之前

样例库 4 个产品共用 5 种物料。把每种物料被多少个产品使用统计出来，看谁是高共用度物料。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9109 · 生产派工
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9109, 9001, '生产派工：先看设备能不能接', 9, 'published',
'# 生产派工：先看设备能不能接

派工把生产指令下达到具体工作中心或设备（MES 工单）。派工的前提是该车间有运行状态的设备。若车间唯一设备停机，工单下了也动不了。

## 派工不是发指令而已

很多现场把派工做成纯指派：工单状态改成 released 就完事。但 released 不等于能开工。真正要确认的是：这个车间此刻有没有可投入的设备。

## 卡住的征兆

一张工单 `state` 是 released，但它所在 `workshop` 下的设备 `status` 全是停机或故障，那它就是派不出去的——后面所有工序都卡在这。

## 动手之前

样例库里已下达的工单中，有位于二号车间的，而二号车间唯一设备 EQ-02 是停机状态。把它们找出来。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9110 · 车间执行
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9110, 9001, '车间执行：用不良率给设备排雷', 10, 'published',
'# 车间执行：用不良率给设备排雷

车间执行产生报工记录，每行记录某台设备某次加工产出了多少合格品、多少不合格品。不良率长期偏高的设备，往往是工艺参数漂移或设备老化的信号。

## 不良率怎么算

不良率 = 不合格数 ÷（合格数 + 不合格数）× 100%。分母是总产量，不是合格数——只除合格数会低估问题。

## 为什么要按设备看

同一道工序换台设备，不良率可能差很多。按设备聚合报工，能快速定位哪台是雷。这是 SPC 与设备管理的日常动作。

## 动手之前

样例库里每台设备都有累计报工。算出各设备的不良率，从最差到最好排，看看谁该优先检修。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9111 · 生产入库
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9111, 9001, '生产入库：先对账再入库', 11, 'published',
'# 生产入库：先对账再入库

工单的 `qty_done`（已完工数）理论上应等于各次报工 `qty_ok`（合格数）之和。两者对不上是常见的账实不符——可能漏报工、重复报、或系统状态滞后。入库前必须核对。

## 对账是入库的前置动作

直接按 `state` 字段判断工单完成是最危险的。状态是人维护的，会滞后、会填错；合格数量加起来是否等于完工数，是算出来的，不会撒谎。

## 差异来自哪里

差为正：报工比系统完工多，可能漏更工单状态。差为负：系统完工比报工多，可能重复报工或状态错填。两种都要查来源。

## 动手之前

样例库里多数工单的报工合格数与系统完工数对不上。把差异算出来，从大到小排，先查差得最多的。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 章节 9112 · 发货出库
-- ===========================================================================
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9112, 9001, '发货出库：别让最后一批拖过期', 12, 'published',
'# 发货出库：别让最后一批拖过期

发货按发货单拣货装车交付客户。一张订单常分多批发运，前面都发了，最后一批（尾批）最容易拖过交期。还有整单未发的。发货逾期直接违约。

## 尾批为什么危险

前面批次按时发，整体看起来顺利，最后一批因为凑整、等齐套或物流排期被挤到交期之后。它体量小、存在感低，却直接决定这张单是否违约。

## 怎么查逾期

发货记录里 `ship_date` 为空的，是还没发；`ship_date` 晚于 `due_date` 的，是发了但逾期。两种都要进预警清单。

## 动手之前

样例库里有分两批发运的订单，其中一批实际发运晚于交期；还有整单未发的。把它们查出来，按交期排。'
, 1, strftime('%s','now'));

-- ===========================================================================
-- 测验：每节点一题。answer 存选项下标（与既有题库一致）。
-- ===========================================================================
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
(9204, 9104, 'single',
 '一张销售订单的客户要求交期远早于标准交付周期，录单时第一反应应该是？',
 '["直接答应客户以维持关系","转交订单评审，核对产能与物料后再承诺","让车间立刻加班赶工","先接下订单再说，后面再想办法"]',
 '1',
 '交期不是销售一人能承诺的。录单只是把需求记下来，真正能否交付要由评审环节根据产能、物料齐套性判断。提前答应却交付不了，比晚答应更伤客户。',
 1, strftime('%s','now')),

(9205, 9105, 'single',
 '一张订单评审状态是 approved、计划状态是 none、交期只剩 7 天。此时最该做的是？',
 '["等生产自己排上","立即排产或升级预警，别让交期溜走","发给客户确认能否延期","先发一批货稳住客户"]',
 '1',
 'approved 只是决定接，none 说明生产侧还没动作。交期 7 天极其紧张，必须立刻排产或升级，否则必然逾期。把风险压到最后一刻才暴露，是评审最该防的事故。',
 1, strftime('%s','now')),

(9206, 9106, 'single',
 '主生产计划（MPS）主要回答的问题是？',
 '["每张工单该用哪台设备","各产品在什么时间段计划产多少","每个物料什么时候采购","客户订单该不该接"]',
 '1',
 'MPS 是需求与产能之间的桥梁，按产品聚合订单得到计划产量，往下喂 MRP、往上承接销售承诺。它不回答设备指派或采购时点，那些是更下游的动作。',
 1, strftime('%s','now')),

(9207, 9107, 'single',
 '物料净需求的正确计算公式是？',
 '["毛需求减去现有库存（必要时再减在途）","订单量直接乘单价","毛需求加上安全库存","现有库存除以订单量"]',
 '0',
 '净需求 = 毛需求 − 现有库存（在途已下单未到货的还可再减）。它是采购量的唯一合理来源，不能拿订单量直接当采购量，也不能无视库存重复采购。',
 1, strftime('%s','now')),

(9208, 9108, 'single',
 '为什么 BOM 里被多个产品共用的物料要重点盯？',
 '["它单价最贵","一处缺料会连累多个产品同时停线","它工艺最复杂","它入库最慢"]',
 '1',
 '高共用度物料是缺料风险的放大器：一种料短缺会同时拖垮所有用到它的产品。识别共用度，是把缺料预警从被动救火变成主动布防的关键。',
 1, strftime('%s','now')),

(9209, 9109, 'single',
 '一张工单状态是 released，但它所在车间唯一设备处于停机状态。正确的处理是？',
 '["照常派下去，设备会自己好","先恢复设备能力或调配设备，不要盲派","直接把工单标记完成","转给另一个车间不管设备"]',
 '1',
 'released 只表示指令已下达，不代表能开工。车间无可用设备时盲派只会制造虚假进度。派工的前提是目标车间此刻有可投入的设备。',
 1, strftime('%s','now')),

(9210, 9110, 'single',
 '计算设备不良率时，分母应该是？',
 '["合格品数量","不合格品数量","合格品加不合格品的总产量","计划产量"]',
 '2',
 '不良率 = 不合格 ÷（合格 + 不合格）总产量。只除合格数会严重低估问题，因为漏算了不合格本身。分母必须是全部产出。',
 1, strftime('%s','now')),

(9211, 9111, 'single',
 '工单的系统完工数（qty_done）与历次报工合格数之和对不上，入库前首先应该？',
 '["直接按系统数入库","查清楚差异来源再入库","把差异抹平算了","忽略差异，反正差不多"]',
 '1',
 '账实不符不查清楚就入库，会把错误带进库存账，后续全盘失真。差异可能来自漏报工、重复报工或状态滞后，必须定位来源。',
 1, strftime('%s','now')),

(9212, 9112, 'single',
 '一张订单分多批发货，最该盯紧的是哪一批？',
 '["第一批，因为最早发","最后一批（尾批），最容易拖过交期","中间批，数量最大","哪批都行，分批不影响交期"]',
 '1',
 '前面批次按时发容易给人一切正常的错觉，尾批因凑整、等齐套、物流排期被挤，最常拖过交期，而它直接决定整张单是否违约。',
 1, strftime('%s','now'));

-- ===========================================================================
-- SQL 实战题（判题哈希由 scripts/gen-answer-hash.mjs 从 dataset.sql 本地复算）
--  哈希与 web/src/features/sql-sandbox/dataset.sql 逐字对应，改 dataset 必须重跑 --regress。
--  answer_sql 服务端保留、API 永不下发（R6）。
-- ===========================================================================
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES
(9304, 9001,
 '查出还没评审、交期却已逼近的急单',
 '今天是 2026-08-08。销售总监要一份急单清单：把还没评审（review_status 是 pending）且交期在 2026-08-15 之前（含当天）的销售订单全部列出来，要看到客户、产品、数量、交期。

要求输出这几列，顺序照写：订单号、客户名称、产品名称、数量、交期。
按交期从早到晚排，最急的排最前面。

提示：日期已是 YYYY-MM-DD 文本格式，可直接比大小；判等用单引号。',
 '{}',
 'SELECT so.so_no, c.name AS customer, p.name AS product, so.qty, so.due_date FROM sales_orders so JOIN customers c ON c.customer_id = so.customer_id JOIN products p ON p.product_id = so.product_id WHERE so.review_status = ''pending'' AND so.due_date <= ''2026-08-15'' ORDER BY so.due_date;',
 'd56c4a2657fd438dee05b1884f6e5c5285eb7ee8cc2a103c71016b31763330af',
 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
customers(customer_id, code, name, region, tier)
products(product_id, code, name, spec, unit)',
 1, strftime('%s','now')),

(9305, 9001,
 '找出评审通过却还没排产的订单',
 '计划经理发现有些订单评审已经通过，但生产侧迟迟没排产。请把这些单子捞出来：review_status 是 approved 且 plan_status 是 none 的销售订单，要看到客户、产品、数量、交期。

要求输出这几列，顺序照写：订单号、客户名称、产品名称、数量、交期。
按交期从早到晚排，最该先排产的排最前面。

提示：两个状态字段都要判等，用单引号。',
 '{}',
 'SELECT so.so_no, c.name AS customer, p.name AS product, so.qty, so.due_date FROM sales_orders so JOIN customers c ON c.customer_id = so.customer_id JOIN products p ON p.product_id = so.product_id WHERE so.review_status = ''approved'' AND so.plan_status = ''none'' ORDER BY so.due_date;',
 '05befb09bdc09d18e4490dc5806f3ca3aaedf1f40e500d443cd03cd449e893a8',
 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
customers(customer_id, code, name, region, tier)
products(product_id, code, name, spec, unit)',
 2, strftime('%s','now')),

(9306, 9001,
 '把已评审订单按产品汇总成主生产计划',
 '把评审已经通过（review_status 是 approved）的销售订单，按产品聚合成一张主生产计划：列出每个产品有多少张订单、计划总产量多少。

要求输出这几列，顺序照写：产品名称、订单数、计划产量。
按计划产量从大到小排，产量最大的产品排最前面。

提示：用 GROUP BY 产品，COUNT 数订单数，SUM 加总数量。',
 '{}',
 'SELECT p.name AS product, COUNT(*) AS order_cnt, SUM(so.qty) AS plan_qty FROM sales_orders so JOIN products p ON p.product_id = so.product_id WHERE so.review_status = ''approved'' GROUP BY p.product_id ORDER BY plan_qty DESC;',
 'ab8ce26893478c6d7b9802cb03f8ee608a7f67d3547877e5137c6a0775d2584b',
 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
products(product_id, code, name, spec, unit)',
 3, strftime('%s','now')),

(9307, 9001,
 '按 BOM 算出哪些物料还要采购',
 '根据已评审通过（review_status 是 approved）的订单，按 BOM 展开算物料净需求：毛需求 = 订单量 × 单件用量 ×（1 + 损耗率），净需求 = 毛需求减去现有库存，只取净需求大于 0 的物料。

要求输出这几列，顺序照写：物料名称、毛需求、现有库存、净需求。
按净需求从大到小排。

提示：用 MAX(0, 表达式) 把负值归零；CAST(... AS INTEGER) 取整，避免小数。',
 '{}',
 'SELECT m.name AS material, CAST(SUM(so.qty * b.qty_per * (1 + b.loss_rate)) AS INTEGER) AS gross_req, m.stock_qty AS on_hand, CAST(MAX(0, SUM(so.qty * b.qty_per * (1 + b.loss_rate)) - m.stock_qty) AS INTEGER) AS net_req FROM sales_orders so JOIN bom b ON b.product_id = so.product_id JOIN materials m ON m.material_id = b.material_id WHERE so.review_status = ''approved'' GROUP BY m.material_id HAVING net_req > 0 ORDER BY net_req DESC;',
 '2d4dfefc2a458dc74c13dfdd44e564d1a0e0cf783f928b701623161163676bd2',
 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
bom(bom_id, product_id, material_id, qty_per, loss_rate)
materials(material_id, code, name, unit, stock_qty)',
 4, strftime('%s','now')),

(9308, 9001,
 '找出被最多产品共用的物料',
 'BOM 描述产品由哪些物料组成。请统计每种物料被多少个不同的产品使用，找出高共用度物料——它们一旦短缺会连累一大片产品。

要求输出这几列，顺序照写：物料名称、被多少产品使用。
先按被使用产品数从多到少排，数量相同再按物料名称排。

提示：COUNT(DISTINCT product_id) 才是「多少种产品」，不能用 COUNT(*)。',
 '{}',
 'SELECT m.name AS material, COUNT(DISTINCT b.product_id) AS used_by_products FROM bom b JOIN materials m ON m.material_id = b.material_id GROUP BY m.material_id ORDER BY used_by_products DESC, m.name;',
 '4523075c36d65ecfc2306e520c7c1733e644b8a91d1115921603f579e56a19e3',
 'bom(bom_id, product_id, material_id, qty_per, loss_rate)
materials(material_id, code, name, unit, stock_qty)',
 5, strftime('%s','now')),

(9309, 9001,
 '找出派不出去的工单',
 '派工的前提是目标车间有运行状态的设备。请把已经下达（state 是 released）但所在车间没有任何运行设备的工单找出来。

要求输出这几列，顺序照写：工单号、车间、计划数量、交期。
按工单号排。

提示：用 NOT EXISTS 子查询判断「该车间不存在 status 是 运行的设备」。',
 '{}',
 'SELECT w.wo_no, w.workshop, w.qty_plan, w.due_date FROM work_orders w WHERE w.state = ''released'' AND NOT EXISTS (SELECT 1 FROM equipment e WHERE e.workshop = w.workshop AND e.status = ''运行'') ORDER BY w.wo_no;',
 '62f8e491bd6e978245633c832b0b86077d1d8bb4fbc606d4ff2c291c6f8085c2',
 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
equipment(equip_id, code, name, workshop, status)',
 6, strftime('%s','now')),

(9310, 9001,
 '算出每台设备的不良率，找出最差的',
 '把每台设备的报工记录聚合，算出不良率（不合格 ÷ 总产量 × 100%），按不良率从高到低排，看看哪台设备最该检修。

要求输出这几列，顺序照写：设备名称、合格总数、不合格总数、不良率（整数百分比）。
先按不良率从高到低排，相同再按设备名称排。

提示：没有报工记录的设备要用 LEFT JOIN 保留，不良率算成 0；分母可能为 0，用 NULLIF 兜底避免除零。',
 '{}',
 'SELECT e.name AS equipment, COALESCE(SUM(r.qty_ok), 0) AS total_ok, COALESCE(SUM(r.qty_ng), 0) AS total_ng, COALESCE(CAST(ROUND(100.0 * COALESCE(SUM(r.qty_ng), 0) / NULLIF(COALESCE(SUM(r.qty_ok), 0) + COALESCE(SUM(r.qty_ng), 0), 0)) AS INTEGER), 0) AS ng_rate_pct FROM equipment e LEFT JOIN production_records r ON r.equip_id = e.equip_id GROUP BY e.equip_id ORDER BY ng_rate_pct DESC, e.name;',
 'c03887dd7b00ca60285268fbde6da7638159044a89b1bff5905247f38d4833a0',
 'equipment(equip_id, code, name, workshop, status)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)',
 7, strftime('%s','now')),

(9311, 9001,
 '生产入库前先对账：报工和完工数对不上',
 '工单的系统完工数（qty_done）应等于历次报工合格数（qty_ok）之和。请把两者对不上的工单找出来，并算出差多少。

要求输出这几列，顺序照写：工单号、系统完工数、报工合格总数、差异（报工合格减系统完工）。
按差异绝对值从大到小排。

提示：LEFT JOIN 保留没有报工记录的工单；用 COALESCE 把空值当 0；HAVING 过滤掉差异为 0 的。',
 '{}',
 'SELECT w.wo_no, w.qty_done AS reported_done, COALESCE(SUM(r.qty_ok), 0) AS produced_ok, (COALESCE(SUM(r.qty_ok), 0) - w.qty_done) AS diff FROM work_orders w LEFT JOIN production_records r ON r.wo_id = w.wo_id GROUP BY w.wo_id HAVING diff <> 0 ORDER BY ABS(diff) DESC;',
 'dd3e0c3fd4ff0c0ec07b89fe476a1eecc51016fe9fc97b26290ccb26db9eae09',
 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)',
 8, strftime('%s','now')),

(9312, 9001,
 '查出尾批逾期和整单未发的发货',
 '发货按批发运。请把逾期的发货记录查出来：实际发运日期（ship_date）晚于应交日期（due_date）的，或者还没发运（ship_date 为空）的，都算。

要求输出这几列，顺序照写：发货单号、客户名称、应交日期、实际发运日期、状态。
按应交日期从早到晚排。

提示：判空用 IS NULL；晚于交期用 ship_date > due_date；两个条件用 OR 连接。',
 '{}',
 'SELECT s.ship_no, c.name AS customer, s.due_date, s.ship_date, s.status FROM shipments s JOIN sales_orders so ON so.so_id = s.so_id JOIN customers c ON c.customer_id = so.customer_id WHERE s.ship_date IS NULL OR s.ship_date > s.due_date ORDER BY s.due_date;',
 '115947f327980d6da0e1908581fdb04a7fe5c1e8cbc13acc57b115630579b506',
 'shipments(ship_id, so_id, ship_no, due_date, ship_date, qty, status)
sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
customers(customer_id, code, name, region, tier)',
 9, strftime('%s','now'));

-- ===========================================================================
-- 挂载：node_resources（9 个节点，每节点 章节+SQL+测验 共 27 条）
--   node_id 一律用 (slug, node_key) 子查询定位，绝不写死自增 id。
--   title 是祈使句（C2）；顺序 = 学习动线：先读懂 → 再动手查 → 最后自测。
-- ===========================================================================
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
-- 客户下单
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'),
 'chapter', 9104, '先看清一张销售订单里谁卡住了交期', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'),
 'sql', 9304, '查出还没评审、交期却已逼近的急单', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'),
 'quiz', 9204, '自测：客户要的日期远早于标准交期怎么办', 3),

-- 订单评审
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'),
 'chapter', 9105, '学会在评审时揪出接了但做不出的单', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'),
 'sql', 9305, '找出评审通过却还没排产的订单', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'),
 'quiz', 9205, '自测：approved 但 none 的订单该先做什么', 3),

-- 主生产计划
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'),
 'chapter', 9106, '把评审通过的订单聚合成主生产计划', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'),
 'sql', 9306, '按产品汇总已评审订单的计划产量', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'),
 'quiz', 9206, '自测：主生产计划到底回答什么问题', 3),

-- 物料需求计划
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'chapter', 9107, '按 BOM 算净需求，别拍脑袋定采购量', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'sql', 9307, '算出哪些物料还要采购、缺口多大', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'quiz', 9207, '自测：净需求到底该怎么算', 3),

-- BOM 与工艺路线
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'chapter', 9108, '看懂 BOM：一个物料被多少产品共用', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'sql', 9308, '统计每种物料被多少个产品使用', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'quiz', 9208, '自测：为什么共用料要重点盯', 3),

-- 生产派工
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'chapter', 9109, '派工前先看车间有没有可用设备', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'sql', 9309, '找出已下达却派不出去的工单', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'quiz', 9209, '自测：车间设备停了还派工会怎样', 3),

-- 车间执行
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'chapter', 9110, '用不良率给设备排雷', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'sql', 9310, '算出每台设备的不良率排个序', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'quiz', 9210, '自测：不良率的分母到底是什么', 3),

-- 生产入库
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'),
 'chapter', 9111, '入库前先对账，别把错账带进去', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'),
 'sql', 9311, '核对报工合格数与系统完工数差多少', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'),
 'quiz', 9212, '自测：账实不符能直接入库吗', 3),

-- 发货出库
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'),
 'chapter', 9112, '发货出库别让最后一批拖过期', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'),
 'sql', 9312, '查出尾批逾期和整单未发的发货', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'),
 'quiz', 9212, '自测：分多批发货最该盯哪一批', 3);
