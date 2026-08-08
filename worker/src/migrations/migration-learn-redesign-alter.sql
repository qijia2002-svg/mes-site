-- ============================================================================
-- 迁移：learn-redesign 增列（flow_nodes + sql_exercises）
-- ----------------------------------------------------------------------------
-- 【不可重入】SQLite 的 ALTER TABLE ADD COLUMN 不支持 IF NOT EXISTS，
-- 重复执行必报 "duplicate column name: xxx"。本文件只跑一次。
-- 与 schema-learn-redesign.sql 的 CREATE TABLE IF NOT EXISTS 段性质不同，
-- 因此拆成独立文件，避免有人为了建表把 ALTER 又跑一遍。
--
-- 执行顺序（三步，不能颠倒）：
--   1. schema-learn-redesign.sql        建 4 张新表（可重入）
--   2. migration-learn-redesign-alter.sql  本文件，增 5 列（不可重入）
--   3. seed-learn-redesign-content.sql  回填 stage_key/one_liner 与内容（可重入）
--
-- 部署：
--   node scripts/d1q.mjs --file worker/src/migrations/migration-learn-redesign-alter.sql --local
--   node scripts/d1q.mjs --file worker/src/migrations/migration-learn-redesign-alter.sql
--
-- 【执行前自检】先确认列不存在，再跑本文件（D1 控制台或 d1q 单句执行）：
--   PRAGMA table_info(flow_nodes);      -- 不应出现 stage_key / one_liner
--   PRAGMA table_info(sql_exercises);   -- 不应出现 worked_sql / worked_note / completion_template
--   已存在则整份跳过，不要挑着跑其中几句。
--
-- 【执行后门禁】必须在开启阶段功能之前跑，两句都要 0 行，见文件末尾断言段。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) flow_nodes 增列
-- ---------------------------------------------------------------------------
-- stage_key —— 节点归属的学习阶段，对应 flow_stages.stage_key。
-- one_liner —— 大白话一句话，抽屉首屏第一行（区别于 description 的业务定义口吻）。
--
-- 【BLOCK-04 铁律：默认值必须是空串 ''，不得是 'tour' 或任何真实阶段名】
--   若默认值填真实阶段名，事故链是这样的：
--     迁移执行 → 12 个节点全部落进「入门阶段」
--     → 内容侧按 SPEC §6 给入门阶段配 '["micro","quiz"]'
--     → 全平台 sql 一次性退出完成度分母
--     → 已做完 quiz 的节点瞬间变已完成，进度条集体虚高跳涨，
--        学习者既有的 SQL 成绩不再影响任何进度显示。
--   全程无报错，DB 层也查不出异常，验收阶段几乎不可能发现。
--
--   空串是「尚未分配阶段」的显式中间态，运行时按 SPEC §2 回落：
--     a) 该节点不参与阶段分组，全景图按现有无阶段布局渲染；
--     b) 完成度口径取 PRACTICE_TYPES 全集（sql 照常计入，与今天线上一致）；
--     c) flow_stages 整表为空时，前端完全回落现有全景。
--   因此本迁移可以先于内容种子落地，零行为变化。
ALTER TABLE flow_nodes ADD COLUMN stage_key TEXT NOT NULL DEFAULT '';
ALTER TABLE flow_nodes ADD COLUMN one_liner TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- 2) sql_exercises 增列：SQL 三阶梯（看例题 → 填空 → 自己写）
-- ---------------------------------------------------------------------------
-- 判题零改动：填空阶补全后仍是目标查询，在浏览器 sql.js 跑出结果集，
-- 走既有归一化 SHA-256 比对 answer_hash（ADR-005 不动）。
--
-- 【内容铁律 1】worked_sql 不得等于 answer_sql —— worked 阶给的是「同类已解决的例子」，
--   不是本题答案。两者相同，阶梯就退化成直接看答案。
-- 【内容铁律 2】completion_template 是人工撰写的挖空版，不得在运行时由 answer_sql 生成，
--   占位符统一 {{1}} {{2}}。保持 R6 原义：answer_sql 本身永不出网。
ALTER TABLE sql_exercises ADD COLUMN worked_sql TEXT NOT NULL DEFAULT '';
ALTER TABLE sql_exercises ADD COLUMN worked_note TEXT NOT NULL DEFAULT '';
ALTER TABLE sql_exercises ADD COLUMN completion_template TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- 3) 执行后断言（人工/CI 校验，注释形式给出）
-- ---------------------------------------------------------------------------
-- 断言 A（本文件刚跑完时预期 12 行，跑完内容种子后必须 0 行）：
--   SELECT id FROM flow_nodes WHERE stage_key = '';
--   刚增列时全表默认空串是正常的，这正是中间态；
--   开启阶段功能之前必须先跑 seed-learn-redesign-content.sql 把它清成 0 行，
--   否则会出现「幽灵节点」——全景图上可见，却不出现在任何阶段进度里。
--
-- 断言 B（任何时候都必须 0 行）：
--   SELECT id FROM sql_exercises WHERE worked_sql <> '' AND worked_sql = answer_sql;
--
-- 断言 C（列已就位）：
--   PRAGMA table_info(flow_nodes);
--   PRAGMA table_info(sql_exercises);

-- ---------------------------------------------------------------------------
-- 4) 回滚
-- ---------------------------------------------------------------------------
-- D1 的 SQLite 支持 DROP COLUMN，但本次 5 列全部是 NOT NULL DEFAULT ''，
-- 对老代码完全透明（老 SELECT 不取这些列），因此**默认不回滚**。
-- 确需回滚时按下面逐句执行，注意 stage_key 一旦回滚，内容种子回填的数据一并丢失：
--   ALTER TABLE flow_nodes     DROP COLUMN stage_key;
--   ALTER TABLE flow_nodes     DROP COLUMN one_liner;
--   ALTER TABLE sql_exercises  DROP COLUMN worked_sql;
--   ALTER TABLE sql_exercises  DROP COLUMN worked_note;
--   ALTER TABLE sql_exercises  DROP COLUMN completion_template;
