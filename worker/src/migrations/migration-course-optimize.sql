-- ============================================================================
-- 课程优化 — 按培训课程设计师 skill 标准重构
-- 每门课添加：ABCD学习目标、布鲁姆层级、能力标注、评估方式
-- ============================================================================

-- 课程1: 工单管理与生产执行 (布鲁姆 L2-L3, 进阶)
UPDATE topics SET
  description = '【能力目标】学员能够在MES系统中独立完成工单创建、状态流转、现场数据核查与异常定位。
【受众】MES实施工程师、车间班组长、运维人员
【前置】SQL查询基础（课程6）
【评估】SQL实战题2道 + 模块考试12题
【课时】6小时（理论2h + SQL实操3h + 考试1h）',
  difficulty = 'intermediate', estimated_hours = 6
WHERE id = 1;

-- 课程2: BOM 与物料管理 (布鲁姆 L2-L3, 进阶)
UPDATE topics SET
  description = '【能力目标】给定一张工单及其BOM结构，学员能计算物料需求量与损耗率，并解释齐套性检查结果。
【受众】MES实施工程师、物料计划员
【前置】工单管理与生产执行（课程1）
【评估】SQL实战题 + 数据分析练习
【课时】5小时（理论2h + SQL实操2h + 案例分析1h）',
  difficulty = 'intermediate', estimated_hours = 5
WHERE id = 2;

-- 课程3: 报工与完工入库 (布鲁姆 L2-L3, 进阶)
UPDATE topics SET
  description = '【能力目标】学员能根据生产记录还原产量、合格率、工时数据，并诊断"数量对不上"、"工单关不掉"两类现场问题。
【受众】MES实施工程师、质量工程师
【前置】工单管理与生产执行（课程1）
【评估】SQL实战题2道 + 场景诊断题
【课时】4小时（理论1.5h + SQL实操2h + 诊断0.5h）',
  difficulty = 'intermediate', estimated_hours = 4
WHERE id = 3;

-- 课程4: ERP 原理与模块 (布鲁姆 L1-L2, 入门)
UPDATE topics SET
  description = '【能力目标】学员能够描述ERP核心模块（销售/采购/生产/财务）的功能与数据流转关系，并解释ERP与MES的接口边界。
【受众】数字化转型新人、IT业务分析师、跨部门协作人员
【前置】无
【评估】理论选择题 + 模块关系图绘制
【课时】8小时（理论4h + 案例分析2h + 流程图练习2h）',
  difficulty = 'beginner', estimated_hours = 8
WHERE id = 4;

-- 课程5: MES 核心模块 (布鲁姆 L2-L3, 进阶)
UPDATE topics SET
  description = '【能力目标】学员能够说明MES七大核心模块（工单/物料/报工/质量/追溯/设备/看板）的功能与车间数据流，对常见实施场景给出AS-IS→TO-BE方案。
【受众】MES实施工程师、项目经理
【前置】ERP原理与模块（课程4）
【评估】场景分析题 + 方案设计答辩
【课时】10小时（理论4h + 场景分析3h + 方案设计3h）',
  difficulty = 'intermediate', estimated_hours = 10
WHERE id = 5;

-- 课程6: SQL 查询基础 (布鲁姆 L2-L3, 入门)
UPDATE topics SET
  description = '【能力目标】给定MES数据库表结构，学员能够编写SELECT/WHERE/GROUP BY/JOIN查询语句，从工单、物料、报工表中提取并汇总数据。
【受众】所有学员（通识技能）
【前置】无
【评估】SQL实战题 + 在线判题系统
【课时】6小时（语法讲解2h + 随堂练习2h + 综合实战2h）',
  difficulty = 'beginner', estimated_hours = 6
WHERE id = 6;

-- 课程7: PLC 可编程逻辑控制器 (布鲁姆 L1-L2, 进阶)
UPDATE topics SET
  description = '【能力目标】学员能够解释PLC工作原理、梯形图基本语法，并说明设备层（PLC/SCADA）与MES层的数据采集链路。
【受众】自动化工程师、MES集成工程师
【前置】MES核心模块（课程5）
【评估】梯形图分析题 + 数采链路设计
【课时】8小时（PLC原理3h + 梯形图编程2h + 数采集成3h）',
  difficulty = 'intermediate', estimated_hours = 8
WHERE id = 7;

-- 更新学习路径描述，增加能力进阶视角
UPDATE learning_paths SET description = '【入门→实战→综合】从SQL基础起步，到ERP全局视野，再到工单/物料/报工三大核心域逐项攻克，最后以MES全景收官。学完可独立承担MES实施项目。' WHERE slug = 'mes-implementation-newbie';
UPDATE learning_paths SET description = '【SQL→业务排查】先建SQL查询能力，再用工单+BOM+报工真实数据练手。练完能独立用SQL定位生产异常。' WHERE slug = 'onsite-sql-troubleshoot';
UPDATE learning_paths SET description = '【经营→车间】先建ERP全局视角理解"为什么做"，再深入MES车间层理解"怎么做"。适合需要打通业务与执行的协作角色。' WHERE slug = 'mes-erp-overview';
UPDATE learning_paths SET description = '【零基础→实战】从SELECT语法到工单报工联表查询，每门课都配动手练习，学完写SQL不查手册。' WHERE slug = 'sql-practical';
UPDATE learning_paths SET description = '【设备→管理】从PLC工业控制底层往上走，到ERP企业管理层。打通智能制造"设备→车间→企业"全链路认知。' WHERE slug = 'smart-manufacturing';
