-- ============================================================================
-- 学习体系 v2 数据库迁移
-- 1. topics 表增加 prerequisites / difficulty / estimated_hours
-- 2. learning_paths 表增加 stages / stage_unlock_type / stage_unlock_value
-- 3. 为现有种子数据填充默认值
-- 全部幂等（IF NOT EXISTS / UPDATE），可重复执行。
-- ============================================================================

-- 1. topics 扩展
ALTER TABLE topics ADD COLUMN prerequisites TEXT NOT NULL DEFAULT '[]';     -- JSON: [courseId, ...]
ALTER TABLE topics ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'beginner';   -- beginner / intermediate / advanced
ALTER TABLE topics ADD COLUMN estimated_hours INTEGER NOT NULL DEFAULT 4;

-- 2. learning_paths 扩展
ALTER TABLE learning_paths ADD COLUMN stages TEXT NOT NULL DEFAULT '[]';         -- JSON: [{name, courses:[courseId]}]
ALTER TABLE learning_paths ADD COLUMN stage_unlock_type TEXT NOT NULL DEFAULT 'all_prev'; -- all_prev / credits
ALTER TABLE learning_paths ADD COLUMN stage_unlock_value INTEGER NOT NULL DEFAULT 0;

-- 3. 填充种子课程的前置依赖 + 难度 + 课时
-- 课程1: 工单管理与生产执行 (进阶, 需先学 SQL基础 课程6)
UPDATE topics SET difficulty = 'intermediate', estimated_hours = 6, prerequisites = '[6]' WHERE id = 1;
-- 课程2: BOM 与物料管理 (进阶, 需先学 工单管理)
UPDATE topics SET difficulty = 'intermediate', estimated_hours = 5, prerequisites = '[1]' WHERE id = 2;
-- 课程3: 报工与完工入库 (进阶, 需先学 工单管理)
UPDATE topics SET difficulty = 'intermediate', estimated_hours = 4, prerequisites = '[1]' WHERE id = 3;
-- 课程4: ERP (入门, 无前置)
UPDATE topics SET difficulty = 'beginner', estimated_hours = 8, prerequisites = '[]' WHERE id = 4;
-- 课程5: MES 核心模块 (进阶, 建议先学 ERP)
UPDATE topics SET difficulty = 'intermediate', estimated_hours = 10, prerequisites = '[4]' WHERE id = 5;
-- 课程6: SQL 查询基础 (入门, 无前置)
UPDATE topics SET difficulty = 'beginner', estimated_hours = 6, prerequisites = '[]' WHERE id = 6;
-- 课程7: PLC (进阶, 建议先学 MES核心)
UPDATE topics SET difficulty = 'intermediate', estimated_hours = 8, prerequisites = '[5]' WHERE id = 7;

-- 4. 填充学习路径的阶段信息
-- 路径1: MES 实施新人入门 (3阶段)
UPDATE learning_paths SET
  stages = '[{"name":"阶段一 基础入门","courses":[6,4]},{"name":"阶段二 核心实战","courses":[1,2]},{"name":"阶段三 综合应用","courses":[3,5]}]',
  stage_unlock_type = 'all_prev',
  topic_ids = '[6,4,1,2,3,5]'
WHERE slug = 'mes-implementation-newbie';

-- 路径2: 现场 SQL 排查专项 (2阶段)
UPDATE learning_paths SET
  stages = '[{"name":"阶段一 SQL基础","courses":[6]},{"name":"阶段二 业务排查","courses":[1,2,3]}]',
  stage_unlock_type = 'all_prev',
  topic_ids = '[6,1,2,3]'
WHERE slug = 'onsite-sql-troubleshoot';

-- 路径3: MES+ERP 全景通识 (2阶段)
UPDATE learning_paths SET
  stages = '[{"name":"阶段一 企业经营","courses":[4]},{"name":"阶段二 车间执行","courses":[5]}]',
  stage_unlock_type = 'all_prev'
WHERE slug = 'mes-erp-overview';

-- 路径4: SQL 从基础到实战 (2阶段)
UPDATE learning_paths SET
  stages = '[{"name":"阶段一 SQL语法","courses":[6]},{"name":"阶段二 MES实战","courses":[1,3]}]',
  stage_unlock_type = 'all_prev'
WHERE slug = 'sql-practical';

-- 路径5: 智能制造基础 (2阶段)
UPDATE learning_paths SET
  stages = '[{"name":"阶段一 设备层","courses":[7]},{"name":"阶段二 管理层","courses":[4]}]',
  stage_unlock_type = 'all_prev'
WHERE slug = 'smart-manufacturing';
