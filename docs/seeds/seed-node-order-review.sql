-- ============================================================
-- 节点种子：order-review（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9105 | 测验 9205,9223,9224 | SQL 9305 | 微练习 9402
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9105;
DELETE FROM questions WHERE id IN (9205, 9223, 9224);
DELETE FROM sql_exercises WHERE id = 9305;
DELETE FROM micro_practices WHERE id = 9402;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review') AND ref_id IN (9105, 9205, 9223, 9224, 9305, 9402) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9105
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9105, 9001, '订单评审：接了不等于做得出', 5, 'published', '# 订单评审：接了不等于做得出

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

样例库里有几张 approved 却 none 的订单，交期各不相同。先把它们捞出来，按交期排，最急的先排产。', 1, strftime('%s','now'));

-- 测验 9205,9223,9224（9205=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9205, 9105, 'single', '一张订单评审状态是 approved、计划状态是 none、交期只剩 7 天。此时最该做的是？', '["等生产自己排上","立即排产或升级预警，别让交期溜走","发给客户确认能否延期","先发一批货稳住客户"]', '1', 'approved 只是决定接，none 说明生产侧还没动作。交期 7 天极其紧张，必须立刻排产或升级，否则必然逾期。把风险压到最后一刻才暴露，是评审最该防的事故。', 1, strftime('%s','now')),
  (9223, 9105, 'single', '订单评审（order-review）首要核对的是什么？', '["客户信用额度是否充足","交期与技术可行性：产能、BOM、关键物料能否达成","运输路线怎么走","发票税率多少"]', '1', '评审核心是交期与可达成性——产能是否够、BOM 能否展开、关键物料是否齐套。信用额度属财务侧，不是评审技术核心。', 2, strftime('%s','now')),
  (9224, 9105, 'single', '一张销售订单通过评审后，下一步通常进入什么环节？', '["直接安排发货","主生产计划（MPS）排产","采购到货入库","质量检验"]', '1', '评审通过 → MPS 把需求汇成产出计划 → MRP 算物料 → 采购/生产。评审通过只是放行，不直接发货。', 3, strftime('%s','now'));

-- SQL 练习 9305（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9305, 9001, '找出评审通过却还没排产的订单', '计划经理发现有些订单评审已经通过，但生产侧迟迟没排产。请把这些单子捞出来：review_status 是 approved 且 plan_status 是 none 的销售订单，要看到客户、产品、数量、交期。

要求输出这几列，顺序照写：订单号、客户名称、产品名称、数量、交期。
按交期从早到晚排，最该先排产的排最前面。

提示：两个状态字段都要判等，用单引号。', '{}', 'SELECT so.so_no, c.name AS customer, p.name AS product, so.qty, so.due_date FROM sales_orders so JOIN customers c ON c.customer_id = so.customer_id JOIN products p ON p.product_id = so.product_id WHERE so.review_status = ''approved'' AND so.plan_status = ''none'' ORDER BY so.due_date;', '05befb09bdc09d18e4490dc5806f3ca3aaedf1f40e500d443cd03cd449e893a8', 'sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
customers(customer_id, code, name, region, tier)
products(product_id, code, name, spec, unit)', 2, strftime('%s','now'));

-- 微练习 9402（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9402, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'pick', '哪几张订单已经评审通过，却还挂在那里没排产？', '{"multi":true,"options":[{"key":"SO-20260728-01","label":"SO-20260728-01 · 评审 approved · 排产 none"},{"key":"SO-20260802-01","label":"SO-20260802-01 · 评审 approved · 排产 none"},{"key":"SO-20260725-01","label":"SO-20260725-01 · 评审 approved · 排产 planned"},{"key":"SO-20260803-01","label":"SO-20260803-01 · 评审 rejected · 排产 none"}]}', '["SO-20260728-01","SO-20260802-01"]', '对。approved 加 none 才是「接了没排」。已经 planned 的在计划里，rejected 的根本没接，都不算漏排。', '两个字段一起看：review_status 要是 approved，plan_status 要是 none。少看一个就会捞错单。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'chapter', 9105, '订单评审：接了不等于做得出', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'quiz', 9205, '一张订单评审状态是 approved、计划状态是 none、交期只剩 7 天', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'quiz', 9223, '订单评审（order-review）首要核对的是什么？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'quiz', 9224, '一张销售订单通过评审后，下一步通常进入什么环节？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'sql', 9305, '找出评审通过却还没排产的订单', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'), 'micro', 9402, '哪几张订单已经评审通过，却还挂在那里没排产？', 6);

PRAGMA foreign_keys = ON;