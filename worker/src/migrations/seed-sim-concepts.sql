-- 模拟器进阶面板深链所需的概念缺口（PRD-FactorySim-v1 §6.1 advisory）。
-- 现有 concepts 表仅有 15 条，模拟器涉及的 bottleneck / lead_time / changeover / oee_idle 缺失。
-- 补建这 4 条概念并挂 knowledge_links（source_type='topic'），使模拟器「进阶」面板能直接深链到知识图，
-- 形成「动手调 → 恍然大悟 → 系统学」的闭环。
--
-- 重跑安全：concepts 用 key 冲突更新；knowledge_links 先按 concept_id 清后插。

INSERT INTO concepts (key, label, definition, topic_id, sort) VALUES
  ('bottleneck', '瓶颈工序', '整条产线能出多少，被最慢那道工序死死卡住，别的工序再快也没用', 1012, 100),
  ('lead_time',  '提前期 / 交期', '从接到订单到真正交货花的时间；排队和等待常占八成以上，别拿加工时间当交期', 1011, 101),
  ('changeover', '换型 / 快速换型', '一批做完切换下一批时要停机调机器；切太碎，机器全在调机没在干活', 6007, 102),
  ('oee_idle',   '设备闲置率', '机器前面没活干只能干等，多半是因为上游或瓶颈没喂饱它，不是工人懒', 6007, 103)
ON CONFLICT(key) DO UPDATE SET
  label = excluded.label,
  definition = excluded.definition,
  topic_id = excluded.topic_id;

-- 先清后插，保证重跑幂等
DELETE FROM knowledge_links
WHERE concept_id IN (SELECT id FROM concepts WHERE key IN ('bottleneck', 'lead_time', 'changeover', 'oee_idle'));

INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 1012, 'about', 2 FROM concepts c WHERE c.key = 'bottleneck';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 6007, 'about', 1 FROM concepts c WHERE c.key = 'bottleneck';

INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 1011, 'about', 2 FROM concepts c WHERE c.key = 'lead_time';
INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 5019, 'about', 1 FROM concepts c WHERE c.key = 'lead_time';

INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 6007, 'about', 2 FROM concepts c WHERE c.key = 'changeover';

INSERT INTO knowledge_links (concept_id, source_type, source_ref, relation, weight)
SELECT c.id, 'topic', 6007, 'about', 2 FROM concepts c WHERE c.key = 'oee_idle';
