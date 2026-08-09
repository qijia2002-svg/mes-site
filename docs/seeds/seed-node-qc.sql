-- ============================================================
-- 节点种子：qc（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9103 | 测验 9203,9239,9240 | SQL 9303 | 微练习 9410
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9103;
DELETE FROM questions WHERE id IN (9203, 9239, 9240);
DELETE FROM sql_exercises WHERE id = 9303;
DELETE FROM micro_practices WHERE id = 9410;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc') AND ref_id IN (9103, 9203, 9239, 9240, 9303, 9410) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9103
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9103, 9001, '质检判定：判了不合格之后呢', 3, 'published', '# 质检判定：判了不合格之后呢

质检在主线上看着只是一个方框，实际上它是整条流程唯一有权说「停」的环节。判合格，货往下走；判不合格，货被扣住，然后一连串动作才刚开始。

新人容易把质检理解成「检一下」。真正的难点从来不是检，是**判完之后怎么处理、怎么追溯、怎么防止再犯**。

## 三道检验分别防什么

| 类型 | 时机 | 防的是 |
|---|---|---|
| 首检 FAI | 换型/换班后第一件 | 参数设错、模具装错 —— 防批量报废 |
| 巡检 IPQC | 生产过程中定时抽 | 过程漂移 —— 刀具磨损、温度跑偏 |
| 终检 FQC | 入库前 | 漏网之鱼 —— 最后一道闸 |

首检的价值最容易被低估。一次首检省下的是**整批**的返工成本，所以再赶工也不能跳首检。这是现场最常被违反、也最不该违反的一条规矩。

## 一条不合格记录该带什么信息

样例库的 `quality_checks` 是最小可用结构：

- `wo_id` —— 哪张工单，追溯的起点
- `check_time` —— 什么时候检的，用来对上当时的班次和设备状态
- `result` —— 合格 / 不合格
- `defect_type` —— **缺陷类型，不合格记录的灵魂**

`defect_type` 为空的不合格记录等于废纸。只知道「坏了」不知道「怎么坏的」，既做不了帕累托分析，也定位不到原因。实施时这个字段必须做成受控下拉，不能让现场自由填 —— 一旦变成自由文本，同一种缺陷会出现「尺寸超差」「尺寸不良」「超差」三种写法，统计直接报废。

## 判不合格之后的三条路

1. **返工（Rework）** —— 能修，走返工工单，修完重检
2. **让步接收（Concession）** —— 不影响功能，走特采审批，必须留记录
3. **报废（Scrap）** —— 直接损失，冲减产出，进成本

三条路都要在系统里留痕。最怕的是第四条路：现场自己「处理」了，系统里什么都没有。这样的工厂做不了质量追溯，客户一投诉就哑口。

## 追溯是怎么走的

从一条不合格记录往回推：

```
不合格记录 → 工单 → 报工记录 → 设备 / 操作工 / 时间段
                  ↘ 领料单 → 物料批次 → 供应商
```

样例库里这条链是通的。`quality_checks` 关到 `work_orders` 能看出车间和产品，再关 `production_records` 能落到具体设备。

## 先迈第一步

样例库里有 4 条不合格记录。先别急着追设备，第一步永远是：**把它们和缺陷类型一起摆出来，看是什么问题、出在哪个车间。**

看清楚了再往下追，才不会追错方向。', 1, strftime('%s','now'));

-- 测验 9203,9239,9240（9203=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9203, 9103, 'single', '实施质检模块时，defect_type（缺陷类型）字段最应该做成什么形式？', '["自由文本，方便现场描述细节","受控下拉，选项由质量部维护","可选填，不强制录入","自动从设备报警码生成"]', '1', '一旦允许自由文本，同一种缺陷会被写成「尺寸超差」「尺寸不良」「超差」等多种写法，帕累托分析和趋势统计全部失效。受控下拉保证了统计口径统一；确实需要补充细节时，另设一个备注字段，不要污染分类字段。设备报警码只覆盖设备类缺陷，覆盖不了来料和人为缺陷。', 1, strftime('%s','now')),
  (9239, 9103, 'single', 'quality_checks 表的 result 字段取值通常是？', '["0 或 1 数字","合格 / 不合格","百分制分数","颜色标记"]', '1', '检验结果用 合格/不合格 表示，不合格记录会带 defect_type 缺陷类型，供后续追溯。', 2, strftime('%s','now')),
  (9240, 9103, 'single', '一批产品被判不合格（QC 判不合格），优先往哪里追溯根因？', '["客户档案","产出它的设备与操作工（production_records）","发票信息","运输单据"]', '1', '从 quality_checks 关联 production_records，可定位是哪台设备、哪个工人产出了不良，是质量追溯的主线。', 3, strftime('%s','now'));

-- SQL 练习 9303（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9303, 9001, '查出这批货为什么被判不合格', '质量例会前十分钟，你需要一张表：所有判定为不合格的质检记录，分别是哪张工单、哪个车间、什么缺陷、什么时候检出的。

要求输出这几列，顺序照写：工单号、车间、缺陷类型、检验时间。
按检验时间从早到晚排，看清楚问题是怎么一天天演变的。

提示：合格记录的 defect_type 是空的，别把它们混进来。', '{}', 'SELECT w.wo_no, w.workshop, q.defect_type, q.check_time FROM quality_checks q JOIN work_orders w ON w.wo_id = q.wo_id WHERE q.result = ''不合格'' ORDER BY q.check_time;', 'd4e58db3521815efc45976481b94c9ad5c701c64d9867ca7272f5566a696e5f5', 'quality_checks(check_id, wo_id, check_time, result, defect_type)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)', 3, strftime('%s','now'));

-- 微练习 9410（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9410, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'order', '把这四件质量动作按它们在生产过程中的先后顺序排好。', '{"items":[{"key":"fai","label":"首检 FAI：换型后第一件，确认参数模具没装错"},{"key":"ipqc","label":"巡检 IPQC：过程中定时抽，盯刀具磨损和温度漂移"},{"key":"fqc","label":"终检 FQC：入库前最后一道闸"},{"key":"ncr","label":"判不合格之后：返工 / 让步接收 / 报废，三条路都要留痕"}]}', '["fai","ipqc","fqc","ncr"]', '对。首检最容易被赶工跳过，但它省下的是整批的返工成本 —— 一次装错模具，检出得越晚废得越多。', '按时间轴想：换型后第一件在什么时候？入库前那道在什么时候？处置动作又排在哪？', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'chapter', 9103, '质检判定：判了不合格之后呢', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'quiz', 9203, '实施质检模块时，defect_type（缺陷类型）字段最应该做成什么形式？', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'quiz', 9239, 'quality_checks 表的 result 字段取值通常是？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'quiz', 9240, '一批产品被判不合格（QC 判不合格），优先往哪里追溯根因？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'sql', 9303, '查出这批货为什么被判不合格', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'), 'micro', 9410, '把这四件质量动作按它们在生产过程中的先后顺序排好。', 6);

PRAGMA foreign_keys = ON;