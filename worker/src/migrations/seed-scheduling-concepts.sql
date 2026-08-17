-- 排产教学化（路线图 P0-1）· 知识图概念缺口补齐。
-- 现有 concepts 表（19 条）覆盖 MRP/BOM/齐套/工单/报工/追溯/入库 + 模拟器 4 概念，
-- 但「计划层」缺 排产(scheduling) / 工序负荷(load) / 高级计划排程(aps) 三块，
-- 正好对应 free-mes 对标的「生产计划·排产」域——本平台唯一完全空缺的核心支柱。
-- 本文件补建这 3 条概念并挂 knowledge_links，使排产迷你模拟（/scheduling）能反链知识图。
--
-- 重跑安全：concepts 用 key 冲突更新；knowledge_links 先按 concept_id 清后插。
-- 指认全部指向真实存在的工件（复用 seed-knowledge-graph.sql 已验证的 flow_nodes / topic）：

INSERT INTO concepts (key, label, definition, topic_id, sort) VALUES
  ('scheduling', '生产排产', '把一张张工单按工艺路线排到各工作中心，决定谁先谁后、每台机器干什么，目标是在交期内把活干完。它接在 MRP 算出"要造多少"之后，是计划真正落到车间的关键一步。', 6, 110),
  ('load', '工序负荷', '某道工序/工作中心在一段时间里要干的活的总量（件数 × 单件工时）。哪道工序负荷最高，哪道就是瓶颈——排产的本质就是别让负荷堵在一道工序上。', 6, 111),
  ('aps', '高级计划排程 APS', '排产的进阶形态：用算法在成千上万张工单、几十个工作中心之间自动找最优顺序，同时权衡交期、产能、换型。教学里我们用 3 张工单体会"顺序怎么影响总工期、瓶颈怎么卡死全线"。', 6, 112)
ON CONFLICT(key) DO UPDATE SET
  label = excluded.label,
  definition = excluded.definition,
  topic_id = excluded.topic_id;

-- 先清后插，保证重跑幂等
DELETE FROM knowledge_links
WHERE concept_id IN (SELECT id FROM concepts WHERE key IN ('scheduling', 'load', 'aps'));

-- scheduling：上游主生产计划(mps) + 下游派工(dispatch) + 计划主题(topic 6)
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'node', (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3 FROM concepts c WHERE c.key = 'scheduling';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'node', (SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3 FROM concepts c WHERE c.key = 'scheduling';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 6, 'about', 1 FROM concepts c WHERE c.key = 'scheduling';

-- load：工艺路线决定各道负荷(bom-route) + 主生产计划(mps) + 计划主题(topic 6)
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'node', (SELECT id FROM flow_nodes WHERE node_key='bom-route' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3 FROM concepts c WHERE c.key = 'load';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'node', (SELECT id FROM flow_nodes WHERE node_key='mps' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 2 FROM concepts c WHERE c.key = 'load';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 6, 'about', 1 FROM concepts c WHERE c.key = 'load';

-- aps：派工(dispatch，排产落地的下一环) + 计划主题(topic 6)
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'node', (SELECT id FROM flow_nodes WHERE node_key='dispatch' AND flow_id=(SELECT id FROM flowcharts WHERE slug='generic-factory')), 'about', 3 FROM concepts c WHERE c.key = 'aps';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 6, 'about', 1 FROM concepts c WHERE c.key = 'aps';
