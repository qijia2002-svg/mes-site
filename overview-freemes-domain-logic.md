# free-mes 领域逻辑抽取（排产 / 报工 / 追溯）

> 目的：从开源真 MES `github.com/metaxk-company/free-mes`（Spring Boot2.7+Vue3+MySQL8+Redis+MinIO，GPL v3）抽取**排产、报工、追溯**三大领域的真实领域逻辑，作为本 MES 教学平台的内容参考。
>
> 纪律（沿用 prior benchmark）：
> - 本平台是**教学平台**，free-mes 是**给工厂运营用的真 MES 工具**——借鉴其「领域模型 / 数据模型 / 流程」，**不搬技术栈（Java/Spring）、不搬运维复杂度、不搬行业专属字段**。
> - 以下结论均来自实际阅读源码，附 `文件:行号`（路径基：`source-code/new_open_mes_server/metaxk-module-mes/.../io/metaxk/module/mes/`）。不编造。
> - 源码已浅克隆于 `/e/free-mes`（仅本会话参考用，非平台依赖）。

---

## 0. 模块地图（先定位，再读）

后端 MES 模块包结构（`metaxk-module-mes-biz/src/main/java/io/metaxk/module/mes/`）：

| 包 | 含义 | 与本任务相关 |
|---|---|---|
| `md` | 主数据 | 工艺路线 / 工作站 / 设备（排产与报工的基础） |
| `pro` | 生产 | 工单 / 任务 / 报工 / 工时（**报工核心**） |
| `qc` | 质检 | 工序记录 ProcessRecord（**追溯相关**） |
| `plan` | 计划 | 月计划 / 日计划（**排产核心**） |
| `cla` | 排班 | 排班日历 / 班组 / 排班计划（**排产支撑**） |
| `order` | 订单/仓储 | 标签 Label / 拣货 ProductPick（**追溯相关**） |
| `dv` | 设备 | 设备状态 |
| `issue` | 安灯 | 异常呼叫 |

---

## 1. 排产 / 计划（Scheduling & Planning）

### 1.1 计划层级数据模型
- **月计划** `plan_month`（`plan/PlanMonth.java:17`）：工厂 / 车间 / 产线 / 月份 / 计划数量。
- **日计划** `plan_day`（`plan/PlanDay.java:18`）：`monthNumber` 关联父月计划（`:33`）、日期、车间、产线、`moNumber` 生产订单号（`:53`）、`planQty`。
- 日计划保存时把 `planQty` **累加回写父月计划**（`plan/impl/PlanDayServiceImpl.java:57-60`）——典型的「子→父数量汇总」。
- **排班** `cla_plan_team`（`cla/ClassPlan.java:18`）：planCode / 班组 teamCode / 轮班方式 shiftWay / 起止时间；`cla_plan_team_people`（`cla/ClassPlanMember.java:14`）记人员 peopleId、分配量 peopleQuantity、关联 taskCode。

### 1.2 是否有「真正的排产算法」？——**没有**
- 建任务时仅做**数量校验**：排产数量 ≤ 订单数量（`pro/TaskController.java:382`）。
- 有「设备产能」校验（`pro/TaskController.java:390-402`）：累加在线设备产能与排产量比较。
- **无负荷计算、无瓶颈识别、无自动排程 / dispatch / 有限产能算法**。前端「排产柱状图」（`cla/ClassCalendarController.java:133`）仅按 `Task.startTime` 汇总数量；`GanttTask.java:15` 仅为可视化。
- `metaxk-pro` 大仓内**无任何 MES / APS 模块**（已搜索确认）。

### 1.3 工单 → 任务 的真实流转
- 工单 `pro_workorder`（`pro/WorkOrder.java:14`，含父子 `parentId`，`:90`）→ 任务 `pro_task`（`pro/Task.java:13`）。
- 排产发生在**任务层**：按「工单 + 工序 + 工作站 + 设备 + 起止时间 + 数量」**手动建 Task**；排满后工单状态置 `COMPLETED`，并算排产进度百分比（`pro/WorkOrderController.java:163-167`、`pro/TaskController.java:562/576/588`）。
- Task 用 `teamCode`（`:158`）绑定执行班组；排班 `ClassPlanMember.taskCode` 关联 Task，并强校验「人员分配量之和 == 任务数量」（`cla/ClassPlanController.java:121-126`）。

### 1.4 教学启示
- **本平台 P0-1 排产迷你 sim 反而演示了 free-mes 缺失的能力**（有限产能递推、瓶颈识别、负荷条）——两者**互补**：free-mes 给「计划数据模型 + 派工 + 排班 + 产能校验」的真实样本，平台 sim 给「算法/瓶颈」的概念。
- 可教知识点：计划层级（月→日、子回写父）、订单量 vs 排产量校验、设备产能校验、班组排班与任务量匹配、排产进度%。

---

## 2. 报工 / 生产反馈（Work Reporting）

> 这是三大域里**最完整、最值得直接转教学**的一块。

### 2.1 三表联动：WorkOrder → Task → Feedback
- `Task`（`@TableName("pro_task")`，`pro/Task.java:13`）：由工单下发、按工序拆分的**工序级执行单元**。`workorderId/Code/Name`（`:32-40`）、`processId/Code/Name`（`:56-64`）、`workstationId/Code/Name`（`:44-52`）、`itemId`、`quantity` 排产数量（`:88`）、`quantityFeedback` 已报工数量（`:92`）、`status`（`:124`）、`schedule` 进度。下发时 `setStatus("NoSTARTED")`。
- `Feedback`（`pro_feedback`，`pro/Feedback.java:16`）：一次报工记录——`taskId/taskCode`、`workorderId/Code`、`processId/Code/Name`、`workstation`、`equipmentCode` 设备（`:114`，多设备用 `#` 拼接）、`quantity` 报工数量（`:77`）、`userName` 操作人（`:87`）、`feedbackTime` 开工（`:94`）/`finishedTime` 完工（`:121`）、`status`（`:99`）、`orderQuantity` 排产数量（`:142`）、`reportingProgress` 报工进度（`:160`）。

### 2.2 关键澄清：**合格 / 不良不在报工主表**
- `Feedback` 实体**没有**合格/不良数量字段（"本次报工数量"被注释，`pro/Feedback.java:81`）。
- 合格/不良在 **FINISHED 时写入质检单 `ProcessRecord`**（qc 模块）（`pro/impl/FeedbackServiceImpl.java:345-396`）。
- **重要教学点：报工 ≠ 质检，二者分离。** 很多初学者会混为一谈。

### 2.3 状态流（用历史表记录，非枚举）
- `FeedbackStatus`（`pro/FeedbackStatus.java:14-26`）**不是枚举，而是状态历史表**（taskCode / status / time / feedbackId）。
- 状态常量流转：`NoSTARTED`（未开工/待报工）→ `STARTED`（开工）→ `PAUSED`/`RESUMED`（暂停/恢复）→ `FINISHED`（完工）。
- 置 STARTED（`pro/impl/FeedbackServiceImpl.java:158`）、updateStatus 流转（`:205-268/410`）；完工回写 Task `quantityFeedback`（`:305`）与 WorkOrder `productionSchedule`（`:339`）。

### 2.4 工时：自动算 vs 手工记
- `FeedbackHours`（`pro_feedback_hours`，`pro/FeedbackHours.java:19`）：FINISHED 时**系统自动生成**，复制报工信息，`workHour` = 按状态时间戳计算的「开工→完工时长（扣除暂停）」（`pro/impl/FeedbackServiceImpl.java:426-499`），含 `equipmentHour`、`workerFinishedTime/equipmentFinishedTime`。
- `TemporaryWorkHours`（`pro_temporary_workhours`，`pro/TemporaryWorkHours.java:14`）：**独立手工记录**，`workhoursType` 工时类型 / `workhours` / `workerName` / `workshopName`，不关联 task/feedback。

### 2.5 教学素材
- 任务下发：WorkOrder→Task→Feedback 三表联动、初始 `NoSTARTED`。
- 报工内容：数量 / 操作人 / 设备 / 起止时间。
- 合格/不良分离到质检（概念澄清）。
- 工时自动算（时长 - 暂停）。
- 状态流以历史表可追溯：`NoSTARTED→STARTED→PAUSED/RESUMED→FINISHED`。

---

## 3. 追溯 / SFC（Traceability）

> 这一块是**绝佳的「真实 MES 追溯为什么难 / 常做错」反例课**——free-mes 的追溯实现有大量真实坑，正好用来教「怎么做对」。

### 3.1 条码 / 标签数据模型
- `Label` = 表 `wh_label`，注释「入库实体类（标签打印）」（`order/Label.java:17`）。追溯字段：`barCode` 条码（`:141`）、`batchNumber` 批号（`:51`）、`boxNumber` 箱号（`:56`）、`palletNumber` 托盘号（`:151`）、`itemCode/Type/Name`（`:161-171`）、`equNumber` 设备编码（`:146`）、`status`（`:186`）。行业字段明显是电线电缆：`axlesNum` 轴数（`:41`）、1~8 轴净重（`:61-96`）、`reelNumber` 盘号（`:121`）。
- 半成品主子表：`SemiLabel`=`wh_semi_label`（只有 number/warehouse/status，`:17-36`）；`SemiLabelItem`=`wh_semi_label_item` 与 Label 字段几乎同构，含 `barCode`（`:140`）、`batchNumber`（`:50`）、外键 `semiNumber`（`:28`）。
- 绑定关系：`OutboundItemLabel`=`order_outbound_item_label`（「PC 扫描出库明细详情」，`:17`）：用 `whLabelId`（`:226`）+ `outboundNumber/outboundItemNumber`（`:39,44`）+ `saleItemNumber`（`:34`）把标签挂到出库单与销售订单，并冗余复制整套标签字段。
- 图形码 `BarcodeUtil` 支持 QR(zxing)、EAN13/Code39/UPCA(barcode4j)（`:170-180`）；二维码内容是**明文拼串**（如 `"任务单号:x#产品编号:x#..."`，`:299`；`"任务编号:x#工序编号:x#工序名称:x"`，`:337`），无校验位、无版本号。

### 3.2 SN（单件级）vs 批次（批级）：粒度真相
- 全 `dal/dataobject` grep **无 `sn/snCode/serialNumber` 字段**——free-mes **没有真正的序列号**。
- **单件级**由 `barCode` 事实承担：`LabelServiceImpl.java:90-91` 用 `selectOne(eq barCode)` 查询（即当唯一键用），但代码中**未见唯一约束或查重**。
- **批次级** `batchNumber` 见 `Label.java:51`、`SemiLabelItem.java:50`、`OutboundItemLabel.java:63`、`InboundItem.java:45`、`OtherInboundItem.java:62`；但 `ReturnsItem.java:74` 却叫 `batch`——**命名不统一**。

### 3.3 ProcessRecord（工序质检记录）
- `qc_process_record`（`:18`）：`taskCode/orderCode/processCode/processName`（`:25-31`）、`productCode`（`:36`）、`quantity`（`:44`）、`inspectWay`（`:48`）、`inspectUser` 质检员（`:91`）、`inspectGroup`（`:86`）、`inspectTime/StartTime/EndTime`（`:65-77`）、`status`（`:79`）。**无设备字段、无批号、无条码**。
- 明细 `qc_process_record_item` 才带 `productBarcode`（`:23`）、`itemDevice` 检测器具（`:38`）、`itemValue` 实测值（`:41`）、`status` 合格标志（`:44`）。结果表 `qc_process_record_result` 存 `resultStatus/detectionNumber/sortNumber`（`:32-41`）。任一检测项不合格则整件不合格（`qc/ProcessRecordController.java:510-528`）。
- 绑定动作：`ProcessRecordItemMapper.xml:20-25`（`update ... set product_barcode=? where record_id=? and sort_number=?`）——扫码值回填到「第 N 件」（调用见 `ProcessRecordController.java:320,505`）。

### 3.4 追溯查询：未实现 + 典型坑
- **正向 / 反向追溯查询均无现成实现**（全模块 grep「追溯|trace」仅命中 `printStackTrace`）。
- `ProcessRecordItem.java:26` 的 `sortNumber` 注释为「序列号」，实际**只是单张检验单内的抽检第几件**（`ProcessRecordController.java:124` 为 `count+1`、`:509` 写「num 当前质检数===序列号」，SQL `max(sort_number) where record_id`）——**名为 SN 实为序号**。
- `ProcessRecord` 不存批号 → 反向（批不良→SN 列表）**无任何字段支撑**。
- 报工层 `pro/Feedback`、`Task` 仅有 taskCode/processCode，**无条码批次** → 追溯断在「任务」粒度。
- `ProductPick` 是**生产领料**而非拣货追溯（`order/ProductPick.java:13,18`，表 `order_product_pick`）；明细 `ProductPickItem.java:15-78` 只有 itemCode/quantity/价格，**无 batchNumber、无 barCode**，无扫码 → 物料正向追溯在领料环节断开。

### 3.5 教学启示（反例 → 正例）
- 用 free-mes 的真实实现做「**为什么很多 MES 追溯做不好**」案例课：
  1. 命名分裂（batchNumber / batch）、SN 缺失（barCode 当主键无约束）。
  2. 追溯断在任务粒度（报工/任务无条码批次）。
  3. 物料正向追溯在领料断开（ProductPick 无批/码）。
  4. 正/反向追溯查询未实现。
- 可设计练习：在平台现有 `sql-sandbox` 基础上，**补 `sn` 字段 + 写正向（SN→经手全部工序）/ 反向（某批不良→涉及哪些 SN）两条 SQL**——free-mes 正好缺这一块，学员补的即是真需求。

---

## 4. 教学映射总表（domain → 平台现有覆盖 → 待加深/新增）

| 域 | 平台现有（来自内容差距表+种子） | 用 free-mes 真实逻辑怎么加深 | 新增可教学件（建议） |
|---|---|---|---|
| **排产** | P0-1 APS 排产迷你 sim（有限产能/瓶颈算法）已上线 | 补「计划数据模型 + 派工 + 排班 + 产能校验」的真实样本（free-mes 弱项正好对照） | 排产派工练习：给定订单量/设备产能，校验排产量是否合法 |
| **报工** | 工单/报工章节已有（末端概念齐） | 用三表联动 + 状态流历史表 + 合格/不良分离 + 工时自动算**加深真实度** | 报工状态流练习：给定 Task 列表，模拟 `NoSTARTED→…→FINISHED`，算进度% |
| **追溯** | 追溯章节已有（批次/SN/正反向概念） | 用 free-mes **真实坑**做「反例 + 正反向追溯设计」新课/练习 | 追溯设计 SQL 练习：补 `sn` + 写正向/反向追溯查询（落在现有 sql-sandbox） |

**核心结论**：free-mes 给的是「运营级 MES 的真实数据模型与流程边界」，本平台给的是「教学化后的概念与算法」。三大域里：
- 排产 = 平台 sim 已超前（算法），free-mes 补认知底座；
- 报工 = free-mes 模型最完整，直接加深现有章节；
- 追溯 = free-mes 是**反例教材**，转成「怎么做对」的设计练习价值最高。

---

## 5. 不照搬清单（纪律红线）
- ❌ 不搬 Java / Spring Boot 技术栈与工程结构。
- ❌ 不搬电线电缆行业专属字段（轴数 axlesNum / 盘号 reelNumber / 箱号）。
- ❌ 不照搬「人工计划录入 + 数量校验」的弱排产实现（平台 sim 已演示更优算法）。
- ❌ 不照搬追溯的缺陷实现（无 SN 约束、命名分裂、查询未实现）——只作**反例**引用。
- ✅ 可借鉴：计划层级与回写、工单→任务→报工三表联动、状态流历史表、合格/不良与报工分离、条码绑定最小实现（标签→单据）、正/反向追溯的设计意图。

---

## 6. 下一步（落地范围待确认）
见任务 #163。候选落地件（按教学杠杆排序，均走「概念→章节→练习→KG 指认」套路）：
1. **报工状态流练习**（低成本高回报，纯前端/逻辑即可）。
2. **追溯设计 SQL 练习**（补 sn + 正/反向查询，落在现有 sql-sandbox，复用 topic6 数据集范式）。
3. **排产派工校验练习**（订单量 vs 排产量 vs 设备产能）。
4. 视情况加深现有「报工 / 追溯」章节正文（用 free-mes 真实模型替换/补充现有占位表述）。
