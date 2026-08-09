-- ============================================================================
-- SQL 沙箱样例库（MES 制造域最小可练数据集）
-- ----------------------------------------------------------------------------
-- 契约文件：本数据集是 sql_exercises.answer_hash 的唯一计算基准。
-- 前端 web/src/features/sql-sandbox/dataset.ts 以 ?raw 直接引入本文件；
-- 后端 seed 脚本必须读取同一份文件建库后执行 answer_sql，才能算出一致的哈希。
-- 单一事实源 = 本文件。任何一方另抄一份都会导致判题全站失效。
--
-- 方言约束：
--   - 只用标准 SQLite 语法，不用扩展函数，保证 sql.js 与 Node 侧 SQLite 行为一致。
--   - 整数列一律写整数字面量，避免 1 与 1.0 序列化差异导致哈希不一致。
--   - 日期统一 'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS' 文本存储。
--   - work_orders.state 采用英文五态词汇（created/released/running/finished/closed），
--     与教学章节一致；切勿混用中文状态，否则判题与教学内容脱节。
-- ============================================================================

-- 产品主数据
CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  spec       TEXT,
  unit       TEXT NOT NULL
);
INSERT INTO products (product_id, code, name, spec, unit) VALUES
  (1, 'P-1001', '减速机',     'XJ-200', '台'),
  (2, 'P-1002', '伺服电机',   'SM-80',  '台'),
  (3, 'P-1003', 'PLC控制器',  'FX-3U',  '个'),
  (4, 'P-1004', '变频器',     'VF-15K', '台');

-- 物料主数据
CREATE TABLE materials (
  material_id INTEGER PRIMARY KEY,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL,
  stock_qty   INTEGER NOT NULL
);
INSERT INTO materials (material_id, code, name, unit, stock_qty) VALUES
  (1, 'M-2001', '铸铁箱体', '件', 320),
  (2, 'M-2002', '轴承',     '套', 1480),
  (3, 'M-2003', '定子组件', '件', 210),
  (4, 'M-2004', '控制主板', '块', 96),
  (5, 'M-2005', '接线端子', '个', 5400);

-- BOM（单层：成品 product → 物料 material）
CREATE TABLE bom (
  bom_id      INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  qty_per     INTEGER NOT NULL,
  loss_rate   REAL NOT NULL
);
INSERT INTO bom (bom_id, product_id, material_id, qty_per, loss_rate) VALUES
  (1, 1, 1, 1, 0.02),
  (2, 1, 2, 4, 0.01),
  (3, 2, 3, 1, 0.03),
  (4, 2, 2, 2, 0.01),
  (5, 3, 4, 1, 0.02),
  (6, 3, 5, 12, 0.05),
  (7, 4, 4, 1, 0.02),
  (8, 4, 5, 8, 0.04);

-- 设备台账
CREATE TABLE equipment (
  equip_id INTEGER PRIMARY KEY,
  code     TEXT NOT NULL,
  name     TEXT NOT NULL,
  workshop TEXT NOT NULL,
  status   TEXT NOT NULL
);
INSERT INTO equipment (equip_id, code, name, workshop, status) VALUES
  (1, 'EQ-01', '注塑机A',     '一号车间', '运行'),
  (2, 'EQ-02', '冲压线B',     '二号车间', '停机'),
  (3, 'EQ-03', '焊装机器人C', '三号车间', '运行'),
  (4, 'EQ-04', '装配线D',     '一号车间', '运行'),
  (5, 'EQ-05', '检测台E',     '三号车间', '故障');

-- 工单
CREATE TABLE work_orders (
  wo_id      INTEGER PRIMARY KEY,
  wo_no      TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  qty_plan   INTEGER NOT NULL,
  qty_done   INTEGER NOT NULL,
  due_date   TEXT NOT NULL,
  state      TEXT NOT NULL,
  workshop   TEXT NOT NULL
);
INSERT INTO work_orders (wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop) VALUES
  (1, 'WO-20260801-01', 1, 120,   0, '2026-08-10', 'released', '一号车间'),
  (2, 'WO-20260801-02', 2,  60,  40, '2026-08-12', 'running',   '二号车间'),
  (3, 'WO-20260802-01', 1, 200,   0, '2026-08-15', 'released', '一号车间'),
  (4, 'WO-20260802-02', 3, 150,  90, '2026-08-09', 'running',   '三号车间'),
  (5, 'WO-20260803-01', 4,  80,  80, '2026-08-20', 'finished',  '一号车间'),
  (6, 'WO-20260803-02', 2,  40,   0, '2026-08-18', 'released', '二号车间');

-- 报工记录
CREATE TABLE production_records (
  rec_id      INTEGER PRIMARY KEY,
  wo_id       INTEGER NOT NULL,
  equip_id    INTEGER NOT NULL,
  operator    TEXT NOT NULL,
  qty_ok      INTEGER NOT NULL,
  qty_ng      INTEGER NOT NULL,
  report_time TEXT NOT NULL
);
INSERT INTO production_records (rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time) VALUES
  (1, 1, 1, '陆明辉', 40, 2, '2026-08-04 09:20:00'),
  (2, 1, 4, '陆明辉', 35, 0, '2026-08-04 15:40:00'),
  (3, 2, 3, '甘若彤', 25, 3, '2026-08-05 10:05:00'),
  (4, 2, 3, '甘若彤', 20, 1, '2026-08-05 16:30:00'),
  (5, 4, 1, '邱敬川', 70, 5, '2026-08-06 08:50:00'),
  (6, 4, 4, '邱敬川', 45, 0, '2026-08-06 14:10:00'),
  (7, 5, 4, '陆明辉', 80, 1, '2026-08-07 11:25:00'),
  (8, 3, 1, '甘若彤', 60, 4, '2026-08-07 17:05:00');

-- 质检记录
CREATE TABLE quality_checks (
  check_id    INTEGER PRIMARY KEY,
  wo_id       INTEGER NOT NULL,
  check_time  TEXT NOT NULL,
  result      TEXT NOT NULL,
  defect_type TEXT
);
INSERT INTO quality_checks (check_id, wo_id, check_time, result, defect_type) VALUES
  (1, 1, '2026-08-04 18:00:00', '合格',   NULL),
  (2, 1, '2026-08-05 18:00:00', '不合格', '尺寸超差'),
  (3, 2, '2026-08-05 18:00:00', '合格',   NULL),
  (4, 4, '2026-08-06 18:00:00', '不合格', '外观划伤'),
  (5, 4, '2026-08-07 18:00:00', '不合格', '尺寸超差'),
  (6, 5, '2026-08-07 18:00:00', '合格',   NULL),
  (7, 3, '2026-08-08 18:00:00', '不合格', '装配错位');

-- ============================================================================
-- 【2026-08-08 扩展】采购与领料域
-- ----------------------------------------------------------------------------
-- 只增不改：以上 7 张表的定义与数据一个字都没动，
-- 现存 6 道真哈希题（sql_exercises id 1~6）的 answer_hash 必须保持不变。
-- 每次改本文件后跑：node scripts/gen-answer-hash.mjs --regress
--
-- 数据设计的「病灶」（工厂全景节点要练的就是把它们查出来）：
--   采购节点 —— PO-3 / PO-7 / PO-10 承诺日期已过、arrive_date 仍为空 = 逾期未到；
--               PO-4 / PO-9 到了货但数量短交。
--   领料节点 —— pick_lists 中 qty_issued < qty_required 的 4 行 = 缺料，
--               其中定子组件与控制主板的缺口，正好源自上面逾期的采购单，
--               形成「采购逾期 → 领料缺料 → 工单动不了」的完整因果链。
--
-- 数值约定：pick_lists.qty_required = CAST(ROUND(bom.qty_per * work_orders.qty_plan
--           * (1 + bom.loss_rate)) AS INTEGER)，四舍五入，12 行全部成立（已脚本校验）。
--           学员可以自己用 BOM 反算出来，不是拍脑袋填的数。
-- 参照「今天」= 2026-08-08，与 quality_checks 最后一条检验时间对齐。
-- ============================================================================

-- 供应商主数据
CREATE TABLE suppliers (
  supplier_id     INTEGER PRIMARY KEY,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  contact         TEXT NOT NULL,
  lead_time_days  INTEGER NOT NULL
);
INSERT INTO suppliers (supplier_id, code, name, contact, lead_time_days) VALUES
  (1, 'SUP-01', '恒昌精密铸造', '邵文倩', 15),
  (2, 'SUP-02', '中科轴承',     '温启贤', 7),
  (3, 'SUP-03', '华瑞电机部件', '樊立宁', 20),
  (4, 'SUP-04', '迅达电子',     '阮清越', 10),
  (5, 'SUP-05', '泰兴五金',     '卓耀庭', 5);

-- 采购订单（arrive_date 为空 = 还没到货）
CREATE TABLE purchase_orders (
  po_id        INTEGER PRIMARY KEY,
  po_no        TEXT NOT NULL,
  supplier_id  INTEGER NOT NULL,
  material_id  INTEGER NOT NULL,
  qty_order    INTEGER NOT NULL,
  qty_received INTEGER NOT NULL,
  order_date   TEXT NOT NULL,
  promise_date TEXT NOT NULL,
  arrive_date  TEXT,
  state        TEXT NOT NULL
);
INSERT INTO purchase_orders (po_id, po_no, supplier_id, material_id, qty_order, qty_received, order_date, promise_date, arrive_date, state) VALUES
  (1,  'PO-20260710-01', 1, 1,  300,  300, '2026-07-10', '2026-07-25', '2026-07-24', 'received'),
  (2,  'PO-20260712-01', 2, 2, 2000, 2000, '2026-07-12', '2026-07-19', '2026-07-19', 'received'),
  (3,  'PO-20260715-01', 3, 3,  400,    0, '2026-07-15', '2026-08-04', NULL,         'created'),
  (4,  'PO-20260718-01', 4, 4,  200,  120, '2026-07-18', '2026-07-28', '2026-07-30', 'received'),
  (5,  'PO-20260720-01', 5, 5, 6000, 6000, '2026-07-20', '2026-07-25', '2026-07-25', 'received'),
  (6,  'PO-20260722-01', 3, 3,  150,    0, '2026-07-22', '2026-08-11', NULL,         'shipped'),
  (7,  'PO-20260725-01', 4, 4,  300,    0, '2026-07-25', '2026-08-06', NULL,         'shipped'),
  (8,  'PO-20260728-01', 1, 1,  150,  150, '2026-07-28', '2026-08-12', '2026-08-05', 'received'),
  (9,  'PO-20260801-01', 2, 2,  800,  500, '2026-08-01', '2026-08-08', '2026-08-08', 'received'),
  (10, 'PO-20260802-01', 5, 5, 2000,    0, '2026-08-02', '2026-08-07', NULL,         'approved');

-- 领料单（qty_issued < qty_required = 缺料）
CREATE TABLE pick_lists (
  pick_id      INTEGER PRIMARY KEY,
  pick_no      TEXT NOT NULL,
  wo_id        INTEGER NOT NULL,
  material_id  INTEGER NOT NULL,
  qty_required INTEGER NOT NULL,
  qty_issued   INTEGER NOT NULL,
  pick_time    TEXT NOT NULL,
  state        TEXT NOT NULL
);
INSERT INTO pick_lists (pick_id, pick_no, wo_id, material_id, qty_required, qty_issued, pick_time, state) VALUES
  (1,  'PK-20260803-01', 1, 1,  122,  122, '2026-08-03 08:30:00', 'done'),
  (2,  'PK-20260803-02', 1, 2,  485,  485, '2026-08-03 08:35:00', 'done'),
  (3,  'PK-20260804-01', 2, 3,   62,   40, '2026-08-04 09:10:00', 'partial'),
  (4,  'PK-20260804-02', 2, 2,  121,  121, '2026-08-04 09:15:00', 'done'),
  (5,  'PK-20260805-01', 4, 4,  153,   96, '2026-08-05 07:50:00', 'partial'),
  (6,  'PK-20260805-02', 4, 5, 1890, 1890, '2026-08-05 07:55:00', 'done'),
  (7,  'PK-20260806-01', 3, 1,  204,  204, '2026-08-06 10:20:00', 'done'),
  (8,  'PK-20260806-02', 3, 2,  808,  760, '2026-08-06 10:25:00', 'partial'),
  (9,  'PK-20260807-01', 5, 4,   82,   82, '2026-08-07 13:40:00', 'done'),
  (10, 'PK-20260807-02', 5, 5,  666,  666, '2026-08-07 13:45:00', 'done'),
  (11, 'PK-20260808-01', 6, 3,   41,    0, '2026-08-08 08:05:00', 'pending'),
  (12, 'PK-20260808-02', 6, 2,   81,   81, '2026-08-08 08:10:00', 'done');

-- ============================================================================
-- 【2026-08-08 扩展(二)】销售 · 计划 · 发货域（支撑工厂全景剩余 9 节点实战）
-- ----------------------------------------------------------------------------
-- 只增不改：前面所有表与数据一字未动；现存 6 道真哈希题（sql_exercises id 1~6）
-- 以及本文件已有的采购/领料域数据全部保留，answer_hash 不变。
-- 本批新增 customers / sales_orders / shipments 三张表 + 一个 released 工单 WO-7，
-- 用来支撑 cust-order / order-review / mps / mrp / shipping 等节点的查询实战。
--
-- 埋设的「病灶」（学员要练的就是把它们一句 SQL 查出来）：
--   cust-order  —— SO-11 / SO-12 还没评审(review_status='pending')、交期已逼近(≤ 2026-08-15)
--   order-review—— SO-3 / SO-6 / SO-9 / SO-10 已评审通过(approved)却还没排产(plan_status='none')
--   mrp        —— 已评审订单净需求：轴承(M-2002)净 96、控制主板(M-2004)净 68
--   dispatch   —— WO-6 / WO-7 在二号车间(released)，但二号车间唯一设备 EQ-02 停机，派不出去
--   shipping   —— SO-2 第二批 SH-02-2 实际发运 08-18 晚于交期 08-15（尾批逾期）；SO-4 整单未发
-- 参照「今天」= 2026-08-08。
-- ============================================================================

-- 客户主数据
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  region      TEXT NOT NULL,
  tier        TEXT NOT NULL
);
INSERT INTO customers (customer_id, code, name, region, tier) VALUES
  (1, 'CU-01', '华东机电',   '华东', 'A'),
  (2, 'CU-02', '华南自动化', '华南', 'A'),
  (3, 'CU-03', '西南装备',   '西南', 'B'),
  (4, 'CU-04', '北方重工',   '华北', 'A'),
  (5, 'CU-05', '小微智造',   '华东', 'C');

-- 销售订单（review_status: pending/approved/rejected；plan_status: none/planned/producing/done）
CREATE TABLE sales_orders (
  so_id         INTEGER PRIMARY KEY,
  so_no         TEXT NOT NULL,
  customer_id   INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  qty           INTEGER NOT NULL,
  order_date    TEXT NOT NULL,
  due_date      TEXT NOT NULL,
  review_status TEXT NOT NULL,
  plan_status   TEXT NOT NULL
);
INSERT INTO sales_orders (so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status) VALUES
  (1,  'SO-20260720-01', 1, 1, 100, '2026-07-20', '2026-08-12', 'approved', 'producing'),
  (2,  'SO-20260725-01', 2, 2,  60, '2026-07-25', '2026-08-15', 'approved', 'planned'),
  (3,  'SO-20260728-01', 3, 3,  80, '2026-07-28', '2026-08-20', 'approved', 'none'),
  (4,  'SO-20260730-01', 4, 4,  50, '2026-07-30', '2026-08-18', 'approved', 'planned'),
  (5,  'SO-20260801-01', 1, 1, 120, '2026-08-01', '2026-08-16', 'approved', 'producing'),
  (6,  'SO-20260802-01', 2, 2,  40, '2026-08-02', '2026-08-22', 'approved', 'none'),
  (7,  'SO-20260803-01', 3, 3,  90, '2026-08-03', '2026-08-25', 'rejected', 'none'),
  (8,  'SO-20260804-01', 4, 4,  30, '2026-08-04', '2026-08-28', 'approved', 'planned'),
  (9,  'SO-20260805-01', 5, 1,  70, '2026-08-05', '2026-08-30', 'approved', 'none'),
  (10, 'SO-20260806-01', 1, 2, 100, '2026-08-06', '2026-08-14', 'approved', 'none'),
  (11, 'SO-20260807-01', 2, 3,  60, '2026-08-07', '2026-08-12', 'pending',  'none'),
  (12, 'SO-20260808-01', 3, 4,  45, '2026-08-08', '2026-08-13', 'pending',  'none');

-- 发货单（ship_date 为空 = 还没发；尾批实际发运晚于 due_date = 逾期）
CREATE TABLE shipments (
  ship_id   INTEGER PRIMARY KEY,
  so_id     INTEGER NOT NULL,
  ship_no   TEXT NOT NULL,
  due_date  TEXT NOT NULL,
  ship_date TEXT,
  qty       INTEGER NOT NULL,
  status    TEXT NOT NULL
);
INSERT INTO shipments (ship_id, so_id, ship_no, due_date, ship_date, qty, status) VALUES
  (1, 1, 'SH-01-1', '2026-08-10', '2026-08-09', 50, 'shipped'),
  (2, 1, 'SH-01-2', '2026-08-12', '2026-08-11', 50, 'shipped'),
  (3, 2, 'SH-02-1', '2026-08-13', '2026-08-12', 30, 'shipped'),
  (4, 2, 'SH-02-2', '2026-08-15', '2026-08-18', 30, 'shipped'),
  (5, 4, 'SH-04-1', '2026-08-16', NULL,        50, 'pending'),
  (6, 3, 'SH-03-1', '2026-08-19', '2026-08-19', 40, 'shipped');

-- 仅追加一个已下达但无可用设备的工单（不改动既有 work_orders 数据）
INSERT INTO work_orders (wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
VALUES (7, 'WO-20260808-01', 2, 50, 0, '2026-08-19', 'released', '二号车间');

-- ============================================================================
-- 【2026-08-08 扩展(三)】共享工单 WO-2026-001（贯通 SQL 沙盒 ↔ 仿真沙盒）
-- ----------------------------------------------------------------------------
-- 与仿真侧 simScenario.WO_DEMO = 'WO-2026-001' 同源。学员先在 SQL 沙盒用这个 WO 号
-- 查它走到了哪一步，再进仿真沙盒点「运行」，日志首行就是同一张工单沿通用工厂主线流转。
--
-- 只增不改既有数据；新增行对判题哈希的影响需逐题核对（切勿想当然「不命中」）：
--   quality_checks.result = '合格'        → 不命中 9303「不合格」统计、不影响 c4/c6；
--   pick_lists 齐套（issued=required）   → 不命中 9302「缺料」统计；
--   work_orders.state = 'running'        → 不影响 c5（仅统计 finished）、不影响 9302/9303；
--   但会进入「对 work_orders 全表按 running 聚合且未显式排除它」的题目——原始 #2
--   （按车间统计在制工单负荷）正是此类，其 answer_hash 已随本次扩展重算为含 WO-2026-001 的值。
-- ⚠️ 任何改动本块数据后，必须先跑 `node scripts/gen-answer-hash.mjs --regress` 复核全部判题哈希。
-- ============================================================================
INSERT INTO work_orders (wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
VALUES (8, 'WO-2026-001', 1, 100, 0, '2026-08-20', 'running', '一号车间');
INSERT INTO pick_lists (pick_id, pick_no, wo_id, material_id, qty_required, qty_issued, pick_time, state)
VALUES (13, 'PK-20260808-03', 8, 1, 102, 102, '2026-08-08 09:00:00', 'done'),
       (14, 'PK-20260808-04', 8, 2, 404, 404, '2026-08-08 09:05:00', 'done');
INSERT INTO quality_checks (check_id, wo_id, check_time, result, defect_type)
VALUES (8, 8, '2026-08-08 18:00:00', '合格', NULL);
