-- 种子：通用工厂主线（订单 → 交付），覆盖销售/计划/采购/生产/质量/仓储/发货
-- 主干是工厂业务流；MES/ERP/WMS/QMS 为横切系统标签（见 flow_node_system 可选扩展）。
-- 重跑安全：先清 generic-factory，再插入。
-- 部署：
--   wrangler d1 execute mes-learning --local  --file=./src/migrations/seed-flowchart-generic.sql
--   wrangler d1 execute mes-learning --remote --file=./src/migrations/seed-flowchart-generic.sql

PRAGMA foreign_keys = OFF;
DELETE FROM flow_edges  WHERE flow_id IN (SELECT id FROM flowcharts WHERE slug = 'generic-factory');
DELETE FROM flow_nodes  WHERE flow_id IN (SELECT id FROM flowcharts WHERE slug = 'generic-factory');
DELETE FROM flowcharts WHERE slug = 'generic-factory';
PRAGMA foreign_keys = ON;

INSERT INTO flowcharts (slug, title, description, status, sort, created_at, updated_at)
VALUES (
  'generic-factory',
  '通用工厂主线（订单 → 交付）',
  '覆盖销售、计划、采购、生产、质量、仓储、发货的全厂业务流。MES/ERP/WMS/QMS 为横切系统标签，挂在节点上，不是主干。',
  'published', 0, strftime('%s','now'), strftime('%s','now')
);

-- 节点（kind: entry|process|exit|hub；icon 为 lucide 名）
INSERT INTO flow_nodes (flow_id, node_key, label, kind, icon, x, y, description, sort) VALUES
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'cust-order',   '客户下单',     'entry',   'shopping-cart', 0,    200, '销售订单录入：客户要什么、多少、何时要。', 1),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'order-review', '订单评审',     'process', 'clipboard-check', 140,  200, '评审交期、产能、物料齐套性，决定是否接单与承诺交期。', 2),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'mps',          '主生产计划',   'process', 'calendar',       280,  200, '把订单转成可执行的月度/周生产计划（MPS）。', 3),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'mrp',          '物料需求计划', 'process', 'calculator',     420,  200, '按 BOM 展开，算出自制/外购物料的需求量与时间（MRP）。', 4),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'purchase',     '采购与供应商', 'process', 'truck',         560,  120, '下采购单、跟供应商交期、到货与进料检验（IQC）。', 5),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'bom-route',    'BOM 与工艺路线', 'process', 'git-branch',    560,  280, '定义产品物料清单（BOM）与每道工序的工艺路线。', 6),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'picking',      '领料发料',     'process', 'package',        700,  200, '仓储按工单发料到线边仓/工位（WMS）。', 7),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'dispatch',     '生产派工',     'process', 'send',           840,  200, '把生产指令下达到具体工作中心/产线（MES 工单）。', 8),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'shopfloor',    '车间执行',     'process', 'factory',        980,  200, '工序加工、报工（扫码/PDA/工单电脑）、在制品跟踪（MES）。', 9),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'qc',           '质量检验',     'process', 'check-circle',  1120,  200, '首检/巡检/终检，SPC 与质量追溯（QMS）。', 10),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'stock-in',     '生产入库',     'process', 'warehouse',     1260,  200, '成品入库，更新库存（WMS）。', 11),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'shipping',     '发货出库',     'exit',    'log-out',       1400,  200, '按发货单拣货、装车、物流交付给客户。', 12);

-- 连线（MRP 分支到 采购 与 BOM/工艺，二者汇聚到 领料）
INSERT INTO flow_edges (flow_id, from_key, to_key, label) VALUES
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'cust-order',  'order-review', ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'order-review', 'mps',         ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'mps',         'mrp',         ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'mrp',         'purchase',    '外购件'),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'mrp',         'bom-route',   '自制件 BOM'),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'purchase',     'picking',     ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'bom-route',    'picking',     ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'picking',      'dispatch',    ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'dispatch',     'shopfloor',   ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'shopfloor',    'qc',          ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'qc',           'stock-in',    ''),
((SELECT id FROM flowcharts WHERE slug='generic-factory'), 'stock-in',     'shipping',    '');
