-- 脑库知识导入种子数据
-- 自动生成，勿手动编辑
-- 来源：E:/我的脑库/10_Learning（学习）/

-- 先清理旧数据（如果重复导入）
-- SKIP: 
-- SKIP: 
-- SKIP: 
-- SKIP: 
-- SKIP: 
-- SKIP: 
-- SKIP: 
-- SKIP: 

-- Topics
INSERT OR REPLACE INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at) VALUES (4, 'erp', 'ERP 原理与模块', '从销售订单到财务结算的企业经营全貌', '["theory"]', 4, 'published', 1785648000, 1785648000);
INSERT OR REPLACE INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at) VALUES (5, 'mes', 'MES 核心模块', '工单/物料/报工/质量/追溯/设备/看板', '["theory"]', 5, 'published', 1785648000, 1785648000);
INSERT OR REPLACE INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at) VALUES (6, 'sql', 'SQL 查询基础', 'SELECT/WHERE/GROUP BY/JOIN', '["theory"]', 6, 'published', 1785648000, 1785648000);
INSERT OR REPLACE INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at) VALUES (7, 'plc', 'PLC 可编程逻辑控制器', '基础/梯形图/工业控制/SCADA-MES集成', '["theory"]', 7, 'published', 1785648000, 1785648000);

-- Chapters
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, 'ERP 是什么', 1, 'published', '# ERP 是什么

## 一句话理解
**ERP = 企业资源计划**。一个软件系统，把公司的"人、财、物、产、供、销"全部管起来。

## 核心模块
```
ERP
├── 销售管理：接客户订单
├── 生产计划：排产
├── MRP：算需要什么物料
├── 采购管理：买东西
├── 库存管理：管仓库
├── 生产管理：管车间
├── 财务管理：算账
└── 人力资源：管人
```

## 我的理解
ERP 就像公司的 **"数字大脑"**——记录每一笔交易、每一个订单、每一件库存。

你在信息化专员岗位上用过 ERP。某制造企业的 ERP 主要用于：
- 数据采集
- 制作生产大屏

**观察任务：** 看看某制造企业的 ERP 系统里有哪些模块在用？哪些没用？

## MES 区别
| ERP | MES |
|-----|-----|
| 管"数"（订单量、库存量、金额） | 管"过程"（怎么做的、谁做的） |
| 管到"生产订单"级别 | 管到"每道工序每次操作" |
| 管理层用 | 车间用 |

## 下一步
→ [[04_MRP物料需求计划|MRP 物料需求计划]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, '销售管理', 2, 'published', '# 销售管理

## 一句话理解
**销售管理 = 从客户询价到发货收款的全流程。**

## 核心流程
```
客户询价 → 报价 → 客户下单 → 销售订单 →
信用检查 → 库存检查 → 发货 → 开票 → 收款
```

## ERP里的销售模块
| 功能 | 做什么 |
|------|--------|
| 客户主数据 | 管理客户信息 |
| 销售订单 | 记录客户要什么、多少、什么时候要 |
| 发货 | 通知仓库发货 |
| 开票 | 生成发票 |
| 收款 | 跟踪回款 |

某制造企业做 OEM/ODM，客户是海外品牌。
**观察任务：** 销售订单怎么传到生产部门的？ERP里看得到吗？

## 关联
- 销售订单 → MRP → 采购 → 生产 → 发货', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, '生产计划', 3, 'published', '# 生产计划

## 一句话理解
**生产计划 = 决定"什么时候做什么、做多少"。**

## 生产计划的层次
```
长期 (3-12月)：产能规划
中期 (1-3月)：主生产计划 (MPS)
短期 (1-4周)：物料需求计划 (MRP)
日常：车间排产
```

**现在的流程（推测）：**
- 客户订单来了 → 计划员排产 → 通知车间
- 排产可能靠 Excel 或经验

**数字化后：**
ERP自动根据订单、库存、产能生成生产计划。

## 面试能讲的
"我理解生产计划从长期产能规划到日常排产的层次。在某制造企业，计划排产主要靠人工，这是数字化转型的切入点。"', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, 'MRP 物料需求计划', 4, 'published', '# MRP 物料需求计划

## 一句话理解
**MRP = 根据订单和 BOM，自动计算需要采购什么、采购多少、什么时候到。**

## MRP 运算逻辑
```
客户订单（10000个 产品）
 ↓
查 BOM（每个 产品 需要 N 个零件）
 ↓
计算总需求：
  - 底座 × 10000
  - 上盖 × 10000  
  - 静触头 × 10000
  - 螺丝 × 40000
  ...
 ↓
减去现有库存
 ↓
生成采购计划 / 生产计划
```

## 我的理解
没有 MRP 之前，计划员手动算需要多少料——容易算错、算漏。
有了 MRP，系统自动算，还能考虑采购提前期。

**现在的流程（推测）：**
```
线长/计划员 → 
  人工估算需要多少料 → 
  通知仓库/采购 → 
  缺料了再补
```

**问题：**
- 缺料时才发现，生产线停下来等
- 库存积压或者不够，没有精确计算

**MRP 化后：**
```
系统根据订单 + BOM →
  自动算出每种零件需要多少 →
  对比库存 →
  生成采购建议/领料计划
```

## 关联你的案例
→ [[缺料流程问题]] — 这就是 MRP 没做好导致的

## 面试能讲的
"我在某制造企业观察到缺料问题根本原因是缺少 MRP 运算——计划靠人工估算。我理解了 MRP 怎么根据 BOM 和订单自动算物料需求。"

## 下一步
→ [[../MES/01_MES是什么|MES 是什么]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, '采购管理', 5, 'published', '# 采购管理

## 一句话理解
**采购管理 = 什么时候买什么、找谁买、多少钱。**

## 核心流程
```
MRP 产生采购需求 →
  询价/比价 →
  下采购订单 →
  供应商确认 →
  收货/质检 (IQC) →
  入库 →
  付款
```

产品 有 N 个零件，来自不同供应商。
**观察任务：**
- 塑料外壳是哪个供应商的？
- 银触点从哪里采购的？
- 采购提前期多长？

## 关联你的案例
IQC（来料检验）不合格 → 退回供应商 → 这就是采购+质量的联动。', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, '库存管理', 6, 'published', '# 库存管理

## 一句话理解
**库存管理 = 管好"什么东西有多少、放在哪"。**

## 库存类型
| 类型 | 说明 | 产品例子 |
|------|------|---------|
| 原材料 | 还没用的零件 | 底座、触头、线圈 |
| 在制品 WIP | 正在做的 | 装配中的半成品 |
| 成品 | 做完的 | 包装好的产品 |
| 安全库存 | 防止断料的缓冲 | 常用螺丝多备一些 |

**问题：** 缺料了才知道不够——说明库存管理不够精细。

**MRP+库存管理后：**
系统知道每种物料还有多少、什么时候用完、什么时候该采购。

## 面试能讲的
"我在产线上观察到了缺料问题，根本原因是库存状态不透明、没有安全库存预警机制。"', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, '生产管理（ERP视角）', 7, 'published', '# 生产管理（ERP视角）

## 一句话理解
**ERP里的生产管理 = 把生产订单变成工单，跟踪完工入库。**（和MES的生产管理不同——ERP管"数"，MES管"过程"）

## ERP生产模块做什么
- 接收销售订单 → 生成生产订单
- 生产订单 → 下达车间
- 完工入库 → 更新库存
- 计算生产成本

**现在的流程：** 计划员/线长→微信群通知→Excel记录
**ERP化：** 系统下达工单→车间接单→完工报工→库存自动更新

## 和MES的关系
| ERP生产管理 | MES生产管理 |
|------------|------------|
| 管"要生产多少" | 管"怎么生产的" |
| 管到生产订单级别 | 管到每道工序 |
| 结果导向 | 过程导向 |', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, '财务会计', 8, 'published', '# 财务会计

## 一句话理解
**财务 = 算清楚"赚了多少、花了多少"。** 作为MES实施工程师，不需要精通财务，但要理解基本概念。

## 核心概念
| 概念 | 说明 |
|------|------|
| 应收账款 | 客户欠我们的钱 |
| 应付账款 | 我们欠供应商的钱 |
| 成本核算 | 算出一个产品花了多少钱 |
| 总账 | 所有账目的汇总 |

## 产品的成本构成
- 材料成本：52个零件（约多少？）
- 人工成本：装配工人计件工资
- 制造费用：设备折旧、电费、厂房

## 为什么MES实施要懂一点财务？
MES采集的生产数据（报工、物料消耗） → 传给ERP → 做成本核算。', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, 'ERP与MES的边界', 9, 'published', '# ERP与MES的边界

## 面试最常问的问题
> "ERP和MES的区别是什么？边界在哪里？"

## 一句话回答
**ERP管"数"（计划层），MES管"过程"（执行层）。ERP管到"生产订单"，MES管到"每道工序每次操作"。**

## 详细对比
| 维度 | ERP | MES |
|------|-----|-----|
| 层级 | 计划层 | 执行层 |
| 时间精度 | 天/周 | 分钟/秒 |
| 数据粒度 | 订单级别 | 工序/SN级别 |
| 用户 | 管理层/计划员 | 操作工/班组长/QC |
| 核心问题 | 要做什么？ | 做得怎么样？ |

## 产品场景举例
ERP：今天要生产1000个产品，需要多少物料？
MES：这1000个产品经过15道工序，每道工序质量如何？不良率多少？

## 数据流向
```
ERP（计划）→ 生产订单 → MES（执行）
MES（执行）→ 完工/质量数据 → ERP（结算）
```

## 面试能讲的
"我在某制造企业观察到的场景：ERP可能下达了生产任务，但车间还是靠纸质传递——这中间的断层就是MES要解决的。MES把ERP的''要做什么''变成车间实际执行的''怎么做、做得怎么样''。"', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, 'MES 是什么', 1, 'published', '# MES 是什么

## 一句话理解
**MES = 制造执行系统 = 车间数字化操作系统。** 把车间的"人、机、料、法、测"全部数字化。

## MES 在工厂中的位置
```
ERP（管计划）→ 下达生产订单
 ↓
MES（管执行）→ 分解工单、追踪每道工序
 ↓
设备/工位 → 扫码、报工、采集数据
 ↓
报表 → 产量、良率、OEE
```

## MES 核心模块
| 模块 | 做什么 | 产品 产线对应 |
|------|--------|-------------|
| 工单管理 | ERP 订单 → 车间任务 | N 道工序拆分工单 |
| 物料管理 | 缺料申请/配送/追溯 | 线圈/PCB/触头的批次管理 |
| 生产报工 | 每道工序完成记录 | 铆接/装配/测试报工 |
| 质量管理 | 不良记录/SPC/追溯 | 漏电测试/延时/瞬时检测 |
| 追溯管理 | 正向/反向追溯 | SN 码绑定 → 全链路 |
| 设备管理 | 设备数据采集/OEE | 老化测试/耐压测试设备 |
| 电子SOP | 工位屏幕显示作业指导 | 15 份纸质 SOP → 电子化 |
| 看板报表 | 实时产量/良率/OEE | 车间大屏 |

**当前状态：** 没有 MES，只有纸质记录 + Excel + 微信
**MES 化机会：** 测试工序（漏电/延时/瞬时/耐压）最适合优先数字化——数据量大、重复性高、人工记录容易出错

## 你的优势
别人学 MES 看书——你在车间每天看到真实的 MES 需求场景。
拿 15 道 SOP 每道问自己："如果上 MES，这步会怎么变？"

## 下一步
→ [[02_工单管理|工单管理]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '工单管理', 2, 'published', '# 工单管理

## 一句话理解
**工单 = ERP的生产订单拆成车间能执行的"任务卡片"。**

## 工作流程
```
ERP生产订单（1000个产品）
 ↓
MES工单拆分：
  工单001：铆接工序 - 1000件
  工单002：焊接工序 - 1000件
  ...
  工单015：包装工序 - 1000件
 ↓
各工位扫码接单 → 报工
```

## 当前流程（AS-IS）
现在：线长在微信群里发"今天做1000个产品"，没有电子工单。

## 目标流程（TO-BE）
MES自动收到ERP的订单 → 拆分15道工序工单 → 每道工序扫码开始 → 自动跟踪进度

## 数据模型
```
work_order 工单表：
  wo_id, prod_order_id, process_id,
  station_id, planned_qty, actual_qty,
  status, start_time, end_time
```', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '物料管理', 3, 'published', '# 物料管理

## 一句话理解
**MES物料管理 = 车间级的物料"配送+追溯"系统。** ERP管"有多少料"，MES管"料用在哪个产品上"。

## 核心功能
1. **缺料申请**：工位扫码 → 触发缺料请求 → 仓库接单配送
2. **物料校验**：装配前扫码物料 → 系统校验是否匹配BOM → 防错
3. **批次追溯**：记录每个产品用了哪批物料 → 出问题可倒查供应商

**你的案例：[[缺料流程问题]]**

AS-IS：工人发现缺料 → 手写通知 → 自己去仓库
TO-BE：扫码 → 系统自动通知仓库 → 配送到工位

## 数据模型
```
material_shortage 缺料表：
  ms_id, work_order_id, station_id,
  material_code, qty, request_time,
  delivery_time, status
```', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '生产报工', 4, 'published', '# 生产报工

## 一句话理解
**报工 = 记录"谁在什么时间做了多少件、合格多少、不良多少"。**

## 当前流程（AS-IS）
- 工人手写记工单（做什么/做多少）
- 班组长月底收集统计
- 计算计件工资 → 易出错、耗时长、争议多

## 目标流程（TO-BE）
- 每道工序做完 → 扫码报工
- MES自动记录：谁/什么时间/什么产品/多少件/合格数/不良数
- 实时看板显示产量
- 月底一键导出计件工资报表

## 数据模型
```
production_record 报工表：
  record_id, work_order_id, employee_id,
  process_id, station_id, sn_code,
  planned_qty, good_qty, ng_qty,
  start_time, end_time
```

## 面试能讲的
"我在某制造企业看到计件靠纸质记录，月底人工核对——如果上了MES扫码报工，效率能提升多少、出错率能降到多少。"', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '质量管理', 5, 'published', '# 质量管理

## 一句话理解
**MES质量管理 = 把 IQC/IPQC/OQC 全部数字化，不良记录可追溯、可分析。**

## 核心功能
1. **不良录入**：扫码 → 选择不良代码 → 系统记录
2. **自动锁定**：不合格品不能流到下一道工序
3. **SPC分析**：自动生成控制图、Pareto图
4. **追溯**：从不良品倒查 → 哪个工位/谁做/哪批料

## 这就是你现在的岗位——IPQC
你每天检查不良 → 如果能用系统记录，就能分析出：
- 哪个工位不良率最高？
- 哪个零件最容易出问题？
- 什么时间段不良增多？

## 数据模型
```
quality_record 质量记录表：
  qr_id, sn_code, process_id, station_id,
  defect_code, defect_desc, severity,
  inspector_id, record_time, status
```

## 面试能讲的
"我是IPQC，正在用统一格式记录不良数据。这是MES质量管理模块最核心的输入——不良代码体系+数据采集+SPC分析。"', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '追溯管理', 6, 'published', '# 追溯管理

## 一句话理解
**追溯 = 正向：产品用了什么料 → 反向：料用在了哪些产品上。**

## 正向追溯
```
SN码：产品-20260719-001
  → 这个产品用了：
 - 底座 (批号 H101-20260701)
 - 线圈 (批号 D505-20260705)
 - PCB (批号 D503-20260702)
  → 经过15道工序
  → 测试结果：漏电测试 PASS / 耐压测试 PASS
```

## 反向追溯
```
线圈批号 D505-20260705 有问题
  → 这批线圈用在了哪些成品上？
  → 查出 SN 列表
  → 召回这些成品
```

## 数据模型
```
traceability 追溯表：
  sn_code →
 bom_line (物料+批次) →
 production_record (工序+人员+时间) →
 quality_record (检验结果)
```

## 面试能讲的
"如果客户投诉一批产品漏电——用MES追溯系统，5分钟内就能查到：这批产品用了哪个供应商的线圈、经过哪些工序、谁装配的、测试结果是什么。"', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '设备管理', 7, 'published', '# 设备管理

## 一句话理解
**设备管理 = 监控设备运行状态、自动采集数据、计算OEE、预警故障。**

产品产线的测试设备：
- 漏电测试仪
- 延时测试仪
- 瞬时测试仪
- 通断耐压测试仪
- 老化试验设备

**现在：** 工人看仪表读数 → 手写记录
**MES化后：** 设备自动传数据 → MES自动判定 → 不合格自动锁定

## OEE（设备综合效率）
OEE = 可用率 × 性能率 × 良品率

## 你的案例
[[设备故障无预警]] —— 这就是设备管理模块要解决的问题。', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, '看板与报表', 8, 'published', '# 看板与报表

## 一句话理解
**看板 = 把数据"可视化"，让管理者一眼看到车间在发生什么。**

## 常见看板
| 看板类型 | 显示内容 | 产品场景 |
|---------|---------|---------|
| 生产看板 | 计划/实际/完成率 | 今日计划1000，已完成650 |
| 质量看板 | 不良率/Pareto/趋势 | 不良率2.1%，触头问题最多 |
| 设备看板 | OEE/运行状态 | 老化测试设备OEE 78% |
| Andon看板 | 异常报警 | 03工位物料不足！ |

## 某制造企业现场
你做过信息化专员，用ERP数据做过生产大屏——这就是看板的雏形。

## 下一步
结合产品产线数据 → 设计一个生产看板的Demo → 面试作品集。', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (6, 'SELECT 查询', 1, 'published', '# SELECT 查询

## 一句话理解
**SELECT = 从数据库里"取数据"。** 你想看什么，就 SELECT 什么。

## 基本语法
```sql
SELECT 列名1, 列名2
FROM 表名;
```

## 模拟你的 产品 数据
假设有一个 **bom** 表：

| code  | name | type | material | qty |
|-------|--------|--------|---------------|-----|
| H101  | 外壳 | 塑料件 | 阻燃增强尼龙 | 1 |
| H102  | 手柄 | 塑料件 | PA6-B260G7 | 1 |
| J202  | 动触头 | 五金件 | 1.5板T3Y2 | 1 |
| B701  | 铆钉 | 标准件 | H62Y2 | 8 |

## 练习 1：查看所有零件
```sql
SELECT *
FROM bom;
```
→ 返回全部 52 行

## 练习 2：只查看零件名称和数量
```sql
SELECT name, qty
FROM bom;
```

## 练习 3：查看不重复的零件类型
```sql
SELECT DISTINCT type
FROM bom;
```
→ 返回：塑料件、五金件、触点件、弹簧件、电子件、热脱扣件、标准件

## 练习 4：统计总共有多少零件
```sql
SELECT COUNT(*)
FROM bom;
```
→ 返回：52

## 面试能讲的
"我用 SQL 建了一个 开关类产品的 BOM 数据库，包含 N 个零件的完整信息，能用 SELECT 做各种查询。"

## 下一步
→ [[03_WHERE过滤|WHERE 条件过滤]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (6, 'WHERE 条件过滤', 2, 'published', '# WHERE 条件过滤

## 一句话理解
**WHERE = 加条件筛选。** 只看你想要的那部分数据。

## 基本语法
```sql
SELECT 列名
FROM 表名
WHERE 条件;
```

## 模拟 产品 数据练习

### 练习 1：只看塑料件
```sql
SELECT code, name, material
FROM bom
WHERE type = ''塑料件'';
```
→ 返回 14 行（外壳、手柄、跳扣...）

### 练习 2：只看关键件
```sql
SELECT code, name, type
FROM bom
WHERE critical = ''是'';
```
→ 返回 15 个关键件

### 练习 3：数量大于 1 的零件
```sql
SELECT name, qty
FROM bom
WHERE qty > 1;
```
→ 铆钉(8)、螺钉(4)、小接线板(3)、高温线(2)...

### 练习 4：多条件
```sql
SELECT name, type, material
FROM bom
WHERE type = ''弹簧件'' AND qty >= 1;
```

### 练习 5：用 LIKE 模糊搜索
```sql
SELECT name
FROM bom
WHERE name LIKE ''%触头%'';
```
→ 动触头、静触头(L极)、静触头(N极)、动触头(N极)...

## 面试能讲的
"我能用 WHERE 条件从 产品 的 N 个零件里快速筛选——比如查所有关键件、查所有五金件数量大于 2 的。"

## 下一步
→ [[04_GROUP_BY聚合|GROUP BY 分组统计]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (6, 'GROUP BY 分组统计', 3, 'published', '# GROUP BY 分组统计

## 一句话理解
**GROUP BY = 分组统计。** "每种类型有多少个"、"每天生产多少"。

## 基本语法
```sql
SELECT 分组列, 聚合函数(统计列)
FROM 表名
GROUP BY 分组列;
```

## 聚合函数
| 函数 | 含义 | 例子 |
|------|------|------|
| COUNT() | 计数 | COUNT(*) → 总共多少行 |
| SUM() | 求和 | SUM(qty) → 总数 |
| AVG() | 平均 | AVG(qty) → 平均 |
| MAX() | 最大 | MAX(qty) → 最多 |
| MIN() | 最小 | MIN(qty) → 最少 |

## 模拟 产品 数据练习

### 练习 1：每种类型的零件数量
```sql
SELECT type, COUNT(*) as cnt
FROM bom
GROUP BY type;
```
→ 塑料件 14、五金件 19、触点件 3、弹簧件 6...

### 练习 2：每个系统的零件数量
```sql
SELECT system, COUNT(*) as cnt
FROM bom
GROUP BY system
ORDER BY cnt DESC;
```
→ 导电系统 10、外壳系统 14...

### 练习 3：模拟生产报工——每天生产了多少
```sql
SELECT date, SUM(quantity) as total
FROM production
GROUP BY date;
```

### 练习 4：模拟不良分析——每个工位不合格数
```sql
SELECT station, COUNT(*) as ng_count
FROM quality_record
WHERE result = ''NG''
GROUP BY station
ORDER BY ng_count DESC;
```

## 面试高频题
> "上月不合格率最高的 3 个工位是哪些？"

```sql
SELECT station, COUNT(*) as ng
FROM quality_record
WHERE result = ''NG''
  AND date BETWEEN ''2026-06-01'' AND ''2026-06-30''
GROUP BY station
ORDER BY ng DESC
LIMIT 3;
```

## 下一步
→ [[05_JOIN多表关联|JOIN 多表关联]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (6, 'JOIN 多表关联', 4, 'published', '# JOIN 多表关联

## 一句话理解
**JOIN = 把两张表"拼"在一起查。** 产品表 JOIN BOM 表 → 知道每个产品用哪些零件。

## JOIN 类型
| 类型 | 含义 |
|------|------|
| INNER JOIN | 两边都有的才显示 |
| LEFT JOIN | 左边全部显示，右边没有的填空 |
| RIGHT JOIN | 右边全部显示 |

## 模拟 产品 场景

### product 产品表
| id | name |
|----|------|
| 1 | 产品漏电产品 |

### bom 表
| product_id | material_name | qty |
|-----------|---------------|-----|
| 1 | 外壳 | 1 |
| 1 | 线圈 | 1 |
| 1 | 铆钉 | 8 |

### 练习 1：查 产品 的完整 BOM
```sql
SELECT p.name, b.material_name, b.qty
FROM product p
JOIN bom b ON p.id = b.product_id;
```

### 练习 2：MES 追溯查询——查一个产品的全链路
```sql
SELECT
  p.name as 产品,
  b.material_name as 零件,
  pr.process_name as 工序,
  w.station as 工位,
  q.result as 检测结果
FROM product p
JOIN bom b ON p.id = b.product_id
JOIN process pr ON b.process_id = pr.id
JOIN quality_record q ON pr.id = q.process_id
WHERE p.sn = ''产品-20260719-001'';
```

## 为什么要会 JOIN？
面试官问："这个产品用了哪个供应商的线圈、经过哪些工序、谁做的、测试结果？"

→ 一个 JOIN 查询全搞定。这就是 MES 追溯的核心能力。

## 下一步
→ [[06_实战_生产报表|实战：生产日报查询]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (7, 'PLC 是什么', 1, 'published', '# PLC 是什么

## 一句话理解
**PLC = 可编程逻辑控制器 = 工业版的"if-then 机器"。** 用软件代替继电器硬接线，按"读输入→执行逻辑→写输出"循环扫描。

## PLC 在自动化层级中的位置
```
ERP（企业计划）
  ↓
MES（车间执行）
  ↓
SCADA（监控/数据采集）
  ↓
PLC（设备级控制）  ← 你在这里
  ↓
传感器/执行器（物理层）
```

## PLC 硬件结构
| 部件 | 作用 | 类比 |
|------|------|------|
| CPU | 执行程序、逻辑运算 | 单片机的 MCU |
| 输入模块 | 采集按钮/传感器信号 | 单片机的 GPIO 输入 |
| 输出模块 | 驱动继电器/接触器/电机 | 单片机的 GPIO 输出 |
| 电源 | 提供 24V/5V | 单片机的电源电路 |
| 通信接口 | 与上位机/其他 PLC 通信 | 单片机的串口/Ethernet |
| 存储器 | 存程序/数据 | 单片机的 Flash/RAM |

## 工作原理：扫描周期
PLC 不是事件驱动，而是**循环扫描**：
```
1. 读输入（刷新输入映像寄存器）
2. 执行用户程序（梯形图/指令表）
3. 处理通信请求
4. 执行 CPU 自诊断
5. 写输出（刷新输出映像寄存器）
 ↑ 回到 1，周期约 1-10ms
```

> ⚠️ 关键：PLC 输出不是立即生效，而是在扫描周期末统一刷新。这与单片机直接操作 GPIO 不同。

## PLC vs 单片机（嵌入式视角）
| 维度 | PLC | 单片机 |
|------|-----|--------|
| 可靠性 | 工业级，抗干扰强 | 需自己设计抗干扰 |
| 开发 | 梯形图图形化，工程师易上手 | C/汇编，需底层开发 |
| 实时性 | 扫描周期 ms 级，确定性强 | 取决于设计，可达 μs 级 |
| 成本 | 高（硬件溢价） | 低 |
| 灵活性 | 标准化模块，扩展受限 | 完全自定义 |
| 适用场景 | 工业现场设备控制 | 嵌入式产品/小批量 |

> 💡 嵌入式工程师学 PLC 的优势：你已经懂"输入→处理→输出"的本质，PLC 只是把它工程化、标准化了。

## 产品 漏保产线对应
- **漏电测试工序**：PLC 采集漏电电流传感器 → 判断是否合格 → 驱动分拣气缸
- **老化测试线**：PLC 控制老化时间、温度，记录通断次数
- **耐压测试**：PLC 控制升压曲线、判断击穿、输出结果
- **装配联锁**：PLC 实现工序互锁（上道未完成→下道不许启动）

## 主流品牌
| 品牌 | 特点 | 常见型号 |
|------|------|---------|
| 西门子 | 市场份额最大，生态完善 | S7-200/300/400/1200/1500 |
| 三菱 | 日系代表，小型机强 | FX 系列 |
| 欧姆龙 | 日系，中型机常见 | CP1H/CJ 系列 |
| 施耐德 | 法系，电气成套常见 | M218/M258 |
| 国产 | 汇川/信捷/和利时，性价比高 | H3U/XD5 |

## 文献支撑
- 柴天佑等. 软件定义智能控制系统未来发展展望[J]. 东北大学学报(自然科学版), 2025, 46(7). [[文献清单#文献1|全文PDF]] — 院士团队综述，Scopus 收录

## 下一步
[[02_PLC编程语言与梯形图|02 编程语言与梯形图]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (7, 'PLC 编程语言与梯形图', 2, 'published', '# PLC 编程语言与梯形图

## 一句话理解
**IEC 61131-3 定义了 5 种 PLC 编程语言**，其中梯形图(LD)最常用——它把继电器电路图直接搬进软件。

## 五种编程语言（IEC 61131-3）
| 语言 | 全称 | 特点 | 适用场景 |
|------|------|------|---------|
| **LD** | Ladder Diagram 梯形图 | 图形化，像继电器电路 | 逻辑控制（最常用） |
| **IL** | Instruction List 指令表 | 类似汇编，文本 | 嵌入式软PLC、优化 |
| **ST** | Structured Text 结构化文本 | 类似 Pascal/C | 复杂运算、循环 |
| **SFC** | Sequential Function Chart 顺序功能图 | 流程图式 | 顺序控制 |
| **FBD** | Function Block Diagram 功能块图 | 模块化连线 | 过程控制 |

## 梯形图基础
梯形图由"梯级(rung)"组成，每条梯级 = 一个逻辑判断 + 输出：
```
  | 常开触点 常闭触点 输出线圈 |
  |----[ ]----+----[/]--------------( )----|
  | | |
  |----[ ]----+ |
```

### 基本元素
| 元素 | 符号 | 含义 | 继电器对应 |
|------|------|------|-----------|
| 常开触点 | `[ ]` | 通电时导通 | 按钮常开 |
| 常闭触点 | `[/]` | 通电时断开 | 按钮常闭 |
| 输出线圈 | `( )` | 得电动作 | 继电器线圈 |
| 定时器 | TON/TOF | 延时动作 | 时间继电器 |
| 计数器 | CTU/CTD | 计数动作 | 计数继电器 |

## 经典自锁电路（启保停）
```
启动按钮 停止按钮 线圈
--[ ]--+-----[/]---------(Q0.0)
 |
--[Q0.0]  ← 自锁（输出反馈做触点）
```
**逻辑：** 按下启动→Q0.0得电→自锁触点闭合→松开启动仍保持；按下停止→断开→Q0.0失电。

## 梯形图 → 指令表（嵌入式软PLC的核心）
嵌入式软PLC的工作流（文献支撑）：
```
上位机：梯形图(LD) → 编译 → 指令表(IL) → 下载
 ↓
嵌入式运行平台：解释执行指令表 → 驱动 I/O
```
> 嵌入式软PLC的价值：把传统硬件PLC的固定硬件，换成"嵌入式板卡+RTOS+解释器"，灵活且低成本。

## 产品 场景：漏电测试梯形图设计
```
启动  光电到位 急停 测试启动
--[ ]--[ ]-----[/]------(M0.0 测试启动)
 |
 M0.0 |
--[M0.0]----[TON T1,2s]------(Q0.0 升压) ← 升压2秒
 |
 T1 |
--[T1]------------------------(Q0.1 采样) ← 采样判定
 |
 采样合格 |
--[I0.5]----------------------(Q0.2 合格灯)
 采样不合格 |
--[I0.6]----------------------(Q0.3 不合格分拣)
```

## 文献支撑
- 乔增光等. 嵌入式软PLC一体化研究与应用[J]. 自动化应用, 2025, 66(11). [[文献清单#文献2|全文PDF]] — 梯形图→指令表→嵌入式解释执行

## 下一步
[[03_PLC与工业控制应用|03 工业控制应用]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (7, 'PLC 与工业控制应用', 3, 'published', '# PLC 与工业控制应用

## 一句话理解
PLC 在工业控制中做三件事：**顺序控制、运动控制、过程控制**。从装配线联锁到伺服定位到 PID 温控，全都能干。

## 三大控制类型
| 类型 | 控制对象 | 典型场景 | 产品 对应 |
|------|---------|---------|---------|
| 顺序控制 | 开关量 | 装配线工序联锁 | 15道工序互锁 |
| 运动控制 | 伺服/步进 | 机械手定位、传送带 | 测试转盘分度 |
| 过程控制 | 模拟量(温度/压力/流量) | PID 闭环 | 老化炉温控 |

## PLC 控制系统设计流程
```
1. 需求分析 → I/O 点数清单
2. 硬件选型 → CPU/模块/品牌
3. 电路设计 → 电气原理图、接线图
4. 程序设计 → 梯形图/ST 编程
5. 硬件调试 → I/O 点测试、接线核对
6. 软件调试 → 单逻辑功能测试
7. 整体联调 → 全流程空载/带载
8. 现场调试 → 异常处理、参数整定
```

## 调试常见问题（文献经验）
| 问题 | 原因 | 解决 |
|------|------|------|
| 输出抖动 | 扫描周期 + 输入毛刺 | 加延时滤波 |
| 通信中断 | 接地/屏蔽不良 | 单点接地、屏蔽层处理 |
| 误动作 | 现场干扰 | 光电隔离、信号滤波 |
| 周期超时 | 程序过大 | 优化扫描、用中断 |

## 工业控制网络（PLC 通信）
| 协议 | 特点 | 应用 |
|------|------|------|
| Modbus RTU | 串口，简单通用 | 仪表/变频器通信 |
| Modbus TCP | 以太网版 Modbus | 上位机通信 |
| PROFINET | 西门子实时以太网 | 西门子生态 |
| EtherCAT | 高速实时（μs级） | 运动控制 |
| OPC UA | 跨平台工业互联 | PLC↔SCADA↔MES |

## 实战案例：高炉自动化控制（文献支撑）
莫昭育等(2025)用 **西门子 S7-400 PLC + WinCC SCADA** 设计高炉控制系统：
- 5 大功能模块、三层通信链路
- 炉温控制误差 ≤5℃
- 故障识别响应 ≤1s
- MTBF 8900 小时
- 煤气能耗降 3.2%、电力能耗降 2.8%

> 启示：PLC + SCADA 是重工业自动化的标配，产品 漏保产线虽小，但"PLC 控制 + SCADA 监控 + 数据落库"的架构完全一致。

## 文献支撑
- 莫昭育等. 基于PLC与SCADA的炼铁高炉自动化控制系统设计[J]. 中阿科技论坛, 2025(12). [[文献清单#文献3|全文PDF]]
- 牟小龙等. PLC在自动化生产线控制系统中的应用与调试研究[J]. 中国建筑, 2025, 8(11). [[文献清单#文献5|详情]]

## 下一步
[[04_PLC与SCADA及MES集成|04 与 SCADA/MES 集成]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (7, 'PLC 与 SCADA/MES 集成', 4, 'published', '# PLC 与 SCADA/MES 集成

## 一句话理解
**PLC 是手、SCADA 是眼、MES 是脑**——PLC 执行动作，SCADA 监控状态，MES 管理决策，数据自下而上流动。

## 三层架构
```
┌─────────────────────────┐
│  MES 层（车间执行） │  工单/报工/追溯/质量
│  ← OPC UA / 数据库 │
├─────────────────────────┤
│  SCADA 层（监控采集） │  WinCC/组态王/iFIX
│  ← Modbus TCP / PROFINET │
├─────────────────────────┤
│  PLC 层（设备控制） │  S7-1200/三菱FX
│  ← I/O 信号 │
├─────────────────────────┤
│  传感器/执行器 │  现场设备
└─────────────────────────┘
```

## 数据链路（数据如何从设备到 MES）
```
PLC 寄存器(如 MW10)
 ↓ Modbus/OPC UA
SCADA 实时数据库（变量映像）
 ↓ ODBC/SDK
MES 关系数据库（如 SQL Server）
 ↓ SQL 查询
报表/看板（产量/良率/OEE）
```

## SCADA 的核心功能
| 功能 | 说明 | 产品 对应 |
|------|------|---------|
| 数据采集 | 周期性读 PLC 寄存器 | 漏电测试数据采集 |
| 画面监控 | 组态画面、实时状态 | 测试台状态图 |
| 报警管理 | 超限报警、历史记录 | 测试超差报警 |
| 趋势曲线 | 历史数据曲线 | 老化温度曲线 |
| 报表 | 班次/日/月报表 | 良率日报 |
| 数据存储 | 存入 SQL/历史库 | 供 MES 查询 |

## PLC ↔ SCADA 通信选型
| 方案 | 优点 | 缺点 | 适用 |
|------|------|------|------|
| OPC UA | 标准、跨平台 | 配置复杂 | 中大型系统 |
| Modbus TCP | 简单、广泛 | 功能有限 | 小型系统 |
| 厂商私有协议 | 性能最优 | 锁定厂商 | 同品牌生态 |
| 数据库直连 | MES 直读 | 实时性差 | 低频数据 |

## 案例：高炉 PLC+SCADA 系统（文献支撑）
莫昭育等(2025)高炉系统采用"检测层+控制层+监控层"三层结构：
- **检测层**：温度/压力/流量传感器
- **控制层**：S7-400 PLC 执行控制逻辑
- **监控层**：WinCC SCADA 画面监控 + 报警 + 数据存储
- 通信：PROFINET + Modbus 混合

## 产品 产线集成思路
```
测试台 PLC（S7-1200）
 ↓ Modbus TCP
SCADA（组态王/WinCC）采集漏电/延时/瞬时/耐压数据
 ↓ ODBC
MES 数据库 → 良率报表 / 追溯
 ↓ SQL
你的查询分析
```

## 文献支撑
- 莫昭育等. 基于PLC与SCADA的炼铁高炉自动化控制系统设计[J]. 中阿科技论坛, 2025(12). [[文献清单#文献3|全文PDF]]

## 下一步
[[05_嵌入式软PLC与前沿趋势|05 嵌入式软PLC与前沿趋势]]', 1, 1785648000);
INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (7, '嵌入式软PLC与前沿趋势', 5, 'published', '# 嵌入式软PLC与前沿趋势

## 一句话理解
**PLC 正在"软化"和"智能化"**——从专用硬件走向嵌入式软PLC，从孤立控制走向数字孪生+软件定义+AI驱动。

## 趋势 1：嵌入式软PLC（软PLC）
传统硬件 PLC 硬件固定、成本高。嵌入式软PLC 把控制逻辑跑在"嵌入式板卡+RTOS"上：

```
上位机开发平台 嵌入式运行平台
┌──────────────┐ ┌──────────────────┐
│ 梯形图(LD) │  下载 │ RTOS + 解释器 │
│  ↓ 编译 │ ──────→  │  ↓ 解释执行指令表  │
│ 指令表(IL) │  网口/串口│  ↓ 驱动 I/O │
└──────────────┘ └──────────────────┘
```

**优势（文献支撑）：**
- 灵活性高：硬件可自定义
- 可扩展性强：功能软件定义
- 成本低：去掉硬件溢价
- 实时性：RTOS 快速响应

> 嵌入式工程师的机会：软PLC 把"PLC 工程化"和"嵌入式灵活"结合，正好是你的交叉地带。

## 趋势 2：PLC + 数字孪生
陈培集(2026)提出 PLC 与数字孪生融合的三层架构：
```
物理控制层（PLC + 设备）
 ↕  双向映射
数字镜像层（虚拟模型）
 ↕  预测决策
预测决策层（LSTM-Transformer 混合模型）
```

**新能源汽车焊装车间实证：**
- 故障误报率显著降低
- 非计划停机减少
- 维修成本降 30%
- OEE 提升至 89%

**关键技术：**
- 时序对齐 + 特征工程
- LSTM-Transformer 混合预测
- 迁移学习适配新设备
- 模型量化 + OPC UA 适配器（边缘部署）

## 趋势 3：软件定义控制 + AI 驱动
柴天佑院士团队(2025)提出"软件定义智能控制系统"：
- **虚拟 PLC**：PLC 功能软件化，跑在通用硬件
- **软件定义控制系统**：控制逻辑可编程重构
- **AI 驱动工业控制**：工业 AI + 工业互联网融合
- **端边云协同**：PID 整定智能系统跨端边云

> 这是工业控制的"未来形态"——传统 PLC 是"硬件+固定程序"，软件定义是"通用硬件+可重构软件+AI优化"。

## 趋势 4：云化 PLC + 工业网络
- **5G + TSN**：超低延迟工业网络
- **EtherCAT 融合**：面向运动控制
- **云化 PLC**：控制逻辑上云，虚拟化

## 对你（嵌入式+MES）的意义
| 趋势 | 你的切入点 |
|------|-----------|
| 嵌入式软PLC | 用单片机+RTOS实现PLC解释器，自制低成本控制器 |
| 数字孪生 | MES 数据 + PLC 状态 → 构建产线孪生体 |
| 软件定义控制 | 从"买PLC"到"写PLC"，技术自主可控 |
| AI驱动 | 漏保测试数据 + ML → 预测性维护/良率预测 |

## 文献支撑
- 乔增光等. 嵌入式软PLC一体化研究与应用[J]. 自动化应用, 2025, 66(11). [[文献清单#文献2|全文PDF]]
- 陈培集. PLC与数字孪生融合的工业控制系统实时映射与动态优化研究[J]. 自动化应用, 2026, 67(7). [[文献清单#文献4|详情]]
- 柴天佑等. 软件定义智能控制系统未来发展展望[J]. 东北大学学报(自然科学版), 2025, 46(7). [[文献清单#文献1|全文PDF]] — Scopus 收录

## 回到地图
[[index|← PLC 学习地图]]', 1, 1785648000);
