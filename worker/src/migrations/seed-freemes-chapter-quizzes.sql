-- ============================================================================
-- 种子：为「MES 二开借鉴（free-mes 源码抽取）」加深的 6 章补配套章节自测题。
-- 章节：67 生产报工 / 69 追溯管理 / 313 批次与SN码管理 / 320 质量追溯 /
--       9110 车间报工 / 9113 质量追溯(往回摸根因)。
-- 每题严格锚定章节正文（含末尾「参考 free-mes」小节），不编造、不泛泛而谈。
-- 字段格式照抄 seed-content-backfill.sql：
--   type: single | judge
--   options: JSON 数组字符串
--   answer: 选项下标（single/judge 为单个数字：judge 中 '0'=正确 '1'=错误）
--   explanation: 中文解析，点出锚点
-- 重跑安全：先 DELETE 这 6 章的全部题，再 INSERT；不碰其它章节。
-- 部署：node node_modules/wrangler/bin/wrangler.js d1 execute mes-learning --remote --file=worker/src/migrations/seed-freemes-chapter-quizzes.sql
-- ============================================================================

DELETE FROM questions WHERE chapter_id IN (67, 69, 313, 320, 9110, 9113);

INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES

  -- ===== 67 生产报工 =====
  (67, 'single', '本章把报工一句话理解为「记录谁在什么时间做了多少件、合格多少、不良多少」。但在参考的免费-mes 真实实现里，合格数和不良数最终存在哪里？',
   '["每次报工的 Feedback 主表里","任务 FINISHED 时写入的质检单(ProcessRecord)","工单主表 work_orders","设备表"]',
   '1',
   '正文末尾参考 free-mes 指出：报工主表里没有「合格/不良」字段，合格数和不良数是在任务 FINISHED 时才写进质检单的。报工只记「做了多少、花了多少时间」，质检才记「做得好不好」，两者分离。',
   1, strftime('%s','now')),

  (67, 'judge', '本章教学模型的报工表 production_record 里放了 good_qty/ng_qty（合格/不良），这是真实 MES 的通用做法。',
   '["正确","错误"]',
   '1',
   '错误。正文参考 free-mes 明确：把 good_qty/ng_qty 放在报工表是教学简化；真实系统里合格/不良在任务完工时才进质检单，与报工主表分离，不能当成通用做法。',
   2, strftime('%s','now')),

  -- ===== 69 追溯管理 =====
  (69, 'single', '追溯管理里，正向追溯与反向追溯的方向分别是？',
   '["正向：原材料→零部件→半成品→成品；反向：成品→半成品→零部件→原材料","正向：成品→原材料；反向：原材料→成品","两者方向相同，都是成品→原材料","两者方向相同，都是原材料→成品"]',
   '0',
   '正文一句话理解与双轨对比表：正向追溯从原材料/零部件出发沿生产流程到成品；反向追溯从最终产品出发逆流程追溯到原材料/零部件。',
   1, strftime('%s','now')),

  (69, 'judge', '开源 MES free-mes 作为真实系统，其正向/反向追溯查询已经完整实现，可直接当作教学范例使用。',
   '["正确","错误"]',
   '1',
   '错误。正文参考 free-mes 反例指出：代码里「追溯」只命中 printStackTrace，正反向追溯查询压根没实现，所谓追溯能力是空的，只能当反例。',
   2, strftime('%s','now')),

  -- ===== 313 批次与 SN 码管理 =====
  (313, 'single', '批次管理与 SN 码管理的核心区别是什么？',
   '["批次管「一群同规格产品」(批级)，SN 管「一个产品」(个体级)","批次管单个产品，SN 管一批产品","两者完全一样，只是叫法不同","批次只用于原材料，SN 只用于成品"]',
   '0',
   '正文一句话理解与对比表：批次管「一群产品」(批级追溯)，SN 码管「一个产品」(个体级、一物一码)，两者协同构成完整追溯体系。',
   1, strftime('%s','now')),

  (313, 'judge', '参考 free-mes：它用 barCode 当单件唯一键，但库里没有唯一约束、也不查重，两个产品用了同一条码都不会报错。',
   '["正确","错误"]',
   '0',
   '正确。正文参考 free-mes 反例：所谓「单件级」是用 barCode 当唯一键，却没有唯一约束、也不查重，重号不报错，这是真实系统的典型坑。',
   2, strftime('%s','now')),

  -- ===== 320 质量追溯 =====
  (320, 'single', '从一条不合格记录(check_id=2)往回摸根因，本章给出的完整追溯链顺序是？',
   '["quality_checks → work_orders → production_records → equipment+operator","work_orders → quality_checks → equipment → production_records","production_records → equipment → work_orders → quality_checks","equipment → operator → quality_checks → work_orders"]',
   '0',
   '正文「完整追溯链」：quality_checks(谁判的、什么缺陷) → work_orders(哪个工单/车间/产品) → production_records(谁做的、哪台设备、合格不良) → equipment+operator(责任设备与当班人)。四张表串起来才可追责。',
   1, strftime('%s','now')),

  (320, 'judge', '算不良率时，分母应是总产量(合格数+不良数)；绝不能拿 work_orders.qty_done(本章案例里还是 0)当分母。',
   '["正确","错误"]',
   '0',
   '正确。正文 SPC 思维强调：不良率 = 不良数 ÷(合格数+不良数)×100%，分母是总产量；并特别警告 WO-20260801-01 的 qty_done 还是 0，此时要用 production_records 的 qty_ok 累加，绝不能拿 qty_done 当分母。',
   2, strftime('%s','now')),

  -- ===== 9110 车间报工 =====
  (9110, 'single', '本章反复强调：工单的完工数 qty_done 是怎么来的？',
   '["由报工记录 production_records 自动累加，不是人填的","工人每天手工改工单上的完工数","月底班组长统计后统一填入","设备自动上报，与报工无关"]',
   '0',
   '正文「完工数不是人填的」：qty_done 是报工记录「滚」出来的，不是人填的。新人常犯直接改工单完工数的错；正确做法是只录报工，系统按报工汇总。',
   1, strftime('%s','now')),

  (9110, 'judge', '参考 free-mes 真实链路：工单下发成多个 Task，工人对 Task 报工生成 Feedback，状态从 NoSTARTED 走到 FINISHED，工时在 FINISHED 时按「开工→完工、扣除暂停」自动算。',
   '["正确","错误"]',
   '0',
   '正确。正文参考 free-mes 明确：真实系统是 WorkOrder→Task→Feedback 三表逐级下发；状态流 NoSTARTED→STARTED→…→FINISHED；工时在 FINISHED 时自动算，不必手填。',
   2, strftime('%s','now')),

  -- ===== 9113 质量追溯(往回摸根因) =====
  (9113, 'single', '本章说「顺着不合格往回摸」能一路摸到注塑机A、陆明辉、那一批，前提是？',
   '["前面每道工序、每次领料都把设备、批号、SN 留下来(数据留痕齐全)","只要 SQL 写得够强，缺数据也能追","只看质检记录就够了","必须有 AI 模型辅助"]',
   '0',
   '正文参考 free-mes 反例：能摸到底的前提是数据留痕齐全；报工/任务表没有条码批次、工序记录不存设备批号、领料单没有批号，任何一处断链都追不到单件。留痕断了，再强的 SQL 也追不回。',
   1, strftime('%s','now')),

  (9113, 'judge', '参考 free-mes：它的报工/任务表没有条码和批次，因此只能追到「任务」级别，追不到单件 SN。',
   '["正确","错误"]',
   '0',
   '正确。正文参考 free-mes 反例：报工/任务表只有任务号/工序号，没有条码和批次，追溯断在「任务」这一级，到不了单件 SN。',
   2, strftime('%s','now'));
