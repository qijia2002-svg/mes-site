-- MES 实训平台 D1 Schema（免费版单库单线程）
-- 部署：wrangler d1 execute mes-learning --local --file=./src/migrations/schema.sql
--       wrangler d1 execute mes-learning --remote --file=./src/migrations/schema.sql

PRAGMA foreign_keys = ON;

-- 平台配置（content_version 用于 L2 缓存换键；token_version 用于会话吊销）
CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
INSERT OR IGNORE INTO platform_config (key, value, updated_at)
VALUES ('content_version', '1', strftime('%s','now')),
       ('token_version',   '1', strftime('%s','now'));

-- 主题（决定"有哪些主题"，纯数据；新增主题零后端改动，见 §A5）
CREATE TABLE IF NOT EXISTS topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  modules     TEXT NOT NULL DEFAULT '[]',     -- JSON 数组，如 ["theory","sql","quiz"]
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published', -- published | draft
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topics_sort ON topics(sort, status);

-- 章节（理论正文，MD 客户端渲染）
CREATE TABLE IF NOT EXISTS chapters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id      INTEGER NOT NULL REFERENCES topics(id),
  title         TEXT NOT NULL,
  sort          INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published',
  md_text       TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chapters_topic ON chapters(topic_id, status, id);

-- 选择题 / 判断题（下发**不含答案**；答案留服务端校验）
CREATE TABLE IF NOT EXISTS questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id   INTEGER NOT NULL REFERENCES chapters(id),
  type         TEXT NOT NULL DEFAULT 'single', -- single | multi | judge
  stem         TEXT NOT NULL,
  options      TEXT NOT NULL DEFAULT '[]',     -- JSON 数组
  answer       TEXT NOT NULL DEFAULT '',        -- 服务端保留，不下发
  explanation  TEXT NOT NULL DEFAULT '',
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id, sort);

-- SQL 实训题（题面+数据集下发；判题在浏览器 WASM 内完成）
CREATE TABLE IF NOT EXISTS sql_exercises (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id    INTEGER NOT NULL REFERENCES topics(id),
  title       TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  dataset_json TEXT NOT NULL DEFAULT '{}',     -- 样例库建表+数据（JSON）
  answer_sql  TEXT NOT NULL DEFAULT '',         -- 服务端保留，用于比对/校验
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sql_ex_topic ON sql_exercises(topic_id, sort);

-- 排障/沙盘场景（practice 模块，Phase 3）
CREATE TABLE IF NOT EXISTS fault_scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id    INTEGER NOT NULL REFERENCES topics(id),
  variant     TEXT NOT NULL DEFAULT 'factory', -- factory | blocks
  title       TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  solution_json TEXT NOT NULL DEFAULT '{}',
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fault_topic ON fault_scenarios(topic_id, variant);

-- 积木容错规则（practice 模块，Phase 3）
CREATE TABLE IF NOT EXISTS block_solutions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES fault_scenarios(id),
  solution_id TEXT NOT NULL,
  rule_json   TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_block_scenario ON block_solutions(scenario_id);

-- 进度事件（幂等：event_id UNIQUE + INSERT OR IGNORE）
CREATE TABLE IF NOT EXISTS progress_events (
  event_id    TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,  -- sql_done | quiz_done | practice_done
  ref_id      TEXT NOT NULL DEFAULT '',
  payload     TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress_events(user_id, created_at);

-- 每日聚合（写时 UPSERT，仪表盘零 GROUP BY）
CREATE TABLE IF NOT EXISTS stats_daily (
  user_id     TEXT NOT NULL,
  day         TEXT NOT NULL,  -- YYYY-MM-DD
  sql_done    INTEGER NOT NULL DEFAULT 0,
  quiz_done   INTEGER NOT NULL DEFAULT 0,
  practice_done INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- Excel 分片导入（staging → commit 两阶段，跨请求整体一致）
CREATE TABLE IF NOT EXISTS import_chunks (
  import_id    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  rows         INTEGER NOT NULL DEFAULT 0,
  done_at      INTEGER NOT NULL,
  PRIMARY KEY (import_id, chunk_index)
);

-- 学习路径（Phase 3：有序主题串联）
CREATE TABLE IF NOT EXISTS learning_paths (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  topic_ids    TEXT NOT NULL DEFAULT '[]',  -- 有序主题 id 数组（JSON）
  sort         INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published',
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lp_sort ON learning_paths(sort, status);

-- 证书（Phase 3）
CREATE TABLE IF NOT EXISTS certifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  require_sql   INTEGER NOT NULL DEFAULT 0,
  require_quiz  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published',
  created_at    INTEGER NOT NULL
);

-- 错题本（学员视角，按 user+题目 幂等）
CREATE TABLE IF NOT EXISTS wrong_questions (
  user_id       TEXT NOT NULL,
  question_id   INTEGER NOT NULL,
  kind          TEXT NOT NULL,            -- quiz | sql
  last_wrong_at INTEGER NOT NULL,
  wrong_count   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, question_id, kind)
);

-- 标签体系
CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS topic_tags (
  topic_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (topic_id, tag_id)
);

-- 媒体（视频等，Phase 3）
CREATE TABLE IF NOT EXISTS media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id   INTEGER,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'video',
  url        TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- 可复用 SQL 样例数据集（沙箱内置库，对应 v2 §4 浏览器端 sql.js）
CREATE TABLE IF NOT EXISTS sql_datasets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  build_sql  TEXT NOT NULL DEFAULT '',  -- 建表 + 插数 DDL/DML
  created_at INTEGER NOT NULL
);

