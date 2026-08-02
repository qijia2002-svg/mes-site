-- ============================================================
-- MES 实训平台 · P2 认证体系 + 路线图去重 Seed SQL
-- 平台：D1（SQLite）
-- 生成时间：2026-08-02
-- ============================================================

-- ----------------------------------------------------------
-- Part A：认证体系（certifications，6 张证书）
-- ----------------------------------------------------------

-- 先清理同名 slug（幂等）
DELETE FROM certifications WHERE slug IN (
  'cert-data-basics',
  'cert-data-advanced',
  'cert-erp-mes',
  'cert-quality',
  'cert-sql-interview',
  'cert-implementation'
);

INSERT INTO certifications (slug, title, description, require_sql, require_quiz, status, created_at) VALUES
  -- P2-数据基础：工单/BOM/报工三大核心模块，SQL 通过 ≥8 题，测验正确率 ≥75%
  ('cert-data-basics',
   'MES 实施工程师·数据基础',
   '完成工单/BOM/报工三大核心模块，SQL 查询能力达标',
   8, 75, 'published', strftime('%s','now')),

  -- P2-数据进阶：SQL 面试实战全部通关，SQL 通过 ≥18 题，测验正确率 ≥80%
  ('cert-data-advanced',
   'MES 实施工程师·数据进阶',
   'SQL 面试实战全部通关，能独立完成多表关联与追溯查询',
   18, 80, 'published', strftime('%s','now')),

  -- P2-ERP/MES 贯通：ERP 原理与 MES 核心模块全部完成，测验正确率 ≥80%
  ('cert-erp-mes',
   'MES 实施工程师·ERP/MES 贯通',
   'ERP 原理与 MES 核心模块全部完成，理解两大系统边界与集成',
   5, 80, 'published', strftime('%s','now')),

  -- P2-质量追溯：质量追溯课程完成，排障场景全部通过，测验正确率 ≥85%
  ('cert-quality',
   'MES 实施工程师·质量追溯',
   '质量追溯课程完成，排障场景全部通过',
   3, 85, 'published', strftime('%s','now')),

  -- P2-SQL 面试通关：SQL 面试实战 9 题全部通过（answer_hash 校验），无测验要求
  ('cert-sql-interview',
   'SQL 面试实战·通关证书',
   'SQL 面试实战 9 题全部通过（answer_hash 校验）',
   9, 0, 'published', strftime('%s','now')),

  -- P2-综合认证：完成全部学习路径（路线图 rm-500 全部主题），SQL ≥30 题，测验 ≥80%
  ('cert-implementation',
   'MES 实施工程师·综合认证',
   '完成全部学习路径（路线图 rm-500 全部主题），具备实施能力',
   30, 80, 'published', strftime('%s','now'));


-- ----------------------------------------------------------
-- Part B：路线图去重与优化（learning_paths）
--
-- 现有路线图（来自 seed-roadmaps.sql）：
--   rm-500：MES 实施工程师学习路线图（16-20 周，系统版）→ 保留
--   rm-501：实施工程师·30天冲刺路线图                   → 保留
--   rm-502：与 rm-500 高度重叠                           → 删除后替换为 rm-502a
--   rm-503：戚家硕·MES/SCADA 实施岗·25天冲刺计划         → 保留
--
-- 去重策略：
--   rm-500  = 系统学习版（16-20 周，4 阶段扎实构建）
--   rm-502a = 速战速决版（2 周高强度，突击面试/项目启动）
-- ----------------------------------------------------------

-- Step 1：清理 rm-502（含 rm-502a 的历史残留）
DELETE FROM learning_paths WHERE slug IN ('rm-502', 'rm-502a');

-- Step 2：更新 rm-500 description——明确「系统学习版」定位，与 rm-502a 形成互补
UPDATE learning_paths
   SET description =
       '系统学习版。适合：有 MES 使用/运维经验，目标成为 MES 实施工程师，'
       || '愿意每周投入 3-5 小时，系统构建 16-20 周实施知识体系。'
       || ' → 与「实施方法论·2周强化」互补：后者适合突击面试，前者适合扎实根基。'
 WHERE slug = 'rm-500';

-- Step 3：插入 rm-502a「速战速决版」（替换 rm-502，专题路径）
-- 说明：复用 rm-502 原有的 4 个 topic（5008/5009/5010/5011），内容高度凝练为 2 周高强度专题
INSERT INTO learning_paths (slug, title, description, topic_ids, sort, status, created_at) VALUES
  ('rm-502a',
   '实施方法论·2周强化',
   '速战速决版。适合：已有一定 MES 基础，需要在 2 周内突击准备面试或项目启动的同学。'
   || '内容高度压缩，不讲原理只讲结论，直击面试高频考点和项目启动 checklist。'
   || '建议先完成 rm-500 系统版，再用 rm-502a 做考前冲刺；也可以单独学习。'
   || '本路线图与「MES 实施工程师学习路线图（rm-500）」互补：'
   || '  rm-500   = 系统学习（16-20 周，原理+实操并重，打牢基础）'
   || '  rm-502a  = 速战速决（2 周，高强度复盘，直击面试/项目启动）',
   '[5008,5009,5010,5011]',
   20,
   'published',
   strftime('%s','now'));


-- ----------------------------------------------------------
-- Part C：补充 3 个高频排障场景（fault_scenarios）
--
-- 表结构（来自 schema.sql）：
--   fault_scenarios(
--     id            INTEGER PRIMARY KEY AUTOINCREMENT,
--     topic_id      INTEGER NOT NULL,   -- 归属主题 ID
--     title         TEXT NOT NULL,
--     level         TEXT NOT NULL DEFAULT 'medium',
--     solution_json TEXT NOT NULL,
--     created_at    INTEGER NOT NULL
--   )
--
-- 排障场景设计原则：
--   场景 4（topic_id=1）：工单状态卡死关不掉 → 报工/工单模块联调
--   场景 5（topic_id=2）：齐套检查虚判       → BOM+库存口径联调
--   场景 6（topic_id=3）：报工入库差异       → 报工+入库/WMS 接口
-- ----------------------------------------------------------

-- 幂等清理：只清理本次新增的 3 条（id >= 4）
DELETE FROM fault_scenarios WHERE id >= 4;

-- 场景 4：工单状态卡死关不掉（topic_id=1 工单模块）
-- 根因：工单关闭前存在未审核报工记录或待审核质检单，MES 状态锁死
INSERT INTO fault_scenarios (topic_id, variant, title, prompt, solution_json, sort, created_at) VALUES
  (1,
   'factory',
   '工单状态卡死关不掉',
   '',
   '{"scenario":"工单已完成报工（done_qty=plan_qty），但 state 仍为 running，无法关闭。",'
   ||'"hint":"检查是否有异常报工记录（负数/超出计划量），或工单是否有未审核的质检单。",'
   ||'"root_cause":"工单关闭前未做完工确认审核，MES 中存在待审核报工导致状态锁死。",'
   ||'"fix":"补审或作废异常报工记录，确认质检OK后手动关闭工单。",'
   ||'"block_solution_id":"B1"}',
   0,
   strftime('%s','now'));

-- 场景 5：齐套检查虚判，现场领不到料（topic_id=2 BOM 模块）
-- 根因：齐套检查使用账面库存口径（含冻结/在检），实际可用库存为零
INSERT INTO fault_scenarios (topic_id, variant, title, prompt, solution_json, sort, created_at) VALUES
  (2,
   'factory',
   '齐套检查虚判，现场领不到料',
   '',
   '{"scenario":"工单齐套检查显示所有物料已齐，但车间领料时发现某种物料实际库存为零。",'
   ||'"hint":"对比齐套检查使用的库存口径（账面库存 vs 可用库存），检查是否有在途/冻结库存被计入。",'
   ||'"root_cause":"齐套检查用了账面库存（含已冻结/在检物料），实际可用库存为零。",'
   ||'"fix":"修改齐套检查口径为可用库存（排除冻结/质检中物料），补录冻结库位数据。",'
   ||'"block_solution_id":"B2"}',
   0,
   strftime('%s','now'));

-- 场景 6：报工数据与入库数量对不上（topic_id=3 报工模块）
-- 根因：部分报工未及时做入库操作，工单未关单，MES 与 WMS 接口数据不一致
INSERT INTO fault_scenarios (topic_id, variant, title, prompt, solution_json, sort, created_at) VALUES
  (3,
   'factory',
   '报工数据与入库数量对不上',
   '',
   '{"scenario":"工单 WO-20260801-01 报工总量 98 台，但入库只有 95 台，差异 3 台去向不明。",'
   ||'"hint":"查该工单所有报工记录，对比入库记录，检查是否有未入库报工或重复报工。",'
   ||'"root_cause":"其中 3 台报工后未及时做入库操作，工单也未关单，导致库存对不上。",'
   ||'"fix":"补做入库操作，或红冲错误报工记录，并排查 MES 与 WMS 接口是否正常。",'
   ||'"block_solution_id":"B3"}',
   0,
   strftime('%s','now'));
