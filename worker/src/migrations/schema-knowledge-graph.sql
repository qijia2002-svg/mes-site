-- ============================================================================
-- 知识点连线图（Obsidian 式）· 概念连接层 DDL
-- ----------------------------------------------------------------------------
-- 仅新增两张表，不改任何现有表结构；不动 dataset.sql / 任何练习答案
-- （S1/E1 约束保持不变）。
--
-- 设计意图：
--   flow_nodes + flow_edges 已经是一张现成的工厂过程流程图；
--   这张图把「同一个知识点散落在讲解 / 微练习 / 术语表 / SQL 练习 / 课程里
--   的多处表述」用一个 concepts 正主表聚合起来，knowledge_links 只做「指认」，
--   不复制内容。前端力导向图据此把同概念的多处表述自动聚成一簇。
-- ============================================================================

CREATE TABLE IF NOT EXISTS concepts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT    NOT NULL UNIQUE,   -- 规范 slug，如 'qty_done' / 'mrp' / 'first_inspection'
  label      TEXT    NOT NULL,          -- 展示名，如 '完工数量 qty_done'
  definition TEXT,                      -- 一句话定义，反链面板里展示
  topic_id   INTEGER REFERENCES topics(id) ON DELETE SET NULL, -- 可选归属课程
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 知识工件 → 概念 的指认：同概念的工件都指向同一行 concepts，连线图即聚簇。
CREATE TABLE IF NOT EXISTS knowledge_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  source_type TEXT    NOT NULL,  -- 'node' | 'explainer' | 'micro' | 'sql_ex' | 'glossary' | 'topic' | 'stage'
  source_ref  INTEGER NOT NULL,  -- 源表对应的行 id
  relation    TEXT    NOT NULL DEFAULT 'about', -- 'about' | 'example' | 'prereq'
  weight      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_kl_concept ON knowledge_links (concept_id);
CREATE INDEX IF NOT EXISTS idx_kl_source  ON knowledge_links (source_type, source_ref);
