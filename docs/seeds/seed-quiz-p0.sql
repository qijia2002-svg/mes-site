-- ============================================================
-- MES 实训平台 · P0 测验题 Seed SQL（主题 4-7 新增 + 主题 1-3 扩充）
-- 平台：Cloudflare D1（SQLite，strftime('%s','now') 生成时间戳）
-- 生成时间：2026-08-02
-- 来源：人工编写；题目内容基于 worker/src/migrations/seed-knowledge.sql
--       （主题 4-7 章节正文）与 worker/src/migrations/seed.sql（主题 1-3 章节与题型风格）
--
-- 题目规模（合计 50 题）：
--   主题 1-3：每章 4 题（2 单选 + 1 多选 + 1 判断）× 6 章 = 24 题
--     （注：需求中「共 16 题」按「每章 4 题」口径执行，6 章合计 24 题）
--   主题 4 ERP：6 题   主题 5 MES：8 题   主题 6 SQL：6 题   主题 7 PLC：6 题
--
-- 章节 ID 说明（重要）：
--   主题 1-3：chapters id = 1..6，由 seed.sql 显式指定（已核对，直接使用字面量）。
--   主题 4-7：seed-knowledge.sql 的 INSERT 未写死 id（AUTOINCREMENT 自增），
--     实际 ID 取决于灌库顺序，无法从文件中提取固定整数。
--     为保证任意灌库顺序下都命中正确章节，主题 4-7 的 chapter_id 采用运行时子查询
--     (SELECT id FROM chapters WHERE topic_id=N AND sort=M LIMIT 1) 解析（结果即整数）。
--     依赖 seed-knowledge.sql 已先行导入；若未导入，子查询返回 NULL 会触发
--     NOT NULL 约束报错（fail-fast，而非静默挂错章节）。
--   参考映射（若按 seed.sql → seed-knowledge.sql 顺序灌库时的派生 ID）：
--     topic 4: id 7-15（sort1 ERP是什么 / sort2 销售管理 / sort3 生产计划 / sort4 MRP /
--              sort5 采购 / sort6 库存 / sort7 生产管理 / sort8 财务 / sort9 ERP与MES边界）
--     topic 5: id 16-23（sort1 MES是什么 / sort2 工单管理 / sort3 物料管理 / sort4 生产报工 /
--              sort5 质量 / sort6 追溯 / sort7 设备 / sort8 看板报表）
--     topic 6: id 24-27（sort1 SELECT / sort2 WHERE / sort3 GROUP BY / sort4 JOIN）
--     topic 7: id 28-32（sort1 PLC是什么 / sort2 梯形图 / sort3 工业控制应用 /
--              sort4 SCADA-MES集成 / sort5 软PLC趋势）
--
-- 幂等性：每组 INSERT 前先按 topic_id 清理该主题下全部题目，可重复执行。
-- ============================================================


-- ============================================================
-- 主题 1 工单数据基础（章节 1-2）· 替换原每章 2 题为每章 4 题
-- ============================================================

-- ---- 章节 1：工单的生命周期与状态流（chapter_id = 1）----
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 1);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (1, 'single', '工单由已下达变为在制，触发事件是什么？', '["点击下达按钮","车间首次报工","仓库发料完成","质检首件放行"]', '1', '车间产生第一次报工说明实际生产已开始，工单才由 released 进入 running；点击下达触发的是 created 到 released 的流转。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (1, 'single', '工单 finished 后仍需关闭流程，主要因为什么？', '["核对成本入账","清点现场物料","归还工装夹具","更新工艺路线"]', '0', 'finished 是生产口径，closed 是财务口径，关闭前需完成成本归集与库存入账核对，两者之间通常隔着对账期。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (1, 'multi', '工单长期停在在制状态，可能原因有哪些？（多选）', '["漏报末批完工","质检拦截未放","报工回写失败","设备故障停机"]', '0,1,2', '漏报最后一批完工、质检拦截未放行、报工接口回写失败都会让状态停滞且现场无在制；设备故障时现场仍有在制品，不属于异常滞留。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (1, 'judge', '工单关闭后，当月发现数量错误可直接反关闭修正。', '["正确","错误"]', '0', '正确。实务通行做法是当月可反关闭修正，跨月一律不允许，只能新建调整单，此规则需在需求阶段与财务确认。', 4, strftime('%s','now'));

-- ---- 章节 2：工单主表结构与高频查询（chapter_id = 2）----
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (2, 'single', '工单主表冗余存储累计完工数量，主要为了什么？', '["提升列表查询性能","避免数据丢失","满足追溯要求","减少存储空间"]', '0', '冗余 done_qty 避免每次列表页都关联汇总海量报工流水，显著提升查询性能；代价是需定期对账发现回写偏差。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (2, 'single', '查询未完工延期工单，状态条件应怎么写？', '["只查在制状态","只查已下达状态","排除完工与关闭","只查草稿状态"]', '2', '已下达未开工的工单同样会延期，应排除 finished 与 closed 等终结状态，覆盖全部未完工单，否则会漏单。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (2, 'multi', '主表完工数与报工流水不一致，影响有哪些？（多选）', '["延期统计失真","绩效工资算错","库存账实不符","数据库变慢"]', '0,1,2', '主表数量失真会连锁导致延期统计、计件绩效、库存入账偏差，需建立定期对账机制；与数据库性能无关。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (2, 'judge', '主表完工数与流水不一致时，应以流水汇总为准。', '["正确","错误"]', '0', '正确。报工流水是只增不改的原始记录，主表冗余字段是派生值，对账时以流水汇总为准并回写修正主表。', 4, strftime('%s','now'));


-- ============================================================
-- 主题 2 BOM 与物料需求（章节 3-4）· 替换原每章 2 题为每章 4 题
-- ============================================================

-- ---- 章节 3：BOM 结构与用量计算（chapter_id = 3）----
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 2);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (3, 'single', '计划 100 台，单位用量 2，损耗率 5%，需求多少？', '["200","205","210","215"]', '2', '需求量=计划数量×单位用量×(1+损耗率)=100×2×1.05=210。漏算损耗按 200 备料，产线会做到缺料停线。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (3, 'single', '半成品既是子件又有自己的子件，属于什么？', '["多层BOM结构","平行BOM","虚拟件","替代料"]', '0', 'BOM 是自关联表，成品、半成品、原材料都是物料，半成品同时作为父件与子件就形成多层 BOM，需递归展开计算。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (3, 'multi', 'BOM 损耗率设置过高，会带来哪些影响？（多选）', '["库存积压浪费","成本核算偏高","缺料风险加大","账实差异加大"]', '0,1', '损耗率过高会放大需求量，造成多采购、库存积压、成本虚高；设置过低才会引发现场缺料，与账实差异无直接关系。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (3, 'judge', 'BOM 的单位用量应把生产损耗直接包含进去。', '["正确","错误"]', '1', '错误。单位用量是理论净用量，损耗率作为独立字段保存，两者相乘得到含损耗需求量；混在一起会破坏数据的可复用性。', 4, strftime('%s','now'));

-- ---- 章节 4：物料需求与齐套检查（chapter_id = 4）----
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (4, 'single', '可用库存比账面库存少，差在哪部分？', '["已分配与在检量","报废损耗量","在途采购量","安全库存量"]', '0', '账面库存含已被其他工单预占的已分配量和质检未放行的在检量，这两部分实际不可用，齐套判断必须用可用库存。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (4, 'single', '缺料查询要用 LEFT JOIN 而非内连接，因为？', '["执行效率更高","避免产生重复行","无库存记录会漏掉","可配合聚合函数"]', '2', '新导入物料可能在库存表中完全没有记录，内连接会丢弃这些行，而它们恰恰是最严重的缺料；还需 COALESCE 把 NULL 转 0。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (4, 'multi', '系统判定齐套但现场领不到料，原因有哪些？（多选）', '["误用账面库存","物料已分配他单","库位信息错误","BOM层级过深"]', '0,1,2', '账面库存含已分配量导致虚齐套、物料被其他工单预占、库位错误找不到实物，都会出现查有领无；BOM 层级与此无关。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (4, 'judge', '齐套检查应使用可用库存而不是账面库存。', '["正确","错误"]', '0', '正确。账面库存包含已分配、在检等不可用部分，只有可用库存才能真实反映当前可领用数量。', 4, strftime('%s','now'));


-- ============================================================
-- 主题 3 报工与完工入库（章节 5-6）· 替换原每章 2 题为每章 4 题
-- ============================================================

-- ---- 章节 5：报工数据模型与合格率（chapter_id = 5）----
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 3);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (5, 'single', '报工表分存合格数与不良数，而不是合格率？', '["数量可跨批相加","节省存储空间","界面显示更直观","方便排序统计"]', '0', '合格数与不良数具有可加性，任意维度都能重算；批次合格率不能直接平均，只存比率会丢失原始数据。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (5, 'single', '整数相除计算合格率，结果会怎样？', '["小数被截断失真","语法直接报错","自动四舍五入","结果必然为零"]', '0', '整数除以整数执行整数除法，小数被截断，应乘以 100.0 转浮点运算；生产环境还需 CASE WHEN 处理分母为零。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (5, 'multi', '某工单合格率异常偏低，可能原因有哪些？（多选）', '["不良数录入错误","合格数漏报漏录","报工混入他单","设备异常停机"]', '0,1,2', '不良数录高、合格数漏报、报工错混其他工单都会使合格率失真，需按工单与班次核对原始流水；设备停机不直接影响该指标。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (5, 'judge', '报工记录录错后，可直接修改原记录。', '["正确","错误"]', '1', '错误。报工表是只增不改的流水表，应追加负数冲销记录再补录正确数据，保留审计轨迹，满足质量追溯要求。', 4, strftime('%s','now'));

-- ---- 章节 6：完工入库与工单关闭（chapter_id = 6）----
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (6, 'single', '入库数与 ERP 对不上，第一步应查什么？', '["主表与流水比对","检查网络故障","核对物料编码","查看操作日志"]', '0', '对账应分段定位：先比主表 done_qty 与报工流水汇总，再逐层比对报工与入库、入库与 ERP 接收，找出断点。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (6, 'single', '报工数据录错后，正确处理方式是什么？', '["追加负数冲销","直接修改原值","删除重新录入","管理员改库"]', '0', '报工表只增不改，追加负数冲销可保留完整审计轨迹；直接修改或删除会销毁证据，导致追溯链断裂。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (6, 'multi', '完工数量正确但工单无法关闭，可能原因？（多选）', '["存在未入库数","成本未归集","质量未放行","交期已超期"]', '0,1,2', '关闭是财务口径，需入库数量齐、成本已归集、质检放行后才能关闭；交期超期只影响延期统计，不阻塞关闭。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (6, 'judge', '实务中跨月工单通常不允许直接反关闭。', '["正确","错误"]', '0', '正确。跨月反关闭会破坏已结算成本与报表，只能通过新建调整单修正，此规则需在需求阶段与财务确认。', 4, strftime('%s','now'));


-- ============================================================
-- 主题 4 ERP 原理与模块（6 题：2 理解 + 2 应用 + 2 分析）
--   章节按 seed-knowledge.sql 中 topic_id=4 的 sort 定位：
--   sort1=ERP 是什么 / sort3=生产计划 / sort4=MRP / sort9=ERP与MES的边界
-- ============================================================
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 4);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 4 AND sort = 1 LIMIT 1), 'single', 'ERP 的核心定位是什么？', '["企业资源计划","设备控制系统","车间执行系统","数据采集系统"]', '0', 'ERP=企业资源计划，把公司的人、财、物、产、供、销全部管起来，属于计划层系统。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 4 AND sort = 9 LIMIT 1), 'single', 'ERP 与 MES 的主要区别是什么？', '["计划层对执行层","执行层对计划层","两者完全相同","MES属于ERP"]', '0', 'ERP 是计划层，管到生产订单、粒度天/周；MES 是执行层，管到工序与 SN、粒度分钟/秒。ERP 回答要做什么，MES 回答做得怎么样。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 4 AND sort = 4 LIMIT 1), 'single', 'MRP 运算的第一步是什么？', '["查BOM展开需求","生成采购订单","计算生产成本","更新库存台账"]', '0', 'MRP 先根据订单查 BOM 算出毛需求，再减去现有库存得到净需求，最后生成采购与生产计划。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 4 AND sort = 3 LIMIT 1), 'single', '销售订单到生产的正确流向是？', '["订单转生产计划","直接通知车间","跳过计划排产","仅更新财务账"]', '0', '销售订单进入 ERP 后经主生产计划与 MRP 形成生产计划再下达车间，同时联动采购与库存，不能绕过计划直接通知车间。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 4 AND sort = 4 LIMIT 1), 'single', 'MRP 输出中净需求为负，说明什么？', '["库存足够不需采购","必须立即采购","BOM数据错误","订单已经取消"]', '0', '净需求=毛需求-现有库存-在途量，为负说明现有库存已覆盖需求，无需生成采购建议；若反复异常需检查库存数据。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 4 AND sort = 9 LIMIT 1), 'single', 'ERP 物料编码混乱对 MES 有何影响？', '["追溯与对账失败","MES自动修复","仅影响打印","没有任何影响"]', '0', 'MES 以 ERP 主数据为基准，编码不一致会导致工单关联错乱、报工无法回传、追溯链断裂，主数据治理是集成项目的前提。', 2, strftime('%s','now'));


-- ============================================================
-- 主题 5 MES 核心模块（8 题：2 记忆/理解 + 2 应用 + 2 分析 + 2 应用/分析）
--   章节按 seed-knowledge.sql 中 topic_id=5 的 sort 定位：
--   sort1=MES是什么 / sort2=工单管理 / sort4=生产报工 / sort6=追溯管理 / sort7=设备管理 / sort8=看板与报表
-- ============================================================
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 5);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 1 LIMIT 1), 'single', 'MES 的中文全称是什么？', '["制造执行系统","企业资源计划","仓库管理系统","设备数据采集"]', '0', 'MES=Manufacturing Execution System=制造执行系统，是面向车间执行层的生产数字化管理系统。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 1 LIMIT 1), 'single', '下列哪项不属于 MES 核心模块？', '["工单管理","生产报工","财务核算","追溯管理"]', '2', 'MES 核心模块包括工单、物料、报工、质量、追溯、设备、电子SOP、看板报表；财务核算是 ERP 的职能。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 2 LIMIT 1), 'single', 'ERP 生产订单在 MES 中转化为？', '["工序级工单","采购订单","质检报告","设备点检表"]', '0', 'MES 将 ERP 生产订单拆分为按工序与工位执行的工单（如 15 道工序对应多张工单），工位扫码接单并报工。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 4 LIMIT 1), 'single', '报工记录必须包含哪类要素？', '["人机料时数量","仅数量即可","仅操作人姓名","设备型号参数"]', '0', '报工需记录谁、什么时间、哪个工单与工位、做了多少、合格多少、不良多少，支撑计件工资与质量追溯。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 2 LIMIT 1), 'single', 'MES 与 ERP 工单状态不一致，先查哪里？', '["接口同步日志","数据库备份","网络交换机","机房温湿度"]', '0', '状态不一致通常是状态变更未回传或回传失败，应先查接口同步日志与失败重试，再核对主数据编码映射。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 6 LIMIT 1), 'single', '判断追溯链是否完整，应重点检查？', '["SN绑定物料工序","工单备注信息","看板刷新频率","报表导出格式"]', '0', '完整追溯需 SN 与物料批次、工序、人员、质检结果全部绑定，任一环节缺失都会导致正反向追溯断链。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 7 LIMIT 1), 'single', '设备稼动率一般如何计算？', '["运行时间占比","合格率占比","产量产能比","维修次数比"]', '0', 'OEE=可用率×性能率×良品率，稼动率指实际运行时间占计划生产时间的比例，反映设备时间利用水平。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 5 AND sort = 8 LIMIT 1), 'single', 'Andon 看板能触发报警，前提是什么？', '["异常数据已采集","看板样式美观","报表格式统一","领导在场观看"]', '0', '看板是数据的可视化，必须先有实时采集的异常数据（缺料、设备故障、质量超差），否则看板只是空壳。', 1, strftime('%s','now'));


-- ============================================================
-- 主题 6 SQL 查询基础（6 题：2 记忆/理解 + 2 应用 + 2 分析）
--   章节按 seed-knowledge.sql 中 topic_id=6 的 sort 定位：
--   sort1=SELECT 查询 / sort2=WHERE 条件过滤 / sort3=GROUP BY 分组统计 / sort4=JOIN 多表关联
-- ============================================================
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 6);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 6 AND sort = 1 LIMIT 1), 'single', 'SELECT 语句的主要作用是什么？', '["查询取数","删除数据","修改数据","建表结构"]', '0', 'SELECT 用于从表中查询数据，配合 FROM 指定表、WHERE 过滤、GROUP BY 分组、ORDER BY 排序。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 6 AND sort = 3 LIMIT 1), 'single', 'GROUP BY 分组统计常配合哪类函数？', '["聚合函数","字符串函数","日期函数","随机函数"]', '0', 'GROUP BY 将数据按分组列聚合，配合 COUNT、SUM、AVG、MAX、MIN 等聚合函数统计每组结果。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 6 AND sort = 2 LIMIT 1), 'single', '查运行中且数量大于零的工单，条件为？', '["AND连接两条件","OR连接两条件","只用状态条件","不用任何条件"]', '0', '多个条件需同时满足时用 AND 连接；OR 表示任一满足，会扩大结果集导致误查。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 6 AND sort = 3 LIMIT 1), 'single', '统计车间产量并筛选超千，用哪个子句？', '["分组HAVING","排序加LIMIT","过滤加去重","关联加合并"]', '0', 'GROUP BY 按车间分组，聚合后对组结果过滤必须用 HAVING；WHERE 只能过滤原始行。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 6 AND sort = 3 LIMIT 1), 'single', '子查询算出最大不良率，外层再怎样？', '["比较后取该工单","直接删除数据","合并两张表","更新全部记录"]', '0', '子查询先算出最大不良率，外层用相等比较定位对应工单，避免手工翻找最大行。', 3, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 6 AND sort = 4 LIMIT 1), 'single', 'JOIN 查报工明细时，最关键的是什么？', '["关联字段正确","表名大小写","注释完整","字段顺序"]', '0', 'JOIN 依赖两表间的关联字段正确匹配，如报工表工单号关联工单表主键，关联错位会产生笛卡尔积或漏行。', 1, strftime('%s','now'));


-- ============================================================
-- 主题 7 PLC 基础（6 题：2 记忆/理解 + 2 应用 + 2 分析）
--   章节按 seed-knowledge.sql 中 topic_id=7 的 sort 定位：
--   sort1=PLC 是什么 / sort2=PLC 编程语言与梯形图 / sort3=PLC 与工业控制应用 / sort4=PLC 与 SCADA/MES 集成
-- ============================================================
DELETE FROM questions WHERE chapter_id IN (SELECT id FROM chapters WHERE topic_id = 7);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 7 AND sort = 1 LIMIT 1), 'single', 'PLC 的工作方式是下列哪种？', '["循环扫描","事件驱动","中断独占","并行处理"]', '0', 'PLC 按读输入、执行程序、处理通信、自诊断、写输出循环扫描，周期约 1-10ms，输出在周期末统一刷新。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 7 AND sort = 2 LIMIT 1), 'single', '梯形图常闭触点在什么条件下导通？', '["对应位为0时","对应位为1时","始终导通","始终断开"]', '0', '常闭触点与继电器常闭对应，输入位为 0 时导通、为 1 时断开；常开触点则相反。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 7 AND sort = 2 LIMIT 1), 'single', '按钮按下灯亮松开灭，用哪种触点？', '["常开触点直连线圈","常闭触点直连","自锁回路","定时器控制"]', '0', '常开触点接输入按钮、输出线圈接灯，按钮按下输入为 1 触点导通灯亮；需要保持点亮才用自锁回路。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 7 AND sort = 1 LIMIT 1), 'single', 'PLC 输入模块的主要作用是什么？', '["采集外部信号","驱动电机","执行运算","存储程序"]', '0', '输入模块采集按钮、传感器等信号给 CPU，输出模块驱动继电器、接触器等执行器，两者是 PLC 与现场的接口。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 7 AND sort = 4 LIMIT 1), 'single', 'SCADA 读不到 PLC 数据，先查什么？', '["通信链路与地址","更换PLC程序","重装SCADA","更换传感器"]', '0', '按物理链路、通信参数、寄存器地址的顺序排查：网线串口、协议参数（波特率、站号）、地址映射（如 MW10）是否一致。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES ((SELECT id FROM chapters WHERE topic_id = 7 AND sort = 3 LIMIT 1), 'single', '模拟量信号与数字量信号主要区别是？', '["连续值对开关量","电压对电流","快慢对高低","远传对本地"]', '0', '模拟量是连续变化的值（温度、压力、流量，需 AD 转换），数字量只有 0/1 两种状态（按钮、到位信号）。', 1, strftime('%s','now'));
