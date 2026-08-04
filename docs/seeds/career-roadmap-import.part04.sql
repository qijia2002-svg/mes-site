-- 自动生成，请勿手改：node scripts/import-career-roadmap.mjs
-- 数据源：.\docs\seeds\career-roadmap-data.json
-- 生成时间：2026-08-02T14:31:42.553Z
-- 幂等：全部 INSERT OR REPLACE + 确定性主键，可重复执行。
-- 顺序：父表先于子表（REPLACE 会触发 ON DELETE CASCADE），不要重排语句。

-- 分片 4/4

INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (57, 401, 21, 'important', '要知道采上来的数据最终要算稼动率和产量，否则会采一堆没用的点、漏掉关键点', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (58, 401, 31, 'important', '验证采集数据对不对，最直接的方法就是查库比对现场实际值', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (59, 402, 42, 'core', '能读懂梯形图才能确认某个状态点是不是真的代表你以为的含义，避免采到假数据', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (60, 402, 62, 'core', 'Modbus 报文、OPC UA 订阅、抓包分析是这个阶段每天都用的手艺', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (61, 402, 32, 'important', '采集数据的准确性验证和初步统计都靠查询，窗口函数在算状态时长时特别常用', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (62, 402, 71, 'important', '采集服务多数跑在 Linux 上，要能自己启停服务、看日志、改配置', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (63, 403, 43, 'core', '协议选型、点表规划、握手协议设计是这个阶段的核心交付物，也是与电气团队平等对话的资本', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (64, 403, 62, 'core', '整条产线几十台设备的组网、网关部署和排障，需要成体系的网络能力', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (65, 403, 72, 'important', '采集服务的部署、定时任务、日志与备份要能自己扛，工厂通常没有专职运维', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (66, 403, 22, 'important', '数据要落到 MES 的稼动率和产量口径上，不懂业务口径会算出没人认的数字', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (67, 403, 51, 'optional', '遇到老设备没有通讯口时，能判断该买成品网关还是需要定制方案', 4);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (68, 404, 63, 'core', '全厂架构、OT 安全隔离、时间同步、容量规划是这个层级不可回避的设计责任', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (69, 404, 43, 'core', '复杂设备联动与疑难故障的最终定位仍然要靠对控制侧的深度理解', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (70, 404, 53, 'important', '标准网关解决不了的场景需要定制边缘设备，断网续传与远程升级是多厂区数采的刚需，也是资深数采工程师最难被替代的能力', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (71, 404, 73, 'important', '几十上百个边缘节点的部署、监控、升级需要工程化的运维体系', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (72, 501, 21, 'core', '要能和车间沟通并判断厂商方案是否符合本厂生产形态，概念不清就只能被厂商牵着走', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (73, 501, 11, 'core', 'ERP 是企业信息化的主干，不懂单据流就无法判断需求该由哪个系统承接', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (74, 501, 31, 'important', '甲方最有价值的能力之一就是能自己查数验证，不必事事等厂商回复', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (75, 502, 22, 'core', '只有懂配置层面的东西，才能判断厂商说的「做不了」到底是真做不了还是不想做', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (76, 502, 12, 'core', '主数据与 MRP 参数是甲方长期要自己维护的东西，不懂就会长期依赖厂商', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (77, 502, 32, 'important', '验收时自己写查询核对数据，是防止厂商用假数据糊弄的最有效手段', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (78, 502, 81, 'important', '编码规则一旦定错要用好几年，甲方必须在这件事上有自己的判断', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (79, 503, 22, 'core', '深度理解配置能力边界，才能在需求与成本之间做出对企业有利的取舍', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (80, 503, 12, 'core', '跨系统项目里 ERP 侧的数据准备和流程调整通常由甲方主导，责任推不掉', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (81, 503, 32, 'core', '上线期每天都要核对数据，这个能力直接决定问题能不能被及时发现', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (82, 503, 61, 'important', '涉及设备联网时要能判断厂商的网络要求是否合理、本厂现有网络够不够', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (83, 503, 82, 'important', '标签、打印和 PDA 作业方案落地后由甲方长期承担，必须自己懂得怎么维护', 4);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (84, 503, 91, 'important', '甲方是监督方，需要看懂乙方的计划与里程碑、能主持内部协调会并留下纪要，但不需要自己编制实施计划', 5);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (85, 504, 23, 'important', '规划时要能判断集成架构是否合理、供应商方案有没有埋坑，需要方案级的理解深度', 0);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (86, 504, 13, 'important', '涉及 ERP 升级或换系统这类重大决策时，必须能独立评估蓝图与迁移风险', 1);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (87, 504, 33, 'important', '企业数据资产的质量治理和跨系统报表体系是甲方长期职责，需要结构性能力', 2);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (88, 504, 62, 'optional', '若企业推进设备联网，能参与网络与安全的技术评审会显著提升话语权', 3);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (89, 504, 71, 'optional', '自建机房或本地部署时，能与厂商讨论环境与备份要求，避免完全被动', 4);
INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES (90, 504, 92, 'important', '做多系统规划要能判断厂商的计划是否现实、UAT 与验收标准是否够硬；L3 的二期挖掘与客户关系是乙方视角，甲方用不上，因此封顶在中级', 5);
UPDATE platform_config SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version';
