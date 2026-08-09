-- ============================================================
-- 节点种子：shopfloor（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9110 | 测验 9210,9237,9238 | SQL 9310 | 微练习 9409
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9110;
DELETE FROM questions WHERE id IN (9210, 9237, 9238);
DELETE FROM sql_exercises WHERE id = 9310;
DELETE FROM micro_practices WHERE id = 9409;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor') AND ref_id IN (9110, 9210, 9237, 9238, 9310, 9409) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9110
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9110, 9001, '车间报工：做完一批之后，数据怎么走的', 10, 'published', '# 车间报工：做完一批之后，数据怎么走的

## 报工四步曲

工人在工位上做完一批，MES 里的数据是这样走的：

1. **扫码确认工单**：扫工单条码，先确认这一批在给哪张工单报工——报错工单比不报更麻烦
2. **录入合格数 / 不良数**：这一批做了多少、合格多少、不良多少，如实录进去
3. **提交**：`production_records` 里多出一行报工记录
4. **qty_done 累加**：`work_orders.qty_done` 按报工记录自动累加

## 完工数不是人填的

> **qty_done 是报工记录「滚」出来的，不是人填的。**

这是新人最常犯的错误：直接去改工单上的完工数。正确的做法是只录报工，完工数由系统按报工记录汇总。过程数据（报工）与结果数据（完工数）必须能对得上。

## 病灶：WO-20260801-01 报了工，完工数却是 0

WO-20260801-01 在 `production_records` 里有两行报工，都是陆明辉交的：

| 报工时间 | 设备 | 合格数 | 不良数 |
|---|---|---|---|
| 2026-08-04 09:20:00 | 注塑机A（EQ-01） | 40 | 2 |
| 2026-08-04 15:40:00 | 装配线D（EQ-04） | 35 | 0 |

两笔合计 **75 件合格品**，但 `work_orders` 里这张工单的 `qty_done` 还是 **0**。

这说明「报工 → 完工数累加」这一环断了：要么这两行报工还没有触发完工数的同步逻辑，要么报工时工单绑错了。生产在走、数据在录，结果表却一直是旧的——这就是车间数据最典型的「账实不符」。

## 数据核查思路

- `production_records` 是**过程数据**：谁、在哪个设备、什么时候、交了多少
- `work_orders` 是**结果数据**：这张工单总共完工多少

两者要能对得上。对不上的时候，先查过程数据，再顺着链路找同步断点——而不是直接改结果数据。

[[sql:9310|查 WO-20260801-01 的报工记录]]

[[sql:9315|查哪些工单完工数与报工汇总不一致]]', 1, strftime('%s','now'));

-- 测验 9210,9237,9238（9210=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9210, 9110, 'single', '## 自测：报工的本质

工人在工位上做完一批，扫码、录数、提交。系统里发生的本质动作是**往哪张表写一行**？工单的完工数（qty_done）又是怎么来的？', '["A. 往 work_orders 写行，qty_done 是人工填的","B. 往 production_records 写行，qty_done 按报工记录自动累加","C. 往 equipment 写行，qty_done 由设备状态自动生成","D. 不用写表，qty_done 由质检结果决定"]', '1', '报工的本质是在 production_records 里新增一行过程数据：谁、哪台设备、什么时候、交了多少合格品和不良品。work_orders.qty_done 是结果数据，按报工记录自动累加，不是人工填的——所以报工漏报，完工数就会偏小，账实对不上。', 1, strftime('%s','now')),
  (9237, 9110, 'single', 'production_records 中的一条记录代表什么？', '["一张完整工单","某设备某工人一次报工的合格/不良产量","一次采购到货","一次发货"]', '1', '每次报工写入一条 production_records：qty_ok 合格数、qty_ng 不良数，累计成工单完工量。', 2, strftime('%s','now')),
  (9238, 9110, 'single', '车间报工中，合格率的标准口径是？', '["qty_ok / qty_plan","qty_ok / (qty_ok + qty_ng)","qty_ng / qty_plan","qty_done / qty_plan"]', '1', '合格率 = 合格 / (合格 + 不良)。不良在 qty_ng 字段。判题与绩效都用这个口径。', 3, strftime('%s','now'));

-- SQL 练习 9310（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9310, 9001, '查 WO-20260801-01 的完整报工记录', '车间主任要核实 WO-20260801-01 的报工情况：这张工单报过几次工、分别在哪个设备、哪个工人、交了多少合格品。

输出列（顺序照写）：操作工、设备名称、合格数、不良数、报工时间。
按报工时间从早到晚排。

提示：production_records 只存了 equip_id，设备名称在 equipment 表里，用 JOIN 关联；工单按 wo_id 过滤，WO-20260801-01 的 wo_id 是 1。', '{}', 'SELECT pr.operator, e.name AS equip, pr.qty_ok, pr.qty_ng, pr.report_time
  FROM production_records pr
  JOIN equipment e ON e.equip_id = pr.equip_id
  WHERE pr.wo_id = 1
  ORDER BY pr.report_time;', '4598d0401d480c03b4bbea74705f107bddd37a058befffae3e49ac0464cf20e4', 'production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)
equipment(equip_id, code, name, workshop, status)', 1, strftime('%s','now'));

-- 微练习 9409（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9409, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'order', '工人在工位上做完一批后，MES 系统里这四步按什么顺序发生？', '{"items":[{"id":"A","text":"扫工单条码，确认在给哪张工单报工"},{"id":"B","text":"录入这一批的合格数与不良数"},{"id":"C","text":"提交，production_records 多出一行"},{"id":"D","text":"work_orders.qty_done 按报工自动累加"}]}', '["A","B","C","D"]', '对。先扫码确认目标工单，避免报错单；再录这一批的合格数与不良数；提交时往 production_records 写一行；写完之后系统才去累加 work_orders.qty_done。完工数是滚出来的，不是人填的。', '想想哪一步在往表里写行，哪一步是写完之后自动算的——扫码在录入之前，提交之后系统才会去累加完工数。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'chapter', 9110, '车间报工：做完一批之后，数据怎么走的', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'quiz', 9210, '## 自测：报工的本质  工人在工位上做完一批，扫码、录数、提交。系统里发生', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'quiz', 9237, 'production_records 中的一条记录代表什么？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'quiz', 9238, '车间报工中，合格率的标准口径是？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'sql', 9310, '查 WO-20260801-01 的完整报工记录', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'), 'micro', 9409, '工人在工位上做完一批后，MES 系统里这四步按什么顺序发生？', 6);

PRAGMA foreign_keys = ON;