-- =============================================================================
-- D1 Schema 增量 — 工艺路线搭建器 + Obsidian 导入
-- 状态：设计稿（Phase 1 调研产出）。评审通过后由后端 owner 落位到
--       worker/src/migrations/002-simulator.sql 再执行。
-- 依据：docs/architecture/tech-spec-simulator-v1.md §3.3 / §7.7
--
-- 部署：
--   wrangler d1 execute mes-learning --local  --file=./src/migrations/002-simulator.sql
--   wrangler d1 execute mes-learning --remote --file=./src/migrations/002-simulator.sql
--
-- 设计约束（不要在实现时"顺手优化"掉）：
--   1. 表名一律 sim_ 前缀。work_orders / bom 已被 sql.js 沙箱样例库占用
--      （web/src/features/sql-sandbox/dataset.sql:47,80），同名不同结构会造成教学混淆。
--   2. 比率/单位用量一律整数定点（万分比 / ×1000），禁 REAL。
--      浮点在跨设备重放仿真时产生位级差异 → "我照做了为什么结果不一样"。
--   3. status 缺省 'draft'。导入与新建永不自动发布。
--   4. 索引只建列表查询主路径 + 业务唯一约束，不建投机性复合索引。
--      所有查询以 scenario_id 为前导列（无任何跨场景查询）。
--   5. 学员画布状态不落库（localStorage 草稿）；运行结果复用 progress_events。
--      故本文件不含 sim_canvas_state / sim_runs —— 这是有意为之，见 ADR-007。
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- PART A — 仿真场景素材（5 张新表，只读下发，走 L2 缓存）
-- -----------------------------------------------------------------------------

-- A1. 仿真场景：一个场景 = 一套完整的示例工厂
CREATE TABLE IF NOT EXISTS sim_scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  topic_id    INTEGER REFERENCES topics(id),      -- 可挂到主题下，也可独立
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  industry    TEXT    NOT NULL DEFAULT 'discrete', -- discrete | process（首期仅 discrete）
  -- config_json: { canvas:{w,h,grid}, speeds:[1,2,4], tickMinutes:1, maxTicks:600,
  --                scoring:{ onTimeWeight, scrapWeight, blockWeight } }
  config_json TEXT    NOT NULL DEFAULT '{}',
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'draft',    -- published | draft
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_scn_list  ON sim_scenarios(status, sort);
CREATE INDEX IF NOT EXISTS idx_sim_scn_topic ON sim_scenarios(topic_id, status);


-- A2. 工序库：工具箱里可拖出来的"积木"
CREATE TABLE IF NOT EXISTS sim_operations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES sim_scenarios(id),
  code        TEXT    NOT NULL,                    -- OP-10 / OP-20 …
  name        TEXT    NOT NULL,                    -- 下料 / 冲压 / 装配 / 终检
  kind        TEXT    NOT NULL DEFAULT 'process',  -- process | qc | material | warehouse
                                                   -- ↑ 决定 canvas 形状：圆角矩形/菱形/平行四边形/桶形
  std_minutes INTEGER NOT NULL DEFAULT 10,         -- 标准工时（仿真分钟 = tick）
  capacity    INTEGER NOT NULL DEFAULT 1,          -- 并行工位数
  yield_rate  INTEGER NOT NULL DEFAULT 10000,      -- 良率，万分比（10000 = 100%）
  on_fail     TEXT    NOT NULL DEFAULT 'rework',   -- rework | scrap | hold
  -- input_json: [{ "materialCode":"M-1002", "qtyPer":2000 }]  qtyPer 为 ×1000 定点
  input_json  TEXT    NOT NULL DEFAULT '[]',
  sort        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scenario_id, code)                       -- 业务幂等键，兼作后台编辑冲突检测
);
CREATE INDEX IF NOT EXISTS idx_sim_op_scn ON sim_operations(scenario_id, sort);


-- A3. 参考工艺路线：标准答案 / 教学范例
--     学员自己搭的路线不进这张表（localStorage 草稿，见 ADR-007）
CREATE TABLE IF NOT EXISTS sim_process_routes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES sim_scenarios(id),
  code         TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  product_code TEXT    NOT NULL DEFAULT '',
  -- graph_json: { "nodes":[{"id","opCode","x","y"}], "edges":[{"from","to"}] }  DAG
  graph_json   TEXT    NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  -- is_reference=1 → graph_json 为参考答案，API 只下发 {code,name,nodeCount} 元信息
  -- 对齐 sql_exercises.answer_sql 的 R6 防泄露处置
  is_reference INTEGER NOT NULL DEFAULT 1,
  sort         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scenario_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sim_route_scn ON sim_process_routes(scenario_id, sort);


-- A4. 工单模板
CREATE TABLE IF NOT EXISTS sim_work_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES sim_scenarios(id),
  wo_no        TEXT    NOT NULL,                   -- WO-2026-0001
  product_code TEXT    NOT NULL,
  qty_plan     INTEGER NOT NULL DEFAULT 1,
  release_tick INTEGER NOT NULL DEFAULT 0,         -- 第几 tick 下达（制造节奏的教学变量）
  priority     INTEGER NOT NULL DEFAULT 0,         -- 越大越优先，同 tick 时决定排队顺序
  sort         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scenario_id, wo_no)
);
CREATE INDEX IF NOT EXISTS idx_sim_wo_scn ON sim_work_orders(scenario_id, release_tick);


-- A5. BOM 明细（单层；多层用 parent_code 自关联表达，v1 仿真只递归 1 层）
CREATE TABLE IF NOT EXISTS sim_bom_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id   INTEGER NOT NULL REFERENCES sim_scenarios(id),
  parent_code   TEXT    NOT NULL,                  -- 成品 / 半成品编码
  material_code TEXT    NOT NULL,
  material_name TEXT    NOT NULL DEFAULT '',       -- 内联，v1 不建独立物料主数据表
  qty_per       INTEGER NOT NULL DEFAULT 1000,     -- 单位用量 ×1000（1000 = 1 件）
  loss_rate     INTEGER NOT NULL DEFAULT 0,        -- 损耗率，万分比
  init_stock    INTEGER NOT NULL DEFAULT 0,        -- 场景初始库存 ×1000
                                                   -- ↑ "缺料标红"演示的核心变量：设 0 即触发
  UNIQUE (scenario_id, parent_code, material_code)
);
CREATE INDEX IF NOT EXISTS idx_sim_bom_scn ON sim_bom_items(scenario_id, parent_code);


-- -----------------------------------------------------------------------------
-- PART B — 异常注入：零 DDL 变更，纯约定复用现有表
-- -----------------------------------------------------------------------------
-- fault_scenarios.variant 新增取值 'sim'（现有 'factory' / 'blocks' 不受影响）
-- fault_scenarios.prompt        = 题面
-- fault_scenarios.solution_json = { scenarioSlug, inject[], expect{} }
--     · inject → 下发给前端，驱动异常发生
--     · expect → 服务端保留，API 永不下发
-- block_solutions.rule_json     = 多解容错规则，同一故障允许多种正确处置，任一命中即通过
--                                 （该表原始注释即"积木容错规则"，属设计意图内复用）
--
-- 因此 PART B 无任何 CREATE / ALTER 语句。此处仅留说明，防止后来者重复建表。


-- -----------------------------------------------------------------------------
-- PART C — Obsidian 导入幂等性（★ 唯一硬阻断项）
-- -----------------------------------------------------------------------------
-- 现状：chapters / topics 没有任何可标识"同一个 md 文件"的稳定字段
--       → 重复导入会产生重复内容。必须先补齐。
--
-- SQLite 的 ALTER TABLE ADD COLUMN 带 DEFAULT 是 O(1) 元数据操作，不重写表，
-- 对现有数据零风险。若目标库已执行过本段，重复执行会报 duplicate column，
-- 属预期行为 —— 迁移脚本需自行做一次 PRAGMA table_info 探测后跳过。

ALTER TABLE topics   ADD COLUMN source_path TEXT NOT NULL DEFAULT '';
ALTER TABLE chapters ADD COLUMN source_path TEXT NOT NULL DEFAULT '';

-- 部分唯一索引：只约束"来自导入"的记录（source_path <> ''），
-- 手工在后台创建的内容（source_path = ''）不受唯一性影响。
-- 这比"加一个 source 枚举列 + 应用层校验"干净得多。
CREATE UNIQUE INDEX IF NOT EXISTS uq_chapters_source
  ON chapters(topic_id, source_path) WHERE source_path <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_source
  ON topics(source_path) WHERE source_path <> '';


-- -----------------------------------------------------------------------------
-- PART D — 额度核算（记录在此，便于后续回看是否仍成立）
-- -----------------------------------------------------------------------------
-- D1 免费版：5,000,000 行读/天 · 100,000 行写/天 · 5 GB 存储
--
-- 读：一个场景整包 ≈ 60 行（1 场景 + 12 工序 + 20 BOM + 5 工单 + 15 路线 + 5 故障）
--     命中 L2 缓存 → 0 行读；1000 次冷读/天 → 60,000 行 = 额度的 1.2%
--
-- 写：POST /api/v1/sim/runs → progress_events 1 行 + stats_daily 1 行 = 2 行/次
--     100 人 × 20 次/天 = 4,000 行 = 额度的 4%
--     Obsidian 全量导入 200 篇 ≈ 400 行 → 可导 250 次/天
--
-- 结论：均在安全区。若未来引入"画布自动保存"，写额度会被单点打穿 —— 见 ADR-007 的否决理由。
-- =============================================================================
</content>
