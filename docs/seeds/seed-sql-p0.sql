-- ============================================================
-- MES 实训平台 SQL 实训题 Seed SQL
-- Cloudflare D1 (SQLite) / sql.js WASM 浏览器端判题
-- 共 18 题：topic_id=1 工单(补3题)、topic_id=2 BOM(补3题)、
--           topic_id=3 报工(补3题)、topic_id=8 SQL面试实战(新增9题)
--
-- answer_hash 说明：
--   PLACEHOLDER_xx_yy 格式为占位符，实际值需人工执行 sql.js 后填入。
--   规范化规则：去所有空白、转小写、按首列排序，再 SHA-256 小写 hex。
-- ============================================================


-- ----------------------------------------------------------
-- topic_id=8 先插入（被 sql_exercises 引用）
-- ----------------------------------------------------------
INSERT INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at)
VALUES (8, 'sql-interview', 'SQL 面试实战', 'JOIN/子查询/窗口函数/日期处理，面试高频真题', '["theory","sql"]', 8, 'published', strftime('%s','now'), strftime('%s','now'));


-- ============================================================
-- topic_id=1 工单（追加 3 题，补到 5 题）
-- 已有 2 题，本次追加 3 题：sort=3~5
-- ============================================================

-- ----------------------------------------------------------
-- [1-3] 工单完工率排名
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  1,
  '工单完工率排名',
  '在 MES 系统中，产品经理需要评估各产品线的交付能力。请统计各产品线的工单完工率（done_qty / plan_qty），并按完工率降序排列，保留两位小数。完工率低于 60% 的产品线请在结果中标记为"预警"。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","due_date TEXT","state TEXT"],"rows":[["WO-001","P001",100,80,"2026-08-01","running"],["WO-002","P001",100,55,"2026-08-02","running"],["WO-003","P002",200,200,"2026-08-03","completed"],["WO-004","P002",150,90,"2026-08-05","running"],["WO-005","P003",80,80,"2026-08-01","completed"],["WO-006","P003",120,72,"2026-08-07","running"],["WO-007","P004",50,20,"2026-08-03","running"],["WO-008","P004",100,95,"2026-08-04","completed"],["WO-009","P001",200,180,"2026-08-08","running"],["WO-010","P002",300,120,"2026-08-09","running"],["WO-011","P003",60,54,"2026-08-06","running"],["WO-012","P005",500,200,"2026-08-10","running"]]},{"name":"产品","columns":["product_id TEXT","product_name TEXT","product_line TEXT"],"rows":[["P001","精密轴承A","产线一"],["P002","精密轴承B","产线一"],["P003","传动齿轮","产线二"],["P004","液压阀体","产线二"],["P005","伺服电机","产线三"]]}',
  'SELECT
    p.product_id,
    p.product_name,
    p.product_line,
    ROUND(CAST(SUM(d.done_qty) AS REAL) / SUM(d.plan_qty) * 100, 2) AS completion_rate
  FROM (SELECT product_id, SUM(plan_qty) AS plan_qty, SUM(done_qty) AS done_qty FROM 工单 GROUP BY product_id) d
  JOIN 产品 p ON p.product_id = d.product_id
  GROUP BY p.product_id
  ORDER BY completion_rate DESC',
  'PLACEHOLDER_1_3',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, due_date, state);\nCREATE TABLE 产品 (product_id, product_name, product_line);',
  3,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [1-4] 工单状态分布统计
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  1,
  '工单状态分布统计',
  '生产调度员需要了解当前各状态工单的整体情况。请统计各状态(state)的工单数量，并在结果中计算每个状态工单的平均计划数量、平均完成数量以及平均延期天数（以2026-08-15为基准计算）。延期天数 = 基准日期 - due_date，仅针对 overdue 工单计算平均值。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","due_date TEXT","state TEXT"],"rows":[["WO-101","P001",100,80,"2026-07-20","completed"],["WO-102","P001",100,100,"2026-07-25","completed"],["WO-103","P002",200,200,"2026-07-28","completed"],["WO-104","P002",150,90,"2026-08-01","running"],["WO-105","P003",80,80,"2026-08-02","completed"],["WO-106","P003",120,72,"2026-08-03","running"],["WO-107","P004",50,20,"2026-08-05","running"],["WO-108","P004",100,95,"2026-08-06","running"],["WO-109","P001",200,180,"2026-08-08","running"],["WO-110","P002",300,120,"2026-08-09","running"],["WO-111","P003",60,54,"2026-08-10","running"],["WO-112","P005",500,200,"2026-08-12","running"]]}',
  'SELECT
    state,
    COUNT(*) AS order_count,
    ROUND(AVG(plan_qty), 2) AS avg_plan_qty,
    ROUND(AVG(done_qty), 2) AS avg_done_qty,
    CASE
      WHEN state = ''running'' THEN
        ROUND(AVG(julianday(''2026-08-15'') - julianday(due_date)), 2)
      ELSE NULL
    END AS avg_delay_days
  FROM 工单
  GROUP BY state
  ORDER BY
    CASE state WHEN ''running'' THEN 0 WHEN ''completed'' THEN 1 ELSE 2 END',
  'PLACEHOLDER_1_4',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, due_date, state); -- state: running/completed/pending',
  4,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [1-5] 工单齐套分析
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  1,
  '工单齐套分析',
  '采购与计划人员需要及时发现缺料风险。请关联工单明细和库存表，计算每个工单的齐套率（实际领料 / 需求数量），筛出齐套率低于 80% 且状态为 running 的工单，按齐套率升序输出工单号、产品ID、需求数量、实际领料和齐套率。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","due_date TEXT","state TEXT"],"rows":[["WO-201","P001",100,80,"2026-08-01","running"],["WO-202","P002",200,180,"2026-08-03","running"],["WO-203","P003",150,150,"2026-08-02","completed"],["WO-204","P001",80,40,"2026-08-05","running"],["WO-205","P002",120,96,"2026-08-06","running"],["WO-206","P004",60,60,"2026-08-01","completed"],["WO-207","P003",200,80,"2026-08-08","running"],["WO-208","P005",300,250,"2026-08-09","running"]]},{"name":"工单物料需求","columns":["wo_id TEXT","material_id TEXT","required_qty INTEGER"],"rows":[["WO-201","M001",50],["WO-201","M002",50],["WO-202","M001",100],["WO-202","M002",80],["WO-203","M001",75],["WO-203","M002",75],["WO-204","M001",40],["WO-204","M002",40],["WO-205","M001",60],["WO-205","M002",60],["WO-206","M001",30],["WO-206","M002",30],["WO-207","M001",100],["WO-207","M002",100],["WO-208","M001",150],["WO-208","M002",150]]},{"name":"物料库存","columns":["material_id TEXT","warehouse_id TEXT","stock_qty INTEGER"],"rows":[["M001","WH-A",30],["M002","WH-A",50],["M001","WH-B",20],["M002","WH-B",20],["M001","WH-C",10],["M002","WH-C",5]]}',
  'WITH req AS (
    SELECT wo_id, SUM(required_qty) AS total_required
    FROM 工单物料需求
    GROUP BY wo_id
  ),
  stock AS (
    SELECT material_id, SUM(stock_qty) AS total_stock
    FROM 物料库存
    GROUP BY material_id
  ),
  avail AS (
    SELECT r.wo_id,
      COALESCE(SUM(s.total_stock), 0) AS total_available
    FROM req r
    LEFT JOIN 工单物料需求 rm ON rm.wo_id = r.wo_id
    LEFT JOIN stock s ON s.material_id = rm.material_id
    GROUP BY r.wo_id
  )
  SELECT
    w.wo_id,
    w.product_id,
    r.total_required AS required_qty,
    a.total_available AS actual_qty,
    ROUND(CAST(a.total_available AS REAL) / r.total_required * 100, 2) AS kit_rate
  FROM 工单 w
  JOIN req r ON r.wo_id = w.wo_id
  JOIN avail a ON a.wo_id = w.wo_id
  WHERE w.state = ''running''
    AND CAST(a.total_available AS REAL) / r.total_required < 0.80
  ORDER BY kit_rate ASC',
  'PLACEHOLDER_1_5',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, due_date, state);\nCREATE TABLE 工单物料需求 (wo_id, material_id, required_qty);\nCREATE TABLE 物料库存 (material_id, warehouse_id, stock_qty);',
  5,
  strftime('%s','now')
);


-- ============================================================
-- topic_id=2 BOM（追加 3 题，补到 5 题）
-- 已有 2 题，本次追加 3 题：sort=3~5
-- ============================================================

-- ----------------------------------------------------------
-- [2-3] 多层 BOM 展开
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  2,
  '多层BOM展开',
  '生产准备工程师需要了解产品 P002 的完整物料构成（所有层级）。BOM 表中 parent_id 表示父项、child_id 表示子项、qty 表示用量。请查出 P002 的所有子级物料及其用量（不限层级深度），并展示层级深度。',
  '{"tables":[{"name":"BOM","columns":["parent_id TEXT","child_id TEXT","qty INTEGER","unit TEXT"],"rows":[["P002","M101",2,"件"],["P002","M102",1,"件"],["M101","M201",3,"个"],["M101","M202",1,"个"],["M102","M203",2,"个"],["M201","M301",1,"克"],["P001","M101",1,"件"],["P001","M103",4,"个"],["P003","M102",2,"件"],["P003","M201",1,"个"]]}',
  'WITH RECURSIVE bom_expand(parent, child, qty, unit, depth) AS (
    SELECT parent_id, child_id, qty, unit, 1
    FROM BOM
    WHERE parent_id = ''P002''
    UNION ALL
    SELECT b.parent_id, b.child_id, b.qty * be.qty, b.unit, be.depth + 1
    FROM BOM b
    JOIN bom_expand be ON be.child = b.parent_id
    WHERE be.depth < 10
  )
  SELECT parent, child, qty, unit, depth
  FROM bom_expand
  ORDER BY depth, parent',
  'PLACEHOLDER_2_3',
  'CREATE TABLE BOM (parent_id, child_id, qty, unit); -- 自连接可展开多层子物料',
  3,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [2-4] 物料短缺预警
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  2,
  '物料短缺预警',
  '采购员需要识别即将缺料的物料。请根据工单物料需求表和当前库存表，计算每种物料的"需求-库存"缺口，并按缺口数量降序排列，筛出缺口 > 0 的物料，标注紧急度：缺口>=50 为"紧急"，>=20 为"预警"，否则"正常"。',
  '{"tables":[{"name":"工单物料需求","columns":["wo_id TEXT","material_id TEXT","required_qty INTEGER","urgency TEXT"],"rows":[["WO-001","M001",100,"high"],["WO-001","M002",80,"high"],["WO-002","M001",60,"medium"],["WO-002","M003",40,"low"],["WO-003","M002",120,"high"],["WO-003","M004",30,"medium"],["WO-004","M001",50,"medium"],["WO-004","M002",60,"medium"],["WO-005","M003",80,"high"],["WO-005","M005",100,"low"]]},{"name":"物料库存","columns":["material_id TEXT","warehouse_id TEXT","stock_qty INTEGER"],"rows":[["M001","WH-A",80],["M002","WH-A",100],["M003","WH-A",30],["M004","WH-A",25],["M005","WH-A",60],["M001","WH-B",20],["M002","WH-B",10],["M003","WH-B",10]]}',
  'WITH total_req AS (
    SELECT material_id, SUM(required_qty) AS total_required
    FROM 工单物料需求
    GROUP BY material_id
  ),
  total_stock AS (
    SELECT material_id, SUM(stock_qty) AS total_stock
    FROM 物料库存
    GROUP BY material_id
  )
  SELECT
    r.material_id,
    r.total_required,
    COALESCE(s.total_stock, 0) AS total_stock,
    (r.total_required - COALESCE(s.total_stock, 0)) AS shortage,
    CASE
      WHEN (r.total_required - COALESCE(s.total_stock, 0)) >= 50 THEN ''紧急''
      WHEN (r.total_required - COALESCE(s.total_stock, 0)) >= 20 THEN ''预警''
      ELSE ''正常''
    END AS urgency_level
  FROM total_req r
  LEFT JOIN total_stock s ON s.material_id = r.material_id
  WHERE (r.total_required - COALESCE(s.total_stock, 0)) > 0
  ORDER BY shortage DESC',
  'PLACEHOLDER_2_4',
  'CREATE TABLE 工单物料需求 (wo_id, material_id, required_qty, urgency);\nCREATE TABLE 物料库存 (material_id, warehouse_id, stock_qty);',
  4,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [2-5] 替代物料查询
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  2,
  '替代物料查询',
  '当主物料 M001 库存不足时，生产调度员需要快速找到可用替代物料。请查询物料 M001 的所有替代物料及其当前库存，并按库存降序排列。若某替代物料库存也不足，则标记为"库存不足"。',
  '{"tables":[{"name":"替代物料关系","columns":["primary_material TEXT","alt_material TEXT","priority INTEGER","conversion_ratio REAL"],"rows":[["M001","M101",1,1.0],["M001","M102",2,1.0],["M002","M201",1,2.0],["M002","M202",2,1.5],["M003","M301",1,1.0],["M101","M001",1,1.0],["M102","M001",1,1.0]]},{"name":"物料库存","columns":["material_id TEXT","warehouse_id TEXT","stock_qty INTEGER"],"rows":[["M001","WH-A",50],["M101","WH-A",80],["M102","WH-A",0],["M201","WH-B",30],["M202","WH-B",20],["M301","WH-A",100],["M301","WH-B",50]]},{"name":"物料信息","columns":["material_id TEXT","material_name TEXT","spec TEXT"],"rows":[["M001","标准螺栓M8","GB/T5783"],["M101","不锈钢螺栓M8","GB/T5783-SS"],["M102","镀锌螺栓M8","GB/T5783-ZN"],["M201","O型圈8mm","GB/T3452.1"],["M202","O型圈10mm","GB/T3452.1"],["M301","润滑脂","ISO VG68"]]}',
  'SELECT
    a.alt_material,
    m.material_name,
    m.spec,
    a.priority,
    a.conversion_ratio,
    COALESCE(s.total_stock, 0) AS stock_qty,
    CASE
      WHEN COALESCE(s.total_stock, 0) <= 0 THEN ''库存不足''
      ELSE ''可用''
    END AS stock_status
  FROM 替代物料关系 a
  JOIN 物料信息 m ON m.material_id = a.alt_material
  LEFT JOIN (
    SELECT material_id, SUM(stock_qty) AS total_stock
    FROM 物料库存
    GROUP BY material_id
  ) s ON s.material_id = a.alt_material
  WHERE a.primary_material = ''M001''
  ORDER BY a.priority ASC, stock_qty DESC',
  'PLACEHOLDER_2_5',
  'CREATE TABLE 替代物料关系 (primary_material, alt_material, priority, conversion_ratio);\nCREATE TABLE 物料库存 (material_id, warehouse_id, stock_qty);\nCREATE TABLE 物料信息 (material_id, material_name, spec);',
  5,
  strftime('%s','now')
);


-- ============================================================
-- topic_id=3 报工（追加 3 题，补到 5 题）
-- 已有 2 题，本次追加 3 题：sort=3~5
-- ============================================================

-- ----------------------------------------------------------
-- [3-3] 日产能统计
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  3,
  '日产能统计',
  '车间主任每日需要查看各班组的产量和质量问题。请按报工日期（report_date）统计每个班组的日产量、不良数量，并计算当日不良率（不良数/总产量，保留2位小数）。结果按日期升序、班组升序排列。',
  '{"tables":[{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","workstation_id TEXT","report_date TEXT","shift TEXT","output_qty INTEGER","defect_qty INTEGER","reporter TEXT"],"rows":[["R001","WO-001","WS-01","2026-08-01","A",50,2,"张三"],["R002","WO-001","WS-02","2026-08-01","A",48,1,"李四"],["R003","WO-002","WS-01","2026-08-01","B",45,0,"王五"],["R004","WO-002","WS-02","2026-08-01","B",40,3,"赵六"],["R005","WO-003","WS-03","2026-08-02","A",55,1,"张三"],["R006","WO-003","WS-01","2026-08-02","A",52,2,"李四"],["R007","WO-004","WS-02","2026-08-02","B",38,4,"王五"],["R008","WO-004","WS-03","2026-08-02","B",42,1,"赵六"],["R009","WO-005","WS-01","2026-08-03","A",60,0,"张三"],["R010","WO-005","WS-02","2026-08-03","A",58,1,"李四"],["R011","WO-006","WS-03","2026-08-03","B",35,5,"王五"],["R012","WO-006","WS-01","2026-08-03","B",40,2,"赵六"]]}',
  'SELECT
    report_date,
    shift,
    SUM(output_qty) AS total_output,
    SUM(defect_qty) AS total_defect,
    ROUND(CAST(SUM(defect_qty) AS REAL) / SUM(output_qty) * 100, 2) AS defect_rate
  FROM 报工记录
  GROUP BY report_date, shift
  ORDER BY report_date ASC, shift ASC',
  'PLACEHOLDER_3_3',
  'CREATE TABLE 报工记录 (report_id, wo_id, workstation_id, report_date, shift, output_qty, defect_qty, reporter); -- shift: A/B/C',
  3,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [3-4] 质量趋势分析
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  3,
  '质量趋势分析',
  '质量工程师关注连续不良率上升的工单，以便及时介入。请查出在同一工单上，连续3天不良率逐日上升的报工记录组合（按工单、第一天、第二天、第三天的顺序输出），不良率=defect_qty/output_qty。',
  '{"tables":[{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","workstation_id TEXT","report_date TEXT","shift TEXT","output_qty INTEGER","defect_qty INTEGER","reporter TEXT"],"rows":[["R101","WO-001","WS-01","2026-08-01","A",100,5,"张三"],["R102","WO-001","WS-01","2026-08-02","A",100,8,"李四"],["R103","WO-001","WS-01","2026-08-03","A",100,12,"王五"],["R104","WO-002","WS-02","2026-08-01","B",80,4,"赵六"],["R105","WO-002","WS-02","2026-08-02","B",80,5,"张三"],["R106","WO-002","WS-02","2026-08-03","B",80,6,"李四"],["R107","WO-003","WS-03","2026-08-01","A",60,2,"王五"],["R108","WO-003","WS-03","2026-08-02","A",60,1,"赵六"],["R109","WO-003","WS-03","2026-08-03","A",60,0,"张三"],["R110","WO-004","WS-01","2026-08-01","A",90,3,"李四"],["R111","WO-004","WS-01","2026-08-02","A",90,6,"王五"],["R112","WO-004","WS-01","2026-08-03","A",90,9,"赵六"]]}',
  'WITH daily_defect AS (
    SELECT
      wo_id,
      report_date,
      CAST(defect_qty AS REAL) / output_qty AS daily_defect_rate
    FROM 报工记录
  ),
  with_prev AS (
    SELECT
      d1.wo_id,
      d1.report_date AS d1_date, d1.daily_defect_rate AS d1_rate,
      d2.report_date AS d2_date, d2.daily_defect_rate AS d2_rate,
      d3.report_date AS d3_date, d3.daily_defect_rate AS d3_rate
    FROM daily_defect d1
    JOIN daily_defect d2 ON d2.wo_id = d1.wo_id
      AND d2.report_date = date(d1.report_date, ''+1 day'')
    JOIN daily_defect d3 ON d3.wo_id = d1.wo_id
      AND d3.report_date = date(d1.report_date, ''+2 day'')
    WHERE d2.daily_defect_rate > d1.daily_defect_rate
      AND d3.daily_defect_rate > d2.daily_defect_rate
  )
  SELECT wo_id, d1_date, d2_date, d3_date,
    ROUND(d1_rate,4) AS rate_day1, ROUND(d2_rate,4) AS rate_day2, ROUND(d3_rate,4) AS rate_day3
  FROM with_prev
  ORDER BY wo_id',
  'PLACEHOLDER_3_4',
  'CREATE TABLE 报工记录 (report_id, wo_id, workstation_id, report_date, shift, output_qty, defect_qty, reporter);',
  4,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [3-5] 工时效率分析
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  3,
  '工时效率分析',
  'IE工程师需要评估各工位的实际工时效率。请关联报工表和工单表，计算每个工位的：计划工时（工单plan_qty*标准工时）、实际工时（报工actual_hours）、效率比（实际/计划）。筛出效率比>1.2（效率过高）或<0.6（效率过低）的工位，按效率比排序输出。',
  '{"tables":[{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","workstation_id TEXT","report_date TEXT","shift TEXT","output_qty INTEGER","defect_qty INTEGER","actual_hours REAL"],"rows":[["RP01","WO-001","WS-01","2026-08-01","A",50,2,4.0],["RP02","WO-001","WS-02","2026-08-01","A",48,1,3.5],["RP03","WO-002","WS-01","2026-08-01","B",45,0,5.0],["RP04","WO-002","WS-02","2026-08-01","B",40,3,2.8],["RP05","WO-003","WS-03","2026-08-02","A",55,1,3.2],["RP06","WO-003","WS-01","2026-08-02","A",52,2,4.8],["RP07","WO-004","WS-02","2026-08-02","B",38,4,2.0],["RP08","WO-004","WS-03","2026-08-02","B",42,1,6.5]]},{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","due_date TEXT","state TEXT"],"rows":[["WO-001","P001",100,80,"2026-08-01","running"],["WO-002","P001",100,55,"2026-08-02","running"],["WO-003","P002",200,200,"2026-08-03","completed"],["WO-004","P002",150,90,"2026-08-05","running"]]},{"name":"工位标准工时","columns":["workstation_id TEXT","product_id TEXT","std_hours_per_unit REAL"],"rows":[["WS-01","P001",0.08],["WS-02","P001",0.07],["WS-03","P002",0.05],["WS-01","P002",0.06],["WS-02","P002",0.05],["WS-03","P001",0.09]]}',
  'WITH planned AS (
    SELECT
      r.report_id,
      r.workstation_id,
      r.wo_id,
      r.actual_hours,
      r.output_qty,
      s.std_hours_per_unit,
      CAST(r.output_qty AS REAL) * s.std_hours_per_unit AS plan_hours
    FROM 报工记录 r
    JOIN 工位标准工时 s ON s.workstation_id = r.workstation_id
    JOIN 工单 w ON w.wo_id = r.wo_id AND s.product_id = w.product_id
  )
  SELECT
    workstation_id,
    report_id,
    wo_id,
    ROUND(plan_hours, 2) AS plan_hours,
    actual_hours,
    ROUND(actual_hours / plan_hours, 2) AS efficiency_ratio,
    CASE
      WHEN actual_hours / plan_hours > 1.2 THEN ''效率过高''
      WHEN actual_hours / plan_hours < 0.6 THEN ''效率过低''
      ELSE ''正常''
    END AS efficiency_flag
  FROM planned
  WHERE actual_hours / plan_hours > 1.2 OR actual_hours / plan_hours < 0.6
  ORDER BY efficiency_ratio ASC',
  'PLACEHOLDER_3_5',
  'CREATE TABLE 报工记录 (report_id, wo_id, workstation_id, report_date, shift, output_qty, defect_qty, actual_hours);\nCREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, due_date, state);\nCREATE TABLE 工位标准工时 (workstation_id, product_id, std_hours_per_unit);',
  5,
  strftime('%s','now')
);


-- ============================================================
-- topic_id=8 SQL 面试实战（新增 9 题，sort=1~9）
-- ============================================================

-- ----------------------------------------------------------
-- [8-1] 子查询：不良率最高的3个工单
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '不良率Top3工单',
  '某工厂质量部门需要重点关注不良率最高的工单。请写出 SQL：从报工记录表中，计算每个工单的总产量和总不良数，计算不良率（不良数/总产量），返回不良率最高的前3个工单，按不良率降序排列。',
  '{"tables":[{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","workstation_id TEXT","report_date TEXT","output_qty INTEGER","defect_qty INTEGER"],"rows":[["R01","WO-101","WS-A","2026-08-01",100,5],["R02","WO-101","WS-B","2026-08-02",100,8],["R03","WO-102","WS-A","2026-08-01",80,2],["R04","WO-102","WS-B","2026-08-02",80,3],["R05","WO-103","WS-C","2026-08-01",60,12],["R06","WO-103","WS-C","2026-08-02",60,10],["R07","WO-104","WS-A","2026-08-01",90,1],["R08","WO-104","WS-B","2026-08-02",90,2],["R09","WO-105","WS-C","2026-08-01",70,7],["R10","WO-105","WS-D","2026-08-02",70,9]]}',
  'SELECT
    wo_id,
    SUM(output_qty) AS total_output,
    SUM(defect_qty) AS total_defect,
    ROUND(CAST(SUM(defect_qty) AS REAL) / SUM(output_qty), 4) AS defect_rate
  FROM 报工记录
  GROUP BY wo_id
  ORDER BY defect_rate DESC
  LIMIT 3',
  'PLACEHOLDER_8_1',
  'CREATE TABLE 报工记录 (report_id, wo_id, workstation_id, report_date, output_qty, defect_qty);',
  1,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-2] 窗口函数：累计产量与计划达成率
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '累计产量达成率',
  '项目经理每天需要跟踪累计产量达成情况。请利用窗口函数，按日期升序计算每个日期的当日产量、累计产量，以及累计产量占目标产量（1000件）的达成率（保留2位小数）。',
  '{"tables":[{"name":"日产量","columns":["prod_date TEXT","daily_output INTEGER","shift TEXT"],"rows":[["2026-08-01","120","A"],["2026-08-02","135","A"],["2026-08-03","110","A"],["2026-08-04","150","B"],["2026-08-05","130","B"],["2026-08-06","145","A"],["2026-08-07","160","A"],["2026-08-08","125","B"],["2026-08-09","140","A"],["2026-08-10","155","A"]]}',
  'SELECT
    prod_date,
    daily_output,
    SUM(daily_output) OVER (ORDER BY prod_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_output,
    ROUND(SUM(daily_output) OVER (ORDER BY prod_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / 1000.0 * 100, 2) AS achieve_rate
  FROM 日产量
  ORDER BY prod_date ASC',
  'PLACEHOLDER_8_2',
  'CREATE TABLE 日产量 (prod_date, daily_output, shift); -- 可使用 SUM() OVER() 窗口函数',
  2,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-3] 多表关联：工单→报工→质量→物料的全链路查询
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '工单全链路查询',
  '老板想看一条工单的完整信息。请关联工单、报工、质量检查和物料4张表，查询工单 WO-001 的：工单信息（产品、计划量、完工量）、报工汇总（总产量、总工时）、质量结果（检查次数、不良总数）、物料消耗（消耗物料种类数）。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","state TEXT"],"rows":[["WO-001","P001",100,80,"running"],["WO-002","P001",80,80,"completed"],["WO-003","P002",120,100,"running"]]},{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","output_qty INTEGER","actual_hours REAL"],"rows":[["R01","WO-001",50,4.0],["R02","WO-001",30,2.5],["R03","WO-002",80,6.0],["R04","WO-003",60,5.0],["R05","WO-003",40,3.5]]},{"name":"质量检查","columns":["check_id TEXT","wo_id TEXT","check_date TEXT","inspected_qty INTEGER","defect_qty INTEGER","result TEXT"],"rows":[["C01","WO-001","2026-08-01",50,2,"pass"],["C02","WO-001","2026-08-02",30,1,"pass"],["C03","WO-002",80,80,0,"pass"],["C04","WO-003","2026-08-03",60,4,"fail"],["C05","WO-003","2026-08-04",40,2,"pass"]]},{"name":"物料消耗","columns":["consume_id TEXT","wo_id TEXT","material_id TEXT","consumed_qty INTEGER"],"rows":[["CM01","WO-001","M001",25],["CM02","WO-001","M002",15],["CM03","WO-001","M003",10],["CM04","WO-002","M001",40],["CM05","WO-003","M001",30],["CM06","WO-003","M002",20]]}',
  'SELECT
    w.wo_id,
    w.product_id,
    w.plan_qty,
    w.done_qty,
    w.state,
    COALESCE(SUM(r.output_qty), 0) AS total_output,
    COALESCE(SUM(r.actual_hours), 0) AS total_hours,
    COUNT(DISTINCT q.check_id) AS check_count,
    COALESCE(SUM(q.defect_qty), 0) AS total_defect,
    COUNT(DISTINCT m.material_id) AS material_types
  FROM 工单 w
  LEFT JOIN 报工记录 r ON r.wo_id = w.wo_id
  LEFT JOIN 质量检查 q ON q.wo_id = w.wo_id
  LEFT JOIN 物料消耗 m ON m.wo_id = w.wo_id
  WHERE w.wo_id = ''WO-001''
  GROUP BY w.wo_id',
  'PLACEHOLDER_8_3',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, state);\nCREATE TABLE 报工记录 (report_id, wo_id, output_qty, actual_hours);\nCREATE TABLE 质量检查 (check_id, wo_id, check_date, inspected_qty, defect_qty, result);\nCREATE TABLE 物料消耗 (consume_id, wo_id, material_id, consumed_qty);',
  3,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-4] 日期处理：近30天有报工的工单数
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '近30天报工工单数',
  'HR想统计近30天（截至2026-08-15）有多少个不同的工单有报工记录。请注意排除重复工单，并按周（week）分组统计。',
  '{"tables":[{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","report_date TEXT","output_qty INTEGER"],"rows":[["R01","WO-101","2026-07-20",50],["R02","WO-102","2026-07-22",40],["R03","WO-101","2026-07-25",60],["R04","WO-103","2026-08-01",80],["R05","WO-104","2026-08-02",70],["R06","WO-103","2026-08-03",90],["R07","WO-105","2026-08-08",55],["R08","WO-106","2026-08-10",65],["R09","WO-104","2026-08-12",75],["R10","WO-107","2026-08-14",85],["R11","WO-108","2026-08-15",45],["R12","WO-105","2026-08-15",60]]}',
  'SELECT
    strftime(''%Y-W%W'', report_date) AS week_label,
    COUNT(DISTINCT wo_id) AS distinct_wo_count
  FROM 报工记录
  WHERE julianday(''2026-08-15'') - julianday(report_date) <= 30
  GROUP BY week_label
  ORDER BY week_label',
  'PLACEHOLDER_8_4',
  'CREATE TABLE 报工记录 (report_id, wo_id, report_date, output_qty); -- 可用 julianday()、strftime() 日期函数',
  4,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-5] 分组聚合：各车间设备稼动率
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '车间设备稼动率',
  '设备部门需要统计各车间的设备稼动率。稼动率 = 运行时长 / 额定运行时长（每日8小时）。筛出稼动率低于70%的车间（标记为"停机预警"），输出车间、设备数、平均稼动率和预警状态。',
  '{"tables":[{"name":"设备台账","columns":["equipment_id TEXT","equipment_name TEXT","workshop TEXT","rated_hours_daily REAL"],"rows":[["EQ-01","加工中心A","一车间",8],["EQ-02","加工中心B","一车间",8],["EQ-03","车床A","一车间",8],["EQ-04","铣床A","二车间",8],["EQ-05","铣床B","二车间",8],["EQ-06","磨床A","二车间",8],["EQ-07","线切割","三车间",8],["EQ-08","激光切割","三车间",8]]},{"name":"设备运行记录","columns":["record_id TEXT","equipment_id TEXT","work_date TEXT","running_hours REAL","down_hours REAL"],"rows":[["REC01","EQ-01","2026-08-01",7.5,0.5],["REC02","EQ-02","2026-08-01",6.0,2.0],["REC03","EQ-03","2026-08-01",7.0,1.0],["REC04","EQ-04","2026-08-01",5.0,3.0],["REC05","EQ-05","2026-08-01",4.5,3.5],["REC06","EQ-06","2026-08-01",7.5,0.5],["REC07","EQ-07","2026-08-01",3.0,5.0],["REC08","EQ-08","2026-08-01",2.5,5.5]]}',
  'SELECT
    e.workshop,
    COUNT(DISTINCT e.equipment_id) AS equipment_count,
    ROUND(AVG(r.running_hours / e.rated_hours_daily * 100), 2) AS avg_utilization,
    CASE
      WHEN AVG(r.running_hours / e.rated_hours_daily * 100) < 70 THEN ''停机预警''
      ELSE ''正常''
    END AS alert_status
  FROM 设备台账 e
  JOIN 设备运行记录 r ON r.equipment_id = e.equipment_id
  GROUP BY e.workshop
  HAVING avg_utilization < 70
  ORDER BY avg_utilization ASC',
  'PLACEHOLDER_8_5',
  'CREATE TABLE 设备台账 (equipment_id, equipment_name, workshop, rated_hours_daily);\nCREATE TABLE 设备运行记录 (record_id, equipment_id, work_date, running_hours, down_hours);',
  5,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-6] 去重与计数：统计独立产品数和工单数
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '去重统计产品与工单',
  '数据分析中经常需要对维度去重。请从报工记录中，统计以下指标：(1) 有报工的不同工单数；(2) 有报工的不同产品ID数；(3) 有报工的不同工位数；(4) 总报工记录数。',
  '{"tables":[{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","product_id TEXT","workstation_id TEXT","report_date TEXT","output_qty INTEGER"],"rows":[["R1","WO-101","P001","WS-A","2026-08-01",100],["R2","WO-101","P001","WS-A","2026-08-02",110],["R3","WO-102","P001","WS-B","2026-08-01",80],["R4","WO-102","P002","WS-B","2026-08-02",90],["R5","WO-103","P002","WS-C","2026-08-03",70],["R6","WO-104","P003","WS-A","2026-08-03",60],["R7","WO-105","P003","WS-C","2026-08-04",55],["R8","WO-106","P004","WS-B","2026-08-04",50]]}',
  'SELECT
    COUNT(DISTINCT wo_id) AS distinct_wo_count,
    COUNT(DISTINCT product_id) AS distinct_product_count,
    COUNT(DISTINCT workstation_id) AS distinct_workstation_count,
    COUNT(*) AS total_report_count
  FROM 报工记录',
  'PLACEHOLDER_8_6',
  'CREATE TABLE 报工记录 (report_id, wo_id, product_id, workstation_id, report_date, output_qty); -- 使用 COUNT(DISTINCT col)',
  6,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-7] EXISTS：查有报工但未完工的工单
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  'EXISTS报工未完工',
  'PMC想快速找出"有报工记录但尚未完工"的工单。请用EXISTS子查询实现，返回这类工单的工单ID、产品ID和当前状态。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","state TEXT"],"rows":[["WO-201","P001",100,80,"running"],["WO-202","P002",80,80,"completed"],["WO-203","P001",120,90,"running"],["WO-204","P003",60,60,"completed"],["WO-205","P002",150,30,"running"],["WO-206","P004",80,0,"pending"]]},{"name":"报工记录","columns":["report_id TEXT","wo_id TEXT","output_qty INTEGER"],"rows":[["R01","WO-201",80],["R02","WO-201",0],["R03","WO-202",80],["R04","WO-203",90],["R05","WO-205",30],["R06","WO-205",0]]}',
  'SELECT wo_id, product_id, state
  FROM 工单 w
  WHERE EXISTS (
    SELECT 1 FROM 报工记录 r WHERE r.wo_id = w.wo_id
  )
    AND w.state != ''completed''
  ORDER BY wo_id',
  'PLACEHOLDER_8_7',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, state);\nCREATE TABLE 报工记录 (report_id, wo_id, output_qty); -- 使用 EXISTS 子查询',
  7,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-8] UNION：合并在制和已完成工单列表
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  'UNION合并工单列表',
  '某报表需要同时展示"在制"和"已完成"工单的综合信息。请用UNION ALL合并两类工单：在制工单（running）标记来源为"在制"，已完成工单（completed）标记来源为"已完成"，输出工单ID、产品ID、完工量和来源。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","state TEXT"],"rows":[["WO-301","P001",100,80,"running"],["WO-302","P002",80,80,"completed"],["WO-303","P001",120,90,"running"],["WO-304","P003",60,60,"completed"],["WO-305","P002",150,30,"running"],["WO-306","P004",200,200,"completed"],["WO-307","P005",90,45,"running"],["WO-308","P001",100,100,"completed"]]}',
  'SELECT wo_id, product_id, done_qty, ''在制'' AS source
  FROM 工单
  WHERE state = ''running''
  UNION ALL
  SELECT wo_id, product_id, done_qty, ''已完成'' AS source
  FROM 工单
  WHERE state = ''completed''
  ORDER BY source, wo_id',
  'PLACEHOLDER_8_8',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, state); -- 使用 UNION ALL 合并两个子查询',
  8,
  strftime('%s','now')
);

-- ----------------------------------------------------------
-- [8-9] CASE WHEN：按完工率分段统计工单分布
-- ----------------------------------------------------------
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  8,
  '完工率分段统计',
  '管理层希望看到工单完工率的整体分布。请按完工率（done_qty/plan_qty）分为4段：0-25%为"严重滞后"、25-50%为"进度滞后"、50-75%为"基本正常"、75-100%为"接近完成"、100%为"已完工"，统计各段工单数量和平均延期天数（以2026-08-15为基准，running工单算延期，completed不计）。',
  '{"tables":[{"name":"工单","columns":["wo_id TEXT","product_id TEXT","plan_qty INTEGER","done_qty INTEGER","due_date TEXT","state TEXT"],"rows":[["WO-401","P001",100,80,"2026-08-01","running"],["WO-402","P001",100,25,"2026-08-02","running"],["WO-403","P002",200,180,"2026-08-03","completed"],["WO-404","P002",150,40,"2026-08-04","running"],["WO-405","P003",80,80,"2026-08-01","completed"],["WO-406","P003",120,30,"2026-08-05","running"],["WO-407","P004",50,45,"2026-08-06","running"],["WO-408","P004",100,100,"2026-08-04","completed"],["WO-409","P001",200,50,"2026-08-08","running"],["WO-410","P002",300,300,"2026-08-09","completed"],["WO-411","P003",60,15,"2026-08-10","running"],["WO-412","P005",500,400,"2026-08-12","running"]]}',
  'WITH wo_stats AS (
    SELECT
      wo_id,
      CAST(done_qty AS REAL) / plan_qty * 100 AS completion_pct,
      CASE state WHEN ''running'' THEN julianday(''2026-08-15'') - julianday(due_date) ELSE 0 END AS delay_days
    FROM 工单
  )
  SELECT
    CASE
      WHEN completion_pct = 100 THEN ''已完工''
      WHEN completion_pct < 25 THEN ''严重滞后''
      WHEN completion_pct < 50 THEN ''进度滞后''
      WHEN completion_pct < 75 THEN ''基本正常''
      WHEN completion_pct < 100 THEN ''接近完成''
      ELSE ''已完工''
    END AS segment,
    COUNT(*) AS order_count,
    ROUND(AVG(delay_days), 2) AS avg_delay_days
  FROM wo_stats
  GROUP BY segment
  ORDER BY
    CASE segment
      WHEN ''严重滞后'' THEN 1
      WHEN ''进度滞后'' THEN 2
      WHEN ''基本正常'' THEN 3
      WHEN ''接近完成'' THEN 4
      WHEN ''已完工'' THEN 5
    END',
  'PLACEHOLDER_8_9',
  'CREATE TABLE 工单 (wo_id, product_id, plan_qty, done_qty, due_date, state); -- 使用 CASE WHEN 进行分段聚合',
  9,
  strftime('%s','now')
);

