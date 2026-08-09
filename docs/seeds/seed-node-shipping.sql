-- ============================================================
-- 节点种子：shipping（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9112 | 测验 9212,9243,9244 | SQL 9312 | 微练习 9412
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9112;
DELETE FROM questions WHERE id IN (9212, 9243, 9244);
DELETE FROM sql_exercises WHERE id = 9312;
DELETE FROM micro_practices WHERE id = 9412;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping') AND ref_id IN (9112, 9212, 9243, 9244, 9312, 9412) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9112
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9112, 9001, '发货出库：别让最后一批拖过期', 12, 'published', '# 发货出库：别让最后一批拖过期

发货按发货单拣货装车交付客户。一张订单常分多批发运，前面都发了，最后一批（尾批）最容易拖过交期。还有整单未发的。发货逾期直接违约。

## 尾批为什么危险

前面批次按时发，整体看起来顺利，最后一批因为凑整、等齐套或物流排期被挤到交期之后。它体量小、存在感低，却直接决定这张单是否违约。

## 怎么查逾期

发货记录里 `ship_date` 为空的，是还没发；`ship_date` 晚于 `due_date` 的，是发了但逾期。两种都要进预警清单。

## 动手之前

样例库里有分两批发运的订单，其中一批实际发运晚于交期；还有整单未发的。把它们查出来，按交期排。', 1, strftime('%s','now'));

-- 测验 9212,9243,9244（9212=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9212, 9112, 'single', '一张订单分多批发货，最该盯紧的是哪一批？', '["第一批，因为最早发","最后一批（尾批），最容易拖过交期","中间批，数量最大","哪批都行，分批不影响交期"]', '1', '前面批次按时发容易给人一切正常的错觉，尾批因凑整、等齐套、物流排期被挤，最常拖过交期，而它直接决定整张单是否违约。', 1, strftime('%s','now')),
  (9243, 9112, 'single', 'shipments 发货的依据来自哪里？', '["采购到货单","对应销售订单/工单的完工入库","质量抽检单","设备运行记录"]', '1', '发货来自 SO 对应 WO 完工入库的成品，shipments.so_id / wo_id 关联回去。没完工入库不能发。', 2, strftime('%s','now')),
  (9244, 9112, 'single', '监控「尾批逾期、整单未发」这类情况，是为了发现什么风险？', '["采购延迟","交付违约风险（该发未发/已逾期）","设备故障","物料损耗"]', '1', '尾批未发或整单未发=交付违约，是发货环节核心监控点，直接影响客户交期与满意度。', 3, strftime('%s','now'));

-- SQL 练习 9312（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9312, 9001, '查出尾批逾期和整单未发的发货', '发货按批发运。请把逾期的发货记录查出来：实际发运日期（ship_date）晚于应交日期（due_date）的，或者还没发运（ship_date 为空）的，都算。

要求输出这几列，顺序照写：发货单号、客户名称、应交日期、实际发运日期、状态。
按应交日期从早到晚排。

提示：判空用 IS NULL；晚于交期用 ship_date > due_date；两个条件用 OR 连接。', '{}', 'SELECT s.ship_no, c.name AS customer, s.due_date, s.ship_date, s.status FROM shipments s JOIN sales_orders so ON so.so_id = s.so_id JOIN customers c ON c.customer_id = so.customer_id WHERE s.ship_date IS NULL OR s.ship_date > s.due_date ORDER BY s.due_date;', '115947f327980d6da0e1908581fdb04a7fe5c1e8cbc13acc57b115630579b506', 'shipments(ship_id, so_id, ship_no, due_date, ship_date, qty, status)
sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)
customers(customer_id, code, name, region, tier)', 9, strftime('%s','now'));

-- 微练习 9412（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9412, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'pick', 'SO-20260725-01 的 60 台伺服电机分两批发。哪一批出了问题？', '{"multi":false,"options":[{"key":"SH-02-1","label":"SH-02-1 · 30 台 · 交期 2026-08-13 · 实发 2026-08-12"},{"key":"SH-02-2","label":"SH-02-2 · 30 台 · 交期 2026-08-15 · 实发 2026-08-18"},{"key":"both-ok","label":"两批都在交期内，没问题"},{"key":"none-ship","label":"两批都还没发出去"}]}', '["SH-02-2"]', '对。尾批晚了三天。整单的交付准时率不看首批看尾批 —— 客户拿不齐 60 台，这单就是逾期，前面那批发得再准也不顶用。', '把每一批的交期和实际发运日期一行行比。分批发货，问题几乎都出在最后一批。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'chapter', 9112, '发货出库：别让最后一批拖过期', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'quiz', 9212, '一张订单分多批发货，最该盯紧的是哪一批？', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'quiz', 9243, 'shipments 发货的依据来自哪里？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'quiz', 9244, '监控「尾批逾期、整单未发」这类情况，是为了发现什么风险？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'sql', 9312, '查出尾批逾期和整单未发的发货', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'), 'micro', 9412, 'SO-20260725-01 的 60 台伺服电机分两批发。哪一批出了问题？', 6);

PRAGMA foreign_keys = ON;