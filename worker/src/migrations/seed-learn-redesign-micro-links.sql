-- ============================================================================
-- 种子：把 12 个微练习挂到节点（node_resources 的 res_type='micro' 行）
-- ----------------------------------------------------------------------------
-- 依据：seed-learn-redesign-content.sql 的 S5 注释——「前端 micro 交互上线后，
--       由前端负责人确认时机再单独出一份挂载种子」。本文件即那份挂载种子。
--
-- 为什么必须挂：NodeDrawerBody 在节点实战区按 node_resources 渲染 micro 卡片，
--   r.type === 'micro' 时取 r.refId 调 GET /api/v1/micro-practices/:id。
--   不挂这层，微练习永远不出现在任何节点下，学员看不到也练不了。
--
-- 安全铁律（R6 同款）：node_resources 只存「挂载关系」（res_type + ref_id），
--   micro 的 answer 仍在 micro_practices 表，本文件不碰、不拷贝答案。
--
-- 完成度影响：BLOCK-02 已限定入门段 practice_types=['micro','quiz']，
--   现在 micro 可完成，正好进分母；其余阶段 micro 也计入，与全集一致。无事故。
--
-- 部署：
--   node scripts/d1q.mjs --file worker/src/migrations/seed-learn-redesign-micro-links.sql --local
--   node scripts/d1q.mjs --file worker/src/migrations/seed-learn-redesign-micro-links.sql
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 重跑安全：先清掉本文件管理的 micro 挂载，再按显式 id 段插入，不碰别人的数据。
DELETE FROM node_resources
 WHERE res_type = 'micro' AND ref_id BETWEEN 9401 AND 9499;

INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
((SELECT id FROM flow_nodes WHERE node_key='cust-order' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9401, '动手练：挑出未评审的急单', 50),
((SELECT id FROM flow_nodes WHERE node_key='order-review' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9402, '动手练：找出接了没排的订单', 50),
((SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9403, '动手练：排好主生产计划四步', 50),
((SELECT id FROM flow_nodes WHERE node_key='mrp' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9404, '动手练：配平应发量算式', 50),
((SELECT id FROM flow_nodes WHERE node_key='purchase' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9405, '动手练：列出逾期未到的采购单', 50),
((SELECT id FROM flow_nodes WHERE node_key='bom-route' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9406, '动手练：连好产品与最大用量物料', 50),
((SELECT id FROM flow_nodes WHERE node_key='picking' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9407, '动手练：判断这张工单齐套没', 50),
((SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9408, '动手练：找到派不下去的卡点', 50),
((SELECT id FROM flow_nodes WHERE node_key='shopfloor' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9409, '动手练：排好报工四步顺序', 50),
((SELECT id FROM flow_nodes WHERE node_key='qc' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9410, '动手练：排好质量动作顺序', 50),
((SELECT id FROM flow_nodes WHERE node_key='stock-in' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9411, '动手练：查清报工与工单的差', 50),
((SELECT id FROM flow_nodes WHERE node_key='shipping' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')),
 'micro', 9412, '动手练：找出晚交的那一批', 50);
