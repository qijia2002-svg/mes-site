-- ============================================================================
-- 种子：分层讲解 node_explainers（进阶详解，detail 层级）
-- ----------------------------------------------------------------------------
-- 配套：seed-learn-redesign-content.sql（微练习 / 分级提示 / 阶段 / 节点回填）。
-- 前置：schema-learn-redesign.sql 已建 node_explainers 表。
--
-- 消费方（前端）：NodeDrawerBody 的 DeepDive 折叠区在展开时懒加载
--   GET /api/v1/node-explainers?node_id=<n>&tier=detail
-- 因此本文件只填 tier='detail'（首屏「知识卡」由前端 beginnerPath.data.ts
-- 本地提供，不依赖本表）。overview 层级留待抽屉重构消费时再补。
--
-- 设计约束（勿违）：
--   E1  数据全部来自 web/src/features/sql-sandbox/dataset.sql 的真实记录，
--       单号 / 数量 / 日期 / 状态都能在样例库里查到。禁止编造。
--   E2  不写生活化比喻（ADR-021）：具象化靠真实数据例子 +
--       「车间动作 ↔ 系统记录」对照，两边都是真实存在的东西。
--   E3  icon 存 Icon.tsx 语义名（sql / quiz / success / warn / error / info /
--       mapping / example / chevron-* / check-circle / deep-dive），禁 emoji。
--   E4  显式 id（9501-9599 段）：本表 id 走 AUTOINCREMENT，但重跑 seed 时若
--       让 DB 自增会漂移，造成前端按 id 缓存 / 去重逻辑混乱。
--       先按显式 id 段清行再插入，保证可重跑且 id 稳定。
--   E5  body_md 是 Markdown，前端经 markdown-it(html:false) + DOMPurify 渲染。
--       正文内不得出现 ASCII 单引号（会破坏 SQL 字符串字面量），
--       代码词用反引号，中文用「」或『』。
--
-- D1 Free 约束：本文件写入 24 行，远低于每日 10 万行配额。
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- 重跑安全：清掉这 12 个节点的既有讲解，再插入；不碰别的节点。
DELETE FROM node_explainers
 WHERE node_id IN (
   SELECT id FROM flow_nodes
    WHERE flow_id = (SELECT id FROM flowcharts WHERE slug='generic-factory')
      AND node_key IN (
        'cust-order','order-review','mps','mrp','purchase','bom-route',
        'picking','dispatch','shopfloor','qc','stock-in','shipping'
      )
 );

PRAGMA foreign_keys = ON;

-- 通用子查询（每个节点一句，便于核对归属）：
--   (SELECT id FROM flow_nodes
--     WHERE node_key='<key>'
--       AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory'))

INSERT INTO node_explainers (id, node_id, tier, kind, title, body_md, icon, sort) VALUES

-- ---------------------------------------------------------------------------
-- 1) cust-order · 客户订单
-- ---------------------------------------------------------------------------
(9501, (SELECT id FROM flow_nodes WHERE node_key='cust-order'  AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '顺着一张单看它变成工单',
 '样例库里 `WO-20260801-02`：产品 2（伺服电机）、计划 60 台、交期 `2026-08-12`、二号车间、状态 `running`。\n\n'
 || '把状态过滤一下就很清楚：\n'
 || '- `released` = 已下达车间、还没动手（如 `WO-20260801-01`）\n'
 || '- `running` = 正在做（如 `WO-20260801-02`，`qty_done` 40 / `qty_plan` 60，做到一半）\n'
 || '- `finished` = 做完了\n\n'
 || '今天（2026-08-08）这张单还在 `running`，说明它已经从「客户要什么」变成「车间正在造什么」。', 'example', 1),

(9502, (SELECT id FROM flow_nodes WHERE node_key='cust-order'  AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', '查进度用 wo_no，别用 so_no',
 '几个最容易绊倒新人的点，逐个确认：\n\n'
 || '1. 一张销售订单常拆成多张工单分批投产，所以**查生产进度永远查工单号 `wo_no`**，不是销售单号 `so_no`。\n'
 || '2. `work_orders.state` 有五个值，是一条单行道：`created` → `released` → `running` → `finished` → `closed`，没有「暂停」「返工」这种中间态。\n'
 || '3. `qty_done` 是报工累加出来的，不是人手填的——它和 `qty_plan` 的差，就是还差多少台。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 2) order-review · 订单评审
-- ---------------------------------------------------------------------------
(9503, (SELECT id FROM flow_nodes WHERE node_key='order-review' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '已通过评审却还没排产的漏网单',
 '样例库里四张单 `review_status` 都是 `approved`、`plan_status` 都是 `none`：\n\n'
 || '- `SO-20260728-01` 交期 2026-08-20\n'
 || '- `SO-20260802-01` 交期 2026-08-22\n'
 || '- `SO-20260805-01` 交期 2026-08-30\n'
 || '- `SO-20260806-01` 交期 2026-08-14（最紧，最该先排）\n\n'
 || '它们都「接了没排」。其中 `SO-20260806-01` 交期已经很近，是漏排清单里最该优先处理的。', 'example', 1),

(9504, (SELECT id FROM flow_nodes WHERE node_key='order-review' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', 'rejected 不算漏排',
 '筛选「接了没排」要两个字段**同时**成立：`review_status = approved` 且 `plan_status = none`。\n\n'
 || '少看一个就会捞错：\n'
 || '- `SO-20260803-01` 是 `rejected`（评审没过，根本没接），不算漏排；\n'
 || '- 已经 `planned` / `producing` 的单已经在计划里，也不算。\n\n'
 || '只有 approved + none，才是真的「接了却没排下去」。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 3) mps · 主生产计划
-- ---------------------------------------------------------------------------
(9505, (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '同一产品的两张单要合并算',
 '产品 1（减速机）挂着两张工单：`WO-20260801-01` 计划 120 台、`WO-20260802-01` 计划 200 台。\n\n'
 || 'MPS 看的是**产品 1 合计 320 台**，不是「两张单」。这就是 `GROUP BY product_id` 再 `SUM(qty_plan)` 的业务含义——按产品归堆，而不是数工单张数。', 'example', 1),

(9506, (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'mapping', '计划员的「产量」就是工单的「数量之和」',
 '同一个数字在两层系统里的名字不一样：\n\n'
 || '- 计划员说的「产品 1 这周要产 320 台」\n'
 || '  ↔ `work_orders` 里 `product_id = 1` 的各行 `qty_plan` 之和\n'
 || '- 车间实际执行时，又把这 320 台拆回 `WO-20260801-01`（120）和 `WO-20260802-01`（200）两张工单去排。\n\n'
 || 'MPS 定的是产品级产量，派工才落到具体工单。', 'mapping', 2),

-- ---------------------------------------------------------------------------
-- 4) mrp · 物料需求计划
-- ---------------------------------------------------------------------------
(9507, (SELECT id FROM flow_nodes WHERE node_key='mrp' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '应发量就是这么算出来的',
 '算产品 1 的铸铁箱体应发量：BOM 里 `qty_per = 1`、`loss_rate = 0.02`，工单 `WO-20260801-01` 计划 120 台。\n\n'
 || '应发 = `ROUND(1 × 120 × 1.02)` = **122**。\n\n'
 || '打开 `pick_lists`，`PK-20260803-01` 的 `qty_required` 正好是 122——系统给这张工单备料，用的就是这个公式。自己用 BOM 反算一遍，能验证每一行领料单对不对。', 'example', 1),

(9508, (SELECT id FROM flow_nodes WHERE node_key='mrp' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', 'BOM 错一位，全厂跟着错',
 'MRP 本身只是乘除法，它**不会验证 BOM 对不对**。\n\n'
 || '`bom.qty_per` 填错一位、或 `loss_rate` 多写一个零，算出的采购量就跟着错：采购照着错的量下单、仓库照着错的量发料——**全程没人会察觉**，直到产线缺件才暴露。\n\n'
 || '所以查 MRP 的问题，先查 BOM，再查计算。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 5) purchase · 采购齐套
-- ---------------------------------------------------------------------------
(9509, (SELECT id FROM flow_nodes WHERE node_key='purchase' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '今天（2026-08-08）的跟催清单',
 '`arrive_date` 为空、`promise_date` 已过的，就是**逾期未到**：\n\n'
 || '- `PO-20260715-01` 承诺 08-04，未到\n'
 || '- `PO-20260725-01` 承诺 08-06，未到\n'
 || '- `PO-20260802-01` 承诺 08-07，未到\n\n'
 || '`PO-20260722-01` 承诺 08-11 还没到，但**还没逾期**，不在今天的催交清单里。\n\n'
 || '另外两类是另一种病：`PO-20260718-01` 到了但 `qty_received` 120 / `qty_order` 200（短交 80）；`PO-20260801-01` 到了但 500 / 800（短交 300）。', 'example', 1),

(9510, (SELECT id FROM flow_nodes WHERE node_key='purchase' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', '跟单只盯两件事',
 '每天打开采购单，只确认两件事，缺一不可：\n\n'
 || '1. **逾期没到**：`arrive_date IS NULL` 且 `promise_date` 早于今天——`= NULL` 或 `= ''` 都查不出，必须用 `IS NULL`。\n'
 || '2. **到货短交**：`qty_received < qty_order` 是数量不足，和「到没到」是两码事。\n\n'
 || '两类问题用同一张表的不同条件区分，别混。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 6) bom-route · BOM 与工艺路线
-- ---------------------------------------------------------------------------
(9511, (SELECT id FROM flow_nodes WHERE node_key='bom-route' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '共用料的用量各产品不同',
 '产品 3（PLC控制器）BOM 两行：控制主板 `M-2004`（每台 1，损耗 0.02）+ 接线端子 `M-2005`（每台 12，损耗 0.05）。\n\n'
 || '产品 4（变频器）也是这两类料，但端子每台只要 **8** 个（损耗 0.04）。\n\n'
 || '同一种接线端子，在 PLC 用 12 个、在变频器用 8 个——这就是为什么说**净需求必须按 BOM 逐产品展开**，不能把两个产品的用量拍脑袋汇总。', 'example', 1),

(9512, (SELECT id FROM flow_nodes WHERE node_key='bom-route' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', 'bom 与库存是两本账',
 '`bom` 说的是「造一台**应该**用多少」，`materials.stock_qty` 说的是「库里**现在**有多少」。两张表回答两个问题。\n\n'
 || '缺料 = 拿 BOM 算出的应发量，去和库存比。只看其中一张，永远算不出缺不缺。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 7) picking · 仓储发料
-- ---------------------------------------------------------------------------
(9513, (SELECT id FROM flow_nodes WHERE node_key='picking' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '三道真实的缺料缺口',
 '把 `pick_lists` 里 `qty_issued < qty_required` 的行挑出来，每一行都是一道缺料：\n\n'
 || '- `WO-20260801-02` 定子组件：应发 62、实发 40 → 缺口 **22**\n'
 || '- `WO-20260802-02` 控制主板：应发 153、实发 96 → 缺口 **57**\n'
 || '- `WO-20260803-02` 轴承：应发 808、实发 760 → 缺口 **48**\n\n'
 || '这些缺口不是随便写的，而是 `qty_required` 由 BOM 反算、`qty_issued` 是仓库实际发出来的。', 'example', 1),

(9514, (SELECT id FROM flow_nodes WHERE node_key='picking' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', '齐套是一票否决',
 '齐套不是百分比，是是非题。一张工单要 5 种料，4 种发齐、1 种差 22 件——这张工单**不齐套**，照样开不了工。\n\n'
 || '产线要装出成品，缺一种料机器就转不起来。所以「发了 80%」在系统里没有任何意义，齐套判断只有「齐 / 不齐」两种结果。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 8) dispatch · 生产派工
-- ---------------------------------------------------------------------------
(9515, (SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '二号车间的两张单为什么派不下去',
 '`WO-20260803-02` 和 `WO-20260808-01` 都在二号车间、状态 `released`，但二号车间**唯一**的设备 `EQ-02` 是停机——两张单都悬在那里派不下去。\n\n'
 || '反观一号车间有 `EQ-01`（运行）和 `EQ-04`（运行），工单才派得动。派工要落到具体设备，不是落到车间名字。', 'example', 1),

(9516, (SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'mapping', 'released 不等于已经在做',
 '车间动作 ↔ 系统记录：\n\n'
 || '- 计划把单下到车间 → `state` 改成 `released`\n'
 || '- 操作工按下开工、设备真正转起来 → `state` 改成 `running`\n\n'
 || '统计在制品只能数 `running`。把 `released` 也算进去，在制数量会虚高一大截，产能分析跟着全错。', 'mapping', 2),

-- ---------------------------------------------------------------------------
-- 9) shopfloor · 车间报工
-- ---------------------------------------------------------------------------
(9517, (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '一个人的良率要按工单汇总',
 '陆明辉在 `WO-20260801-01` 报了两笔：`rec_id 1` 合格 40 / 不良 2，`rec_id 2` 合格 35 / 不良 0，合计合格 75 / 不良 2。\n\n'
 || '算他在这张单的良率，要先把两笔按 `wo_id` 汇总（75 / 77），再除。拿某一笔的 40 / 42 当整张单的良率会严重失真——他在这张单上其实是 97.4%，不是 95.2%。', 'example', 1),

(9518, (SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', '整数相除会把良率算成 0',
 'SQL 里 `75 / 77` 两个整数相除，结果是 **0** 不是 0.97——小数部分被直接截断，而且**不报错**。\n\n'
 || '所以要写 `100.0 * SUM(qty_ok) / (SUM(qty_ok) + SUM(qty_ng))`：那个 `.0` 强制走小数除法。这是零基础最容易踩、也最难自己发现的一个坑。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 10) qc · 质量检验
-- ---------------------------------------------------------------------------
(9519, (SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '同一工单可能撞上不同缺陷',
 '`WO-20260802-02` 被检了两次都不合格：`check_id 4` 是「外观划伤」、`check_id 5` 是「尺寸超差」——同一条工单的不同缺陷类型。\n\n'
 || '`WO-20260801-01` 也有一条不合格「尺寸超差」（`check_id 2`）。\n\n'
 || '如果这些记录的 `defect_type` 空着，它们就只是一句「有问题」，复盘时无从追起、下个月照犯。', 'example', 1),

(9520, (SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', '质量不只在最后一道关',
 '把质量寄托在终检，等于让不良品先做完再挑出来——料和工时已经花掉了。\n\n'
 || '- **首检**拦住的是一整批（换型后第一件装错模具，检出得越早废得越少）；\n'
 || '- **巡检**盯刀具磨损、温度漂移这种渐进退化；\n'
 || '- **终检**只是入库前最后一道闸，价值最低。\n\n'
 || '质检的价值在尽早发现，不在最后兜底。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 11) stock-in · 成品入库
-- ---------------------------------------------------------------------------
(9521, (SELECT id FROM flow_nodes WHERE node_key='stock-in' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '一张干净的完工单长这样',
 '`WO-20260803-01`：`qty_plan` 80、`qty_done` 80、`state` 是 `finished`，三个数互相对得上，是一张干净的完工单，可以放心入库。\n\n'
 || '对照 `WO-20260801-02`：`qty_done` 40 / `qty_plan` 60、还在 `running`——能入库的只有 40 台，剩下 20 台没做出来，不能按 60 入库。', 'example', 1),

(9522, (SELECT id FROM flow_nodes WHERE node_key='stock-in' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', 'qty_done 不一定等于 qty_plan',
 '计划 100 台，最后完工 96 台是常态——中间有报废、有返修不及。\n\n'
 || '所以统计产出只能用 `qty_done`，用 `qty_plan` 当产出会**系统性高估**，而且报表上完全看不出错在哪。入库、发货、算产值，通通认 `qty_done`。', 'warn', 2),

-- ---------------------------------------------------------------------------
-- 12) shipping · 仓储发运
-- ---------------------------------------------------------------------------
(9523, (SELECT id FROM flow_nodes WHERE node_key='shipping' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'example', '准不准时看尾批不看首批',
 '`SO-20260725-01` 分两批发：`SH-02-1` 实发 08-12（交期 08-13，准时）、`SH-02-2` 实发 08-18（交期 08-15，**晚 3 天**）。\n\n'
 || '整单准时率看尾批不看首批——客户拿不齐 60 台，这单就是逾期，前面那批发得再准也不顶用。\n\n'
 || '`SO-20260730-01` 的 `SH-04-1` 实发日期还是空，整单没发。', 'example', 1),

(9524, (SELECT id FROM flow_nodes WHERE node_key='shipping' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'detail', 'misconception', 'closed 不等于按时交付',
 '`state = closed` 只说明「这单走完了」，一个字都没说准不准时。\n\n'
 || '准时率要拿**实际发货日**去比 `due_date` 才算得出来。只数 `closed` 的条数，报表会好看离谱，而客户的感受完全相反。', 'warn', 2);
