-- ============================================================================
-- 课程数据去重优化 · 迁移脚本
-- 针对已有部署执行：修复标签、新增学习路径、创建跨引用
-- 全部用 INSERT OR REPLACE / UPDATE，可重复执行（幂等）。
-- ============================================================================

-- 1. 修复 Topic 6（SQL 查询基础）模块标签：支持 sql + quiz 模块
UPDATE topics SET modules = '["theory","sql","quiz"]', description = 'SELECT/WHERE/GROUP BY/JOIN/子查询/窗口函数' WHERE id = 6;

-- 2. 更新"现场 SQL 排查专项"描述，标明包含 BOM
UPDATE learning_paths SET description = '面向运维岗，聚焦数量对不上、合格率异常这类高频报障，训练用 SQL 分段比对定位问题边界（含 BOM 用料核对）的能力。' WHERE slug = 'onsite-sql-troubleshoot';

-- 3. 新增学习路径（幂等：slug UNIQUE，已存在则忽略）
INSERT OR IGNORE INTO learning_paths (slug, title, description, topic_ids, sort, status, created_at) VALUES ('mes-erp-overview', 'MES+ERP 全景通识', '先建立 ERP 经营全局视角，再深入 MES 车间执行层，形成"上接计划、下接设备"的完整知识链。适合转行新人或跨部门协作人员。', '[4,5]', 3, 'published', strftime('%s','now'));

INSERT OR IGNORE INTO learning_paths (slug, title, description, topic_ids, sort, status, created_at) VALUES ('sql-practical', 'SQL 从基础到实战', '从零学 SQL 查询语法，用 MES 工单报工资数据练手，最后到综合实战场景。纯动手路径，每门课都带 SQL 练习。', '[6,1,3]', 4, 'published', strftime('%s','now'));

INSERT OR IGNORE INTO learning_paths (slug, title, description, topic_ids, sort, status, created_at) VALUES ('smart-manufacturing', '智能制造基础', 'PLC 工业控制入门 → ERP 企业资源规划，从设备层到管理层打通智能制造认知链路。', '[7,4]', 5, 'published', strftime('%s','now'));

-- 4. 给知识型课程添加跨引用（topic description 中注明关联实操课）
UPDATE topics SET description = '从销售订单到财务结算的企业经营全貌。配套实操：工单管理（课程1）、BOM与物料管理（课程2）' WHERE id = 4;
UPDATE topics SET description = '工单/物料/报工/质量/追溯/设备/看板。配套实操：工单管理（课程1）、报工与完工入库（课程3）' WHERE id = 5;
UPDATE topics SET description = 'SELECT/WHERE/GROUP BY/JOIN/子查询/窗口函数。配套实操：工单管理（课程1）、报工与完工入库（课程3）' WHERE id = 6;
UPDATE topics SET description = '基础/梯形图/工业控制/SCADA-MES集成。进阶：MES核心模块（课程5）' WHERE id = 7;
