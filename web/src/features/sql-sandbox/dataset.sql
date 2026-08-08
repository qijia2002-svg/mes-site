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
