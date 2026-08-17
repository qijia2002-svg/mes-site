-- ============================================================================
-- 种子：MES 二开借鉴（free-mes 源码抽取）衍生的 6 道 SQL 实训题。
-- 报工×2(topic3) / 追溯×2 + 排产派工×2(topic9001)，均扎根 free-mes 真实领域逻辑。
-- answer_hash 由本脚本用 sql.js 1.13.0 + 同源 canonicalizeRows 复算，与前端逐字一致。
-- 重跑安全：按 id 清掉本 seed 管辖的行再插入。
-- 部署：node node_modules/wrangler/bin/wrangler.js d1 execute mes-learning --remote --file=worker/src/migrations/seed-freemes-exercises.sql
-- ============================================================================

DELETE FROM sql_exercises WHERE id IN (9501, 9502, 9503, 9504, 9505, 9506);

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES
(9501, 3,
 '按工单统计报工完成进度',
 '一张工单会拆成多道工序任务（task）。每个任务有排产数量 plan_qty 和已报工数量 reported_qty，状态 status 从 NoSTARTED→STARTED→PAUSED→FINISHED。

按工单汇总报工进度：返回 工单号、总排产数量、总已报工数量、以及 ROUND(总已报工*100.0/总排产) 作为 progress_pct（整数百分比）。按工单号升序排。',
 '{"buildSql":"\nCREATE TABLE work_tasks (\n  task_code TEXT, order_code TEXT, process_name TEXT, workstation TEXT,\n  status TEXT, plan_qty INTEGER, reported_qty INTEGER\n);\nINSERT INTO work_tasks VALUES\n (''T-1001'',''WO-301'',''下料'',''下料工位'',''FINISHED'',100,100),\n (''T-1002'',''WO-301'',''机加工'',''机加工工位'',''STARTED'',80,30),\n (''T-1003'',''WO-301'',''组装'',''组装工位'',''NoSTARTED'',120,0),\n (''T-1004'',''WO-302'',''下料'',''下料工位'',''FINISHED'',60,60),\n (''T-1005'',''WO-302'',''机加工'',''机加工工位'',''PAUSED'',90,40),\n (''T-1006'',''WO-303'',''焊接'',''焊接工位'',''FINISHED'',50,50),\n (''T-1007'',''WO-303'',''质检'',''质检工位'',''STARTED'',50,20);\n"}',
 'SELECT order_code, SUM(plan_qty) AS total_plan, SUM(reported_qty) AS total_done, ROUND(SUM(reported_qty)*100.0/SUM(plan_qty)) AS progress_pct FROM work_tasks GROUP BY order_code ORDER BY order_code;',
 'b632cfe84258f288201e0527dde95bd1606989023327477d0f20968d9daa5e53',
 'work_tasks(task_code, order_code, process_name, workstation, status, plan_qty, reported_qty)
-- status 取值：NoSTARTED / STARTED / PAUSED / FINISHED',
 1, strftime('%s','now')),
(9502, 3,
 '统计各报工状态的任务数',
 '报工状态有四种：NoSTARTED(待开工)、STARTED(开工)、PAUSED(暂停)、FINISHED(完工)。

统计每种状态各有几个任务，返回 状态、任务数（列名 task_count），按任务数从多到少排。',
 '{"buildSql":"\nCREATE TABLE work_tasks (\n  task_code TEXT, order_code TEXT, process_name TEXT, workstation TEXT,\n  status TEXT, plan_qty INTEGER, reported_qty INTEGER\n);\nINSERT INTO work_tasks VALUES\n (''T-1001'',''WO-301'',''下料'',''下料工位'',''FINISHED'',100,100),\n (''T-1002'',''WO-301'',''机加工'',''机加工工位'',''STARTED'',80,30),\n (''T-1003'',''WO-301'',''组装'',''组装工位'',''NoSTARTED'',120,0),\n (''T-1004'',''WO-302'',''下料'',''下料工位'',''FINISHED'',60,60),\n (''T-1005'',''WO-302'',''机加工'',''机加工工位'',''PAUSED'',90,40),\n (''T-1006'',''WO-303'',''焊接'',''焊接工位'',''FINISHED'',50,50),\n (''T-1007'',''WO-303'',''质检'',''质检工位'',''STARTED'',50,20);\n"}',
 'SELECT status, COUNT(*) AS task_count FROM work_tasks GROUP BY status ORDER BY task_count DESC;',
 'd1ac6d20747d1d753e3597bfc1159203a80f87f9ccbcc6221e21aad9315dd16f',
 'work_tasks(task_code, order_code, process_name, workstation, status, plan_qty, reported_qty)
-- status 取值：NoSTARTED / STARTED / PAUSED / FINISHED',
 2, strftime('%s','now')),
(9503, 9001,
 '正向追溯：查某序列号经手的全部工序',
 '质量追溯（正向）：给一个产品序列号，查出它从上线到完工经手的每一道工序记录。

查序列号 SN-A02 的全部工序，返回 序列号、批次号、工序、操作工、设备、结果，按工序顺序 seq 排。',
 '{"buildSql":"\nCREATE TABLE process_records (\n  sn TEXT, batch_no TEXT, process_name TEXT, operator TEXT, equip TEXT, seq INTEGER, result TEXT\n);\nINSERT INTO process_records VALUES\n (''SN-A01'',''B-2408'',''SMT贴片'',''张三'',''贴片机1'',1,''pass''),\n (''SN-A01'',''B-2408'',''ICT测试'',''李四'',''测试台2'',2,''pass''),\n (''SN-A01'',''B-2408'',''组装'',''王五'',''组装线3'',3,''pass''),\n (''SN-A02'',''B-2408'',''SMT贴片'',''张三'',''贴片机1'',1,''pass''),\n (''SN-A02'',''B-2408'',''ICT测试'',''李四'',''测试台2'',2,''fail''),\n (''SN-A02'',''B-2408'',''组装'',''王五'',''组装线3'',3,''pass''),\n (''SN-A03'',''B-2409'',''SMT贴片'',''赵六'',''贴片机1'',1,''pass''),\n (''SN-A03'',''B-2409'',''ICT测试'',''李四'',''测试台2'',2,''pass''),\n (''SN-A03'',''B-2409'',''组装'',''钱七'',''组装线3'',3,''pass'');\n"}',
 'SELECT sn, batch_no, process_name, operator, equip, result FROM process_records WHERE sn=''SN-A02'' ORDER BY seq;',
 'c02adc462840a17c2bdddb307f9c8b3fe6549c67b4a1ec09d97e218674b22e85',
 'process_records(sn, batch_no, process_name, operator, equip, seq, result)
-- sn 序列号(单件级) | batch_no 批次号(批级) | seq 工序顺序 | result: pass/fail',
 3, strftime('%s','now')),
(9504, 9001,
 '反向追溯：某批次的不良涉及哪些序列号',
 '质量追溯（反向）：从一道不合格的工序，反查它属于哪几个单件。

批次 B-2408 里有一道工序判了 fail。查出该批次中所有「结果不合格」(result=''fail'') 的工序记录对应的序列号，去重并按序列号升序排，返回 序列号、工序、结果。',
 '{"buildSql":"\nCREATE TABLE process_records (\n  sn TEXT, batch_no TEXT, process_name TEXT, operator TEXT, equip TEXT, seq INTEGER, result TEXT\n);\nINSERT INTO process_records VALUES\n (''SN-A01'',''B-2408'',''SMT贴片'',''张三'',''贴片机1'',1,''pass''),\n (''SN-A01'',''B-2408'',''ICT测试'',''李四'',''测试台2'',2,''pass''),\n (''SN-A01'',''B-2408'',''组装'',''王五'',''组装线3'',3,''pass''),\n (''SN-A02'',''B-2408'',''SMT贴片'',''张三'',''贴片机1'',1,''pass''),\n (''SN-A02'',''B-2408'',''ICT测试'',''李四'',''测试台2'',2,''fail''),\n (''SN-A02'',''B-2408'',''组装'',''王五'',''组装线3'',3,''pass''),\n (''SN-A03'',''B-2409'',''SMT贴片'',''赵六'',''贴片机1'',1,''pass''),\n (''SN-A03'',''B-2409'',''ICT测试'',''李四'',''测试台2'',2,''pass''),\n (''SN-A03'',''B-2409'',''组装'',''钱七'',''组装线3'',3,''pass'');\n"}',
 'SELECT DISTINCT sn, process_name, result FROM process_records WHERE batch_no=''B-2408'' AND result=''fail'' ORDER BY sn;',
 '8da3a4aab3b16adb77279dcdade09b9570b847d84aaf2af023aa004ccfeb17a2',
 'process_records(sn, batch_no, process_name, operator, equip, seq, result)
-- 反向追溯：按 batch_no + result 过滤，反查涉及的 sn',
 4, strftime('%s','now')),
(9505, 9001,
 '校验：排产量不得超过订单量',
 '派工（dispatch）硬规则一：一道工序的排产数量 plan_qty 不能超过它所属工单的订单总量 order_qty，否则排了也做不出来。

查出所有「排产数量 > 订单量」的非法派工，返回 任务号、工单号、排产数量、订单量，按任务号升序排。',
 '{"buildSql":"\nCREATE TABLE work_orders (order_code TEXT, product TEXT, order_qty INTEGER);\nINSERT INTO work_orders VALUES\n (''WO-501'',''断路器A'',200),(''WO-502'',''接触器B'',150),(''WO-503'',''继电器C'',100);\nCREATE TABLE dispatch_tasks (\n  task_code TEXT, order_code TEXT, process_name TEXT, equip TEXT, plan_qty INTEGER, equip_capacity INTEGER\n);\nINSERT INTO dispatch_tasks VALUES\n (''D-1'',''WO-501'',''下料'',''下料机'',200,300),\n (''D-2'',''WO-501'',''机加工'',''CNC'',250,200),\n (''D-3'',''WO-502'',''下料'',''下料机'',150,150),\n (''D-4'',''WO-502'',''机加工'',''CNC'',180,160),\n (''D-5'',''WO-503'',''焊接'',''焊机'',100,120);\n"}',
 'SELECT t.task_code, t.order_code, t.plan_qty, o.order_qty FROM dispatch_tasks t JOIN work_orders o ON t.order_code=o.order_code WHERE t.plan_qty > o.order_qty ORDER BY t.task_code;',
 '16ea817b4b762cf5bf76acba103b5110419aaa4d37c5319f8666c8ee56605aa7',
 'work_orders(order_code, product, order_qty)
dispatch_tasks(task_code, order_code, process_name, equip, plan_qty, equip_capacity)',
 5, strftime('%s','now')),
(9506, 9001,
 '校验：排产数量不得超过设备产能',
 '派工硬规则二：排产数量 plan_qty 不能超过该设备当天的产能 equip_capacity，否则当天做不完。

查出所有「排产数量 > 设备产能」的派工，返回 任务号、工序、设备、排产数量、设备产能，按排产数量从多到少排。',
 '{"buildSql":"\nCREATE TABLE work_orders (order_code TEXT, product TEXT, order_qty INTEGER);\nINSERT INTO work_orders VALUES\n (''WO-501'',''断路器A'',200),(''WO-502'',''接触器B'',150),(''WO-503'',''继电器C'',100);\nCREATE TABLE dispatch_tasks (\n  task_code TEXT, order_code TEXT, process_name TEXT, equip TEXT, plan_qty INTEGER, equip_capacity INTEGER\n);\nINSERT INTO dispatch_tasks VALUES\n (''D-1'',''WO-501'',''下料'',''下料机'',200,300),\n (''D-2'',''WO-501'',''机加工'',''CNC'',250,200),\n (''D-3'',''WO-502'',''下料'',''下料机'',150,150),\n (''D-4'',''WO-502'',''机加工'',''CNC'',180,160),\n (''D-5'',''WO-503'',''焊接'',''焊机'',100,120);\n"}',
 'SELECT task_code, process_name, equip, plan_qty, equip_capacity FROM dispatch_tasks WHERE plan_qty > equip_capacity ORDER BY plan_qty DESC;',
 '56fc71776be553865c79e8ce6eeb31b36f8c6dcbe2bd2f951fe8cb4abc01026b',
 'dispatch_tasks(task_code, order_code, process_name, equip, plan_qty, equip_capacity)',
 6, strftime('%s','now'));
