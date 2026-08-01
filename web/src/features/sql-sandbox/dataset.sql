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
