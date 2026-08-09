-- ============================================================================
-- 种子：工厂主线 12 节点的 sim 实战（让抽屉「仿真」实战出现，并能被完成计入进度）。
-- ----------------------------------------------------------------------------
-- 配套 seed-flowchart-generic.sql（流程图骨架）与本文件（sim 资源）。
--
-- 设计约束（同 seed-flowchart-generic-resources.sql）：
--   C1  节点完成度只认「做过实战」。sim 实战做完 → 派发 factory:resource-done
--       事件（type=sim, refId=节点序号 1..12），进度落在 factory.progress。
--   C2  node_resources.title 必须是祈使句 —— 学员看到的是一个动作。
--   C3  沙盒即流程图同一个「通用工厂」；ref_id 与前端 simScenario.SIM_REF_ID 一一对应。
--
-- ref_id 取值 1..12（= FLOW_ORDER 序号），与前端 simScenario.SIM_REF_ID 对齐，
-- 否则抽屉 isDone 与沙盒派发的 refId 对不上，进度会「做了却没记上」。
--
-- 重跑安全：先按业务键清掉本 seed 管辖的 sim 行，再插入。不碰其它 res_type。
--
-- 部署：
--   node scripts/d1q.mjs --file worker/src/migrations/seed-flowchart-generic-sim.sql --local
--   node scripts/d1q.mjs --file worker/src/migrations/seed-flowchart-generic-sim.sql
-- ============================================================================

PRAGMA foreign_keys = OFF;
DELETE FROM node_resources
 WHERE res_type = 'sim'
   AND node_id IN (
     SELECT id FROM flow_nodes
      WHERE flow_id IN (SELECT id FROM flowcharts WHERE slug = 'generic-factory')
   );
PRAGMA foreign_keys = ON;

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'cust-order'),   'sim', 1,  '看一张客户订单怎么变成工单',              1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'order-review'),'sim', 2,  '试着评审这张订单能不能接',                1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mps'),          'sim', 3,  '把订单拆成可执行的周生产计划',            1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'),          'sim', 4,  '按 BOM 展开算出自制与外购需求',          1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'purchase'),     'sim', 5,  '看采购怎么跟催逾期的物料',                1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'bom-route'),    'sim', 6,  '定义这张产品的 BOM 与工艺路线',          1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'picking'),      'sim', 7,  '看领料齐套怎么卡住整张工单',              1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'dispatch'),     'sim', 8,  '把生产指令下达到具体产线',                1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shopfloor'),    'sim', 9,  '看工单 WO-2026-001 怎么在车间里流转',     1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'qc'),           'sim', 10, '看质检怎么判不合格并追溯原因',            1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'stock-in'),     'sim', 11, '看成品怎么入库并更新库存',                1),
((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'shipping'),     'sim', 12, '看合格品怎么发货交付给客户',              1);
