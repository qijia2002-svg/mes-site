-- ============================================================
-- 节点种子：purchase（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9101 | 测验 9201,9229,9230 | SQL 9301 | 微练习 9405
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9101;
DELETE FROM questions WHERE id IN (9201, 9229, 9230);
DELETE FROM sql_exercises WHERE id = 9301;
DELETE FROM micro_practices WHERE id = 9405;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase') AND ref_id IN (9101, 9201, 9229, 9230, 9301, 9405) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9101
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9101, 9001, '采购跟催：料为什么还没到', 1, 'published', '# 采购跟催：料为什么还没到

在工厂全景图上，采购处在「计划」和「生产」中间。MRP 算出来要买什么、买多少、什么时候要，采购把它变成一张张采购单发给供应商。这个环节一旦掉链子，后面领料、上线、交付会一路塌方 —— 而且现场往往到领料那一刻才发现。

## 这个环节在系统里对应什么

| 动作 | 主责系统 | 落到哪张表 |
|---|---|---|
| 算出需求量与需求日期 | ERP（MRP 运算） | 计划需求 |
| 下采购单、跟交期 | ERP 采购模块 / SRM | `purchase_orders` |
| 供应商档案与交期承诺 | ERP / SRM | `suppliers` |
| 到货点收、进料检验 IQC | WMS + QMS | 收货单、检验单 |

要注意：**采购单的「承诺到货日」不等于「需求日」**。承诺日是供应商答应的，需求日是生产要的。两者之间那点缓冲，就是采购员的全部安全感。

## 三个字段决定一切

一张采购单能不能安心，看三个字段就够：

- `promise_date` —— 供应商承诺的到货日
- `arrive_date` —— 实际到货日，**为空就是还没到**
- `qty_received` vs `qty_order` —— 到了，但到齐了吗

组合出来是四种状态，现场叫法不一样但语义固定：

| promise_date | arrive_date | 数量 | 现场叫法 |
|---|---|---|---|
| 未过期 | 空 | — | 在途，正常 |
| **已过期** | **空** | — | **逾期未到 —— 要跟催** |
| 任意 | 有 | 已收 < 订购 | **短交 —— 缺口要补单** |
| 任意 | 有 | 已收 = 订购 | 正常关单 |

真正会咬人的是中间两行。逾期未到通常有人盯，短交最容易漏 —— 单据状态是 `received`，看起来清清爽爽，数量却差了一截，直到领料时才炸。

## 为什么必须自己会查

采购系统都有跟催报表，但报表的口径是别人定的。你会遇到这种情况：报表显示「按期到货率 96%」，车间却天天喊缺料。原因往往是报表把短交算成了到货。

自己写一句 SQL，口径自己定，这是实施工程师和只会看报表的人之间的分水岭。

## 动手之前

样例库里有 10 张采购单，其中有几张已经过了承诺日、`arrive_date` 还是空的。它们卡住的物料，正好是下一个节点「领料发料」里缺得最狠的那两种。

先把它们揪出来。', 1, strftime('%s','now'));

-- 测验 9201,9229,9230（9201=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9201, 9101, 'single', '采购报表显示按期到货率 96%，车间却天天喊缺料。最可能的原因是什么？', '["车间领料单填错了物料编码","报表把短交的采购单算成了按期到货","供应商承诺日期录入时晚填了几天","MRP 运算周期太长导致需求滞后"]', '1', '短交是最隐蔽的缺料源头：单据状态已经是 received，按期到货率的统计口径通常只看 arrive_date 有没有值，不比对 qty_received 与 qty_order，于是差的那一截数量在报表上完全隐形，一直拖到领料才暴露。判断到货是否真的完成，必须同时看日期和数量两个维度。', 1, strftime('%s','now')),
  (9229, 9101, 'single', 'purchase_orders 里如何判断一张采购单逾期？', '["看 po_no 编号大小","实际到货 arrive_date 晚于期望 expect_date，或应到未到","看 supplier_id","看采购数量 qty"]', '1', '逾期=实际到货日晚于期望日，或期望日已过仍无到货(arrive_date 为空)。这是跟催的依据。', 2, strftime('%s','now')),
  (9230, 9101, 'single', '采购单逾期，最直接影响的下游环节是？', '["订单评审","领料（picking）缺料","质量检验","发货出库"]', '1', '料不到 → 仓库补不上 → 领料环节缺料 → 工单开不了工。这是采购→领料→派工→车间 的传导链起点。', 3, strftime('%s','now'));

-- SQL 练习 9301（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9301, 9001, '查出哪些采购单已经逾期还没到货', '今天是 2026-08-08。采购经理要一份跟催清单：把承诺到货日已经过了、但实际还没到货的采购单全部列出来，并且要看到是哪家供应商、卡的是什么物料、订了多少。

要求输出这几列，顺序照写：采购单号、供应商名称、物料名称、订购数量、承诺到货日。
按承诺到货日从早到晚排 —— 拖最久的排最前面，先催它。

提示：还没到货的判断依据是 arrive_date 为空，注意 SQL 里判空不能用等号。', '{}', 'SELECT p.po_no, s.name AS supplier, m.name AS material, p.qty_order, p.promise_date FROM purchase_orders p JOIN suppliers s ON s.supplier_id = p.supplier_id JOIN materials m ON m.material_id = p.material_id WHERE p.arrive_date IS NULL AND p.promise_date < ''2026-08-08'' ORDER BY p.promise_date;', '28fb4ec64cef6ed854ad45ef79f45d73357f793bf128166d7496c5a13c773ca8', 'purchase_orders(po_id, po_no, supplier_id, material_id, qty_order, qty_received, order_date, promise_date, arrive_date, state)
suppliers(supplier_id, code, name, contact, lead_time_days)
materials(material_id, code, name, unit, stock_qty)', 1, strftime('%s','now'));

-- 微练习 9405（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9405, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'pick', '今天是 2026-08-08。下面五张采购单，哪几张是「逾期未到、要马上跟催」的？', '{"multi":true,"options":[{"key":"PO-20260715-01","label":"PO-20260715-01 · 承诺 2026-08-04 · 未到货"},{"key":"PO-20260725-01","label":"PO-20260725-01 · 承诺 2026-08-06 · 未到货"},{"key":"PO-20260802-01","label":"PO-20260802-01 · 承诺 2026-08-07 · 未到货"},{"key":"PO-20260722-01","label":"PO-20260722-01 · 承诺 2026-08-11 · 未到货"},{"key":"PO-20260718-01","label":"PO-20260718-01 · 已到货 · 订 200 收 120"}]}', '["PO-20260715-01","PO-20260725-01","PO-20260802-01"]', '对。逾期未到 = 承诺日已经过了 且 arrive_date 还是空。承诺 08-11 那张还在途，不算逾期；订 200 收 120 那张是短交，是另一种病，要单独盯。', '两个条件缺一不可：承诺日期过了没？货到了没？还没到承诺日的、已经到货的，都不在这份跟催清单里。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'chapter', 9101, '采购跟催：料为什么还没到', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'quiz', 9201, '采购报表显示按期到货率 96%，车间却天天喊缺料。最可能的原因是什么？', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'quiz', 9229, 'purchase_orders 里如何判断一张采购单逾期？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'quiz', 9230, '采购单逾期，最直接影响的下游环节是？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'sql', 9301, '查出哪些采购单已经逾期还没到货', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'), 'micro', 9405, '今天是 2026-08-08。下面五张采购单，哪几张是「逾期未到、要马上跟催', 6);

PRAGMA foreign_keys = ON;