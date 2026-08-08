-- 订单评审专题中文名词（名词解释 / 名称翻译 内联功能的中文章节命中补全）
-- 幂等：INSERT OR IGNORE（重复执行安全）。
-- 复用既有 'mes' 分组；value 存中文术语本身，zh 存其英文对应，detail 存中文详解，
--   与英文词条（BOM / WORK ORDER …）对称，内联高亮与搜索框都能命中。
-- 运行：node scripts/d1q.mjs --file worker/src/migrations/seed-glossary-mes-cn.sql

INSERT OR IGNORE INTO dict_data (type_key, value, pos, zh, example, example_zh, category, detail, sort, status, created_at, updated_at)
VALUES
  ('mes','订单评审','n.','order review','接单后先评能否做得出、交得出','After taking an order, assess whether it can be made and delivered on time','MES','订单评审是接单后的第一道关卡：评估交期、物料、产能是否撑得住，避免“接了做不出”。',13,1,1700000000000,1700000000000),
  ('mes','评审','v./n.','review','对订单的可行性做评估确认','Review the order for feasibility before committing','MES','评审是对订单/计划做可行性、交期、物料的评估与确认，是 MES 流转的关键节点。',14,1,1700000000000,1700000000000),
  ('mes','交期','n.','due date','客户要求 8 月 15 日前交付','The customer requires delivery by Aug 15','MES','交期是客户要求的完工交付日期；评审重点看交期是否赶得上。',15,1,1700000000000,1700000000000),
  ('mes','齐套','n.','kitting','开工前核对物料是否全部备齐','Check all materials are ready before starting','MES','齐套是开工前核对工单所需物料是否全部备齐；缺料则无法开工。',16,1,1700000000000,1700000000000),
  ('mes','工单','n.','work order','下发一张生产工单','Release a work order to the shop floor','MES','工单是下发给车间的具体生产指令，包含产品、数量、工艺与交期。',17,1,1700000000000,1700000000000),
  ('mes','生产计划','n.','production plan','由订单拆解出的各车间排程','The schedule broken down from the order','MES','生产计划由订单拆解而来，排定各车间何时做、做多少。',18,1,1700000000000,1700000000000),
  ('mes','评审状态','n.','review status','待评审 / 已评审 / 驳回','Pending review / Reviewed / Rejected','MES','评审状态描述订单在评审环节所处的阶段，驱动后续是否进入排产。',19,1,1700000000000,1700000000000),
  ('mes','计划状态','n.','plan status','待排产 / 已排产 / 已下达','To schedule / Scheduled / Released','MES','计划状态描述生产计划在排产环节所处的阶段，决定能否开工。',20,1,1700000000000,1700000000000),
  ('mes','逾期','adj.','overdue','超过承诺交期仍未完成','Still unfinished past the promised due date','MES','逾期是超过承诺交期仍未完成，是交期风险的核心信号。',21,1,1700000000000,1700000000000),
  ('mes','物料缺口','n.','material shortage','齐套检查时发现的缺料数量','The missing quantity found during kitting check','MES','物料缺口是齐套检查时发现的缺料数量，需补料或调整交期。',22,1,1700000000000,1700000000000);
