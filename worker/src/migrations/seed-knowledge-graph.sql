-- ============================================================================
-- 知识点连线图（Obsidian 式）· 概念种子 + 真实工件指认
-- ----------------------------------------------------------------------------
-- 概念连接层起头用的 15 个核心锚点。每个概念指认已在平台里真实存在的工件：
--   · node       → flow_nodes（按 node_key 子查询解析 id，零硬编码）
--   · explainer  → node_explainers（显式真实 id 9501–9524）
--   · micro      → micro_practices（显式真实 id 9407/9409/9411）
--   · sql_ex     → sql_exercises（显式真实 id 9302/9303）
--   · glossary   → dict_data（按 value 子查询解析 id）
--   · topic      → topics（显式真实 id 1/2/3/6）
--
-- 约束：仅做指认关联，不改任何现有表；不动 dataset.sql / 练习答案。
-- 子查询里凡是可能解析为空的项（glossary 词条）都 LIMIT 1 保护；若词条缺失，
-- 该行 source_ref 为 NULL 会触发 NOT NULL 约束——本文件所有被引用的词条均已在
--   schema-dict.sql / seed-glossary-mes-cn.sql（BOM / WORK ORDER / TRACEABILITY / 交期 / 齐套）
--   与 seed-glossary-mes-abbr.sql（MRP）中确认存在；glossary 子查询的 type_key 与实际表一致。
-- ============================================================================

-- 重跑安全：先清空本文件负责的连接层，再插入；不碰别的来源。
DELETE FROM knowledge_links WHERE id > 0;
DELETE FROM concepts WHERE id > 0;

INSERT INTO concepts (id, key, label, definition, topic_id, sort) VALUES
  (1,  'qty_done',         '完工数量 qty_done', '工单实际报工累加出来的完成数；入库 / 发货 / 产值都认它，不是 qty_plan。', 3, 1),
  (2,  'qty_plan',         '计划数量 qty_plan', '工单计划生产的数量，是 MRP 展开与排产的依据。', NULL, 2),
  (3,  'mrp',              '物料需求计划 MRP',  '按订单和 BOM 自动算出自制 / 外购物料的需求量与时间。', 6, 3),
  (4,  'bom',              '物料清单 BOM',      '产品所需物料及数量的层级清单，驱动 MRP 与齐套。', 2, 4),
  (5,  'mps',              '主生产计划 MPS',    '把订单转成可执行的月度 / 周生产计划，定产品级产量。', NULL, 5),
  (6,  'first_inspection', '首检 FAI',          '换型 / 换班后第一件检验，防整批报废，质量最该优先的关卡。', NULL, 6),
  (7,  'shopfloor_report', '报工',              '车间向系统汇报做了多少，写入 production_records 流水，累加出 qty_done。', 3, 7),
  (8,  'wip',              '在制品 WIP',        '已开工尚未完工的物料，排产与交期管理的重点。', NULL, 8),
  (9,  'stock_in',         '入库',              '成品完工入库，更新库存；入库数认 qty_done。', NULL, 9),
  (10, 'due_date',         '交期 due date',     '客户要求的完工交付日期，评审与准时率都看它。', NULL, 10),
  (11, 'defect',           '不合格',            '质检判定的不良记录，缺陷类型(defect_type)必须受控。', NULL, 11),
  (12, 'traceability',     '追溯',              '从不合格记录顺工单追到设备 / 操作工 / 时间段的能力。', NULL, 12),
  (13, 'kitting',          '齐套 Kitting',      '开工前物料是否全部备齐的布尔判断，一票否决。', NULL, 13),
  (14, 'work_order',       '工单 Work Order',   'ERP 计划落成车间动作的核心单据，含产品 / 数量 / 工艺 / 交期。', 1, 14),
  (15, 'sales_order',      '销售订单',          '客户要什么、多少、何时要，全流程的起点。', NULL, 15);

-- P1：四个高频概念的零基础白话兜底（打破 jargon 循环）。
-- 仅 UPDATE，不改动概念主 INSERT；重跑安全（文件头部 DELETE 已清空 concepts）。
UPDATE concepts SET zero_basis_def = '系统帮你算「要买什么、买多少、什么时候到」，免得靠人脑拍脑袋。它依据两张清单：客户要什么成品、做成品需要哪些零件。' WHERE key = 'mrp';
UPDATE concepts SET zero_basis_def = '做一件成品需要哪些零件、各要多少个的「配料表」。比如做一张桌子，BOM 写：桌面 1、桌腿 4、螺丝 16。它只讲「需要什么」，不管时间。' WHERE key = 'bom';
UPDATE concepts SET zero_basis_def = '开工前先清点：这张单子的所有零件是不是都到齐了？齐了才能开工，差一个都不行。「布尔判断」就是「齐 / 没齐」二选一。' WHERE key = 'kitting';
UPDATE concepts SET zero_basis_def = '已经真正做完、并报给系统的数量。比如工单要 100 个，工人做完 60 个并上报，qty_done 就是 60——它和「计划做 100 个」(qty_plan) 是两回事。' WHERE key = 'qty_done';

-- 指认层：concept_id 经 key 子查询解析；source_ref 按类型解析（见上说明）。
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight) VALUES

  -- 1) qty_done
  ((SELECT id FROM concepts WHERE key='qty_done'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='stock-in' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='qty_done'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 2),
  ((SELECT id FROM concepts WHERE key='qty_done'), 'explainer', 9521, 'about', 3),
  ((SELECT id FROM concepts WHERE key='qty_done'), 'explainer', 9522, 'about', 3),
  ((SELECT id FROM concepts WHERE key='qty_done'), 'explainer', 9502, 'about', 2),
  ((SELECT id FROM concepts WHERE key='qty_done'), 'topic',     3, 'about', 1),

  -- 2) qty_plan
  ((SELECT id FROM concepts WHERE key='qty_plan'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 2),
  ((SELECT id FROM concepts WHERE key='qty_plan'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 2),
  ((SELECT id FROM concepts WHERE key='qty_plan'), 'explainer', 9521, 'about', 2),
  ((SELECT id FROM concepts WHERE key='qty_plan'), 'explainer', 9502, 'about', 2),

  -- 3) mrp
  ((SELECT id FROM concepts WHERE key='mrp'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='mrp' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='mrp'), 'explainer', 9507, 'about', 3),
  ((SELECT id FROM concepts WHERE key='mrp'), 'explainer', 9508, 'about', 3),
  ((SELECT id FROM concepts WHERE key='mrp'), 'glossary', (SELECT id FROM dict_data WHERE type_key='mes_abbr' AND value='MRP' LIMIT 1), 'about', 2),
  ((SELECT id FROM concepts WHERE key='mrp'), 'topic',     6, 'about', 1),

  -- 4) bom
  ((SELECT id FROM concepts WHERE key='bom'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='bom-route' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='bom'), 'explainer', 9511, 'about', 3),
  ((SELECT id FROM concepts WHERE key='bom'), 'explainer', 9512, 'about', 3),
  ((SELECT id FROM concepts WHERE key='bom'), 'glossary', (SELECT id FROM dict_data WHERE type_key='mes' AND value='BOM' LIMIT 1), 'about', 2),
  ((SELECT id FROM concepts WHERE key='bom'), 'topic',     2, 'about', 1),

  -- 5) mps
  ((SELECT id FROM concepts WHERE key='mps'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='mps'), 'explainer', 9505, 'about', 3),
  ((SELECT id FROM concepts WHERE key='mps'), 'explainer', 9506, 'about', 3),

  -- 6) first_inspection
  ((SELECT id FROM concepts WHERE key='first_inspection'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='first_inspection'), 'explainer', 9520, 'about', 3),

  -- 7) shopfloor_report
  ((SELECT id FROM concepts WHERE key='shopfloor_report'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='shopfloor_report'), 'explainer', 9517, 'about', 3),
  ((SELECT id FROM concepts WHERE key='shopfloor_report'), 'explainer', 9518, 'about', 3),
  ((SELECT id FROM concepts WHERE key='shopfloor_report'), 'topic',     3, 'about', 1),

  -- 8) wip
  ((SELECT id FROM concepts WHERE key='wip'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 2),
  ((SELECT id FROM concepts WHERE key='wip'), 'explainer', 9516, 'about', 3),

  -- 9) stock_in
  ((SELECT id FROM concepts WHERE key='stock_in'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='stock-in' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='stock_in'), 'explainer', 9521, 'about', 3),
  ((SELECT id FROM concepts WHERE key='stock_in'), 'explainer', 9522, 'about', 3),

  -- 10) due_date
  ((SELECT id FROM concepts WHERE key='due_date'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='shipping' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='due_date'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='cust-order' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 1),
  ((SELECT id FROM concepts WHERE key='due_date'), 'explainer', 9523, 'about', 3),
  ((SELECT id FROM concepts WHERE key='due_date'), 'explainer', 9524, 'about', 3),
  ((SELECT id FROM concepts WHERE key='due_date'), 'glossary', (SELECT id FROM dict_data WHERE type_key='mes' AND value='交期' LIMIT 1), 'about', 2),

  -- 11) defect
  ((SELECT id FROM concepts WHERE key='defect'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='defect'), 'explainer', 9519, 'about', 3),
  ((SELECT id FROM concepts WHERE key='defect'), 'sql_ex',   9303, 'about', 2),

  -- 12) traceability
  ((SELECT id FROM concepts WHERE key='traceability'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='traceability'), 'explainer', 9519, 'about', 3),
  ((SELECT id FROM concepts WHERE key='traceability'), 'glossary', (SELECT id FROM dict_data WHERE type_key='mes' AND value='TRACEABILITY' LIMIT 1), 'about', 2),
  ((SELECT id FROM concepts WHERE key='traceability'), 'sql_ex',   9303, 'about', 2),

  -- 13) kitting
  ((SELECT id FROM concepts WHERE key='kitting'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='picking' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='kitting'), 'explainer', 9513, 'about', 3),
  ((SELECT id FROM concepts WHERE key='kitting'), 'explainer', 9514, 'about', 3),
  ((SELECT id FROM concepts WHERE key='kitting'), 'glossary', (SELECT id FROM dict_data WHERE type_key='mes' AND value='齐套' LIMIT 1), 'about', 2),
  ((SELECT id FROM concepts WHERE key='kitting'), 'sql_ex',   9302, 'about', 2),

  -- 14) work_order
  ((SELECT id FROM concepts WHERE key='work_order'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='cust-order' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 2),
  ((SELECT id FROM concepts WHERE key='work_order'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='work_order'), 'explainer', 9501, 'about', 3),
  ((SELECT id FROM concepts WHERE key='work_order'), 'explainer', 9502, 'about', 3),
  ((SELECT id FROM concepts WHERE key='work_order'), 'glossary', (SELECT id FROM dict_data WHERE type_key='mes' AND value='WORK ORDER' LIMIT 1), 'about', 2),
  ((SELECT id FROM concepts WHERE key='work_order'), 'topic',     1, 'about', 1),

  -- 15) sales_order
  ((SELECT id FROM concepts WHERE key='sales_order'), 'node',     (SELECT id FROM flow_nodes WHERE node_key='cust-order' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3),
  ((SELECT id FROM concepts WHERE key='sales_order'), 'explainer', 9501, 'about', 3),
  ((SELECT id FROM concepts WHERE key='sales_order'), 'explainer', 9503, 'about', 2),

  -- 微练习（显式真实 id；micro_practices 表带 node_id，后端据此映射 nodeKey）
  ((SELECT id FROM concepts WHERE key='kitting'),          'micro', 9407, 'about', 2),
  ((SELECT id FROM concepts WHERE key='shopfloor_report'), 'micro', 9409, 'about', 2),
  ((SELECT id FROM concepts WHERE key='qty_done'),         'micro', 9411, 'about', 2),
  ((SELECT id FROM concepts WHERE key='stock_in'),         'micro', 9411, 'about', 2);
