# PRD · 能力路线与职业路径 v1

| 项 | 内容 |
|---|---|
| 文档版本 | v1.1（v1.0 基础上按项目总监裁决打补丁：补 project-management 与 programming-dev 两条 track，并挂入职业矩阵） |
| 撰写 | 许清楚（产品经理） |
| 类型 | 已上线平台的增量需求，非新项目 |
| 数据交付 | `docs/seeds/career-roadmap-data.json`（10 tracks / 5 careers，架构师表结构以该文件字段为契约） |
| 状态 | 已定稿，待架构师建表 + 待内容填充 |

---

## 1. 这次要解决的问题

平台现在有 5 个有效课程主题、42 章可用内容，但它们是**平铺的**。用户进来只能看到"有哪些课"，看不到两件事：

1. **我现在在哪一级、下一步该学什么** —— 没有分级，学完 MES 8 章不知道自己算入门还是算会了
2. **学这些能干什么活** —— 没有岗位出口，内容与就业之间没有连线

增量需求要补的就是这两层：**纵向分级（tracks × levels）** 和 **横向岗位映射（careers × stages × requirements）**。

不新增课程内容。已有 48 章全部挂载完毕，缺的部分用 `planned_chapters` 占位大纲（共 120 章），供后续填充。

---

## 2. 分级标准：凭什么算 L1 / L2 / L3

分级不按"学了几章"，按**任务自主度**。这是唯一能自洽的标准——同样学 8 章，能不能独立干活是可验证的，学时长短不是。

| 级别 | 能力性质 | 判定问题 | 工作场景描述 | 面试对应 |
|---|---|---|---|---|
| **L1 入门** | 认知层：听得懂、看得懂 | 能否用自己的话把概念讲给别人听，并看懂系统里的单据/界面/数据？ | 能参加需求会不掉队，能被分配观察和记录类任务；**不能独立交付** | 答得了概念题、名词解释 |
| **L2 中级** | 操作层：动得了手、配得了 | 能否在有人分配任务、有环境的前提下独立完成标准作业，并自己发现错误？ | 能承接明确边界的配置/开发/调试任务，交付质量不需要返工 | 答得了场景题、"这个功能怎么配" |
| **L3 高级** | 方案层：设计得了、救得了火 | 能否面对没有标准答案的问题给出方案，并对结果负责？ | 能独立对客户、能定位跨系统问题、能在事故现场做决策 | 答得了架构题、事故复盘题 |

**三条硬约束：**

- **L1 的验收必须是"能输出"而不是"看完了"** —— 所以每级 `outcomes` 都写成可当场验证的动作（"能画出 ERP 与 MES 的职责边界图"），不写"了解 XX"。
- **级别是累积的**：声明 L3 即隐含掌握 L1/L2。所以 `careers` 里同一 track 在同一 stage 只出现一行，跨 stage 只升不降。
- **学时（`hours`）是自学口径**，按晚上和周末投入估算：L1 约 10-14h，L2 约 18-32h，L3 约 24-34h。L2 通常最重，因为它是"从看懂到会做"的那一跳。

---

## 3. 路线设计：为什么是 10 条、为什么嵌入式是选修

### 3.1 九条核心 + 一条选修

| sort | slug | kind | 定位 | 内容状态 |
|---|---|---|---|---|
| 1 | erp | core | 计划层与账，MES 主数据的上游 | L1 有内容，L2/L3 待建 |
| 2 | mes | core | 现场执行层，平台主线 | L1/L2 有内容，L3 待建 |
| 3 | sql | core | **唯一 5 个岗位全部要求**的通用底层技能 | L1 有内容，L2/L3 待建 |
| 4 | plc | core | 设备控制侧，数采的源头 | L1/L2 有内容，L3 待建 |
| 5 | embedded | **elective** | 选修加分线 | 仅 L3 有 1 章，标 `content_status: "inverted"` |
| 6 | industrial-network | core | IT/OT 之间的断层，全平台最大盲区 | 全部待建 |
| 7 | linux-ops | core | 交付与运维的兜底能力 | 全部待建 |
| 8 | barcode-rfid | core | 追溯落地的物理入口 | 全部待建 |
| 9 | project-management | core | 从「能干活」到「能带项目」的分水岭，4/5 岗位需要 | 全部待建（v1.1 新增） |
| 10 | programming-dev | core | 二开岗位的技术主干，与 sql 互补 | 全部待建（v1.1 新增） |

> **v1.1 补充说明**：这两条是 v1.0 第 6 节标记的契约外缺口，经项目总监裁决转为正式 track。原先靠 `milestone` / `deliverables` 文字承载的项目管理与编程能力，现已改为 `requirements` 正式条目，能力矩阵不再有隐性依赖。<br>建议图标语义名：`project-management` 用 `clipboard-list`，`programming-dev` 用 `code`（已写入 JSON 的 `icon` 字段）。

### 3.2 嵌入式为什么定 elective

判定依据是**它是否出现在任一岗位的准入要求里**。逐条核对 5 个岗位后：

- MES 实施 / ERP 顾问 / MES 二开 / 甲方专员 —— 四个岗位在任何阶段都不需要它
- 只有 SCADA 数采工程师需要，且集中在**阶段 4（资深）**，用于处理"老设备没通讯口、标准网关搞不定"的定制场景

一条只对 1/5 岗位、且只在最后阶段生效的技能，不该占主线门槛的位置。定为 elective，在 UI 上应与 core 视觉分离（建议图标 `cpu`，与 core 的实心风格区分为描边风格），避免新人误以为必学而劝退。

### 3.3 五条新建路线为什么算 core 而不是选修

它们没内容，但都是**已发生的交付事故来源**：数据断了查不出是网络问题（industrial-network）、客户没运维只能实施自己部署（linux-ops）、编码规则定错导致追溯链断掉（barcode-rfid）、需求没签字导致范围无限膨胀（project-management）、二开代码改核心导致产品无法升级（programming-dev）。这五件事在原有 5 条线里没有任何一章覆盖。定 core 是为了在职业矩阵里如实标出它们的必要性，而不是等内容做完再承认。

判定 core 的一致标准是：**该能力是否在任一岗位的任一阶段被标为 `core` 或在两个以上岗位被标为 `important`**。project-management 在 erp-consultant 阶段 4 和 mes-implementation 阶段 4 均为 core，programming-dev 在 mes-dev 三个阶段连续 core，两条均满足。

---

## 4. 章节映射：做了哪些判断

现有 48 章（1-6、55-80、305-320）**全部挂载，无遗漏、无重复**。以下四处是我在总监给的映射建议上做的调整或确认，附理由：

| 处理 | 判断与理由 |
|---|---|
| **mes L2 = 305-320 + 1-6，共 22 章** | 按建议执行。22 章 / 32 学时是全平台最重的一级，且老课程 1-6（工单/BOM物料/生产报工 各 2 章）与 305-320 中的"工单管理""产品与物料""多层BOM""生产报工"存在**主题重叠**。<br>**v1.1 裁决结果**：1-6 保留在 mes 中级，不迁出、不删除。已在该 level 上新增 `chapter_notes` 映射（键为章节 id 字符串，值为 `"实操案例，建议排在核心章节之后"`），共 6 条。前端据此对这 6 章做次级排序与标签区分，避免用户在目录里看到两套讲工单的课。 |
| **erp L1 = 55-63，全 9 章** | 按建议执行。9 章含"ERP与MES的边界"，放 L1 合理——这一章正是建立职责认知的，属于认知层。 |
| **embedded L3 = 80，L1/L2 全空** | 按建议执行。章节 80 是"嵌入式软PLC与前沿趋势"，内容确属高级，形成"顶层有内容、底层没内容"的倒挂。<br>**v1.1 裁决结果**：保留倒挂，已在 embedded track 上加 `content_status: "inverted"`。前端据此显示"前置内容建设中"，L3 不作为可直接进入的入口。 |
| **sql L2/L3 的落点** | topic 8 `sql-interview`（SQL 面试实战）目前是**空壳、0 章**。sql L2 的"MES 常见业务查询模板集"与 L3 的"生产事故排查取数实战"内容形态就是面试实战。<br>**v1.1 裁决结果**：批准。已在 sql L2/L3 两级加 `target_topic_slug: "sql-interview"`，供内容导入时定位，不必新建 topic。 |
| **`target_topic_slug` 的适用范围** | 该字段只标"落到已有空 topic"的情形。逐条核对后，现有 topic 中**只有 topic 8 是空壳**，因此全库仅 sql L2/L3 两处使用。<br>其余待建级别分两类：erp / mes / plc 的待建级属于**同名 topic 的自然延伸**（新章节直接挂到 topic 4/5/7 下），无需标注；industrial-network / linux-ops / barcode-rfid / project-management / programming-dev 五条**需要架构师新建 topic**，故省略该字段。 |

---

## 5. 职业路径：阶段划分与需求矩阵怎么定

### 5.1 四阶段划分依据

阶段不按学习进度切，按**能独立承担的责任范围**切，这样每个阶段的 `milestone` 才可验证：

| 阶段 | 名称 | 责任边界 | milestone 的验证形式 |
|---|---|---|---|
| 1 | 打基础 | 能参与，不能交付 | 产出一份分析类文档（流程图、表关系图） |
| 2 | 上手 | 在带教下交付明确任务 | 独立完成一个模块并通过评审 |
| 3 | 独立 | 独立对一个项目/一条产线负责 | 项目上线并验收，有客观达标指标 |
| 4 | 资深 | 对方案、架构、团队负责 | 中标 / 主导平台级改造 / 输出被采纳的规划 |

**时长按中国制造业实际节奏**，不是理想值：MES 实施因为高频驻场、上手最快（阶段1 仅 0-1 个月），其余四岗阶段1 为 0-2 个月；到"能独立带项目"普遍需要 6-18 个月；到资深需要额外 1.5-3 年。

### 5.2 需求矩阵的差异化（这是本文件最不能抄的部分）

矩阵按岗位真实工作内容逐条推导，不搞"所有岗位都学所有线"。下表为**各岗位对每条 track 的最终封顶要求**（数字为级别，`*`=core `+`=important `~`=optional，空白=该岗位完全不需要）：

| track | MES 实施 | ERP 顾问 | MES 二开 | SCADA 数采 | 甲方专员 |
|---|---|---|---|---|---|
| mes | 3* | 3+ | 3* | 2+ | 3+ |
| erp | 3+ | 3* | — | — | 3+ |
| sql | 3+ | 3+ | 3* | 2+ | 3+ |
| plc | 1~ | — | — | 3* | — |
| embedded | — | — | — | 3+ | — |
| industrial-network | 2~ | — | 2+ | 3* | 2~ |
| linux-ops | 2+ | 1~ | 3+ | 3+ | 1~ |
| barcode-rfid | 3+ | — | 2+ | — | 2+ |
| **project-management** | **2\*** | **3\*** | — | — | **2+** |
| **programming-dev** | — | — | **3\*** | — | — |

关键差异判断：

- **MES 实施工程师**：覆盖面最广但深度分散。PLC 只需"能看懂点表、和电气对上话"，深度调试是 SCADA 岗的活。project-management 封顶 L2 core——阶段 4 要同时管两个以上项目，计划编制与上线组织必须自己扛。
- **ERP 实施顾问**：**完全不含 plc、industrial-network、barcode-rfid、embedded、programming-dev**。工作对象是流程和账，不碰设备也不写代码。是**唯一要求 project-management L3 core** 的岗位——ERP 项目周期半年到一年，范围蔓延与变更管理直接决定项目盈亏。
- **MES 二开**：**programming-dev 从阶段 2 起连续三级 core**，是这条路径的技术主干；sql 同样一路 core。两者分工明确：sql 管取数，programming-dev 管逻辑、接口与扩展。不含 project-management——这个岗位对技术方案负责，不对客户和工期负责。
- **SCADA 数采**：**唯一要求 plc L3 + industrial-network L3 的岗位**，也是 embedded 唯一的出口。不含 project-management 与 programming-dev——它的产出是数据链路而非项目交付或代码资产。
- **甲方数字化专员**：**宽而不深**。erp 和 mes 阶段 2 要 L2 core，但最终封顶只标 important（甲方需要判断力，不需要亲手交付）。project-management 封顶 L2 important，理由见下。

`importance` 三档的含义固定为：`core` = 不具备就无法进入该阶段；`important` = 缺失会明显拖慢或降低交付质量；`optional` = 有则加分，可外包或后补。每条 `note` 都写了"为什么这个阶段需要它"，不写空话。

### 5.3 两处自主判断的结论（v1.1）

总监就以下两处征询判断，我的结论是**都加，但级别与权重不同**：

| 岗位 | 结论 | 依据 |
|---|---|---|
| **mes-implementation** | 阶段 3 → PM **L1 important**；阶段 4 → PM **L2 core** | 与总监倾向一致。阶段 3 的 milestone 已经是"独立主导项目上线并验收"，而立项范围界定与需求确认单签字正是守住边界的手段，缺了它需求会被无限追加——这是实施岗位最高频的亏损来源。阶段 4 的 milestone 是"同时管理两个以上项目"，UAT 组织与上线切换已是本职而非加分，故升为 core。不给到 L3：多项目并行与二期挖掘属于项目经理职责，已超出本岗位定义。 |
| **digital-specialist** | 阶段 3 → PM **L1 important**；阶段 4 → PM **L2 important**，**封顶不到 L3** | 与总监倾向一致，并补一条限定。甲方是**监督方不是执行方**：需要看懂乙方的计划与里程碑、能主持内部协调会、能判断 UAT 与验收标准够不够硬，因此 L1/L2 有实际用途。但 PM L3 的内容里"客户关系经营与二期挖掘"是纯乙方视角，甲方用不上，"多项目并行调度"也远超单个专员的职权范围，硬挂 L3 会让矩阵失真，故封顶 L2。<br>保持 important 而非 core 的理由：甲方专员即使项目管理能力一般，项目仍可由乙方项目经理推进；但若 erp/mes/sql 不过关，就会被厂商牵着走——那三条才是这个岗位的立身之本。 |

---

## 6. 已知内容缺口（按优先级）

| 缺口 | 影响 | 建议优先级 |
|---|---|---|
| **sql L2/L3 全空（12 章大纲）** | sql 是 5/5 岗位共同要求、且 4 个岗位要到 L2 以上。它是当前最大的单点缺口 | P0 |
| **mes L3 全空（6 章大纲）** | 三个岗位（MES 实施、MES 二开、甲方专员）的阶段 3-4 都卡在这里 | P0 |
| **programming-dev 全空（15 章大纲）** | mes-dev 从阶段 2 起连续三级 core 全部依赖它，该岗位路径目前是断的 | P0（v1.1 新增，与 sql/mes 缺口同级） |
| **五条新建路线共 75 章大纲，零内容** | 职业矩阵里已标为 core，用户点进去是空的，属于承诺未兑现 | P1（顺序建议：linux-ops → project-management → industrial-network → barcode-rfid，按覆盖岗位数排） |
| **erp L2/L3 全空（11 章大纲）** | ERP 顾问路径从阶段 2 起就断了 | P1 |
| ~~无"项目管理"track~~ | **v1.1 已解决**：新增 `project-management`（sort 9），15 章大纲，挂入 4 个岗位 | 已闭环 |
| ~~无"编程基础"track~~ | **v1.1 已解决**：新增 `programming-dev`（sort 10），15 章大纲，挂入 mes-dev | 已闭环 |

---

## 7. 交付物与后续动作

- **数据文件**：`docs/seeds/career-roadmap-data.json` —— **10 tracks（30 个 level）/ 5 careers（20 个 stage / 90 条 requirement）/ 120 条 planned_chapters 大纲**，已通过契约校验（字段完整、importance 枚举合法、track 引用有效、sort 无重复、章节 id 无重复无杜撰、同 stage 无重复 track、跨 stage 级别单调不回退、P0 三条规则零命中）。校验脚本：`docs/seeds/_verify-roadmap.mjs`，输出留在 `_verify-out.txt`，可随时复跑。
- **交给架构师**：按 JSON 字段建表，字段名不改。注意四点：<br>① `chapter_ids` 是数组，需要关联表；`planned_chapters` 是纯展示数据，不与 chapters 表关联。<br>② v1.1 新增三个可选字段——track 级 `content_status`（当前仅 embedded = `"inverted"`）与 `icon`；level 级 `target_topic_slug`（仅 sql L2/L3）与 `chapter_notes`（仅 mes L2，键为章节 id 字符串）。这四个字段**允许缺省**，建模时按 nullable 处理。<br>③ industrial-network / linux-ops / barcode-rfid / project-management / programming-dev 五条需要新建对应 topic。<br>④ sql L2/L3 的内容导入目标是已有的 topic 8 `sql-interview`，不要新建。
- **交给设计师**：两处视觉区分：elective 线（embedded）与 core 线区分；`content_status: "inverted"` 的 track 需显示"前置内容建设中"。
- **图标（v1.1 已与架构师现有实现对齐）**：JSON 的 10 条 track 与 5 条 career 均已补齐 `icon` 语义名，取值与 `docs/seeds/career-roadmap-import.sql` 中架构师的分配一致，JSON 为唯一事实源：<br>`erp` `mes` `sql` `plc` `embedded` `network` `linux` `barcode` `clipboard-list` `code`；career 用 `role-mes-impl` / `role-erp-consultant` / `role-mes-dev` / `role-scada` / `role-owner-digital`。<br>**待架构师处理的缺陷**：`clipboard-list` 与 `code` 两个键**当前不存在于 `web/src/components/Icon.tsx` 的 REGISTRY** 中，但 import.sql 已引用，违反 ADR-002 的"icon 取值必须存在于 REGISTRY"约束。需补两个 SVG 定义后才能上线，否则这两条新路线的图标会缺失。
- **交给内容侧**：按第 6 节优先级填充，`planned_chapters.desc` 每条已写明"讲什么 / 给谁看 / 学完能干嘛"，可直接作为写作提纲。mes L2 的 1-6 章按 `chapter_notes` 排在核心章节之后。

---

## 8. 验收标准

- Given 用户进入某条 track 详情页，When 该级别 `chapter_ids` 非空，Then 展示可点击的章节列表；When 为空且有 `planned_chapters`，Then 展示大纲并标注"内容建设中"，不可点击
- Given track 的 `content_status` 为 `inverted`，When 用户查看该 track，Then 高级别虽有内容也不作为推荐入口，并提示"前置内容建设中"
- Given 某级别存在 `chapter_notes`，When 渲染章节列表，Then 带注记的章节排在无注记章节之后并显示对应标签
- Given 用户进入某个 career 详情页，When 查看任一 stage，Then 能看到该阶段所有 requirement 及其 importance 标识、跳转到对应 track 级别的链接
- Given 用户已完成某条 track 的 L1 全部章节，When 查看依赖该 track L1 的 career stage，Then 该条 requirement 显示为已满足
- Given 任一 career 的 stage 4，When 检查其 requirement 集合，Then 不出现同一 track 的重复条目，且级别不低于前序 stage
