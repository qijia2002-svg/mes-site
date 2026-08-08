-- ============================================================================
-- 种子：工厂主线三个「学习工位」的专属内容（purchase / picking / qc）
-- ----------------------------------------------------------------------------
-- 配套 seed-flowchart-generic.sql（先跑那个建流程图，再跑本文件挂内容）。
--
-- 设计约束（架构师裁定，勿违）：
--   C1  节点完成度只认「做过实战」，知识卡片读完不算完成。
--   C2  node_resources.title 必须是祈使句 —— 「查出这批货为什么被判不合格」，
--       不是「质检知识」。学员看到的是一个动作，不是一个名词。
--   C3  没内容就不出行。绝不用 /sql-space 这类通用兜底链接充数。
--
-- 判题哈希来源：node scripts/gen-answer-hash.mjs --batch tmp/node-sql-items.json
--   三道题的 answer_hash 由 web/src/features/sql-sandbox/dataset.sql 本地复算得出，
--   与前端 web/src/lib/resultHash.ts 同算法。改 dataset.sql 后必须重跑：
--   node scripts/gen-answer-hash.mjs --regress
--
-- 显式 id（9xxx 预留段）的理由：
--   学习进度按 `${type}:${refId}` 落在 userData 的 factory.progress 里。
--   若用 AUTOINCREMENT，每次重跑 seed 章节 id 都会漂移，学员进度会被清零。
--   副作用：sqlite_sequence 会被抬到 9xxx，后续后台新建内容从 9xxx+1 开始。
--   这是有意接受的代价 —— 进度不丢 > id 好看。
--
-- 重跑安全：先按业务键清掉本 seed 管辖的行，再插入。不碰任何别人的数据。
--
-- 部署：
--   node scripts/d1q.mjs --file worker/src/migrations/seed-flowchart-generic-resources.sql --local
--   node scripts/d1q.mjs --file worker/src/migrations/seed-flowchart-generic-resources.sql
-- ============================================================================

PRAGMA foreign_keys = OFF;

DELETE FROM node_resources
 WHERE node_id IN (
   SELECT id FROM flow_nodes
    WHERE flow_id IN (SELECT id FROM flowcharts WHERE slug = 'generic-factory')
      AND node_key IN ('purchase', 'picking', 'qc')
 );
DELETE FROM questions      WHERE id IN (9201, 9202, 9203);
DELETE FROM sql_exercises  WHERE id IN (9301, 9302, 9303);
DELETE FROM chapters       WHERE id IN (9101, 9102, 9103);
DELETE FROM topics         WHERE id = 9001 OR slug = 'factory-mainline';

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 载体主题：status = 'draft'，不进 /courses 列表，只作为节点内容的挂靠容器。
-- 章节本身仍是 published，/chapters/:id 深链可直达（getChapterSvc 只校验章节状态）。
-- ---------------------------------------------------------------------------
INSERT INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at, prerequisites, difficulty, estimated_hours)
VALUES (
  9001,
  'factory-mainline',
  '工厂主线·节点专属内容',
  '挂在工厂全景各节点下的知识卡片与实战题。不作为独立课程出现在课程列表，入口只有工厂全景图。',
  '["theory","sql","quiz"]',
  900,
  'draft',
  strftime('%s','now'), strftime('%s','now'),
  '[]', 'intermediate', 3
);

-- ---------------------------------------------------------------------------
-- 章节 9101 · 采购与供应商
-- ---------------------------------------------------------------------------
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9101, 9001, '采购跟催：料为什么还没到', 1, 'published',
'# 采购跟催：料为什么还没到

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

先把它们揪出来。'
, 1, strftime('%s','now'));

-- ---------------------------------------------------------------------------
-- 章节 9102 · 领料发料
-- ---------------------------------------------------------------------------
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9102, 9001, '领料齐套：差一样，整张工单就趴窝', 2, 'published',
'# 领料齐套：差一样，整张工单就趴窝

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

采购逾期 → 库存没补上 → 领料发不出 → 工单动不了。这条因果链你能一句 SQL 走完，就真的看懂这段流程了。'
, 1, strftime('%s','now'));

-- ---------------------------------------------------------------------------
-- 章节 9103 · 质量检验
-- ---------------------------------------------------------------------------
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
9103, 9001, '质检判定：判了不合格之后呢', 3, 'published',
'# 质检判定：判了不合格之后呢

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

看清楚了再往下追，才不会追错方向。'
, 1, strftime('%s','now'));

-- ---------------------------------------------------------------------------
-- 测验：每节点一题。answer 存选项下标（与既有题库一致）。
-- 考的是「这个环节最容易翻车的点」，不是名词解释。
-- ---------------------------------------------------------------------------
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
(9201, 9101, 'single',
 '采购报表显示按期到货率 96%，车间却天天喊缺料。最可能的原因是什么？',
 '["车间领料单填错了物料编码","报表把短交的采购单算成了按期到货","供应商承诺日期录入时晚填了几天","MRP 运算周期太长导致需求滞后"]',
 '1',
 '短交是最隐蔽的缺料源头：单据状态已经是 received，按期到货率的统计口径通常只看 arrive_date 有没有值，不比对 qty_received 与 qty_order，于是差的那一截数量在报表上完全隐形，一直拖到领料才暴露。判断到货是否真的完成，必须同时看日期和数量两个维度。',
 1, strftime('%s','now')),

(9202, 9102, 'single',
 '一张工单需要 10 种物料，仓库发齐了 9 种。这张工单的齐套状态应该是什么？',
 '["齐套率 90%，可以先开工","未齐套，不能开工","部分齐套，由班组长决定","按发料金额占比折算齐套率"]',
 '1',
 '齐套是一票否决的布尔判断，不是百分比。缺任何一种物料产线都装不出成品，所以齐套只有齐与不齐两种状态。把齐套做成百分比是实施时的经典错误设计 —— 看板会显示一片漂亮的 90%，而实际上一条线都开不起来。',
 1, strftime('%s','now')),

(9203, 9103, 'single',
 '实施质检模块时，defect_type（缺陷类型）字段最应该做成什么形式？',
 '["自由文本，方便现场描述细节","受控下拉，选项由质量部维护","可选填，不强制录入","自动从设备报警码生成"]',
 '1',
 '一旦允许自由文本，同一种缺陷会被写成「尺寸超差」「尺寸不良」「超差」等多种写法，帕累托分析和趋势统计全部失效。受控下拉保证了统计口径统一；确实需要补充细节时，另设一个备注字段，不要污染分类字段。设备报警码只覆盖设备类缺陷，覆盖不了来料和人为缺陷。',
 1, strftime('%s','now'));

-- ---------------------------------------------------------------------------
-- SQL 实战题（判题哈希由 scripts/gen-answer-hash.mjs 从 dataset.sql 本地复算）
--   9301 purchase-overdue  28fb4ec6…  3 行 × 5 列
--   9302 picking-shortage  5ec2b52f…  4 行 × 5 列
--   9303 qc-defect-trace   d4e58db3…  4 行 × 4 列
-- answer_sql 服务端保留、API 永不下发（R6）。dataset_json 是历史死字段，恒为 {}。
-- ---------------------------------------------------------------------------
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES
(9301, 9001,
 '查出哪些采购单已经逾期还没到货',
 '今天是 2026-08-08。采购经理要一份跟催清单：把承诺到货日已经过了、但实际还没到货的采购单全部列出来，并且要看到是哪家供应商、卡的是什么物料、订了多少。

要求输出这几列，顺序照写：采购单号、供应商名称、物料名称、订购数量、承诺到货日。
按承诺到货日从早到晚排 —— 拖最久的排最前面，先催它。

提示：还没到货的判断依据是 arrive_date 为空，注意 SQL 里判空不能用等号。',
 '{}',
 'SELECT p.po_no, s.name AS supplier, m.name AS material, p.qty_order, p.promise_date FROM purchase_orders p JOIN suppliers s ON s.supplier_id = p.supplier_id JOIN materials m ON m.material_id = p.material_id WHERE p.arrive_date IS NULL AND p.promise_date < ''2026-08-08'' ORDER BY p.promise_date;',
 '28fb4ec64cef6ed854ad45ef79f45d73357f793bf128166d7496c5a13c773ca8',
 'purchase_orders(po_id, po_no, supplier_id, material_id, qty_order, qty_received, order_date, promise_date, arrive_date, state)
suppliers(supplier_id, code, name, contact, lead_time_days)
materials(material_id, code, name, unit, stock_qty)',
 1, strftime('%s','now')),

(9302, 9001,
 '找出因为缺料没领全的工单，缺口有多大',
 '车间报了一堆缺料。别听传话，自己查：哪些领料单实发数量小于应发数量，各差多少。

要求输出这几列，顺序照写：工单号、物料名称、应发数量、实发数量、缺口数量（应发减实发）。
按缺口从大到小排，缺得最狠的排最前面。

提示：判断缺料要用数量比大小，不要用 state 字段 —— 状态是人填的会滞后，数量是算出来的不会撒谎。',
 '{}',
 'SELECT w.wo_no, m.name AS material, p.qty_required, p.qty_issued, p.qty_required - p.qty_issued AS shortage FROM pick_lists p JOIN work_orders w ON w.wo_id = p.wo_id JOIN materials m ON m.material_id = p.material_id WHERE p.qty_issued < p.qty_required ORDER BY shortage DESC;',
 '5ec2b52f2b12d452c73fe0bcac72db25d3c60cb47bf552e5a31f999023504f33',
 'pick_lists(pick_id, pick_no, wo_id, material_id, qty_required, qty_issued, pick_time, state)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
materials(material_id, code, name, unit, stock_qty)',
 2, strftime('%s','now')),

(9303, 9001,
 '查出这批货为什么被判不合格',
 '质量例会前十分钟，你需要一张表：所有判定为不合格的质检记录，分别是哪张工单、哪个车间、什么缺陷、什么时候检出的。

要求输出这几列，顺序照写：工单号、车间、缺陷类型、检验时间。
按检验时间从早到晚排，看清楚问题是怎么一天天演变的。

提示：合格记录的 defect_type 是空的，别把它们混进来。',
 '{}',
 'SELECT w.wo_no, w.workshop, q.defect_type, q.check_time FROM quality_checks q JOIN work_orders w ON w.wo_id = q.wo_id WHERE q.result = ''不合格'' ORDER BY q.check_time;',
 'd4e58db3521815efc45976481b94c9ad5c701c64d9867ca7272f5566a696e5f5',
 'quality_checks(check_id, wo_id, check_time, result, defect_type)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)',
 3, strftime('%s','now'));

-- ---------------------------------------------------------------------------
-- 挂载：node_resources
--   node_id 一律用 (slug, node_key) 子查询定位，绝不写死自增 id。
--   title 是祈使句（C2）—— 学员看到的是一个动作，不是一个名词。
--   顺序 = 学习动线：先读懂 → 再动手查 → 最后自测。
--   本批不挂 sim：这三个节点还没有专属仿真场景，
--   宁可少一行，也不放一个跳到通用仿真页的假链接（C3）。
-- ---------------------------------------------------------------------------
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
-- 采购与供应商
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'),
 'chapter', 9101, '先搞懂采购单上哪三个字段会咬人', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'),
 'sql', 9301, '查出哪些采购单已经逾期还没到货', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'),
 'quiz', 9201, '自测：报表说按期到货，车间为什么还缺料', 3),

-- 领料发料
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'),
 'chapter', 9102, '先弄明白应发数量是怎么从 BOM 算出来的', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'),
 'sql', 9302, '找出因为缺料没领全的工单，缺口有多大', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'),
 'quiz', 9202, '自测：十样料齐了九样，算不算齐套', 3),

-- 质量检验
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'chapter', 9103, '先看清判了不合格之后还要做什么', 1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'sql', 9303, '查出这批货为什么被判不合格', 2),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id
   WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),
 'quiz', 9203, '自测：缺陷类型字段该怎么设计', 3);
