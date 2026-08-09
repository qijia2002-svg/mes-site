-- ============================================================
-- 节点种子：cust-order（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9104 | 测验 9204,9221,9222 | SQL 9304 | 微练习 9401
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9104;
DELETE FROM questions WHERE id IN (9204, 9221, 9222);
DELETE FROM sql_exercises WHERE id = 9304;
DELETE FROM micro_practices WHERE id = 9401;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order') AND ref_id IN (9104, 9204, 9221, 9222, 9304, 9401) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9104
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9104, 9001, '客户下单：工厂全景的起点', 4, 'published', '# 客户下单：工厂全景的起点

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

样例库有 12 张订单，其中几张还没评审、交期却已经逼近。先别信汇报，自己查出来。', 1, strftime('%s','now'));

-- 测验 9204,9221,9222（9204=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9204, 9104, 'single', '一张销售订单的客户要求交期远早于标准交付周期，录单时第一反应应该是？', '["直接答应客户以维持关系","转交订单评审，核对产能与物料后再承诺","让车间立刻加班赶工","先接下订单再说，后面再想办法"]', '1', '交期不是销售一人能承诺的。录单只是把需求记下来，真正能否交付要由评审环节根据产能、物料齐套性判断。提前答应却交付不了，比晚答应更伤客户。', 1, strftime('%s','now')),
  (9221, 9104, 'single', '一张销售订单（SO）与工单（WO）的关系，通常哪种说法正确？', '["一张 SO 必然直接生成一张 WO，一一对应","一个产品的一张 SO 常按批量/产线拆成多张 WO","多张 SO 必须合并成一张 WO","SO 与 WO 没有任何关联"]', '1', 'SO 是客户需求承诺，MES 计划环节按产品+BOM+批量把一张 SO 拆成一张或多张 WO。拆批/合批由计划策略决定，并非永远一对一。', 2, strftime('%s','now')),
  (9222, 9104, 'single', 'sales_orders 表中的 due_date 字段表示什么？', '["销售录单的日期","客户要求的交付日期","实际发货日期","生产开始日期"]', '1', 'due_date 是客户交期，计划据此倒排生产；实际发货看 shipments.ship_date，两者不是一回事。', 3, strftime('%s','now'));

-- SQL 练习 9304（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9304, 9001, '查出还没评审、交期却已逼近的急单', '今天是 2026-08-08。销售总监要一份急单清单：把还没评审（review_status 是 pending）且交期在 2026-08-15 之前（含当天）的销售订单全部列出来，要看到客户、产品、数量、交期。

要求输出这几列，顺序照写：订单号、客户名称、产品名称、数量、交期。
按交期从早到晚排，最急的排最前面。

提示：日期已是 YYYY-MM-DD 文本格式，可直接比大小；判等用单引号。', '{}', 'SELECT so.so_no, c.name AS customer, p.name AS product, so.qty, so.due_date FROM sales_orders so JOIN customers c ON c.customer_id = so.customer_id JOIN products p ON p.product_id = so.product_id WHERE so.review_status = ''pending'' AND so.due_date <= ''2026-08-15'' ORDER BY so.due_date;', 'd56c4a2657fd438dee05b1884f6e5c5285eb7ee8cc2a103c71016b31763330af', 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
customers(customer_id, code, name, region, tier)
products(product_id, code, name, spec, unit)', 1, strftime('%s','now'));

-- 微练习 9401（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9401, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'pick', '今天是 2026-08-08。下面四张销售订单，哪几张属于「还没评审、交期却已经逼近」的急单？', '{"multi":true,"options":[{"key":"SO-20260807-01","label":"SO-20260807-01 · 交期 2026-08-12 · 未评审"},{"key":"SO-20260808-01","label":"SO-20260808-01 · 交期 2026-08-13 · 未评审"},{"key":"SO-20260725-01","label":"SO-20260725-01 · 交期 2026-08-15 · 已评审"},{"key":"SO-20260728-01","label":"SO-20260728-01 · 交期 2026-08-20 · 已评审"}]}', '["SO-20260807-01","SO-20260808-01"]', '对。急单要两个字段同时成立：review_status 还是 pending，due_date 又已经逼近。只看交期会把已经评审过的正常单也算进来。', '再看一眼两个字段：review_status 和 due_date。已经评审过的不算急单，交期还有半个月的也不算。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'chapter', 9104, '客户下单：工厂全景的起点', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'quiz', 9204, '一张销售订单的客户要求交期远早于标准交付周期，录单时第一反应应该是？', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'quiz', 9221, '一张销售订单（SO）与工单（WO）的关系，通常哪种说法正确？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'quiz', 9222, 'sales_orders 表中的 due_date 字段表示什么？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'sql', 9304, '查出还没评审、交期却已逼近的急单', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'), 'micro', 9401, '今天是 2026-08-08。下面四张销售订单，哪几张属于「还没评审、交期却', 6);

PRAGMA foreign_keys = ON;