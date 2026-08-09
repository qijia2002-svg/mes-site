-- ============================================================
-- 节点种子：stock-in（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9111 | 测验 9211,9241,9242 | SQL 9311 | 微练习 9411
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9111;
DELETE FROM questions WHERE id IN (9211, 9241, 9242);
DELETE FROM sql_exercises WHERE id = 9311;
DELETE FROM micro_practices WHERE id = 9411;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in') AND ref_id IN (9111, 9211, 9241, 9242, 9311, 9411) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9111
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9111, 9001, '生产入库：先对账再入库', 11, 'published', '# 生产入库：先对账再入库

工单的 `qty_done`（已完工数）理论上应等于各次报工 `qty_ok`（合格数）之和。两者对不上是常见的账实不符——可能漏报工、重复报、或系统状态滞后。入库前必须核对。

## 对账是入库的前置动作

直接按 `state` 字段判断工单完成是最危险的。状态是人维护的，会滞后、会填错；合格数量加起来是否等于完工数，是算出来的，不会撒谎。

## 差异来自哪里

差为正：报工比系统完工多，可能漏更工单状态。差为负：系统完工比报工多，可能重复报工或状态错填。两种都要查来源。

## 动手之前

样例库里多数工单的报工合格数与系统完工数对不上。把差异算出来，从大到小排，先查差得最多的。', 1, strftime('%s','now'));

-- 测验 9211,9241,9242（9211=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9211, 9111, 'single', '工单的系统完工数（qty_done）与历次报工合格数之和对不上，入库前首先应该？', '["直接按系统数入库","查清楚差异来源再入库","把差异抹平算了","忽略差异，反正差不多"]', '1', '账实不符不查清楚就入库，会把错误带进库存账，后续全盘失真。差异可能来自漏报工、重复报工或状态滞后，必须定位来源。', 1, strftime('%s','now')),
  (9241, 9111, 'single', '生产入库（stock-in）前必须核对什么？', '["报工完工数与入库数是否一致","客户是否签字","发票金额","发货地址"]', '1', '入库前对账：production_records 累计完工 vs 本次入库数，不一致要先查清再入库，避免账实不符。', 2, strftime('%s','now')),
  (9242, 9111, 'single', '生产入库（stock-in）更新的是哪类数据？', '["在制工单状态","产成品库存","采购订单","销售订单"]', '1', '入库把产成品从在制(WIP)结转为成品库存，是生产→库存的结转动作。', 3, strftime('%s','now'));

-- SQL 练习 9311（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9311, 9001, '生产入库前先对账：报工和完工数对不上', '工单的系统完工数（qty_done）应等于历次报工合格数（qty_ok）之和。请把两者对不上的工单找出来，并算出差多少。

要求输出这几列，顺序照写：工单号、系统完工数、报工合格总数、差异（报工合格减系统完工）。
按差异绝对值从大到小排。

提示：LEFT JOIN 保留没有报工记录的工单；用 COALESCE 把空值当 0；HAVING 过滤掉差异为 0 的。', '{}', 'SELECT w.wo_no, w.qty_done AS reported_done, COALESCE(SUM(r.qty_ok), 0) AS produced_ok, (COALESCE(SUM(r.qty_ok), 0) - w.qty_done) AS diff FROM work_orders w LEFT JOIN production_records r ON r.wo_id = w.wo_id GROUP BY w.wo_id HAVING diff <> 0 ORDER BY ABS(diff) DESC;', 'dd3e0c3fd4ff0c0ec07b89fe476a1eecc51016fe9fc97b26290ccb26db9eae09', 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)', 8, strftime('%s','now'));

-- 微练习 9411（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9411, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'pick', 'WO-20260801-02 的报工记录合格数合计是 45，工单上的 qty_done 却是 40。现在要办入库，按哪个数？', '{"multi":false,"options":[{"key":"by-45","label":"按报工的 45 入库，报工最贴近现场"},{"key":"by-40","label":"按工单的 40 入库，工单是主数据"},{"key":"investigate","label":"先查清这 5 台差在哪，查明白再入库"},{"key":"by-avg","label":"取两者平均，先把库存做平"}]}', '["investigate"]', '对。两个数对不上，说明中间少了一笔账 —— 可能是漏报、返工、或者报工记录没滚进工单。这时候入库，等于把错账带进库存，后面盘点全乱。这就是这条主线最后一课要拆的那个病灶。', '先别急着选一个数。想想：这两个数为什么会不一样？入库之后还查得回来吗？', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'chapter', 9111, '生产入库：先对账再入库', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'quiz', 9211, '工单的系统完工数（qty_done）与历次报工合格数之和对不上，入库前首先应', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'quiz', 9241, '生产入库（stock-in）前必须核对什么？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'quiz', 9242, '生产入库（stock-in）更新的是哪类数据？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'sql', 9311, '生产入库前先对账：报工和完工数对不上', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'), 'micro', 9411, 'WO-20260801-02 的报工记录合格数合计是 45，工单上的 qty', 6);

PRAGMA foreign_keys = ON;