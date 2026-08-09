-- ============================================================
-- 节点种子：mps（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9106 | 测验 9206,9225,9226 | SQL 9306 | 微练习 9403
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9106;
DELETE FROM questions WHERE id IN (9206, 9225, 9226);
DELETE FROM sql_exercises WHERE id = 9306;
DELETE FROM micro_practices WHERE id = 9403;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps') AND ref_id IN (9106, 9206, 9225, 9226, 9306, 9403) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9106
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9106, 9001, '主生产计划：把订单变成可执行的排产', 6, 'published', '# 主生产计划（MPS）：把订单变成可执行的排产

MPS 是把评审通过的订单，聚合成每月、每周产什么、产多少的计划。它是需求与产能之间的桥梁，往下喂给 MRP 算物料，往上承接销售承诺。

## MPS 回答的问题

不是某张工单怎么做，而是各产品在什么时间段计划产多少。所以 MPS 的核心动作就是按产品聚合。

## 聚合就是 GROUP BY

把评审通过的订单按 `product_id` 分组，数一数有多少张单、加一加总数量，一张主生产计划就出来了。订单多的时候，这个聚合能一眼看出哪个产品是产出大头。

## 动手之前

样例库里已评审通过的订单横跨 4 个产品。把它们按产品汇总，看计划产量排出来是什么样。', 1, strftime('%s','now'));

-- 测验 9206,9225,9226（9206=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9206, 9106, 'single', '主生产计划（MPS）主要回答的问题是？', '["每张工单该用哪台设备","各产品在什么时间段计划产多少","每个物料什么时候采购","客户订单该不该接"]', '1', 'MPS 是需求与产能之间的桥梁，按产品聚合订单得到计划产量，往下喂 MRP、往上承接销售承诺。它不回答设备指派或采购时点，那些是更下游的动作。', 1, strftime('%s','now')),
  (9225, 9106, 'single', '主生产计划（MPS）的主要输入来自哪里？', '["采购到货单","评审通过的销售订单（需求）","质量检验报告","设备维修记录"]', '1', 'MPS 把评审通过的 SO 按产品汇总成计划产量，是 MRP 的上游输入。采购/质检是更下游的数据。', 2, strftime('%s','now')),
  (9226, 9106, 'single', 'MPS 与 MRP 的根本区别是什么？', '["MPS 管物料需求，MRP 管产出计划","MPS 管最终产品的产出计划，MRP 展开 BOM 算物料净需求","两者完全相同","都只管采购"]', '1', 'MPS=最终产品层面「产多少」；MRP=MPS 展开 BOM 后算「缺什么料、缺多少」。层级不同。', 3, strftime('%s','now'));

-- SQL 练习 9306（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9306, 9001, '把已评审订单按产品汇总成主生产计划', '把评审已经通过（review_status 是 approved）的销售订单，按产品聚合成一张主生产计划：列出每个产品有多少张订单、计划总产量多少。

要求输出这几列，顺序照写：产品名称、订单数、计划产量。
按计划产量从大到小排，产量最大的产品排最前面。

提示：用 GROUP BY 产品，COUNT 数订单数，SUM 加总数量。', '{}', 'SELECT p.name AS product, COUNT(*) AS order_cnt, SUM(so.qty) AS plan_qty FROM sales_orders so JOIN products p ON p.product_id = so.product_id WHERE so.review_status = ''approved'' GROUP BY p.product_id ORDER BY plan_qty DESC;', 'ab8ce26893478c6d7b9802cb03f8ee608a7f67d3547877e5137c6a0775d2584b', 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
products(product_id, code, name, spec, unit)', 3, strftime('%s','now'));

-- 微练习 9403（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9403, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'order', '把主生产计划的四步按实际先后顺序排好。', '{"items":[{"key":"so-agg","label":"汇总已评审订单，按产品算出总需求量"},{"key":"capacity","label":"对着产能和交期，摊到每周该产出多少"},{"key":"freeze","label":"冻结近期计划，不再随便改"},{"key":"wo","label":"按冻结后的计划下达生产工单"}]}', '["so-agg","capacity","freeze","wo"]', '对。MPS 的顺序是先算需求、再看产能、然后冻结、最后才下工单。冻结这一步最容易被跳过，跳了车间就天天改计划。', '想一想：产能还没看，能先下工单吗？计划还没冻结，工单下去改不改？', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'chapter', 9106, '主生产计划：把订单变成可执行的排产', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'quiz', 9206, '主生产计划（MPS）主要回答的问题是？', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'quiz', 9225, '主生产计划（MPS）的主要输入来自哪里？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'quiz', 9226, 'MPS 与 MRP 的根本区别是什么？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'sql', 9306, '把已评审订单按产品汇总成主生产计划', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'), 'micro', 9403, '把主生产计划的四步按实际先后顺序排好。', 6);

PRAGMA foreign_keys = ON;