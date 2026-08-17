-- ============================================================================
-- 种子：topic 6「SQL 查询基础」6 道 SQL 实训题（此前该 sql 模块主题 0 练习）。
-- answer_hash 由本脚本用 sql.js 1.13.0 + 同源 canonicalizeRows 复算，与前端逐字一致。
-- 重跑安全：按 id 清掉本 seed 管辖的行再插入。
-- 部署：node node_modules/wrangler/bin/wrangler.js d1 execute mes-learning --remote --file=worker/src/migrations/seed-topic6-sql-exercises.sql
-- ============================================================================

DELETE FROM sql_exercises WHERE id IN (9401, 9402, 9403, 9404, 9405, 9406);

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES
(9401, 6,
 '列出所有产品，按单价从高到低排',
 '你是刚接手数据库的新人。先用最基础的 SELECT 把产品表看个遍：

列出所有产品的「产品编号、产品名称、单价」三列，按单价从高到低排（最贵的排最前面）。

提示：表叫 products，列分别是 product_id / product_name / unit_price；排序用 ORDER BY 单价 DESC。',
 '{"buildSql":"\nCREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, unit_price REAL);\nINSERT INTO products VALUES (1,''断路器A型'',120.50),(2,''接触器B型'',88.00),(3,''继电器C型'',45.00),(4,''变压器D型'',320.00);\n\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES\n (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),\n (2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),\n (3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),\n (4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),\n (5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),\n (6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\n\nCREATE TABLE production_records (pr_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_good INTEGER, qty_bad INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES\n (1,2,2,''张三'',30,2,''2026-08-11 09:10''),\n (2,2,2,''李四'',10,1,''2026-08-11 14:20''),\n (3,4,3,''王五'',90,5,''2026-08-10 10:00''),\n (4,5,1,''赵六'',80,0,''2026-08-09 16:00'');\n\nCREATE TABLE quality_checks (qc_id INTEGER PRIMARY KEY, wo_id INTEGER, product_id INTEGER, workshop TEXT, equip_id INTEGER, operator TEXT, defect_type TEXT, check_time TEXT);\nINSERT INTO quality_checks VALUES\n (1,2,2,''二号车间'',2,''李四'',NULL,''2026-08-11 15:00''),\n (2,4,3,''三号车间'',3,''王五'',''尺寸超差'',''2026-08-10 11:00''),\n (3,5,4,''一号车间'',1,''赵六'',NULL,''2026-08-09 17:00''),\n (4,3,1,''一号车间'',NULL,NULL,''外观划伤'',''2026-08-12 08:30'');\n\nCREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, equip_name TEXT, workshop TEXT, status TEXT);\nINSERT INTO equipment VALUES\n (1,''数控车床01'',''一号车间'',''running''),\n (2,''注塑机02'',''二号车间'',''running''),\n (3,''贴片机03'',''三号车间'',''down'');\n"}',
 'SELECT product_id, product_name, unit_price FROM products ORDER BY unit_price DESC;',
 'c97369b58d806a72e825333975082dd97057fb4527d98e63c7a4bb311d4dbb7c',
 'products(product_id, product_name, unit_price)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
production_records(pr_id, wo_id, equip_id, operator, qty_good, qty_bad, report_time)
quality_checks(qc_id, wo_id, product_id, workshop, equip_id, operator, defect_type, check_time)
equipment(equip_id, equip_name, workshop, status)',
 1, strftime('%s','now')),
(9402, 6,
 '查出延期且还没完工的工单',
 '生产主管要一份跟催清单：把交期早于 2026-08-15、且还没完工（state 不是 finished）的工单全部列出来。

显示列（顺序照写）：工单号、计划数量、已完工数量、交期。按交期从早到晚排，最急的排最前面。

提示：日期是 YYYY-MM-DD 文本，可直接比大小；"不是 finished" 用 <> 或 NOT IN 表达。',
 '{"buildSql":"\nCREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, unit_price REAL);\nINSERT INTO products VALUES (1,''断路器A型'',120.50),(2,''接触器B型'',88.00),(3,''继电器C型'',45.00),(4,''变压器D型'',320.00);\n\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES\n (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),\n (2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),\n (3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),\n (4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),\n (5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),\n (6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\n\nCREATE TABLE production_records (pr_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_good INTEGER, qty_bad INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES\n (1,2,2,''张三'',30,2,''2026-08-11 09:10''),\n (2,2,2,''李四'',10,1,''2026-08-11 14:20''),\n (3,4,3,''王五'',90,5,''2026-08-10 10:00''),\n (4,5,1,''赵六'',80,0,''2026-08-09 16:00'');\n\nCREATE TABLE quality_checks (qc_id INTEGER PRIMARY KEY, wo_id INTEGER, product_id INTEGER, workshop TEXT, equip_id INTEGER, operator TEXT, defect_type TEXT, check_time TEXT);\nINSERT INTO quality_checks VALUES\n (1,2,2,''二号车间'',2,''李四'',NULL,''2026-08-11 15:00''),\n (2,4,3,''三号车间'',3,''王五'',''尺寸超差'',''2026-08-10 11:00''),\n (3,5,4,''一号车间'',1,''赵六'',NULL,''2026-08-09 17:00''),\n (4,3,1,''一号车间'',NULL,NULL,''外观划伤'',''2026-08-12 08:30'');\n\nCREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, equip_name TEXT, workshop TEXT, status TEXT);\nINSERT INTO equipment VALUES\n (1,''数控车床01'',''一号车间'',''running''),\n (2,''注塑机02'',''二号车间'',''running''),\n (3,''贴片机03'',''三号车间'',''down'');\n"}',
 'SELECT wo_no, qty_plan, qty_done, due_date FROM work_orders WHERE due_date < ''2026-08-15'' AND state <> ''finished'' ORDER BY due_date;',
 '8faa48044d169731dcca1241e2e20fa97dbb9bb7f082967d57693905e40430c4',
 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
-- state 取值：created / released / running / finished / closed',
 2, strftime('%s','now')),
(9403, 6,
 '按车间统计工单数量与计划总数',
 '厂长要看各车间的负荷：按车间分组，统计每个车间的工单数量和计划生产总数量。

显示列（顺序照写）：车间、工单数量、计划总数。按工单数量从多到少排。

提示：分组用 GROUP BY workshop；数量用 COUNT(*)，计划总数用 SUM(qty_plan)。',
 '{"buildSql":"\nCREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, unit_price REAL);\nINSERT INTO products VALUES (1,''断路器A型'',120.50),(2,''接触器B型'',88.00),(3,''继电器C型'',45.00),(4,''变压器D型'',320.00);\n\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES\n (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),\n (2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),\n (3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),\n (4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),\n (5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),\n (6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\n\nCREATE TABLE production_records (pr_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_good INTEGER, qty_bad INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES\n (1,2,2,''张三'',30,2,''2026-08-11 09:10''),\n (2,2,2,''李四'',10,1,''2026-08-11 14:20''),\n (3,4,3,''王五'',90,5,''2026-08-10 10:00''),\n (4,5,1,''赵六'',80,0,''2026-08-09 16:00'');\n\nCREATE TABLE quality_checks (qc_id INTEGER PRIMARY KEY, wo_id INTEGER, product_id INTEGER, workshop TEXT, equip_id INTEGER, operator TEXT, defect_type TEXT, check_time TEXT);\nINSERT INTO quality_checks VALUES\n (1,2,2,''二号车间'',2,''李四'',NULL,''2026-08-11 15:00''),\n (2,4,3,''三号车间'',3,''王五'',''尺寸超差'',''2026-08-10 11:00''),\n (3,5,4,''一号车间'',1,''赵六'',NULL,''2026-08-09 17:00''),\n (4,3,1,''一号车间'',NULL,NULL,''外观划伤'',''2026-08-12 08:30'');\n\nCREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, equip_name TEXT, workshop TEXT, status TEXT);\nINSERT INTO equipment VALUES\n (1,''数控车床01'',''一号车间'',''running''),\n (2,''注塑机02'',''二号车间'',''running''),\n (3,''贴片机03'',''三号车间'',''down'');\n"}',
 'SELECT workshop, COUNT(*) AS wo_count, SUM(qty_plan) AS plan_total FROM work_orders GROUP BY workshop ORDER BY wo_count DESC;',
 'c6329e6662d470066baca0822705f68833ca203eb81b650bc48d2bcc0df2265e',
 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)',
 3, strftime('%s','now')),
(9404, 6,
 '关联工单与产品，看每张工单做什么',
 '把工单表和它的产品对上：查出每张工单的工单号、对应的产品名称、计划数量、已完工数量。

显示列（顺序照写）：工单号、产品名称、计划数量、已完工数量。按工单号升序排。

提示：work_orders.product_id 连 products.product_id，用 JOIN。',
 '{"buildSql":"\nCREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, unit_price REAL);\nINSERT INTO products VALUES (1,''断路器A型'',120.50),(2,''接触器B型'',88.00),(3,''继电器C型'',45.00),(4,''变压器D型'',320.00);\n\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES\n (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),\n (2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),\n (3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),\n (4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),\n (5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),\n (6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\n\nCREATE TABLE production_records (pr_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_good INTEGER, qty_bad INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES\n (1,2,2,''张三'',30,2,''2026-08-11 09:10''),\n (2,2,2,''李四'',10,1,''2026-08-11 14:20''),\n (3,4,3,''王五'',90,5,''2026-08-10 10:00''),\n (4,5,1,''赵六'',80,0,''2026-08-09 16:00'');\n\nCREATE TABLE quality_checks (qc_id INTEGER PRIMARY KEY, wo_id INTEGER, product_id INTEGER, workshop TEXT, equip_id INTEGER, operator TEXT, defect_type TEXT, check_time TEXT);\nINSERT INTO quality_checks VALUES\n (1,2,2,''二号车间'',2,''李四'',NULL,''2026-08-11 15:00''),\n (2,4,3,''三号车间'',3,''王五'',''尺寸超差'',''2026-08-10 11:00''),\n (3,5,4,''一号车间'',1,''赵六'',NULL,''2026-08-09 17:00''),\n (4,3,1,''一号车间'',NULL,NULL,''外观划伤'',''2026-08-12 08:30'');\n\nCREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, equip_name TEXT, workshop TEXT, status TEXT);\nINSERT INTO equipment VALUES\n (1,''数控车床01'',''一号车间'',''running''),\n (2,''注塑机02'',''二号车间'',''running''),\n (3,''贴片机03'',''三号车间'',''down'');\n"}',
 'SELECT w.wo_no, p.product_name, w.qty_plan, w.qty_done FROM work_orders w JOIN products p ON w.product_id = p.product_id ORDER BY w.wo_no;',
 'a0fca5808fba39ab65fe996680d4aba7dd0eba05b21e11312d13cd62bbd71dd6',
 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
products(product_id, product_name, unit_price)',
 4, strftime('%s','now')),
(9405, 6,
 '实战：统计每个产品的累计合格产出',
 '生产报表时间到。根据报工记录（production_records），汇总每个产品累计报工的合格数量。

显示列（顺序照写）：产品名称、合格总数。按合格总数从多到少排。

提示：报工记录只存 wo_id，要经 work_orders 连到 products 才能拿到产品名；合格数在 production_records.qty_good，用 SUM 汇总，GROUP BY 产品。',
 '{"buildSql":"\nCREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, unit_price REAL);\nINSERT INTO products VALUES (1,''断路器A型'',120.50),(2,''接触器B型'',88.00),(3,''继电器C型'',45.00),(4,''变压器D型'',320.00);\n\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES\n (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),\n (2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),\n (3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),\n (4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),\n (5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),\n (6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\n\nCREATE TABLE production_records (pr_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_good INTEGER, qty_bad INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES\n (1,2,2,''张三'',30,2,''2026-08-11 09:10''),\n (2,2,2,''李四'',10,1,''2026-08-11 14:20''),\n (3,4,3,''王五'',90,5,''2026-08-10 10:00''),\n (4,5,1,''赵六'',80,0,''2026-08-09 16:00'');\n\nCREATE TABLE quality_checks (qc_id INTEGER PRIMARY KEY, wo_id INTEGER, product_id INTEGER, workshop TEXT, equip_id INTEGER, operator TEXT, defect_type TEXT, check_time TEXT);\nINSERT INTO quality_checks VALUES\n (1,2,2,''二号车间'',2,''李四'',NULL,''2026-08-11 15:00''),\n (2,4,3,''三号车间'',3,''王五'',''尺寸超差'',''2026-08-10 11:00''),\n (3,5,4,''一号车间'',1,''赵六'',NULL,''2026-08-09 17:00''),\n (4,3,1,''一号车间'',NULL,NULL,''外观划伤'',''2026-08-12 08:30'');\n\nCREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, equip_name TEXT, workshop TEXT, status TEXT);\nINSERT INTO equipment VALUES\n (1,''数控车床01'',''一号车间'',''running''),\n (2,''注塑机02'',''二号车间'',''running''),\n (3,''贴片机03'',''三号车间'',''down'');\n"}',
 'SELECT p.product_name, SUM(r.qty_good) AS good_total FROM production_records r JOIN work_orders w ON r.wo_id = w.wo_id JOIN products p ON w.product_id = p.product_id GROUP BY p.product_id, p.product_name ORDER BY good_total DESC;',
 'f8e2295559f765b1c788a0bc3ce0781f490f82d8756dd90c609a49ddd8aaf63b',
 'production_records(pr_id, wo_id, equip_id, operator, qty_good, qty_bad, report_time)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
products(product_id, product_name, unit_price)',
 5, strftime('%s','now')),
(9406, 6,
 '实战：追溯所有不合格质检记录',
 '质量例会要追一批不合格品。查出所有不合格（defect_type 不为空）的质检记录，并关联出工单号、产品名称、车间、操作工、缺陷类型。

显示列（顺序照写）：工单号、产品名称、车间、操作工、缺陷类型、检验时间。按检验时间从早到晚排。

提示：quality_checks 里合格记录的 defect_type 是 NULL，用 IS NOT NULL 先把合格记录过滤掉；经 wo_id 连 work_orders 拿工单号、经 product_id 连 products 拿产品名。',
 '{"buildSql":"\nCREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, unit_price REAL);\nINSERT INTO products VALUES (1,''断路器A型'',120.50),(2,''接触器B型'',88.00),(3,''继电器C型'',45.00),(4,''变压器D型'',320.00);\n\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES\n (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),\n (2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),\n (3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),\n (4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),\n (5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),\n (6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\n\nCREATE TABLE production_records (pr_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_good INTEGER, qty_bad INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES\n (1,2,2,''张三'',30,2,''2026-08-11 09:10''),\n (2,2,2,''李四'',10,1,''2026-08-11 14:20''),\n (3,4,3,''王五'',90,5,''2026-08-10 10:00''),\n (4,5,1,''赵六'',80,0,''2026-08-09 16:00'');\n\nCREATE TABLE quality_checks (qc_id INTEGER PRIMARY KEY, wo_id INTEGER, product_id INTEGER, workshop TEXT, equip_id INTEGER, operator TEXT, defect_type TEXT, check_time TEXT);\nINSERT INTO quality_checks VALUES\n (1,2,2,''二号车间'',2,''李四'',NULL,''2026-08-11 15:00''),\n (2,4,3,''三号车间'',3,''王五'',''尺寸超差'',''2026-08-10 11:00''),\n (3,5,4,''一号车间'',1,''赵六'',NULL,''2026-08-09 17:00''),\n (4,3,1,''一号车间'',NULL,NULL,''外观划伤'',''2026-08-12 08:30'');\n\nCREATE TABLE equipment (equip_id INTEGER PRIMARY KEY, equip_name TEXT, workshop TEXT, status TEXT);\nINSERT INTO equipment VALUES\n (1,''数控车床01'',''一号车间'',''running''),\n (2,''注塑机02'',''二号车间'',''running''),\n (3,''贴片机03'',''三号车间'',''down'');\n"}',
 'SELECT w.wo_no, p.product_name, qc.workshop, qc.operator, qc.defect_type, qc.check_time FROM quality_checks qc JOIN work_orders w ON qc.wo_id = w.wo_id JOIN products p ON qc.product_id = p.product_id WHERE qc.defect_type IS NOT NULL ORDER BY qc.check_time;',
 'c43d6d94d5dd540fa031ba4de5b101b039baac8a925589ca6ba41cb18cd17692',
 'quality_checks(qc_id, wo_id, product_id, workshop, equip_id, operator, defect_type, check_time)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
products(product_id, product_name, unit_price)',
 6, strftime('%s','now'));
