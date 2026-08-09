-- ============================================================
-- 节点种子：dispatch（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9109 | 测验 9209,9235,9236 | SQL 9309 | 微练习 9408
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9109;
DELETE FROM questions WHERE id IN (9209, 9235, 9236);
DELETE FROM sql_exercises WHERE id = 9309;
DELETE FROM micro_practices WHERE id = 9408;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch') AND ref_id IN (9109, 9209, 9235, 9236, 9309, 9408) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9109
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9109, 9001, '派工：released 工单为什么开不了工', 9, 'published', '# 派工：released 工单为什么开不了工

计划员在 MES 里把工单打到了「已下达（released）」，以为这就完事了。结果车间喊：「工单下了，线没动。」

released 不是「已开工」，只是「可以开工了」。真正能不能动，还要过三道关：设备、工人、料。

## 派工四要素

一张工单真正能开出产，需要四个东西同时到位：

| 要素 | 系统里的对应 | 说明 |
|---|---|---|
| 工单已下达 | `work_orders.state = ''released''` | 这步计划员已完成 |
| 车间有设备 | `equipment.workshop` 对上 | 没设备就是空谈 |
| 设备在运行 | `equipment.status = ''运行''` | 停机/故障的设备派不了工 |
| 操作工在岗 | `production_records.operator` | 没工人设备转不起来 |

这四个条件缺一个，车间就会回你一句：「工单收到了，但开不了。」

## released ≠ running：最容易踩的坑

`work_orders.state` 有五态：created → released → running → finished → closed。

新人容易把 released 当成「已经在生产」，其实 released 只代表计划员下了指令，生产还没有真正开始。真正开始生产的标志是 `production_records` 里出现了第一条报工记录，同时工单状态自动跳到 running。

## 二号车间的典型卡点：设备停机

今天（2026-08-08）现场有个典型案例：WO-20260808-01，这张工单分配在二号车间。

WO-20260808-01 的问题是：EQ-02（冲压线B）状态为**停机**。设备停了，计划员派不下去。车间会跟你说「等设备修好」，MES 里这张工单的状态还是 released。

这不是 MES 的问题，是设备管理的问题（TPM 全员生产维护）。派工环节的价值，就是把这类「看起来能开工但实际动不了」的情况提前暴露出来。

## 关联节点：派工卡点会向下传导

派工卡住了，后面车间执行（shopfloor）就收不到报工。领料（picking）环节如果缺料，工单也一样动不了。缺料的根因往往在采购（purchase）：PO-3、PO-7 的定子组件预期到货但已逾期，仓库补不上货，领料就卡住。

完整链条：
```
purchase（采购逾期） → picking（领料缺料） → dispatch（派工开不了） → shopfloor（报工为零）
```

[[sql:9309|查出哪些 released 工单被设备卡住了]]
[[sql:9314|排出各操作工的报工绩效]]', 1, strftime('%s','now'));

-- 测验 9209,9235,9236（9209=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9209, 9109, 'single', 'WO-20260808-01 分配在二号车间，今日（2026-08-08）这张 released 工单开不了工，最可能卡在哪？', '["工单还没到交付日期，计划系统自动暂停","二号车间的唯一设备 EQ-02 处于「停机」状态","仓库没有减速机的原材料","计划员忘记点「确认开工」按钮"]', '1', 'WO-20260808-01 的工单状态是 released，分配车间是二号车间。查看 equipment 表，二号车间的唯一设备 EQ-02（冲压线B）状态为「停机」。released 只是计划员下达了指令，设备不转工单就开不了。设备状态不归 MES 管，属于 TPM（全员生产维护）范畴。', 1, strftime('%s','now')),
  (9235, 9109, 'single', '工单状态 released 代表什么含义？', '["已完工入库","已下达、可以开工，但还没真正生产","已关闭结算","已通过质检"]', '1', 'released=计划员下达指令，可以开工了。真正开始生产以 production_records 出现首条报工、状态跳 running 为标志。', 2, strftime('%s','now')),
  (9236, 9109, 'single', '判断一张工单能否派工开工，关键要确认哪三样？', '["客户、发票、运输","设备状态 × 操作工在岗 × 物料齐套","价格、折扣、税率","供应商、合同、账期"]', '1', '派工三要素：设备是否在运行、车间有无在岗工人、物料是否齐套。缺任何一样车间都会回「开不了工」。', 3, strftime('%s','now'));

-- SQL 练习 9309（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9309, 9001, '查出哪些 released 工单因为设备原因无法开工', '今天是 2026-08-08，车间主管想知道哪些 released 工单因为设备原因无法开工。

请关联 work_orders 和 equipment 表，输出列：工单号、产品名称、车间、设备名称、设备状态。
只查 released 状态的工单，按设备状态降序排列（停机、故障排前面）。

提示：用 JOIN 让工单的车间对上设备的车间，注意一张工单对应一台设备的关系。', '{}', 'SELECT w.wo_no, p.name AS product, w.workshop, e.name AS equip, e.status
   FROM work_orders w
   JOIN products p ON p.product_id = w.product_id
   JOIN equipment e ON e.workshop = w.workshop
   WHERE w.state = ''released''
   ORDER BY CASE e.status WHEN ''停机'' THEN 1 WHEN ''故障'' THEN 2 WHEN ''运行'' THEN 3 ELSE 4 END;', 'e793a2a7f0c5c29498ade4a0004407073486e7826d7f84392a31a9f068f92c7b', 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
equipment(equip_id, code, name, workshop, status)
products(product_id, code, name)', 1, strftime('%s','now'));

-- 微练习 9408（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9408, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'pick', '数据集里现在有四张 released 工单。今天（2026-08-08）哪些是被设备卡住、开不了工的？', '{"options":[{"id":"A","text":"只有 WO-20260801-01，因为它交期最近"},{"id":"B","text":"WO-20260803-02 和 WO-20260808-01，两张都在二号车间"},{"id":"C","text":"WO-20260801-01 和 WO-20260802-01，两张都在一号车间"},{"id":"D","text":"四张全被卡住，released 本来就开不了工"}]}', '["B"]', '对。WO-20260801-01、WO-20260802-01 在一号车间，EQ-01 注塑机A 和 EQ-04 装配线D 都是「运行」，设备没拦着它们；WO-20260803-02、WO-20260808-01 都在二号车间，而二号车间只有 EQ-02 冲压线B 一台，状态是「停机」——这两张才是真卡住的。至于「故障」的 EQ-05，它在三号车间，跟这四张工单都不沾边。', '提示：先从 work_orders 里挑出 state = released 的工单，看它们各在哪个车间；再去 equipment 表按车间查设备状态。注意一号车间有两台设备、二号车间只有一台，车间对不上的设备不用管。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'chapter', 9109, '派工：released 工单为什么开不了工', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'quiz', 9209, 'WO-20260808-01 分配在二号车间，今日（2026-08-08）这', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'quiz', 9235, '工单状态 released 代表什么含义？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'quiz', 9236, '判断一张工单能否派工开工，关键要确认哪三样？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'sql', 9309, '查出哪些 released 工单因为设备原因无法开工', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'), 'micro', 9408, '数据集里现在有四张 released 工单。今天（2026-08-08）哪些', 6);

PRAGMA foreign_keys = ON;