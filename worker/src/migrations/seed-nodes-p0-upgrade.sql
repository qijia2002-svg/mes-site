-- ============================================================
-- P0 节点课程升级（2026-08-08）
-- 由 tmp/build-p0-upgrade.py 从 docs/seeds/seed-nodes-p0-consolidated.sql 生成，请勿手改。
--
-- 覆盖 5 个节点：dispatch / shopfloor / qc / mrp / bom-route
-- 每个节点 = chapter + questions + sql_exercises + micro_practices + node_resources
--
-- 相对原稿改了什么：
--   1. ID 按线上 D1 真实归属重编号（原稿假设的 9104/9204/9304 其实属于 cust-order，
--      照原样执行会把六个节点的课程内容互相串台）
--   2. 9309 补 JOIN products —— 原稿 SELECT 里的 p.name 没有来源，执行直接报错
--   3. 9314 原题只筛 WO-20260801-02 一张工单，结果只有 1 行，改为全体操作工绩效（3 行）
--   4. 9307 原稿 CTE 别名越界报错；口径也从「按产品逐行罗列」改为
--      「跨产品汇总到物料再减库存」，否则共用料的缺口会被算没
--   5. mrp 章节轴承那行只算了减速机的一半（-308 过剩），与本章自测题（缺 96）自相矛盾，
--      已改为 1576 / 1480 / +96
--   6. 9210 / 9215 的 answer 存的是字母 'B'，而判题按 0-based 索引，已改为 '1'
--   7. 五道微练习 payload 从 {key,label} 统一为前端要的 {id,text}；
--      dispatch 题面与数据对不上、qc 题跑到 BOM 上去了、bom-route 答案算错，三道重写
--
-- 章节 sort 沿用线上约定 = id - 9100
-- ============================================================

PRAGMA foreign_keys = OFF;

------------------------------------------------------------
-- [dispatch] 派工：released 工单为什么开不了工
-- 病灶：WO-20260808-01 在二号车间，但 EQ-02 冲压线B 停机 → 开不了工
------------------------------------------------------------
DELETE FROM chapters       WHERE id = 9109;
DELETE FROM questions      WHERE id IN (9209, 9214);
DELETE FROM sql_exercises  WHERE id IN (9309, 9314);
DELETE FROM micro_practices WHERE id = 9408;
DELETE FROM node_resources
 WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
                   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch')
   AND ref_id IN (9109, 9209, 9214, 9309, 9314, 9408);

INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9109, 9001, '派工：released 工单为什么开不了工', 9, 'published',
'# 派工：released 工单为什么开不了工

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
[[sql:9314|排出各操作工的报工绩效]]',
1, strftime('%s','now'));

INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
(9209, 9109, 'single',
 'WO-20260808-01 分配在二号车间，今日（2026-08-08）这张 released 工单开不了工，最可能卡在哪？',
 '["工单还没到交付日期，计划系统自动暂停","二号车间的唯一设备 EQ-02 处于「停机」状态","仓库没有减速机的原材料","计划员忘记点「确认开工」按钮"]',
 '1',
 'WO-20260808-01 的工单状态是 released，分配车间是二号车间。查看 equipment 表，二号车间的唯一设备 EQ-02（冲压线B）状态为「停机」。released 只是计划员下达了指令，设备不转工单就开不了。设备状态不归 MES 管，属于 TPM（全员生产维护）范畴。',
 1, strftime('%s','now')),
(9214, 9109, 'single',
 '计划员把一张 released 工单分配到某车间后，系统提示「设备正常但无法开工」，还需要确认什么？',
 '["工单交付日期是否已过期","该车间是否有可用的操作工在岗","工单的计划量是否大于零","该工单是否已关联销售订单"]',
 '1',
 '设备在运行不代表一定开得了工。如果该车间没有在岗的操作工（production_records 里没有对应工人记录），设备空转也没有产出。新员工入职延迟、换班未交接等情况都会导致这类问题。确认顺序：设备→工人→物料。',
 2, strftime('%s','now'));

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES
(9309, 9001,
 '查出哪些 released 工单因为设备原因无法开工',
 '今天是 2026-08-08，车间主管想知道哪些 released 工单因为设备原因无法开工。

请关联 work_orders 和 equipment 表，输出列：工单号、产品名称、车间、设备名称、设备状态。
只查 released 状态的工单，按设备状态降序排列（停机、故障排前面）。

提示：用 JOIN 让工单的车间对上设备的车间，注意一张工单对应一台设备的关系。',
 '{}',
 'SELECT w.wo_no, p.name AS product, w.workshop, e.name AS equip, e.status
   FROM work_orders w
   JOIN products p ON p.product_id = w.product_id
   JOIN equipment e ON e.workshop = w.workshop
   WHERE w.state = ''released''
   ORDER BY CASE e.status WHEN ''停机'' THEN 1 WHEN ''故障'' THEN 2 WHEN ''运行'' THEN 3 ELSE 4 END;',
 'e793a2a7f0c5c29498ade4a0004407073486e7826d7f84392a31a9f068f92c7b',
 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
equipment(equip_id, code, name, workshop, status)
products(product_id, code, name)',
 1, strftime('%s','now')),
(9314, 9001,
 '排出各操作工的报工绩效，决定这批活派给谁',
 '派工不只是挑设备，还要挑人。车间主管想按历史数据决定这批活优先派给谁。

请从 production_records 统计每位操作工的整体表现，输出列（顺序照写）：操作工、经手工单数、合格数、不良数、合格率。
合格率 = 合格数 /（合格数 + 不良数），保留 3 位小数。
按合格率降序排列；合格率相同的，合格数多的排前面。

提示：同一位操作工可能在同一张工单上报工多次，工单数要用 COUNT(DISTINCT wo_id) 去重。',
 '{}',
 'SELECT pr.operator,
        COUNT(DISTINCT pr.wo_id) AS wo_cnt,
        SUM(pr.qty_ok) AS qty_ok,
        SUM(pr.qty_ng) AS qty_ng,
        ROUND(CAST(SUM(pr.qty_ok) AS REAL) / (SUM(pr.qty_ok) + SUM(pr.qty_ng)), 3) AS pass_rate
   FROM production_records pr
   GROUP BY pr.operator
   ORDER BY pass_rate DESC, qty_ok DESC;',
 'c714b9da139248041336885122362833881fb1e6059b549369ae0633980a8620',
 'production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)',
 2, strftime('%s','now'));

INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
9408,
(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
'pick',
'数据集里现在有四张 released 工单。今天（2026-08-08）哪些是被设备卡住、开不了工的？',
'{"options":[{"id":"A","text":"只有 WO-20260801-01，因为它交期最近"},{"id":"B","text":"WO-20260803-02 和 WO-20260808-01，两张都在二号车间"},{"id":"C","text":"WO-20260801-01 和 WO-20260802-01，两张都在一号车间"},{"id":"D","text":"四张全被卡住，released 本来就开不了工"}]}',
'["B"]',
'对。WO-20260801-01、WO-20260802-01 在一号车间，EQ-01 注塑机A 和 EQ-04 装配线D 都是「运行」，设备没拦着它们；WO-20260803-02、WO-20260808-01 都在二号车间，而二号车间只有 EQ-02 冲压线B 一台，状态是「停机」——这两张才是真卡住的。至于「故障」的 EQ-05，它在三号车间，跟这四张工单都不沾边。',
'提示：先从 work_orders 里挑出 state = released 的工单，看它们各在哪个车间；再去 equipment 表按车间查设备状态。注意一号车间有两台设备、二号车间只有一台，车间对不上的设备不用管。',
1);

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'chapter', 9109, '派工：released 工单为什么开不了工', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'sql', 9309, '查出哪些 released 工单被设备卡住了', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'sql', 9314, '排出各操作工的报工绩效', 3),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'quiz', 9209, '自测：派工四要素', 4),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'quiz', 9214, '自测：设备正常但无法开工怎么办', 5),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),
 'micro', 9408, '判断 WO-20260801-01 卡在哪', 6);

------------------------------------------------------------
-- [shopfloor] 车间报工：做完一批之后，数据怎么走的
-- 病灶：WO-20260801-01 有报工记录（陆明辉 75 件）但 work_orders.qty_done=0
--       ——「报工 → 完工数累加」同步断裂
------------------------------------------------------------
DELETE FROM chapters       WHERE id = 9110;
DELETE FROM questions      WHERE id IN (9210, 9215);
DELETE FROM sql_exercises  WHERE id IN (9310, 9315);
DELETE FROM micro_practices WHERE id = 9409;
DELETE FROM node_resources
 WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
                   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor')
   AND ref_id IN (9110, 9210, 9215, 9310, 9315, 9409);

INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9110, 9001,
'车间报工：做完一批之后，数据怎么走的',
10, 'published',
'# 车间报工：做完一批之后，数据怎么走的

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

[[sql:9315|查哪些工单完工数与报工汇总不一致]]',
1, strftime('%s','now'));

INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (
9210, 9110, 'single',
'## 自测：报工的本质

工人在工位上做完一批，扫码、录数、提交。系统里发生的本质动作是**往哪张表写一行**？工单的完工数（qty_done）又是怎么来的？',
'["A. 往 work_orders 写行，qty_done 是人工填的","B. 往 production_records 写行，qty_done 按报工记录自动累加","C. 往 equipment 写行，qty_done 由设备状态自动生成","D. 不用写表，qty_done 由质检结果决定"]',
'1',
'报工的本质是在 production_records 里新增一行过程数据：谁、哪台设备、什么时候、交了多少合格品和不良品。work_orders.qty_done 是结果数据，按报工记录自动累加，不是人工填的——所以报工漏报，完工数就会偏小，账实对不上。',
1, strftime('%s','now')),
(9215, 9110, 'single',
'## 自测：WO-20260801-01 的完工数为什么是 0

WO-20260801-01 在 production_records 里有两行报工（陆明辉共交 75 件合格品），但 work_orders 里这张工单的 qty_done 是 0。问题最可能出在哪一步？',
'["A. 工人根本没报工，工单上没有任何报工记录","B. 报工已提交，但没触发完工数同步（或工单绑定录错）","C. 报工里的 75 件全是不良品，所以不算完工","D. 工单还没到交期，完工数要等交期后才更新"]',
'1',
'过程数据（报工合计 75 件）与结果数据（qty_done=0）对不上，说明「报工 → 完工数累加」这一环断了：要么同步逻辑没触发，要么报工时工单绑错。车间核查遇到账实不符，要顺链路找断点，而不是直接手改 qty_done。',
2, strftime('%s','now'));

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
9310, 9001,
'查 WO-20260801-01 的完整报工记录',
'车间主任要核实 WO-20260801-01 的报工情况：这张工单报过几次工、分别在哪个设备、哪个工人、交了多少合格品。

输出列（顺序照写）：操作工、设备名称、合格数、不良数、报工时间。
按报工时间从早到晚排。

提示：production_records 只存了 equip_id，设备名称在 equipment 表里，用 JOIN 关联；工单按 wo_id 过滤，WO-20260801-01 的 wo_id 是 1。',
'{}',
'SELECT pr.operator, e.name AS equip, pr.qty_ok, pr.qty_ng, pr.report_time
  FROM production_records pr
  JOIN equipment e ON e.equip_id = pr.equip_id
  WHERE pr.wo_id = 1
  ORDER BY pr.report_time;',
'4598d0401d480c03b4bbea74705f107bddd37a058befffae3e49ac0464cf20e4',
'production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)
equipment(equip_id, code, name, workshop, status)',
1, strftime('%s','now')),
(9315, 9001,
'查出完工数与报工汇总不一致的工单',
'工单的完工数（qty_done）应该等于这张工单历次报工合格数（qty_ok）之和，但有些工单两者对不上。请查出所有对不上的工单，并算出差多少。

输出列（顺序照写）：工单号、工单完工数、报工合格总数、差值（工单完工数 - 报工合格总数）。
按差值从小到大排——负得最多的排最前，也就是「报了工但工单没同步」最严重的工单最靠前。

提示：用 LEFT JOIN 保留没有报工记录的工单；报工合格数按工单分组求和，COALESCE 把空值当 0；只留差值不等于 0 的工单。',
'{}',
'WITH reported AS (
  SELECT wo_id, SUM(qty_ok) AS reported_ok FROM production_records GROUP BY wo_id
)
SELECT w.wo_no, w.qty_done AS qty_on_wo, COALESCE(r.reported_ok,0) AS qty_reported,
  w.qty_done - COALESCE(r.reported_ok,0) AS diff
FROM work_orders w LEFT JOIN reported r ON r.wo_id = w.wo_id
WHERE w.qty_done <> COALESCE(r.reported_ok,0)
ORDER BY diff ASC;',
'719be1a165dcddd2d43114aca091afc79ae372ccb7458764f6881a1e1333542b',
'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)',
2, strftime('%s','now'));

INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
9409,
(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
'order',
'工人在工位上做完一批后，MES 系统里这四步按什么顺序发生？',
'{"items":[{"id":"A","text":"扫工单条码，确认在给哪张工单报工"},{"id":"B","text":"录入这一批的合格数与不良数"},{"id":"C","text":"提交，production_records 多出一行"},{"id":"D","text":"work_orders.qty_done 按报工自动累加"}]}',
'["A","B","C","D"]',
'对。先扫码确认目标工单，避免报错单；再录这一批的合格数与不良数；提交时往 production_records 写一行；写完之后系统才去累加 work_orders.qty_done。完工数是滚出来的，不是人填的。',
'想想哪一步在往表里写行，哪一步是写完之后自动算的——扫码在录入之前，提交之后系统才会去累加完工数。',
1);

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'chapter', 9110, '先搞懂报工之后 qty_done 是怎么来的', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'sql', 9310, '查 WO-20260801-01 的完整报工记录', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'sql', 9315, '查出完工数与报工汇总不一致的工单', 3),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'quiz', 9210, '自测：报工的本质是什么', 4),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'quiz', 9215, '自测：完工数为 0 是什么问题', 5),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),
 'micro', 9409, '把报工四步按顺序排好', 6);

------------------------------------------------------------
-- [qc-deep] 质量追溯：从不合格记录往回摸到根因（qc 节点补充内容）
-- 病灶：check_id=2 → WO-20260801-01 → 一号车间 → EQ-01 注塑机A → 陆明辉
------------------------------------------------------------
DELETE FROM chapters       WHERE id = 9113;
DELETE FROM questions      WHERE id = 9213;
DELETE FROM sql_exercises  WHERE id = 9313;
DELETE FROM micro_practices WHERE id = 9413;
DELETE FROM node_resources
 WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
                   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc')
   AND ref_id IN (9113, 9213, 9313, 9413);

INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9113, 9001, '质量追溯：顺着不合格记录往回摸到根因', 13, 'published',
'# 质量追溯：顺着不合格记录往回摸到根因

## 一句话理解

> 追溯不是把不合格记录查出来就算完，而是顺着它一路往回摸，摸到车间、设备、当班操作工，直到能说清「这一件为什么坏」。

在质量检验节点，判出不合格只是第一步。真正值钱的能力是**追溯**：从一条质检记录出发，把整条因果链还原出来。

## 完整追溯链

一张不合格记录能牵出整条链：

quality_checks（谁判的、什么缺陷） → work_orders（哪个工单、哪个车间、什么产品） → production_records（谁做的、哪台设备、合格几件不良几件） → equipment + operator（责任设备与当班人）

四张表串起来，不合格就不再是孤零零的一行，而是一段可追责的过程。

## 动手摸一条：check_id=2

以 check_id=2 为例，它是 WO-20260801-01（减速机）的尺寸超差，往回摸：

- quality_checks：check_id=2，wo_id=1，缺陷类型 尺寸超差
- work_orders：wo_id=1 → 一号车间，产品是减速机
- production_records：一号车间这台工单有两笔报工，其中 EQ-01（注塑机A）那笔由陆明辉报工，40 件合格、2 件不良
- 结论：尺寸超差大概率来自注塑机A 那班——设备和人一下子就定位到了

这就是追溯的威力：从「不合格」三个字，直接落到「注塑机A、陆明辉、那一批」。

## SPC 思维：看比率，不看绝对数

追溯出来之后还要会解读。同一台设备，产 100 件坏 5 件，和产 1000 件坏 5 件，严重程度天差地别。所以要算**不良率**：

不良率 = 不良数 ÷（合格数 + 不良数）× 100%

分母是总产量，不是合格数，也不是计划数。

特别注意：WO-20260801-01 的 work_orders.qty_done 还是 0（工单还没完工同步），这时候绝不能拿 qty_done 当分母，要用 production_records 里的 qty_ok 累加来算。

[[sql:9313|从质检记录追到设备和操作工]]',
1, strftime('%s','now'));

INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (
9213, 9113, 'single',
 '操作工邱敬川在工单 WO-20260802-02 上的两次报工累计：合格 70+45=115 件，不良 5+0=5 件。按质量追溯 / SPC 的不良率口径，这道工单的不良率应怎么算？',
 '["A. 不良数 ÷ 合格数 = 5 ÷ 115 ≈ 4.35%（只拿合格数当分母）","B. 不良数 ÷（合格数 + 不良数）= 5 ÷ 120 ≈ 4.17%（分母是总产量）","C. 不良数 ÷ 计划数 = 5 ÷ 150 ≈ 3.33%（拿计划量当分母）","D. 不良数 ÷ 报工次数 = 5 ÷ 2 = 2.5 件/次（拿次数当分母）"]',
 '1',
 '不良率的分母必须是总产量（合格 + 不良）。像 WO-20260801-01 这种 qty_done 还没同步的工单，更不能拿 work_orders.qty_done 当分母，要用 production_records 的 qty_ok + qty_ng 来算。只除合格数会低估问题，这正是 SPC 日常最该防的误用。',
 1, strftime('%s','now'));

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
9313, 9001,
 '从质检记录追溯到设备和操作工',
 '今天质量例会要追一批不合格。查出所有不合格质检记录，关联到工单、产品、车间、设备、操作工，按检验时间升序排列。

要求输出这几列，顺序照写：检验时间、工单号、产品名称、车间、设备、操作工、缺陷类型。

提示：quality_checks 里合格记录的 defect_type 是 NULL，用 IS NOT NULL 先把合格记录过滤掉，只留不合格。',
 '{}',
 'SELECT q.check_time, w.wo_no, p.name AS product, w.workshop, e.name AS equip, pr.operator, q.defect_type
   FROM quality_checks q
   JOIN work_orders w ON w.wo_id = q.wo_id
   JOIN products p ON p.product_id = w.product_id
   LEFT JOIN production_records pr ON pr.wo_id = q.wo_id
   LEFT JOIN equipment e ON e.equip_id = pr.equip_id
   WHERE q.result = ''不合格''
   ORDER BY q.check_time;',
 '3ce2ab52b31c4689425092ad48143124118b29c7d6ca2132194bb1519b5df843',
 'quality_checks(check_id, wo_id, check_time, result, defect_type)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
products(product_id, code, name, spec, unit)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)
equipment(equip_id, code, name, workshop, status)',
 13, strftime('%s','now'));

INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
9413,
(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
'order',
'check_id = 2 是一条「不合格 / 尺寸超差」的质检记录。要从它追到具体设备和操作工，四步查询按什么顺序走？',
'{"items":[{"id":"A","text":"从 quality_checks 取出这条记录的 wo_id"},{"id":"B","text":"用 wo_id 查 work_orders，拿到产品和车间"},{"id":"C","text":"按车间去 equipment 表，圈出这个车间的设备"},{"id":"D","text":"回到 production_records，按 wo_id 加 equip_id 锁定操作工"}]}',
'["A","B","C","D"]',
'对。追溯是顺着外键往回走：质检记录身上只有 wo_id，先拿到工单，再由工单的车间圈出设备，最后用工单加设备去报工记录里锁定人。check_id=2 走完这条链，落点是 WO-20260801-01、一号车间、EQ-01 注塑机A，操作工陆明辉。',
'提示：quality_checks 表里没有设备也没有人，只有 wo_id。别一上来就查 production_records——你还不知道该按哪个 wo_id 筛。',
1);

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'chapter', 9113, '把不合格记录追到设备和人', 4),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'sql', 9313, '从质检记录追溯到设备和操作工', 5),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'quiz', 9213, '自测：不良率怎么算', 6),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'micro', 9413, '把产品和 BOM 用量配对', 7);

------------------------------------------------------------
-- [mrp] MRP 运算：毛需求怎么变成净需求
-- 病灶：控制主板净需求=+68（库存96但毛需求164）→ 关联采购节点 PO-3/PO-7 逾期
------------------------------------------------------------
DELETE FROM chapters       WHERE id = 9107;
DELETE FROM questions      WHERE id = 9207;
DELETE FROM sql_exercises  WHERE id = 9307;
DELETE FROM micro_practices WHERE id = 9404;
DELETE FROM node_resources
 WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
                   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp')
   AND ref_id IN (9107, 9207, 9307, 9404);

INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9107, 9001,
'MRP 运算：毛需求怎么变成净需求',
7, 'published',
'# MRP 运算：毛需求怎么变成净需求

## MRP 在工厂里的位置

MRP（Material Requirements Planning）处于**计划层**，它的输入是已评审的销售订单，输出是各物料的净需求量——这个输出会直接流入采购节点，成为采购申请的依据。

## MRP 三步走

第一步：筛订单（review_status = ''approved''）→ 第二步：BOM展开 → 第三步：减库存

## 数据怎么走

以本系统 dataset 为例，今天是 **2026-08-08**，计划员要跑一轮 MRP：

**按产品汇总（只算 approved 订单）：**
- 减速机：100 + 120 + 70 = **290 台**
- 伺服电机：60 + 40 + 100 = **200 台**
- PLC 控制器：**80 台**
- 变频器：50 + 30 = **80 台**

**BOM 展开成毛需求（含损耗）：**

| 产品 | 物料 | 计算过程 | 毛需求 |
|---|---|---|---|
| 减速机 290 台 | 铸铁箱体 | 290 × 1 × 1.02 | **296 件** |
| 减速机 290 台 | 轴承 | 290 × 4 × 1.01 | **1172 套** |
| 伺服电机 200 台 | 定子组件 | 200 × 1 × 1.03 | **206 件** |
| 伺服电机 200 台 | 轴承 | 200 × 2 × 1.01 | **404 套** |
| PLC 控制器 80 台 | 控制主板 | 80 × 1 × 1.02 | **82 块** |
| PLC 控制器 80 台 | 接线端子 | 80 × 12 × 1.05 | **1008 个** |
| 变频器 80 台 | 控制主板 | 80 × 1 × 1.02 | **82 块** |
| 变频器 80 台 | 接线端子 | 80 × 8 × 1.04 | **666 个** |

**净需求（减库存）：**

| 物料 | 毛需求 | 库存 | 净需求 | 说明 |
|---|---|---|---|---|
| 铸铁箱体 | 296 件 | 320 件 | **-24** | 过剩，可不动 |
| 轴承（减速机 1172 + 伺服电机 404） | 1576 套 | 1480 套 | **+96** | 注意： 库存不足，还缺 96 套 |
| 定子组件 | 206 件 | 210 件 | **-4** | 略过剩 |
| 控制主板 | 82+82=164 块 | 96 块 | **+68** | 注意： 库存不足，还缺 68 块 |
| 接线端子 | 1008+666=1674 个 | 5400 个 | **-3726** | 过剩 |

> **注意**：共用料要先跨产品汇总再减库存。轴承单看减速机是 1172 套、库存 1480 套，像是够的；
> 把伺服电机的 404 套加进来才是 1576 套，实际缺 96 套。分产品各减一次库存，缺口就被算没了。

> **注意**：定子组件虽然在途（PO-3、PO-7 预期到货），但 MRP 只算现货库存，在途不计入。
> 所以这一轮真正要补货的是轴承（+96）和控制主板（+68）——这就是 MRP 与采购节点要联动的原因。

## 关键卡点

1. **净需求 = 毛需求 - 库存**：在途量（采购在途/生产在制）不计入减项
2. **损耗率进 BOM**：SQL 里用 `CAST(qty_per * (1 + loss_rate) AS INTEGER)` 一次性算进去
3. **已评审才纳入**：rejected / pending 订单不参与计算

[[sql:9307|算出各物料净需求与库存缺口]]',
1, strftime('%s','now'));

INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (
9207, 9107, 'single',
'## 自测：轴承的库存够不够支撑所有已评审订单？

以下是今日（2026-08-08）MRP 运算的部分结果：

| 用途 | 轴承净需求（套） |
|---|---|
| 减速机 290 台 × 4 套/台 × 1.01 | 1172 |
| 伺服电机 200 台 × 2 套/台 × 1.01 | 404 |
| **合计毛需求** | **1576** |
| 当前库存 | 1480 |

已知轴承当前库存为 **1480 套**，请问：库存是否足够支撑所有已评审订单的需求？',
'["A. 够用，库存还有剩余","B. 不够用，出现缺口约 96 套","C. 刚好用完，一套不剩","D. 需要进一步查看 BOM 才能判断"]',
'1',
'轴承的毛需求 = 减速机用 + 伺服电机用 = 290 × 4 × 1.01 + 200 × 2 × 1.01 = 1172 + 404 = **1576 套**。轴承库存 = 1480 套。净需求 = 1576 - 1480 = **96 套**（缺口）。答案 **B**：不够用，还缺约 96 套轴承。轴承在采购节点 PO-2 里预期到货 2000 套，正是用来填补这个缺口的。',
1, strftime('%s','now'));

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
9307, 9001,
'算出各物料的净需求与库存缺口',
'今天是 **2026-08-08**，计划员要跑一轮 MRP。

你的任务：把所有已评审通过（`review_status = ''approved''`）的订单按产品汇总，用 BOM 展开成各物料的毛需求，**跨产品汇总到物料**之后再减库存，得出净需求。

**净需求解读：**
- 净需求 **< 0**（负数）→ 库存够用，不用补货
- 净需求 **> 0**（正数）→ 库存不足，缺口要靠采购补

## 输出要求

输出列（顺序照写）：
1. **物料名称**
2. **毛需求**（含损耗，四舍五入取整）
3. **当前库存**
4. **净需求**（= 毛需求 - 库存）

排序：**净需求降序**（最缺的排最前面）。

## 提示

- 损耗率直接乘进 BOM：`qty_per * (1 + loss_rate)`
- 取整用 `CAST(ROUND(...) AS INTEGER)`，与 pick_lists 的口径一致
- **关键**：轴承被减速机和伺服电机共用，接线端子被 PLC 和变频器共用。
  共用料必须先跨产品把毛需求加起来，再减库存——分产品各减一次库存，会把缺口算没了
- `approved` 以外的订单（pending / rejected）不参与计算',
'{}',
'WITH approved AS (
  SELECT product_id, SUM(qty) AS total_qty
    FROM sales_orders
   WHERE review_status = ''approved''
   GROUP BY product_id
)
SELECT m.name AS material,
       SUM(CAST(ROUND(a.total_qty * b.qty_per * (1 + b.loss_rate)) AS INTEGER)) AS gross_need,
       m.stock_qty AS stock,
       SUM(CAST(ROUND(a.total_qty * b.qty_per * (1 + b.loss_rate)) AS INTEGER)) - m.stock_qty AS net_need
  FROM approved a
  JOIN bom b ON b.product_id = a.product_id
  JOIN materials m ON m.material_id = b.material_id
 GROUP BY m.material_id, m.name, m.stock_qty
 ORDER BY net_need DESC;',
'1ebab73b4c23e6ae17c5e7a5c809da0bf3329494bf51ced1c2e7fa626b98c195',
'products(product_id, code, name, spec, unit)
materials(material_id, code, name, unit, stock_qty)
bom(bom_id, product_id, material_id, qty_per, loss_rate)
sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)',
9, strftime('%s','now'));

INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
9404,
(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
'pick',
'MRP 跑完，控制主板的净需求是 +68 块（毛需求 164 块，库存只有 96 块）。净需求为正意味着什么？计划员下一步该做什么？',
'{"options":[{"id":"A","text":"直接去仓库调拨，不用下采购单"},{"id":"B","text":"生成采购申请，向供应商下达采购单"},{"id":"C","text":"等供应商主动联系补货"},{"id":"D","text":"把净需求清零，避免触发采购"}]}',
'["B"]',
'对。净需求为正 = 现货不够，差的那部分要靠采购补。MRP 的输出就是采购节点的输入，两个环节是这样咬合上的。',
'提示：净需求为正说明库存不够——不够的部分靠什么补上？采购（purchase）是 MRP 的下游，MRP 算出来的净需求就是采购申请的依据。',
1);

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'chapter', 9107, '先搞懂净需求是怎么从订单算出来的', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'sql', 9307, '算出各物料净需求与库存缺口', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'quiz', 9207, '自测：轴承库存够不够支撑所有订单', 3),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),
 'micro', 9404, '判断净需求为正时下一步做什么', 4);

------------------------------------------------------------
-- [bom-route] BOM 与工艺路线：把产品拆解成物料和工序
-- 病灶：接线端子共用于 PLC（12个/台）和变频器（8个/台），每产品用量不同
------------------------------------------------------------
DELETE FROM chapters       WHERE id = 9108;
DELETE FROM questions      WHERE id = 9208;
DELETE FROM sql_exercises  WHERE id = 9308;
DELETE FROM micro_practices WHERE id = 9406;
DELETE FROM node_resources
 WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
                   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route')
   AND ref_id IN (9108, 9208, 9308, 9406);

INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9108, 9001, 'BOM 与工艺路线：把产品拆解成物料和工序', 8, 'published',
'# BOM 与工艺路线：把产品拆解成物料和工序

## BOM 的本质：乘法律

BOM（物料清单）是 MES 系统里最核心的数据结构之一，它回答的问题是：**这个产品由哪些物料构成，每台用多少，有多少损耗**。

记住这个公式：

> **应发量 = qty_per × qty_plan × (1 + loss_rate)**

比如 BOM 里记录"减速机用轴承：4 套/台，损耗 1%"，那 80 台减速机的轴承应发量就是：

`80 × 4 × 1.01 = 323 套`

注意：**损耗率必须进 BOM**，否则仓库按净用量备料，生产到一半就断料。

## 共用料的陷阱

在工厂里，同一种物料往往被多个产品共用——轴承就是典型：

| BOM 记录 | 产品 | qty_per | 说明 |
|---------|------|---------|------|
| 减速机 → 轴承 | P-1001 减速机 | 4 套/台 | |
| 伺服电机 → 轴承 | P-1002 伺服电机 | 2 套/台 | 共用物料！|

如果计划 100 台减速机 + 100 台伺服电机，轴承总需求**不是** 100×(4+2)=600，而是：

- 减速机：100 × 4 × 1.01 = 404 套
- 伺服电机：100 × 2 × 1.01 = 202 套
- **合计：606 套**

这就是为什么净需求必须**按 BOM 逐产品展开**，把相同物料的用量分开算完之后再汇总。

## 工艺路线：从工单反推产品归属车间

dataset 的 work_orders 表里，workshop 列隐含记录了每个产品通常在哪个车间生产：

| 产品 | 归属车间 | 证据（工单） |
|------|---------|-------------|
| P-1001 减速机 | 一号车间 | WO-20260801-01、WO-20260802-01、WO-20260803-01 |
| P-1002 伺服电机 | 二号车间 | WO-20260801-02、WO-20260803-02、WO-20260808-01 |
| P-1003 PLC控制器 | 三号车间 | WO-20260802-02 |
| P-1004 变频器 | 一号车间 | WO-20260803-01 |

工艺路线决定了工序排程的物理约束——**同一个车间内，共用设备的不同产品会相互竞争设备产能**。

## 病灶：接线端子共用于 PLC 和变频器

接线端子（M-2005）是另一个共用料陷阱：

- PLC控制器：12 个/台，损耗 5%
- 变频器：8 个/台，损耗 4%

如果仓库直接加总"接线端子总需求"，会丢失产品维度的差异；只有按 BOM 展开，才能算出各自准确的应发量。

[[sql:9308|查各产品 BOM 构成与应发量]]',
1, strftime('%s','now'));

INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (
9208, 9108, 'single',
'计划同时投产：
- 减速机（P-1001）50 台，每台需要轴承 4 套，损耗率 1%
- 伺服电机（P-1002）50 台，每台需要轴承 2 套，损耗率 1%

仓库要备多少套轴承？',
'["A. 300 套","B. 303 套","C. 404 套","D. 606 套"]',
'1',
'**不能用 50×(4+2)=300 来算共用料！** 必须按 BOM 逐产品展开：

- 减速机轴承需求：50 × 4 × 1.01 = **202 套**
- 伺服电机轴承需求：50 × 2 × 1.01 = **101 套**
- **合计：303 套**

共用料每种产品的 qty_per 不同，汇总需求时必须先分开算，再求和。',
1, strftime('%s','now'));

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
9308, 9001,
'查出各产品 BOM 构成，计算单次生产的应发量',
'工厂要新上一批生产（WO-20260803-01: 80台减速机，WO-20260803-02: 40台伺服电机），仓库要提前备料。按 BOM 展开这两种产品的物料需求，计算应发量（应发量 = 单件用量 × 计划量 × (1+损耗率)，取整），列出各产品各物料的详细构成。

输出列：产品名称、物料名称、计划量、单件用量、损耗率、应发量。
排序：产品名称升序，应发量降序。',
'{}',
'SELECT p.name AS product, m.name AS material,
    w.qty_plan, b.qty_per, b.loss_rate,
    CAST(ROUND(w.qty_plan * b.qty_per * (1 + b.loss_rate)) AS INTEGER) AS qty_required
  FROM (SELECT * FROM work_orders WHERE wo_no IN (''WO-20260803-01'',''WO-20260803-02'')) w
  JOIN bom b ON b.product_id = w.product_id
  JOIN products p ON p.product_id = w.product_id
  JOIN materials m ON m.material_id = b.material_id
  ORDER BY p.name, qty_required DESC;',
'a051196128f7dec259a208b606c58b592620272925a6c8c3bdcdf74a034f139a',
'products(product_id, code, name, spec, unit)
materials(material_id, code, name, unit, stock_qty)
bom(bom_id, product_id, material_id, qty_per, loss_rate)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)',
1, strftime('%s','now'));

INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
9406,
(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
'match',
'把四个产品连到它 BOM 里每台用量最大的那种物料上。注意用量要连数字一起对。',
'{"left":[{"id":"P-1001","text":"减速机 P-1001"},{"id":"P-1002","text":"伺服电机 P-1002"},{"id":"P-1003","text":"PLC控制器 P-1003"},{"id":"P-1004","text":"变频器 P-1004"}],"right":[{"id":"m-bearing-4","text":"轴承 4 套/台"},{"id":"m-bearing-2","text":"轴承 2 套/台"},{"id":"m-terminal-12","text":"接线端子 12 个/台"},{"id":"m-terminal-8","text":"接线端子 8 个/台"}]}',
'["P-1001=>m-bearing-4","P-1002=>m-bearing-2","P-1003=>m-terminal-12","P-1004=>m-terminal-8"]',
'对，而且四个产品的「大头物料」没有一个是独占的：减速机和伺服电机都吃轴承，一台 4 套一台 2 套；PLC 和变频器都吃接线端子，一台 12 个一台 8 个。共用料的用量跟着产品走，这就是 BOM 展开必须逐产品算、不能按物料拍总量的原因。',
'提示：把 bom 表按 product_id 分组，看每个产品里 qty_per 最大的那一行是什么物料、每台用几个。轴承和接线端子都出现在两个产品里，但用量不一样，别当成同一个选项。',
1);

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'chapter', 9108, '先搞懂 BOM 的乘法律和共用料陷阱', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'sql', 9308, '按 BOM 展开两种产品的应发量', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'quiz', 9208, '自测：共用料需求怎么算', 3),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),
 'micro', 9406, '把产品和最大用量物料配对', 4);

------------------------------------------------------------
-- 附带修复：线上 stock-in 节点的 quiz 资源指到了 shipping 的题（9212），
-- 导致「生产入库」和「发货出库」两个节点点开是同一道题。9211 才是入库那道。
UPDATE node_resources
   SET ref_id = 9211
 WHERE res_type = 'quiz'
   AND ref_id = 9212
   AND node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
                   WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in');

PRAGMA foreign_keys = ON;
