-- ============================================================================
-- 职业—能力—章节 三层图谱 · 建表迁移
-- 设计说明：docs/architecture/career-roadmap-schema.md
-- 决策记录：docs/decisions/ADR-012-career-roadmap-model.md
--
-- 执行：
--   wrangler d1 execute mes-learning --local  --file=./docs/seeds/migration-career-roadmap.sql
--   wrangler d1 execute mes-learning --remote --file=./docs/seeds/migration-career-roadmap.sql
--
-- 约束：
--   * 全部 CREATE ... IF NOT EXISTS，可重复执行，幂等。
--   * 不 DROP、不 ALTER 任何现有表；learning_paths / topics / chapters 原样不动。
--   * 时间戳统一为**毫秒** epoch，与 worker 侧 Date.now() 一致
--     （对齐 admin.repo.ts 的 `const now = () => Date.now()`）。
--
-- D1 外键行为（已核实 https://developers.cloudflare.com/d1/sql-api/foreign-keys/）：
--   D1 对每个隐式事务永远开启外键校验，`PRAGMA foreign_keys = off` 被静默忽略。
--   因此本文件只在**子系统内部**建强外键（全部 ON DELETE CASCADE）；
--   指向 chapters(id) 的引用**故意不加外键**，理由见设计说明 §5。
--   后续灌数据的 DML 若可能临时违反约束，请在该 DML 文件开头加：
--     PRAGMA defer_foreign_keys = on;
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. tracks —— 能力路线（ERP / MES / SQL / PLC / 嵌入式 / 工业网络 / Linux / 条码RFID）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  subtitle    TEXT    NOT NULL DEFAULT '',
  -- core = 主干必修路线；elective = 选修/加分路线
  kind        TEXT    NOT NULL DEFAULT 'core'
              CHECK (kind IN ('core','elective')),
  -- 图标语义名，取值必须存在于 web/src/components/Icon.tsx 的 REGISTRY（ADR-002）
  -- 禁止 emoji / 组件名 / URL。例：sql · plc · network · barcode
  icon        TEXT    NOT NULL DEFAULT 'paths',
  summary     TEXT    NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'published'
              CHECK (status IN ('published','draft')),
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);

-- slug 已有 UNIQUE 隐式索引，这里只补列表页排序
CREATE INDEX IF NOT EXISTS idx_tracks_sort ON tracks(status, sort, id);


-- ---------------------------------------------------------------------------
-- 2. track_levels —— 路线三级（L1 入门 / L2 中级 / L3 高级）
--    planned_chapters 为 JSON，存尚未建章节的占位，**不计入进度分母**。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS track_levels (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  level       INTEGER NOT NULL CHECK (level IN (1,2,3)),
  name        TEXT    NOT NULL,
  goal        TEXT    NOT NULL DEFAULT '',
  -- 建议学时（小时）。0 表示未评估。
  hours       INTEGER NOT NULL DEFAULT 0,
  -- JSON 字符串数组：本级学完的能力产出
  outcomes    TEXT    NOT NULL DEFAULT '[]',
  -- JSON 对象数组 [{ "title": "...", "desc": "..." }]：规划中但尚未建的章节
  planned_chapters TEXT NOT NULL DEFAULT '[]',
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  -- 一条路线同一等级只能有一行；重跑 seed 时用 INSERT OR REPLACE 收敛
  UNIQUE (track_id, level)
);

CREATE INDEX IF NOT EXISTS idx_track_levels_track ON track_levels(track_id, level);


-- ---------------------------------------------------------------------------
-- 3. track_level_chapters —— 「路线等级 ↔ 已建章节」有序映射
--    对应契约里的 levels[].chapter_ids，sort 保序，无损承载数组顺序。
--
--    【外键决策】chapter_id 指向 chapters(id) 但**不建外键**：
--      a) seed 数据先于内容落库，引用未建章节是常态，D1 强 FK 会让整批 seed 原子失败；
--      b) 后台 import/content 会重建章节，硬 FK 会直接阻塞导入；
--      c) 悬空 id 无害——写入用 WHERE EXISTS 过滤，读取一律 INNER JOIN chapters，
--         不存在/未发布的章节自然不出现，也不会污染进度分母。
--    level_id 在子系统内部，保持强外键 + CASCADE。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS track_level_chapters (
  level_id    INTEGER NOT NULL REFERENCES track_levels(id) ON DELETE CASCADE,
  chapter_id  INTEGER NOT NULL,          -- 软引用 chapters(id)，故意不加 FOREIGN KEY
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  PRIMARY KEY (level_id, chapter_id)
);

-- 取某级章节清单（有序）
CREATE INDEX IF NOT EXISTS idx_tlc_level   ON track_level_chapters(level_id, sort);
-- 反查：该章节属于哪些能力等级（章节页面包屑 / 影响面分析）
CREATE INDEX IF NOT EXISTS idx_tlc_chapter ON track_level_chapters(chapter_id);


-- ---------------------------------------------------------------------------
-- 4. career_paths —— 岗位职业路径（5 条）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_paths (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  tagline     TEXT    NOT NULL DEFAULT '',
  -- 展示用薪资区间原文，如「12-20K / 月（长三角，2 年经验）」。不做数值计算，存 TEXT。
  salary      TEXT    NOT NULL DEFAULT '',
  -- 展示用需求热度原文，如「高」「稳定增长」。同样不参与计算。
  demand      TEXT    NOT NULL DEFAULT '',
  overview    TEXT    NOT NULL DEFAULT '',
  -- JSON 字符串数组：日常工作内容
  daily_work  TEXT    NOT NULL DEFAULT '[]',
  -- JSON 字符串数组：典型交付物
  outputs     TEXT    NOT NULL DEFAULT '[]',
  -- 图标语义名，同 tracks.icon 约束
  icon        TEXT    NOT NULL DEFAULT 'user',
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'published'
              CHECK (status IN ('published','draft')),
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_careers_sort ON career_paths(status, sort, id);


-- ---------------------------------------------------------------------------
-- 5. career_stages —— 岗位成长阶段
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_stages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  career_id   INTEGER NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  -- 阶段序号，从 1 开始，决定图谱从左到右/从上到下的顺序
  stage       INTEGER NOT NULL CHECK (stage >= 1),
  title       TEXT    NOT NULL,
  -- 展示用周期原文，如「1-2 个月」。不做时间计算，存 TEXT。
  duration    TEXT    NOT NULL DEFAULT '',
  goal        TEXT    NOT NULL DEFAULT '',
  milestone   TEXT    NOT NULL DEFAULT '',
  -- JSON 字符串数组：面试考点
  interview_points TEXT NOT NULL DEFAULT '[]',
  -- JSON 字符串数组：阶段交付物
  deliverables     TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  UNIQUE (career_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_career_stages_career ON career_stages(career_id, stage);


-- ---------------------------------------------------------------------------
-- 6. career_stage_reqs —— 阶段 → 能力路线等级 的需求边（路径图的「边」）
--    对应契约里的 stages[].requirements[{ track, level, importance, note }]。
--    契约用 (track_slug, level) 表达，落库时解析为 track_levels.id 外键。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_stage_reqs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id    INTEGER NOT NULL REFERENCES career_stages(id) ON DELETE CASCADE,
  level_id    INTEGER NOT NULL REFERENCES track_levels(id)  ON DELETE CASCADE,
  importance  TEXT    NOT NULL DEFAULT 'core'
              CHECK (importance IN ('core','important','optional')),
  note        TEXT    NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  -- 同一阶段不重复要求同一个「路线×等级」
  UNIQUE (stage_id, level_id)
);

-- 按阶段取需求边（画图主路径）
CREATE INDEX IF NOT EXISTS idx_csr_stage ON career_stage_reqs(stage_id, sort);
-- 反查：该能力等级被哪些岗位阶段要求（能力页展示「学了能干什么」）
CREATE INDEX IF NOT EXISTS idx_csr_level ON career_stage_reqs(level_id);


-- ============================================================================
-- 校验（灌数完成后手动跑，用于发现悬空章节引用）
--
--   -- 悬空 / 未发布的章节引用，应为空集
--   SELECT tlc.level_id, tlc.chapter_id
--   FROM track_level_chapters tlc
--   LEFT JOIN chapters c ON c.id = tlc.chapter_id AND c.status = 'published'
--   WHERE c.id IS NULL;
--
--   -- 每条路线是否齐了三级，应为 8 行且 n = 3
--   SELECT t.slug, COUNT(tl.id) AS n FROM tracks t
--   LEFT JOIN track_levels tl ON tl.track_id = t.id GROUP BY t.id ORDER BY t.sort;
--
--   -- 图标语义名清单，逐个核对 Icon.tsx REGISTRY 是否已注册
--   SELECT 'track' AS scope, slug, icon FROM tracks
--   UNION ALL SELECT 'career', slug, icon FROM career_paths;
-- ============================================================================
