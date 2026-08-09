-- ============================================================
-- 节点种子：bom-route（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9108 | 测验 9208,9231,9232 | SQL 9308 | 微练习 9406
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9108;
DELETE FROM questions WHERE id IN (9208, 9231, 9232);
DELETE FROM sql_exercises WHERE id = 9308;
DELETE FROM micro_practices WHERE id = 9406;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route') AND ref_id IN (9108, 9208, 9231, 9232, 9308, 9406) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9108
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9108, 9001, 'BOM 与工艺路线：把产品拆解成物料和工序', 8, 'published', '# BOM 与工艺路线：把产品拆解成物料和工序

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

[[sql:9308|查各产品 BOM 构成与应发量]]', 1, strftime('%s','now'));

-- 测验 9208,9231,9232（9208=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9208, 9108, 'single', '计划同时投产：
- 减速机（P-1001）50 台，每台需要轴承 4 套，损耗率 1%
- 伺服电机（P-1002）50 台，每台需要轴承 2 套，损耗率 1%

仓库要备多少套轴承？', '["A. 300 套","B. 303 套","C. 404 套","D. 606 套"]', '1', '**不能用 50×(4+2)=300 来算共用料！** 必须按 BOM 逐产品展开：

- 减速机轴承需求：50 × 4 × 1.01 = **202 套**
- 伺服电机轴承需求：50 × 2 × 1.01 = **101 套**
- **合计：303 套**

共用料每种产品的 qty_per 不同，汇总需求时必须先分开算，再求和。', 1, strftime('%s','now')),
  (9231, 9108, 'single', 'BOM（物料清单）在 MES 中的主要作用？', '["记录客户联系信息","展开产品由哪些物料构成及单台用量","安排设备保养","管理发货物流"]', '1', 'BOM 定义产品→物料的构成与单台用量 qty_per，是 MRP 与应发料量计算的基础。', 2, strftime('%s','now')),
  (9232, 9108, 'single', 'bom 表中的 loss_rate（损耗率）主要影响什么？', '["产品售价","应发料量（需叠加损耗）","设备运行状态","客户交期"]', '1', '应发量 = 理论用量 × (1 + loss_rate)。损耗率越高，备料越多，否则生产中容易缺料。', 3, strftime('%s','now'));

-- SQL 练习 9308（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9308, 9001, '查出各产品 BOM 构成，计算单次生产的应发量', '工厂要新上一批生产（WO-20260803-01: 80台减速机，WO-20260803-02: 40台伺服电机），仓库要提前备料。按 BOM 展开这两种产品的物料需求，计算应发量（应发量 = 单件用量 × 计划量 × (1+损耗率)，取整），列出各产品各物料的详细构成。

输出列：产品名称、物料名称、计划量、单件用量、损耗率、应发量。
排序：产品名称升序，应发量降序。', '{}', 'SELECT p.name AS product, m.name AS material,
    w.qty_plan, b.qty_per, b.loss_rate,
    CAST(ROUND(w.qty_plan * b.qty_per * (1 + b.loss_rate)) AS INTEGER) AS qty_required
  FROM (SELECT * FROM work_orders WHERE wo_no IN (''WO-20260803-01'',''WO-20260803-02'')) w
  JOIN bom b ON b.product_id = w.product_id
  JOIN products p ON p.product_id = w.product_id
  JOIN materials m ON m.material_id = b.material_id
  ORDER BY p.name, qty_required DESC;', 'a051196128f7dec259a208b606c58b592620272925a6c8c3bdcdf74a034f139a', 'products(product_id, code, name, spec, unit)
materials(material_id, code, name, unit, stock_qty)
bom(bom_id, product_id, material_id, qty_per, loss_rate)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)', 1, strftime('%s','now'));

-- 微练习 9406（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9406, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'match', '把四个产品连到它 BOM 里每台用量最大的那种物料上。注意用量要连数字一起对。', '{"left":[{"id":"P-1001","text":"减速机 P-1001"},{"id":"P-1002","text":"伺服电机 P-1002"},{"id":"P-1003","text":"PLC控制器 P-1003"},{"id":"P-1004","text":"变频器 P-1004"}],"right":[{"id":"m-bearing-4","text":"轴承 4 套/台"},{"id":"m-bearing-2","text":"轴承 2 套/台"},{"id":"m-terminal-12","text":"接线端子 12 个/台"},{"id":"m-terminal-8","text":"接线端子 8 个/台"}]}', '["P-1001=>m-bearing-4","P-1002=>m-bearing-2","P-1003=>m-terminal-12","P-1004=>m-terminal-8"]', '对，而且四个产品的「大头物料」没有一个是独占的：减速机和伺服电机都吃轴承，一台 4 套一台 2 套；PLC 和变频器都吃接线端子，一台 12 个一台 8 个。共用料的用量跟着产品走，这就是 BOM 展开必须逐产品算、不能按物料拍总量的原因。', '提示：把 bom 表按 product_id 分组，看每个产品里 qty_per 最大的那一行是什么物料、每台用几个。轴承和接线端子都出现在两个产品里，但用量不一样，别当成同一个选项。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'chapter', 9108, 'BOM 与工艺路线：把产品拆解成物料和工序', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'quiz', 9208, '计划同时投产： - 减速机（P-1001）50 台，每台需要轴承 4 套，损', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'quiz', 9231, 'BOM（物料清单）在 MES 中的主要作用？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'quiz', 9232, 'bom 表中的 loss_rate（损耗率）主要影响什么？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'sql', 9308, '查出各产品 BOM 构成，计算单次生产的应发量', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'), 'micro', 9406, '把四个产品连到它 BOM 里每台用量最大的那种物料上。注意用量要连数字一起对', 6);

PRAGMA foreign_keys = ON;