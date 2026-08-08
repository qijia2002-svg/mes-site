-- ============================================================================
-- 种子：零基础重学重构 v1 内容（6 站 + 一句话 + 微练习 + 分级提示）
-- ----------------------------------------------------------------------------
-- 依据：docs/SPEC-LearnRedesign-v1.md §6（映射与 flow_stages 6 行已锁定）
-- 前置：先跑 schema-learn-redesign.sql（建表）
--       再跑 migration-learn-redesign-alter.sql（增列，只跑一次）
--       最后跑本文件；讲解（node_explainers）在配套文件
--       seed-learn-redesign-explainers.sql，两个文件都要跑。
--
-- 部署：
--   node scripts/d1q.mjs --file worker/src/migrations/seed-learn-redesign-content.sql --local
--   node scripts/d1q.mjs --file worker/src/migrations/seed-learn-redesign-content.sql
--
-- 设计约束（勿违）：
--   S1  数据全部取自 web/src/features/sql-sandbox/dataset.sql 的真实记录，
--       单号、数量、日期都能在样例库里查到。禁止编造单号。
--   S2  不写生活化比喻（ADR-021）。具象化靠真实数据例子与「车间动作 ↔ 系统记录」对照。
--   S3  micro_practices.answer 是服务端机密，列表接口永不下发；payload 里不得含答案。
--   S4  显式 id（9xxx 段）：学习进度按 `${type}:${refId}` 落 userData，
--       用 AUTOINCREMENT 会让重跑 seed 时 id 漂移，学员进度被清零。
--       micro 用 9401-9499，explainer 用 9501-9599。
--   S5  本文件**不往 node_resources 插 res_type='micro' 的行**。
--       原因：node_resources 是完成度分母来源，micro 一旦进分母，
--       前端还没有渲染/完成 micro 的路径时，节点会永远不完成（BLOCK-01 同款事故）。
--       前端 micro 交互上线后，由前端负责人确认时机再单独出一份挂载种子。
--   S6  重跑安全：先按显式 id 段与业务键清行再插入，不碰别人的数据。
--
-- D1 Free 约束：本文件写入 6 + 18 + 12 + 12 = 48 行量级，远低于每日 10 万行。
-- ============================================================================

PRAGMA foreign_keys = OFF;

DELETE FROM flow_stages
 WHERE flow_id IN (SELECT id FROM flowcharts WHERE slug = 'generic-factory');
DELETE FROM micro_practices WHERE id BETWEEN 9401 AND 9499;
DELETE FROM practice_hints  WHERE target_type = 'micro' AND target_id BETWEEN 9401 AND 9499;
DELETE FROM practice_hints  WHERE target_type = 'quiz'  AND target_id IN (9202, 9204);
DELETE FROM practice_hints  WHERE target_type = 'sql'   AND target_id IN (9301, 9302);

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- a) flow_stages —— 6 站主线（SPEC §6 表，逐字照抄；goal 为本次撰写）
-- ---------------------------------------------------------------------------
-- BLOCK-02：入门段（tour + plan，共 4 节点）practice_types 只有 micro + quiz，
-- SQL 不计入完成度分母 —— 12 个节点每个都挂了 sql，不限定的话第一站就撞最硬门槛。
-- 其余四段恢复全集。practice_types 存 JSON 字符串，值域必须是
-- PRACTICE_TYPES = {quiz, sql, sim, micro} 的子集。
-- goal 写「学完能做到什么」，指向样例库里查得到的具体动作。
INSERT INTO flow_stages (flow_id, stage_key, title, subtitle, goal, icon, practice_types, sort) VALUES
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'tour', '先走一圈', '用一张订单，把工厂全貌看一遍',
 '能指着流程图说出 SO-20260725-01 这张单从进厂到发货要经过哪几个环节、每个环节归谁管。', 'compass',
 '["micro","quiz"]', 1),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'plan', '计划订单', '这张单怎么变成可生产的计划',
 '能说清一张已评审通过的订单为什么迟迟没排产，并在 sales_orders 里把这类单挑出来。', 'clipboard-check',
 '["micro","quiz"]', 2),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'procure', '采购齐套', '物料怎么买齐、怎么验收入库',
 '能自己查出哪些采购单逾期未到、哪些是到货但短交，不依赖采购报表给的口径。', 'truck',
 '["micro","quiz","sql","sim"]', 3),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'produce', '生产工单', '计划怎么下到产线、怎么报工',
 '能从工单查到报工记录，说出 WO-20260801-02 计划 60 台为什么只完成了 40 台。', 'factory',
 '["micro","quiz","sql","sim"]', 4),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'quality', '质量检验', '怎么做首检巡检、怎么追溯',
 '能从一条不合格记录顺着工单追到车间、设备和当班操作工。', 'check-circle',
 '["micro","quiz","sql","sim"]', 5),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'ship', '仓储发运', '成品怎么入库、怎么发到客户手上',
 '能查出哪一批发货晚于交期、哪张订单整单还没发，并说出入库前该核对哪两个数。', 'log-out',
 '["micro","quiz","sql","sim"]', 6);

-- ---------------------------------------------------------------------------
-- b) 12 个节点回填 stage_key + one_liner（SPEC §6 映射表）
-- ---------------------------------------------------------------------------
-- stage_key 按站分组批量更新；one_liner 逐节点更新（文案各不相同）。
-- 全部用 flow_id 子查询限定 generic-factory，不影响用户自建的其他流程图。
UPDATE flow_nodes SET stage_key = 'tour'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
   AND node_key IN ('cust-order');
UPDATE flow_nodes SET stage_key = 'plan'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
   AND node_key IN ('order-review', 'mps', 'mrp');
UPDATE flow_nodes SET stage_key = 'procure'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
   AND node_key IN ('purchase', 'bom-route');
UPDATE flow_nodes SET stage_key = 'produce'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
   AND node_key IN ('picking', 'dispatch', 'shopfloor');
UPDATE flow_nodes SET stage_key = 'quality'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
   AND node_key IN ('qc');
UPDATE flow_nodes SET stage_key = 'ship'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
   AND node_key IN ('stock-in', 'shipping');

UPDATE flow_nodes SET one_liner = '一张订单进厂：客户要什么、多少、何时要'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'cust-order';
UPDATE flow_nodes SET one_liner = '评审交期、产能、物料齐套，决定接不接这单'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'order-review';
UPDATE flow_nodes SET one_liner = '把订单排成可执行的月度/周生产计划（MPS）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'mps';
UPDATE flow_nodes SET one_liner = '按 BOM 展开，算出自制/外购物料的需求量与时间'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'mrp';
UPDATE flow_nodes SET one_liner = '下采购单、跟供应商交期、到货与进料检（IQC）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'purchase';
UPDATE flow_nodes SET one_liner = '定 BOM 与工艺路线，驱动齐套'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'bom-route';
UPDATE flow_nodes SET one_liner = '仓储按工单发料到线边仓（WMS）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'picking';
UPDATE flow_nodes SET one_liner = '把生产指令下到产线（MES 工单）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'dispatch';
UPDATE flow_nodes SET one_liner = '工序加工、报工、在制品跟踪（MES）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'shopfloor';
UPDATE flow_nodes SET one_liner = '首检/巡检/终检，质量追溯（QMS）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'qc';
UPDATE flow_nodes SET one_liner = '成品入库，更新库存（WMS）'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'stock-in';
UPDATE flow_nodes SET one_liner = '拣货、装车、物流交付客户'
 WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory') AND node_key = 'shipping';

-- ---------------------------------------------------------------------------
-- c) micro_practices —— 12 站各 1 条（SQL 前面垫的那级台阶）
-- ---------------------------------------------------------------------------
-- payload / answer 的 JSON 形状约定（前端与判分服务共用，改动需同步 learn.service.ts）：
--   pick   payload {"multi":bool,"options":[{"key","label"}]}   answer ["key", ...]（与顺序无关）
--   order  payload {"items":[{"key","label"}]}（前端打乱后展示）  answer ["key1","key2",...]（严格按顺序）
--   match  payload {"left":[{"key","label"}],"right":[{"key","label"}]}
--          answer ["leftKey=>rightKey", ...]（与顺序无关）
-- payload 里绝不出现答案标记；answer 只留服务端，GET 列表接口不下发（S3）。
-- feedback_ok 讲清楚「为什么对」，feedback_bad 只给方向，具体台阶走 practice_hints。
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES
(9401, (SELECT id FROM flow_nodes WHERE node_key='cust-order' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', '今天是 2026-08-08。下面四张销售订单，哪几张属于「还没评审、交期却已经逼近」的急单？',
 '{"multi":true,"options":[{"key":"SO-20260807-01","label":"SO-20260807-01 · 交期 2026-08-12 · 未评审"},{"key":"SO-20260808-01","label":"SO-20260808-01 · 交期 2026-08-13 · 未评审"},{"key":"SO-20260725-01","label":"SO-20260725-01 · 交期 2026-08-15 · 已评审"},{"key":"SO-20260728-01","label":"SO-20260728-01 · 交期 2026-08-20 · 已评审"}]}',
 '["SO-20260807-01","SO-20260808-01"]',
 '对。急单要两个字段同时成立：review_status 还是 pending，due_date 又已经逼近。只看交期会把已经评审过的正常单也算进来。',
 '再看一眼两个字段：review_status 和 due_date。已经评审过的不算急单，交期还有半个月的也不算。', 1),

(9402, (SELECT id FROM flow_nodes WHERE node_key='order-review' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', '哪几张订单已经评审通过，却还挂在那里没排产？',
 '{"multi":true,"options":[{"key":"SO-20260728-01","label":"SO-20260728-01 · 评审 approved · 排产 none"},{"key":"SO-20260802-01","label":"SO-20260802-01 · 评审 approved · 排产 none"},{"key":"SO-20260725-01","label":"SO-20260725-01 · 评审 approved · 排产 planned"},{"key":"SO-20260803-01","label":"SO-20260803-01 · 评审 rejected · 排产 none"}]}',
 '["SO-20260728-01","SO-20260802-01"]',
 '对。approved 加 none 才是「接了没排」。已经 planned 的在计划里，rejected 的根本没接，都不算漏排。',
 '两个字段一起看：review_status 要是 approved，plan_status 要是 none。少看一个就会捞错单。', 1),

(9403, (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'order', '把主生产计划的四步按实际先后顺序排好。',
 '{"items":[{"key":"so-agg","label":"汇总已评审订单，按产品算出总需求量"},{"key":"capacity","label":"对着产能和交期，摊到每周该产出多少"},{"key":"freeze","label":"冻结近期计划，不再随便改"},{"key":"wo","label":"按冻结后的计划下达生产工单"}]}',
 '["so-agg","capacity","freeze","wo"]',
 '对。MPS 的顺序是先算需求、再看产能、然后冻结、最后才下工单。冻结这一步最容易被跳过，跳了车间就天天改计划。',
 '想一想：产能还没看，能先下工单吗？计划还没冻结，工单下去改不改？', 1),

(9404, (SELECT id FROM flow_nodes WHERE node_key='mrp' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'match', 'WO-20260801-02 要做 60 台伺服电机，定子组件的应发量算出来是 62 件。把式子里的每个数字连到它的名字上。',
 '{"left":[{"key":"n60","label":"60"},{"key":"n1","label":"1"},{"key":"n003","label":"0.03"},{"key":"n62","label":"62"}],"right":[{"key":"qty-plan","label":"工单计划量 qty_plan"},{"key":"qty-per","label":"单件用量 qty_per"},{"key":"loss","label":"损耗率 loss_rate"},{"key":"required","label":"应发量 qty_required"}]}',
 '["n60=>qty-plan","n1=>qty-per","n003=>loss","n62=>required"]',
 '对。应发量 = 单件用量 × 计划量 × (1 + 损耗率)，60 × 1 × 1.03 = 61.8，四舍五入 62。样例库 12 行领料单每一行都能这样反算出来。',
 '把 60 × 1 × (1 + 0.03) 算一遍，看结果落在哪个数上，剩下三个就好对了。', 1),

(9405, (SELECT id FROM flow_nodes WHERE node_key='purchase' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', '今天是 2026-08-08。下面五张采购单，哪几张是「逾期未到、要马上跟催」的？',
 '{"multi":true,"options":[{"key":"PO-20260715-01","label":"PO-20260715-01 · 承诺 2026-08-04 · 未到货"},{"key":"PO-20260725-01","label":"PO-20260725-01 · 承诺 2026-08-06 · 未到货"},{"key":"PO-20260802-01","label":"PO-20260802-01 · 承诺 2026-08-07 · 未到货"},{"key":"PO-20260722-01","label":"PO-20260722-01 · 承诺 2026-08-11 · 未到货"},{"key":"PO-20260718-01","label":"PO-20260718-01 · 已到货 · 订 200 收 120"}]}',
 '["PO-20260715-01","PO-20260725-01","PO-20260802-01"]',
 '对。逾期未到 = 承诺日已经过了 且 arrive_date 还是空。承诺 08-11 那张还在途，不算逾期；订 200 收 120 那张是短交，是另一种病，要单独盯。',
 '两个条件缺一不可：承诺日期过了没？货到了没？还没到承诺日的、已经到货的，都不在这份跟催清单里。', 1),

(9406, (SELECT id FROM flow_nodes WHERE node_key='bom-route' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'match', '把四个产品连到它 BOM 里用量最大的那种物料上。',
 '{"left":[{"key":"P-1001","label":"减速机 XJ-200"},{"key":"P-1002","label":"伺服电机 SM-80"},{"key":"P-1003","label":"PLC控制器 FX-3U"},{"key":"P-1004","label":"变频器 VF-15K"}],"right":[{"key":"m-bearing","label":"轴承 4 套/台"},{"key":"m-stator","label":"定子组件 1 件/台"},{"key":"m-terminal-12","label":"接线端子 12 个/台"},{"key":"m-terminal-8","label":"接线端子 8 个/台"}]}',
 '["P-1001=>m-bearing","P-1002=>m-stator","P-1003=>m-terminal-12","P-1004=>m-terminal-8"]',
 '对。同一种接线端子，PLC 用 12 个、变频器用 8 个 —— 共用料的用量各产品不同，这就是为什么净需求必须按 BOM 逐产品展开，不能拍脑袋汇总。',
 '注意接线端子在两个产品里都出现，但每台用量不一样。先把用量数字对上，再对产品。', 1),

(9407, (SELECT id FROM flow_nodes WHERE node_key='picking' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', 'WO-20260801-02 要 62 件定子组件，仓库只发出 40 件（PK-20260804-01），另外两样料都发齐了。这张工单现在算什么状态？',
 '{"multi":false,"options":[{"key":"partial-ok","label":"齐套率 65%，可以先开工，边做边补"},{"key":"not-kitted","label":"未齐套，这张工单开不了"},{"key":"by-leader","label":"部分齐套，由班组长决定开不开"},{"key":"by-amount","label":"按发料金额占比折算齐套率"}]}',
 '["not-kitted"]',
 '对。齐套是一票否决：十样料齐了九样，齐套率不是 90%，是 0。差 22 件定子组件，线就是装不出成品。',
 '想想产线现场：少了一种料，机器能不能转起来？齐套到底是百分比还是是非题？', 1),

(9408, (SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', 'WO-20260808-01 状态已经是 released、车间填的是二号车间，却始终派不下去。最可能卡在哪？',
 '{"multi":false,"options":[{"key":"eq-down","label":"二号车间唯一的设备 EQ-02 处于停机状态"},{"key":"no-review","label":"工单还没经过评审"},{"key":"due-far","label":"交期 2026-08-19 还早，系统故意压着"},{"key":"mat-ok","label":"物料已经发齐，不需要派工"}]}',
 '["eq-down"]',
 '对。released 只是「计划下达了」，能不能真正开工还要看车间有没有可用设备。二号车间只有 EQ-02 一台，它停机，工单就悬在那里。',
 '派工要落到具体设备上。先查一下这个车间有几台设备、状态分别是什么。', 1),

(9409, (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'order', '工人在工位上做完一批，MES 里这四件事按什么顺序发生？',
 '{"items":[{"key":"scan","label":"扫工单条码，确认在给哪张工单报工"},{"key":"input","label":"录入这一批的合格数与不良数"},{"key":"submit","label":"提交，production_records 多出一行"},{"key":"rollup","label":"work_orders.qty_done 按报工累加"}]}',
 '["scan","input","submit","rollup"]',
 '对。报工的本质就是往 production_records 写一行，工单上的完工数是它累加出来的结果，不是人手填的。',
 '先想清楚哪一步在往表里写行、哪一步是写完之后自动算的。', 1),

(9410, (SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'order', '把这四件质量动作按它们在生产过程中的先后顺序排好。',
 '{"items":[{"key":"fai","label":"首检 FAI：换型后第一件，确认参数模具没装错"},{"key":"ipqc","label":"巡检 IPQC：过程中定时抽，盯刀具磨损和温度漂移"},{"key":"fqc","label":"终检 FQC：入库前最后一道闸"},{"key":"ncr","label":"判不合格之后：返工 / 让步接收 / 报废，三条路都要留痕"}]}',
 '["fai","ipqc","fqc","ncr"]',
 '对。首检最容易被赶工跳过，但它省下的是整批的返工成本 —— 一次装错模具，检出得越晚废得越多。',
 '按时间轴想：换型后第一件在什么时候？入库前那道在什么时候？处置动作又排在哪？', 1),

(9411, (SELECT id FROM flow_nodes WHERE node_key='stock-in' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', 'WO-20260801-02 的报工记录合格数合计是 45，工单上的 qty_done 却是 40。现在要办入库，按哪个数？',
 '{"multi":false,"options":[{"key":"by-45","label":"按报工的 45 入库，报工最贴近现场"},{"key":"by-40","label":"按工单的 40 入库，工单是主数据"},{"key":"investigate","label":"先查清这 5 台差在哪，查明白再入库"},{"key":"by-avg","label":"取两者平均，先把库存做平"}]}',
 '["investigate"]',
 '对。两个数对不上，说明中间少了一笔账 —— 可能是漏报、返工、或者报工记录没滚进工单。这时候入库，等于把错账带进库存，后面盘点全乱。这就是这条主线最后一课要拆的那个病灶。',
 '先别急着选一个数。想想：这两个数为什么会不一样？入库之后还查得回来吗？', 1),

(9412, (SELECT id FROM flow_nodes WHERE node_key='shipping' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'pick', 'SO-20260725-01 的 60 台伺服电机分两批发。哪一批出了问题？',
 '{"multi":false,"options":[{"key":"SH-02-1","label":"SH-02-1 · 30 台 · 交期 2026-08-13 · 实发 2026-08-12"},{"key":"SH-02-2","label":"SH-02-2 · 30 台 · 交期 2026-08-15 · 实发 2026-08-18"},{"key":"both-ok","label":"两批都在交期内，没问题"},{"key":"none-ship","label":"两批都还没发出去"}]}',
 '["SH-02-2"]',
 '对。尾批晚了三天。整单的交付准时率不看首批看尾批 —— 客户拿不齐 60 台，这单就是逾期，前面那批发得再准也不顶用。',
 '把每一批的交期和实际发运日期一行行比。分批发货，问题几乎都出在最后一批。', 1);

-- ---------------------------------------------------------------------------
-- e) practice_hints —— 答错之后的台阶（按需单条下发，ADR-019）
-- ---------------------------------------------------------------------------
-- L1 指方向 / L2 给关键点 / L3 给做法。
-- 【L3 铁律】不得写出可直接提交的完整答案：
--   sql 的 L3 只说清用哪些条件和哪几张表关联，不给可复制运行的 SELECT 语句；
--   micro / quiz 的 L3 不点破最终选项，只把判据摆到眼前。
-- 不给 sim 配提示：当前 12 个节点没有任何 sim 挂载（内容侧 C3：没内容不出行），
-- 配了就是查不到目标的幽灵提示。
INSERT INTO practice_hints (target_type, target_id, level, body_md) VALUES
('micro', 9401, 1, '判断急单要同时看两个字段，只看交期不够。'),
('micro', 9401, 2, '一个字段是 `review_status`（pending 才是没评审），另一个是 `due_date`（离今天 2026-08-08 还有几天）。'),
('micro', 9405, 1, '「逾期」和「没到货」是两个条件，要同时成立。'),
('micro', 9405, 2, '承诺日 `promise_date` 早于今天 2026-08-08 是第一条；`arrive_date` 还是空是第二条。到货了但数量不足属于短交，是另一类问题。'),
('micro', 9407, 1, '先想清楚齐套到底是百分比，还是是非题。'),
('micro', 9407, 2, '产线要装出成品，需要的每一样料都得到位。差 22 件定子组件，机器转不起来 —— 这种情况下「65%」这个数字对现场有任何意义吗？'),
('quiz', 9202, 1, '别按发了几种料去算比例，先问这条线到底开不开得起来。'),
('quiz', 9202, 2, '齐套在系统里是一个布尔判断，看板上只有两种颜色。把它做成百分比是实施时的经典错误设计。'),
('sql', 9301, 1, '要找的是「承诺日已经过了，货却还没到」的采购单，两个条件用 AND 连。'),
('sql', 9301, 2, 'SQL 里判空不能用 `= NULL`，要用 `IS NULL`。今天按 2026-08-08 算，承诺日拿来和它比大小。'),
('sql', 9301, 3, '三张表关联：`purchase_orders` 分别按 `supplier_id` 接 `suppliers`、按 `material_id` 接 `materials`。输出列按题目给的顺序写，最后按承诺日升序排，拖最久的排最前面。'),
('sql', 9302, 1, '缺料要用数量比大小，别去看 `state` 字段 —— 状态是人填的会滞后。'),
('sql', 9302, 2, '筛选条件是实发小于应发；缺口是应发减实发，需要在 SELECT 里算出来并起个别名。'),
('sql', 9302, 3, '`pick_lists` 按 `wo_id` 接 `work_orders` 拿工单号，按 `material_id` 接 `materials` 拿物料名。排序直接用缺口那个别名，降序。');

-- ---------------------------------------------------------------------------
-- f) 部署后断言（人工 / CI 校验，全部必须为 0 行）
-- ---------------------------------------------------------------------------
-- 断言 1（BLOCK-04 上线门禁，最关键）—— 不允许任何节点没分配阶段：
--   SELECT id, node_key FROM flow_nodes WHERE stage_key = '';
--
-- 断言 2（内容铁律 1）—— 例题不得等于答案：
--   SELECT id FROM sql_exercises WHERE worked_sql <> '' AND worked_sql = answer_sql;
--
-- 断言 3 —— 节点的 stage_key 必须在 flow_stages 里存在（不允许打错字造出野阶段）：
--   SELECT n.node_key, n.stage_key FROM flow_nodes n
--    WHERE n.flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
--      AND n.stage_key NOT IN (SELECT stage_key FROM flow_stages
--                               WHERE flow_id = n.flow_id);
--
-- 断言 4 —— 微练习的 answer 不得为空数组（空答案会让任何提交都判错）：
--   SELECT id FROM micro_practices WHERE answer IN ('', '[]');
--
-- 断言 5 —— payload 里不得混进 answer 字段（防内容侧手滑把答案写进题面）：
--   SELECT id FROM micro_practices WHERE payload LIKE '%"answer"%';
--
-- 计数核对（不是 0 行断言，是期望值）：
--   SELECT COUNT(*) FROM flow_stages
--    WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory');   -- 期望 6
--   SELECT COUNT(*) FROM micro_practices WHERE id BETWEEN 9401 AND 9499;          -- 期望 12
--   SELECT COUNT(DISTINCT stage_key) FROM flow_nodes
--    WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory');   -- 期望 6
