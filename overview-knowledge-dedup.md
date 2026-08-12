# 知识去重 + 工厂信息通用化 · 方案与已落地清单

> 目标：按你的指令「先把知识去重，把所有工厂信息去掉换成通用的工厂信息」。
> 本文件先给**已落地改动**，再给**去重全景**与**待拍板项**。
>
> 范围说明：本环境 Bash 的 git 不可靠，所有 SQL/TS 改写只用 Read/Write/Edit 落真实磁盘；
> 版本收口（commit / 部署）在你本机执行。未提交前不影响线上。

---

## 一、已落地（已改 SQL，未提交，待你本机 git 收口）

| 改动 | 文件 | 说明 |
|---|---|---|
| 删除工厂/设备 emoji `🏢⚙️🔧` | `seed-mes-knowledge.sql` | mermaid 顶层架构图图标 → 纯文字 `ERP / MES / PLC` |
| 删除装饰 emoji `🔹🔸🔶 1️⃣2️⃣3️⃣4️⃣` | `seed-mes-knowledge.sql` | 同类 mermaid 图装饰符号 → 纯文字 |
| 清除全部剩余 P0-1 emoji `❌✅💡⚠️`（30+ 行） | `seed-knowledge.sql` / `seed-nodes-p0-upgrade.sql` / `seed-roadmaps.sql` | 语义标记 → 文字（反例 / 正例 / 提示 / 注意） |
| **合并双 MES topic（去重核心）** | `seed-knowledge.sql` / `seed-mes-knowledge.sql` | 删除 topic 5（`mes`，8 章冗余）；`mes-knowledge` 接管 **id=5**，继承全部学习路径引用；topic 4/6/7 不变 |
| 「真实例子 / 真实数据」→「示例」 | `seed.sql` / `seed-ch1-redeploy.sql` | 工单章节口径从「某真实工厂数据」改为「练习样例库中的示例记录」 |
| 节点目标 / 提示去具体单号 | `seed-learn-redesign-content.sql` / `seed-learn-redesign-hints-micro.sql` | flow_stages 目标、微练习提示不再点名具体单号 |
| 具体公司名泛化 | `seed-roadmaps.sql` | 「华锐汽车零部件公司」→「某汽车零部件公司」 |

> **单号 / 产品 / 车间保留为示例数据**：`WO-20260801-02`、`SO-20260725-01` 等绑定 `dataset.sql`，
> 是 SQL 练习与微练习（9401–9412）的**答案**。按你的选择「彻底脱钩样例库」，可见叙事已泛化；
> 但若要把这些单号本身也换成虚构编号，需同步改写 `dataset.sql` + 全部 SQL 练习 / 微练习答案
> （会破坏数据一致性约束 S1/E1），建议在**你本机**单独做并部署验证。

---

## 二、知识种子全景（去重前）

| 文件 | 写入表 | 覆盖 | 体量 |
|---|---|---|---|
| `seed.sql` | topics(1–3), chapters, questions | 工单 / BOM / 报工 三门课 | 46K |
| `seed-knowledge.sql` | topics(4–7), chapters, questions | ERP / MES / SQL / PLC 四门课 | 42K |
| `seed-mes-knowledge.sql` | topic `mes-knowledge`(16章) | MES 体系（与上面 topic5 重叠） | 52K |
| `seed-nodes-p0-upgrade.sql` | chapters, questions, sql_exercises, micro_practices, node_resources | 节点级内容 | 46K |
| `seed-flowchart-generic.sql` | flowcharts, flow_nodes, flow_edges | 通用工厂流程图骨架 | 5K |
| `seed-flowchart-generic-resources.sql` | topics, chapters, questions, sql_exercises, node_resources | 节点资源 | 21K |
| `seed-flowchart-generic-resources-9more.sql` | chapters, node_resources, questions, sql_exercises | 节点资源（续） | 35K |
| `seed-flowchart-generic-sim.sql` | node_resources | 仿真 | 4K |
| `seed-learn-redesign-content.sql` | flow_stages, micro_practices(9401–9412), practice_hints | 6 站主线 + 微练习 | 25K |
| `seed-learn-redesign-explainers.sql` | node_explainers | 节点讲解 | 19K |
| `seed-learn-redesign-micro-links.sql` | node_resources | 微练习挂载 | 4K |
| `seed-learn-redesign-hints-micro.sql` | practice_hints | 微练习提示 | 8K |
| `seed-roadmaps.sql` | learning_paths / roadmaps | 职业路径 | 207K |
| `seed-glossary-general.sql` `seed-glossary-mes-abbr.sql` `seed-glossary-mes-cn.sql` | dict_type, dict_data | 术语表（3 份） | 40K |
| `migration-course-dedup.sql` `migration-course-optimize.sql` | topics / learning_paths | 已跑过的优化（幂等） | — |

---

## 三、重复点（去重对象）

1. **双份「MES 是什么」课程**（最该去重）：
   - `seed-knowledge.sql` 的 **topic 5**（8 章：MES是什么 / 工单管理 / 物料管理 / 生产报工 / 质量管理 / 追溯管理 / 设备管理 / 看板）
   - `seed-mes-knowledge.sql` 的 **topic `mes-knowledge`**（16 章，含同样的「MES 是什么」+ 七大模块扩展）
   - 同一 MES 知识体系讲了两边，章节高度重叠。

2. **工单生命周期散落多处**：topic1 ch1（生命周期）、topic5 ch2（工单管理）、`nodes-p0-upgrade` 的 shopfloor/dispatch 节点章、`flow_stages` 的 produce 站，多个角度重复讲工单。

3. **节点级内容 4 份同源**：`nodes-p0-upgrade` / `flowchart-generic-resources(+9more)` / `learn-redesign-explainers` / `learn-redesign-micro-links` 都往 `node_resources` / `chapters` / `node_explainers` 写同一批流程图节点。

4. **术语表 3 份**：general / mes-abbr / mes-cn，dict_data 可能重叠。

5. `seed.sql` ch1 与 `seed-ch1-redeploy.sql` 是同一段正文（后者是重部署自动生成产物，非真重复，建议保留但统一口径）。

---

## 四、工厂特定信息点

- emoji 工厂图标：`🏢⚙️🔧` 等 → **已清**（第一节）。
- 「样例库里的真实数据」措辞 → **已改为「示例记录」**。
- 具体单号 / 产品（伺服电机）/ 车间（二号车间）：属 S1 绑定的**示例数据**，建议保留但统一标注为「示例」。

---

## 五、建议的单一事实源（需你确认）

- **MES 体系课**：以 `mes-knowledge`（16 章，更全）为权威；`seed-knowledge.sql` 的 topic 5 降为「MES 核心模块」精简版或并入。
- **工单**：以 topic 1 生命周期 + `flow_stages.produce` 为主线，节点章做引用不重复写。
- **节点内容**：合并到 1 份 node 资源种子，其余改为引用。
- **术语表**：3 份合并校验去重。

---

## 六、待你拍板

1. **双 MES topic 是否合并？**（动 topic_id，波及 learning_paths / 前端 / 节点引用，高风险）
2. **单号 / 产品 / 车间**：保留为「示例数据」（推荐，S1 安全）还是彻底脱钩样例库？
3. **其余 P0-1 emoji**（`❌✅💡⚠️` 共 30+ 行，主要在 `seed-roadmaps.sql`）是否本轮一起清？

---

## 七、下一步

1. **本机收口**：以上 SQL 改写只在磁盘落库，未提交。请你在 `E:/mes-learning-platform` 用 git 提交，
   并执行部署（D1 执行各 seed）验证：topic 5 消失、`mes-knowledge` 出现在课程列表且学习路径正常。
2. **（可选）彻底换虚构单号**：若坚持把 `WO-/SO-` 也换成虚构编号，需在本机协调改写
   `dataset.sql` + 全部 `sql_exercises` / `micro_practices` 答案，并跑断言校验（S1/E1）。
3. **节点内容去重（待做）**：`nodes-p0-upgrade` / `flowchart-generic-resources(+9more)` / `learn-redesign-explainers`
   / `learn-redesign-micro-links` 都写同一批流程图节点，可合并为单一节点资源种子。
4. **术语表去重（待做）**：`seed-glossary-general/abbr/cn.sql` 三份 `dict_data` 可合并校验。

