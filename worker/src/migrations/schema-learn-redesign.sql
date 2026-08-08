-- 学习体验重构 v1 —— 零基础友好内容模型（ARCH-LearnRedesign-v1 §3）
--
-- 设计前提（不可违背）：
--   1. 本文件只新增「内容表」，不改动 node_resources 的语义。
--      node_resources 是**完成度锚点**（practicesOf 的分母来源），
--      大白话讲解/真实数据例子/误解澄清属于「读物」不属于「实战」，
--      混进去会静默压低进度条。详见 ADR-017。
--   2. 全部为读多写少的内容表：讲解/提示零运行时写入，
--      只有 micro_practice 判分走 1 行读、0 行写（进度仍落 user_kv）。
--      D1 Free 每日 10 万行写入配额不受本次改动影响。
--   3. 所有 icon 字段存 Icon.tsx 语义名（lucide-react@1.28.0），禁 emoji。
--
-- 部署：
--   wrangler d1 execute mes-learning --local  --file=./src/migrations/schema-learn-redesign.sql
--   wrangler d1 execute mes-learning --remote --file=./src/migrations/schema-learn-redesign.sql

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1) 学习阶段：实现「先全貌、后细节」的分层
-- ---------------------------------------------------------------------------
-- 同一张流程图切成若干阶段，学习者按阶段推进而不是一上来面对 12 个节点。
-- 阶段的**数量、命名、收哪些节点由内容侧配置决定**，本表不预设方案
-- （PRD v1.2 §3.2：阶段划分待用户给定）。stage_key 是自由文本，代码不得硬编码具体值。
CREATE TABLE IF NOT EXISTS flow_stages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id    INTEGER NOT NULL REFERENCES flowcharts(id) ON DELETE CASCADE,
  stage_key  TEXT NOT NULL,                    -- 自由文本，内容侧命名；代码只按 sort 取序
  title      TEXT NOT NULL,                    -- 「先看懂工厂在干什么」
  subtitle   TEXT NOT NULL DEFAULT '',         -- 一句话说明这一阶段要花多久、做什么
  goal       TEXT NOT NULL DEFAULT '',         -- 「学完你能：看着流程图说出每个环节谁在用」
  icon       TEXT NOT NULL DEFAULT '',         -- Icon.tsx 语义名
  -- 本阶段「算完成」要求做完哪几类实战（JSON 数组）。
  -- 存在理由（BLOCK-02）：线上 12 个节点**每个都挂了 sql**，
  -- 若不限定，入门阶段的节点也要求写 SQL 才算完成，
  -- 与「入门阶段还没到 SQL」直接冲突，学习者第一阶段就会被 SQL 卡死。
  -- PRD v1.2 §3.0 决策一：入门阶段（第一阶段，无论如何命名）设 '["micro","quiz"]'，
  -- 后续阶段用默认全集。
  -- 值域必须是 PRACTICE_TYPES 的子集，未列出的类型仍可自由练习，只是不进完成度分母。
  practice_types TEXT NOT NULL DEFAULT '["quiz","sql","sim","micro"]',
  sort       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (flow_id, stage_key)
);
CREATE INDEX IF NOT EXISTS idx_flow_stages_flow ON flow_stages(flow_id, sort);

-- ---------------------------------------------------------------------------
-- 2) 分层讲解：大白话 / 真实业务数据例子 / 常见误解
-- ---------------------------------------------------------------------------
-- 独立于 node_resources，因此**永不进入完成度分母**（ADR-017 的核心收益）。
-- tier 决定「先看什么」：overview 在抽屉首屏直出，detail 折叠在「想深入了解」里。
--
-- 【kind 没有 analogy，是刻意的】用户决策不走生活化比喻（PRD v1.2 §3.1 / Out-of-Scope），
-- 具象化改由 example 承担——**取自 SQL 沙盒真实记录**（带真实单号与数字），
-- 而不是领域外类比。留着 analogy 槽位等于邀请内容侧继续写比喻。见 ADR-021。
--
-- 【mapping 不是比喻】UIUX v1 §6.3 设计的「对照块」：左边车间里的真实动作，
-- 右边系统里的真实记录（工人扫码 ↔ production_records 多一行）。
-- 两边都是真实存在的东西，是对应关系不是类比，因此保留为独立 kind。
-- 命名刻意避开 analogy —— 叫 analogy 的槽位迟早会被写进生活比喻。
CREATE TABLE IF NOT EXISTS node_explainers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id  INTEGER NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  tier     TEXT NOT NULL DEFAULT 'overview',   -- overview(先全貌) | detail(后细节)
  -- plain(大白话) | example(真实数据例子) | mapping(车间动作↔系统记录对照) | misconception(常见误解)
  kind     TEXT NOT NULL DEFAULT 'plain',
  title    TEXT NOT NULL DEFAULT '',
  body_md  TEXT NOT NULL DEFAULT '',           -- Markdown，前端经 markdown-it + DOMPurify 渲染
  icon     TEXT NOT NULL DEFAULT '',           -- Icon.tsx 语义名
  sort     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_node_explainers_node ON node_explainers(node_id, tier, sort);

-- ---------------------------------------------------------------------------
-- 3) 分级提示：答错了给台阶，而不是直接甩答案
-- ---------------------------------------------------------------------------
-- level 1 指方向 / 2 给关键点 / 3 给做法（仍不得包含可直接提交的正确答案）。
-- 安全铁律：本表内容**只能**由 /api/v1/practice-hints 按 level 单条下发，
-- 禁止随题面接口一起下发（否则学员在浏览器里直接读到 L3）。见 ADR-019。
CREATE TABLE IF NOT EXISTS practice_hints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,                   -- quiz | sql | sim | micro
  target_id   INTEGER NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1,      -- 1 | 2 | 3
  body_md     TEXT NOT NULL DEFAULT '',
  UNIQUE (target_type, target_id, level)
);
CREATE INDEX IF NOT EXISTS idx_practice_hints_target ON practice_hints(target_type, target_id, level);

-- ---------------------------------------------------------------------------
-- 4) 微练习：把 SQL 门槛前面垫一级台阶
-- ---------------------------------------------------------------------------
-- 零基础学员直接写 SQL 会卡死。先用点/连/排的轻互动确认「他看懂了这张表在说什么」，
-- 再放 SQL 沙盒。micro 计入完成度（属于实战），需同步进 PRACTICE_TYPES 白名单。
CREATE TABLE IF NOT EXISTS micro_practices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id      INTEGER NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'match',  -- match(连线) | order(排顺序) | pick(点流程图)
  prompt       TEXT NOT NULL,                  -- 「把下面 3 个单据，拖到它该出现的环节」
  payload      TEXT NOT NULL DEFAULT '{}',     -- JSON 题目素材（选项/配对候选），**不含答案**
  answer       TEXT NOT NULL DEFAULT '[]',     -- JSON 正确解，服务端保留，列表接口永不下发
  feedback_ok  TEXT NOT NULL DEFAULT '',       -- 答对时的具体反馈（说清楚为什么对）
  feedback_bad TEXT NOT NULL DEFAULT '',       -- 答错时的通用引导（具体提示走 practice_hints）
  sort         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_micro_practices_node ON micro_practices(node_id, sort);

-- ---------------------------------------------------------------------------
-- 5) flow_nodes 增列（【只跑一次】）
-- ---------------------------------------------------------------------------
-- SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，重复执行会报
-- "duplicate column name"。本段与上面的 CREATE TABLE IF NOT EXISTS 不同，**不可重入**。
-- 部署时单独执行本段；已执行过则跳过。
--
-- 【已落盘为独立可执行文件】本段与第 6 段的 ALTER 已去注释写进
--   worker/src/migrations/migration-learn-redesign-alter.sql（含执行前自检与断言）。
--   这里保留注释版仅作 schema 说明，**不要**把下面两行取消注释后再跑一遍。
--   执行顺序：本文件（建表，可重入）→ migration-learn-redesign-alter.sql（增列，只跑一次）
--            → seed-learn-redesign-content.sql（回填内容，可重入）。
--
-- stage_key —— 节点归属阶段。默认值 **必须是空串，不能是任何真实阶段名**。
-- one_liner —— 大白话一句话（区别于 description 的业务定义口吻）。
--
-- 【BLOCK-04：默认值填真实阶段名会造成静默进度事故】
--   原稿写的是 DEFAULT 'tour'。把它和 PRD v1.2 §3.0（入门阶段 practice_types = micro+quiz）
--   放在一起看，事故链是这样的：
--     迁移执行 → 12 个节点全部落进「入门阶段」
--     → 内容侧按 PRD 给入门阶段配 '["micro","quiz"]'
--     → **全平台 sql 一次性退出完成度分母**
--     → 所有已做完 quiz 的节点瞬间变 practiced，进度条集体虚高跳涨，
--        且学习者既有的 SQL 成绩不再影响任何进度显示。
--   没有任何报错，DB 层也查不出异常——这是最难在验收里发现的一类问题。
--
-- 【中间态规则（让「迁移先行」与「阶段待定」解耦）】
--   stage_key = '' 表示尚未分配阶段，运行时按以下回落，保证**零行为变化**：
--     a) 该节点不参与任何阶段分组，全景图按现有无阶段布局渲染；
--     b) 其完成度口径取 PRACTICE_TYPES 默认全集（sql 照常计入，与今天线上一致）；
--     c) flow_stages 整表为空时，前端不渲染阶段分组与阶段进度，完全回落现有全景。
--   因此本迁移可以在阶段方案定稿之前先落地，不需要等 PRD §3.2。
--
-- 【上线门禁】阶段功能正式开启时，必须先断言无遗漏节点：
--   SELECT id FROM flow_nodes WHERE stage_key = ''; 必须 0 行，
--   否则会出现不属于任何阶段的「幽灵节点」——它在全景图上可见，
--   却永远不出现在任何阶段进度里，学习者会看到「12 个节点，但各阶段加起来只有 9 个」。
--
-- ALTER TABLE flow_nodes ADD COLUMN stage_key TEXT NOT NULL DEFAULT '';
-- ALTER TABLE flow_nodes ADD COLUMN one_liner TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- 6) sql_exercises 增列：F6「SQL 三阶梯」（【只跑一次】，同样不可重入）
-- ---------------------------------------------------------------------------
-- 同上：可执行版在 migration-learn-redesign-alter.sql，本段只作说明，勿重复执行。
-- 阶梯：看例题(worked) → 填空(completion) → 自己写(free)。
--
-- 判题零改动：填空阶学员补全后得到的仍是目标查询，
-- 在浏览器 sql.js 里跑出结果集，走既有归一化 SHA-256 比对 answer_hash（ADR-005 不动）。
--
-- 【内容铁律 1】worked_sql **不得等于** answer_sql。
--   worked 阶要给的是「同类已解决的例子」，不是本题答案；
--   两者相同的话阶梯就退化成直接看答案，F6 的教学意义归零。
--   验收断言：SELECT id FROM sql_exercises WHERE worked_sql <> '' AND worked_sql = answer_sql; 必须 0 行。
--
-- 【内容铁律 2】completion_template 是**人工撰写**的挖空版，不得在运行时由 answer_sql 生成。
--   保持 R6 原义：answer_sql 本身永不出网。
--   占位符统一用 {{1}} {{2}}，前端按序号渲染输入框。
--
-- ALTER TABLE sql_exercises ADD COLUMN worked_sql TEXT NOT NULL DEFAULT '';
-- ALTER TABLE sql_exercises ADD COLUMN worked_note TEXT NOT NULL DEFAULT '';
-- ALTER TABLE sql_exercises ADD COLUMN completion_template TEXT NOT NULL DEFAULT '';
