-- ============================================================
-- 节点种子：picking（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9102 | 测验 9202,9233,9234 | SQL 9302 | 微练习 9407
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9102;
DELETE FROM questions WHERE id IN (9202, 9233, 9234);
DELETE FROM sql_exercises WHERE id = 9302;
DELETE FROM micro_practices WHERE id = 9407;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking') AND ref_id IN (9102, 9202, 9233, 9234, 9302, 9407) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9102
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9102, 9001, '领料齐套：差一样，整张工单就趴窝', 2, 'published', '# 领料齐套：差一样，整张工单就趴窝

工单下达之后，第一件真实发生的事不是开机，是领料。仓库按工单把料发到线边仓或工位，这一步在 WMS 里叫发料，在车间口语里就叫「领料」。

领料是整条主线上**最诚实的一个环节** —— 前面计划做得多漂亮、采购报表多好看，到这里全部现原形。库里有就是有，没有就是没有。

## 应发数量是算出来的，不是拍出来的

一张领料单的应发量，来自 BOM 的三个数：

```
应发量 = 单件用量(qty_per) × 工单计划量(qty_plan) × (1 + 损耗率(loss_rate))
```

样例库里 12 行领料单，每一行的 `qty_required` 都严格等于这个式子四舍五入的结果。你可以自己反算验证 —— 这不是编的数字，是能对上账的。

损耗率这一项经常被新人忽略。做 200 台减速机要 200 个铸铁箱体？不对，要 204 个。2% 的损耗是冲压废品、装配划伤、来料不良吃掉的。**BOM 里不设损耗率，仓库就永远差那么一点点，然后天天补单。**

## 齐套 = 一票否决

判断一张工单能不能开工，看的不是「领了多少」，是「有没有一样没领全」。这就是齐套（Kitting）：

> 十样料齐了九样，齐套率不是 90%，是 0。

所以现场看板上的齐套状态只有两色。半齐套等于没齐套，因为线一样开不起来。

## 缺料怎么在数据里现形

| 情况 | 数据特征 | state |
|---|---|---|
| 正常发齐 | `qty_issued = qty_required` | `done` |
| 部分发料 | `qty_issued < qty_required` 且大于 0 | `partial` |
| 完全没发 | `qty_issued = 0` | `pending` |

注意别只看 `state` 字段。状态是人维护的，会滞后、会填错；`qty_issued < qty_required` 是算出来的，不会撒谎。**排查缺料永远用数量比大小，不要用状态字段。** 这条经验能省掉很多个加班的晚上。

## 顺藤摸瓜

样例库里有 4 行缺料。其中两行卡的物料，正是上一个节点里那几张逾期未到的采购单锁住的东西。

采购逾期 → 库存没补上 → 领料发不出 → 工单动不了。这条因果链你能一句 SQL 走完，就真的看懂这段流程了。', 1, strftime('%s','now'));

-- 测验 9202,9233,9234（9202=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9202, 9102, 'single', '一张工单需要 10 种物料，仓库发齐了 9 种。这张工单的齐套状态应该是什么？', '["齐套率 90%，可以先开工","未齐套，不能开工","部分齐套，由班组长决定","按发料金额占比折算齐套率"]', '1', '齐套是一票否决的布尔判断，不是百分比。缺任何一种物料产线都装不出成品，所以齐套只有齐与不齐两种状态。把齐套做成百分比是实施时的经典错误设计 —— 看板会显示一片漂亮的 90%，而实际上一条线都开不起来。', 1, strftime('%s','now')),
  (9233, 9102, 'single', 'pick_lists 中 qty_pick < qty_req 表示什么？', '["领料超额","缺料，实领少于需求","物料已齐套","工单已取消"]', '1', '实领小于需求=缺料，缺口 = qty_req − qty_pick。领料齐套是开工前置条件。', 2, strftime('%s','now')),
  (9234, 9102, 'single', '工单能够领料的前提是什么？', '["客户已付款","工单已 released 且关键物料齐套","质量检验已通过","发货已完成"]', '1', '领料面向已下达(released)工单，且依赖采购到货齐套；否则就会出现缺料缺口。', 3, strftime('%s','now'));

-- SQL 练习 9302（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9302, 9001, '找出因为缺料没领全的工单，缺口有多大', '车间报了一堆缺料。别听传话，自己查：哪些领料单实发数量小于应发数量，各差多少。

要求输出这几列，顺序照写：工单号、物料名称、应发数量、实发数量、缺口数量（应发减实发）。
按缺口从大到小排，缺得最狠的排最前面。

提示：判断缺料要用数量比大小，不要用 state 字段 —— 状态是人填的会滞后，数量是算出来的不会撒谎。', '{}', 'SELECT w.wo_no, m.name AS material, p.qty_required, p.qty_issued, p.qty_required - p.qty_issued AS shortage FROM pick_lists p JOIN work_orders w ON w.wo_id = p.wo_id JOIN materials m ON m.material_id = p.material_id WHERE p.qty_issued < p.qty_required ORDER BY shortage DESC;', '5ec2b52f2b12d452c73fe0bcac72db25d3c60cb47bf552e5a31f999023504f33', 'pick_lists(pick_id, pick_no, wo_id, material_id, qty_required, qty_issued, pick_time, state)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
materials(material_id, code, name, unit, stock_qty)', 2, strftime('%s','now'));

-- 微练习 9407（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9407, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'pick', 'WO-20260801-02 要 62 件定子组件，仓库只发出 40 件（PK-20260804-01），另外两样料都发齐了。这张工单现在算什么状态？', '{"multi":false,"options":[{"key":"partial-ok","label":"齐套率 65%，可以先开工，边做边补"},{"key":"not-kitted","label":"未齐套，这张工单开不了"},{"key":"by-leader","label":"部分齐套，由班组长决定开不开"},{"key":"by-amount","label":"按发料金额占比折算齐套率"}]}', '["not-kitted"]', '对。齐套是一票否决：十样料齐了九样，齐套率不是 90%，是 0。差 22 件定子组件，线就是装不出成品。', '想想产线现场：少了一种料，机器能不能转起来？齐套到底是百分比还是是非题？', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'chapter', 9102, '领料齐套：差一样，整张工单就趴窝', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'quiz', 9202, '一张工单需要 10 种物料，仓库发齐了 9 种。这张工单的齐套状态应该是什么', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'quiz', 9233, 'pick_lists 中 qty_pick < qty_req 表示什么？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'quiz', 9234, '工单能够领料的前提是什么？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'sql', 9302, '找出因为缺料没领全的工单，缺口有多大', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'), 'micro', 9407, 'WO-20260801-02 要 62 件定子组件，仓库只发出 40 件（P', 6);

PRAGMA foreign_keys = ON;