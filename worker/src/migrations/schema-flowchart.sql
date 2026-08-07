-- 工厂流程图（导航主干：factory-first 重构核心）
-- 通用工厂主线（订单 → 交付）为第一个数据集；用户后续可自行加行业流程图进作品集。
-- 部署：
--   wrangler d1 execute mes-learning --local  --file=./src/migrations/schema-flowchart.sql
--   wrangler d1 execute mes-learning --remote --file=./src/migrations/schema-flowchart.sql

PRAGMA foreign_keys = ON;

-- 流程图（一套图 = 一个工厂/一种业务流）
CREATE TABLE IF NOT EXISTS flowcharts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'published', -- published | draft
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flowcharts_sort ON flowcharts(sort, status);

-- 流程节点（主干是工厂业务流本身，不是 MES/ERP）
CREATE TABLE IF NOT EXISTS flow_nodes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id     INTEGER NOT NULL REFERENCES flowcharts(id) ON DELETE CASCADE,
  node_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'process', -- entry | process | exit | hub
  icon        TEXT NOT NULL DEFAULT '',        -- lucide 图标名（前端锁定一套 SVG 图标库）
  x           REAL NOT NULL DEFAULT 0,         -- 画布坐标（前端流程图布局用）
  y           REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',        -- 节点一句话说明
  sort        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (flow_id, node_key)
);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON flow_nodes(flow_id, sort);

-- 流程连线（支持分支/汇聚，非纯线性）
CREATE TABLE IF NOT EXISTS flow_edges (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id   INTEGER NOT NULL REFERENCES flowcharts(id) ON DELETE CASCADE,
  from_key  TEXT NOT NULL,
  to_key    TEXT NOT NULL,
  label     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_flow_edges_flow ON flow_edges(flow_id);

-- 节点挂载的资源（知识/实战锚点）
-- res_type: chapter(理论) | quiz(一题) | sql(跑SQL) | sim(仿真沙盒)
-- ref_id: 指向现有实体（chapters.id / questions.id / sql_exercises.id / fault_scenarios.id）
CREATE TABLE IF NOT EXISTS node_resources (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id   INTEGER NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  res_type  TEXT NOT NULL,
  ref_id    INTEGER NOT NULL DEFAULT 0,
  title     TEXT NOT NULL DEFAULT '',          -- 可选覆盖标题
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_node_resources_node ON node_resources(node_id, sort);
