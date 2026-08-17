-- ============================================================================
-- 种子：MES 二开借鉴（free-mes 源码抽取）第 2 批 SQL 实训题（计划层级 + 班组排班）。
-- 全部 topic 9001（工厂主线）。扎根 free-mes 真实领域逻辑：
--   plan_month/plan_day 两级计划（monthNumber 关联）；cla_team/cla_team_member/cla_plan_team/cla_plan_team_people 班组排班。
-- answer_hash 由本脚本用 sql.js 1.13.0 + 同源 canonicalizeRows 复算，与前端逐字一致。
-- 重跑安全：按 id 清掉本 seed 管辖的行再插入。
-- 部署：node node_modules/wrangler/bin/wrangler.js d1 execute mes-learning --remote --file=worker/src/migrations/seed-freemes-plan-cla.sql
-- ============================================================================

DELETE FROM sql_exercises WHERE id IN (9507, 9508, 9509);

INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES
(9507, 9001,
 '计划层级：校验日计划合计是否超过月计划',
 '生产计划是「月计划 → 日计划」两级：月计划 plan_month 定总量，日计划 plan_day 把总量拆到每一天，用 month_number 指向所属月计划。

查「日计划合计 > 月计划数量」的月份（计划分解超量，不允许）。关联 plan_month 与 plan_day（month.number = day.month_number），按月份汇总日计划数量：
返回 月计划编号、月计划数量、日计划合计、差值（日合计 - 月计划数量，列名 diff）。按 diff 从多到少排。',
 '{"buildSql":"\nCREATE TABLE plan_month (\n  number TEXT, factory_name TEXT, workshop TEXT, production_line TEXT, month TEXT, plan_qty INTEGER, unit TEXT\n);\nINSERT INTO plan_month VALUES\n (''M-2024-08'',''工厂A'',''总装车间'',''L1'',''2024-08'',1000,''台''),\n (''M-2024-09'',''工厂A'',''总装车间'',''L1'',''2024-09'',800,''台'');\nCREATE TABLE plan_day (\n  number TEXT, month_number TEXT, day TEXT, workshop TEXT, production_line TEXT,\n  mo_number TEXT, product_number TEXT, product_name TEXT, plan_qty INTEGER, unit TEXT\n);\nINSERT INTO plan_day VALUES\n (''D-0801'',''M-2024-08'',''2024-08-01'',''总装车间'',''L1'',''WO-801'',''P-A'',''断路器A'',400,''台''),\n (''D-0802'',''M-2024-08'',''2024-08-02'',''总装车间'',''L1'',''WO-801'',''P-A'',''断路器A'',350,''台''),\n (''D-0803'',''M-2024-08'',''2024-08-03'',''总装车间'',''L1'',''WO-801'',''P-A'',''断路器A'',300,''台''),\n (''D-0901'',''M-2024-09'',''2024-09-01'',''总装车间'',''L1'',''WO-802'',''P-B'',''接触器B'',300,''台''),\n (''D-0902'',''M-2024-09'',''2024-09-02'',''总装车间'',''L1'',''WO-802'',''P-B'',''接触器B'',300,''台''),\n (''D-0903'',''M-2024-09'',''2024-09-03'',''总装车间'',''L1'',''WO-802'',''P-B'',''接触器B'',150,''台'');\n"}',
 'SELECT m.number AS month_number, m.plan_qty AS month_plan, SUM(d.plan_qty) AS day_total, SUM(d.plan_qty) - m.plan_qty AS diff FROM plan_month m JOIN plan_day d ON m.number = d.month_number GROUP BY m.number, m.plan_qty HAVING SUM(d.plan_qty) > m.plan_qty ORDER BY diff DESC;',
 'f50cd8ce4fce14faa35e7d8341b9055da8dd2b0491fbd7c91f617e002b885a12',
 'plan_month(number, factory_name, workshop, production_line, month, plan_qty, unit)
plan_day(number, month_number, day, workshop, production_line, mo_number, product_number, product_name, plan_qty, unit)
-- 日计划通过 month_number 关联所属月计划',
 1, strftime('%s','now')),
(9508, 9001,
 '班组排班：校验排班指派人数是否超过班组编制',
 '班组排班有两组表：班组 cla_team 及其成员 cla_team_member（一人在编记一行）；排班计划 cla_plan_team 把某个班组排到某周，排班人员 cla_plan_team_people 记录该排班里指派的每个人（每人一行，含任务 task_code）。

查「排班计划指派人数 > 所属班组在编人数」的排班（排班超编，不允许）。人数 = 按 plan_code 统计 cla_plan_team_people 的去重人数；班组在编 = 按 team_code 统计 cla_team_member 的人数。
返回 排班编号、班组编号、指派人数、在编人数、超编数（指派 - 在编，列名 over）。按超编数从多到少排。',
 '{"buildSql":"\nCREATE TABLE cla_team (team_code TEXT, team_name TEXT, team_type TEXT, team_leader TEXT);\nINSERT INTO cla_team VALUES\n (''T-A'',''一班'',''生产'',''赵组长''),(''T-B'',''二班'',''生产'',''钱组长'');\nCREATE TABLE cla_team_member (team_code TEXT, person_code TEXT, user_name TEXT);\nINSERT INTO cla_team_member VALUES\n (''T-A'',''MA1'',''甲''),(''T-A'',''MA2'',''乙''),(''T-A'',''MA3'',''丙''),(''T-A'',''MA4'',''丁''),(''T-A'',''MA5'',''戊''),\n (''T-B'',''MB1'',''己''),(''T-B'',''MB2'',''庚''),(''T-B'',''MB3'',''辛'');\nCREATE TABLE cla_plan_team (plan_code TEXT, plan_name TEXT, team_code TEXT, team_name TEXT);\nINSERT INTO cla_plan_team VALUES\n (''S-1'',''八月第一周排班'',''T-A'',''一班''),(''S-2'',''八月第二周排班'',''T-B'',''二班'');\nCREATE TABLE cla_plan_team_people (plan_code TEXT, team_code TEXT, plan_people_name TEXT, task_code TEXT, people_quantity REAL);\nINSERT INTO cla_plan_team_people VALUES\n (''S-1'',''T-A'',''PA1'',''T1'',40),(''S-1'',''T-A'',''PA2'',''T1'',40),(''S-1'',''T-A'',''PA3'',''T2'',30),(''S-1'',''T-A'',''PA4'',''T3'',25),\n (''S-2'',''T-B'',''PB1'',''T1'',20),(''S-2'',''T-B'',''PB2'',''T2'',20),(''S-2'',''T-B'',''PB3'',''T3'',20),(''S-2'',''T-B'',''PB4'',''T4'',20),(''S-2'',''T-B'',''PB5'',''T4'',20);\n"}',
 'SELECT pt.plan_code, pt.team_code, COUNT(DISTINCT ppl.plan_people_name) AS assigned, tm.member_cnt AS team_size, COUNT(DISTINCT ppl.plan_people_name) - tm.member_cnt AS over FROM cla_plan_team pt JOIN (SELECT team_code, COUNT(*) AS member_cnt FROM cla_team_member GROUP BY team_code) tm ON tm.team_code = pt.team_code JOIN cla_plan_team_people ppl ON ppl.plan_code = pt.plan_code GROUP BY pt.plan_code, pt.team_code, tm.member_cnt HAVING COUNT(DISTINCT ppl.plan_people_name) > tm.member_cnt ORDER BY over DESC;',
 '724b82fd1efd882d50dbbcc714e87e003e3aca9b034520e252e447f0f0975269',
 'cla_team(team_code, team_name, team_type, team_leader)
cla_team_member(team_code, person_code, user_name)
cla_plan_team(plan_code, plan_name, team_code, team_name)
cla_plan_team_people(plan_code, team_code, plan_people_name, task_code, people_quantity)',
 2, strftime('%s','now')),
(9509, 9001,
 '班组排班：统计各班组的在编人数与排班覆盖',
 '延续上题的班组/排班模型。统计每个班组的能力视图：
- 在编人数：cla_team_member 中该 team_code 的人数；
- 已排班人数：cla_plan_team_people 中该 team_code 的去重人数；
- 排班工序数：cla_plan_team_people 中该 team_code 的去重 task_code 数。
返回 班组编号、班组名称、在编人数、已排班人数、排班工序数，按在编人数从多到少排。',
 '{"buildSql":"\nCREATE TABLE cla_team (team_code TEXT, team_name TEXT, team_type TEXT, team_leader TEXT);\nINSERT INTO cla_team VALUES\n (''T-A'',''一班'',''生产'',''赵组长''),(''T-B'',''二班'',''生产'',''钱组长'');\nCREATE TABLE cla_team_member (team_code TEXT, person_code TEXT, user_name TEXT);\nINSERT INTO cla_team_member VALUES\n (''T-A'',''MA1'',''甲''),(''T-A'',''MA2'',''乙''),(''T-A'',''MA3'',''丙''),(''T-A'',''MA4'',''丁''),(''T-A'',''MA5'',''戊''),\n (''T-B'',''MB1'',''己''),(''T-B'',''MB2'',''庚''),(''T-B'',''MB3'',''辛'');\nCREATE TABLE cla_plan_team (plan_code TEXT, plan_name TEXT, team_code TEXT, team_name TEXT);\nINSERT INTO cla_plan_team VALUES\n (''S-1'',''八月第一周排班'',''T-A'',''一班''),(''S-2'',''八月第二周排班'',''T-B'',''二班'');\nCREATE TABLE cla_plan_team_people (plan_code TEXT, team_code TEXT, plan_people_name TEXT, task_code TEXT, people_quantity REAL);\nINSERT INTO cla_plan_team_people VALUES\n (''S-1'',''T-A'',''PA1'',''T1'',40),(''S-1'',''T-A'',''PA2'',''T1'',40),(''S-1'',''T-A'',''PA3'',''T2'',30),(''S-1'',''T-A'',''PA4'',''T3'',25),\n (''S-2'',''T-B'',''PB1'',''T1'',20),(''S-2'',''T-B'',''PB2'',''T2'',20),(''S-2'',''T-B'',''PB3'',''T3'',20),(''S-2'',''T-B'',''PB4'',''T4'',20),(''S-2'',''T-B'',''PB5'',''T4'',20);\n"}',
 'SELECT t.team_code, t.team_name, COUNT(DISTINCT m.person_code) AS roster, COUNT(DISTINCT p.plan_people_name) AS scheduled, COUNT(DISTINCT p.task_code) AS tasks FROM cla_team t LEFT JOIN cla_team_member m ON m.team_code = t.team_code LEFT JOIN cla_plan_team_people p ON p.team_code = t.team_code GROUP BY t.team_code, t.team_name ORDER BY roster DESC;',
 '42134425b9844f7ea033821b68b226d27566de83ddf09e4d422e4842f1ef26f3',
 'cla_team(team_code, team_name, ...)
cla_team_member(team_code, person_code, user_name)
cla_plan_team_people(plan_code, team_code, plan_people_name, task_code, people_quantity)',
 3, strftime('%s','now'));
