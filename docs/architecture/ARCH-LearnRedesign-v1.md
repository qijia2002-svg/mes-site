# 学习体验重构 — 架构方案 v1

状态：Draft v1.2（对齐 PRD v1.2） | 日期：2026-08-08 | 负责人：高见远（首席架构师）
关联：docs/PRD-ZeroBasis-Relearn-v1.md（v1.2）/ ADR-014 / ADR-016 / ADR-017 / ADR-018 / ADR-019 / ADR-020 / ADR-021
线上基线：部署版本 c7ebb522，flowchart API 返回 12 节点 / 36 resources

## 1. 结论先行

当前技术栈**完全支撑**本次重构，无需引入任何新依赖、新服务、新数据库。
本次是**加法改造**：新增 4 张内容表 + 5 个只读端点 + 1 个判分端点，存量表和端点零破坏性变更。

但有 **4 个必须在动工前解决的阻塞项**，四个都是沉默失效——不报错、类型检查全绿、只是进度算错：

| 编号 | 一句话 | 位置 |
|---|---|---|
| BLOCK-01 | `practicesOf` 是黑名单，任何新资源类型自动进完成度分母 | §4.2 |
| BLOCK-02 | 12 个节点每个都挂 sql，第一阶段必被 SQL 卡死 | §4A |
| BLOCK-03 | 全局 `nextKey` 走拓扑序，会把人带出当前阶段 | §4A |
| BLOCK-04 | 迁移默认值填真实阶段名，会让全平台 sql 一次性退出分母 | §4B |

另有一项与本次重构无关、顺手核出的既有风险：`answer_hash` 缺防回归断言（§4C）。

## 2. 版本锚定（按实际安装版本写，不按印象写）

| 组件 | 实际版本 | 证据 |
|---|---|---|
| React | ^19.0.0 | web/package.json |
| react-router-dom | ^7.18.2 | web/package.json |
| @tanstack/react-query | ^5.59.0 | web/package.json |
| Vite | ^6.0.0 | web/package.json |
| lucide-react | 1.28.0（精确锁定） | web/package.json + node_modules/lucide-react/package.json 已核验存在 |
| sql.js | 1.13.0 | web/package.json |
| markdown-it / dompurify | ^14.1.0 / ^3.1.7 | web/package.json |
| Workers compatibility_date | 2025-10-01 | wrangler.toml |
| D1 database | mes-learning / 81994d7b-... | wrangler.toml |

响应信封锚定 `worker/src/core/response.ts`：成功 `{ code: 0, data, msg: "ok", traceId }`，
失败 `{ code, data: null, msg, traceId }`。**字段名是 `msg` 不是 `message`**，
与通用规范不同，以项目现状为准。

## 3. 技术可行性评估（逐项）

| 需求 | 可行性 | 依据与约束 |
|---|---|---|
| ① 重排学习路径（先全貌后细节） | 可行 | flow_nodes 已有 sort + edges 拓扑；只需加 stage 分层。解锁判定放前端派生层，零后端成本 |
| ② 讲解通俗（大白话/真实数据例子/误解澄清） | 可行 | 前端已有 markdown-it + DOMPurify 渲染链路（ChapterPage 在用），新表直接复用 |
| ③ 互动即时反馈 | 可行 | quiz 服务端判分、SQL 客户端 SHA-256 判题（ADR-005）均已就绪，只需补「分级提示」与「微练习」 |
| ④ 信息架构重做 | 可行 | 路由已是 react-router-dom v7 + 路由级懒加载（ADR-009），改导航不动数据层 |

### 3.1 不可行 / 高风险警告

**WARN-01 — D1 Free 单次 Worker 调用查询数上限 50 条（付费版 1000）。**
现状 `getFlowchart` 用 4 条查询（flow / nodes / edges / resources IN 批量）拿完整图，设计是对的。
新增 stages 后为 5 条。**硬约束：禁止为了拿讲解/微练习而按节点循环查询**——
12 个节点循环 3 次就是 36 条，叠加现有 5 条已逼近 50 条上限，且这是**首页**接口。
讲解与微练习必须走独立端点、抽屉打开时按需拉，不并入首屏。

**WARN-02 — D1 Free 每日写入 10 万行。**
「做中学」会显著抬高交互频次。**禁止把每次提示解锁、每次答题尝试各写一行 progress_events**——
一个活跃用户一天几百次交互，几百个用户就打爆配额，且爆了之后**整库拒绝写入**（不是降级，是全站写挂）。
沿用现状：进度写 `user_kv` 的 `factory.progress` 单键 JSON（1 次写入覆盖），前端防抖同步。
需要行为分析时另议，本期不做。

**WARN-03 — D1 Free 单库 500 MB。** 讲解是纯文本 Markdown，量级几 MB，不构成风险。

**WARN-04 — 不要用 Workers AI 实时生成提示作为主链路。**
`aiLimit()` 限流 + 推理延迟 + 输出不可控，零基础学员最需要的恰恰是**稳定、准确、审校过**的台阶。
提示走人工撰写入库（practice_hints）。AI 保留为「还是不懂？换个说法」的可选增强，失败静默降级。

## 4. 内容模型设计

### 4.1 核心决策：新内容表独立，不扩 node_resources.res_type

**不要**把 example / misconception 加成 `node_resources.res_type` 的新值。原因见 BLOCK-01。

`node_resources` 的语义是**完成度锚点**（"要做的事"），不是"要读的东西"。
讲解、真实数据例子、误解澄清都是读物，塞进去会直接污染进度分母。
因此：讲解类内容进独立表 `node_explainers`，与完成度彻底解耦。

唯一新增的 res_type 值是 `micro`（微练习），因为它**确实是实战**，应当计入完成度。

### 4.2 BLOCK-01（必须先修）：practicesOf 是黑名单，不是白名单

证据：`web/src/features/factory/factoryFlow.data.ts:94-96`

```ts
export function practicesOf(res: NodeResourceDTO[]): NodeResourceDTO[] {
  return res.filter((r) => r.type !== 'chapter');
}
```

这是排除法。后果：**今后往 node_resources 写入的任何新 res_type 值，都会自动被当成"实战"计入分母。**
配合 `useNodeStatus.ts:52` 的 `practices.every(r => isDone(...))`——
只要有一条永远不会被标记完成的资源（比如一条误解澄清），该节点的 `practiced` 永远为 false，
进度条永久卡住、`nextKey` 永远指向它。

这是典型的**沉默逻辑错误**：不报错、不崩溃、类型检查全绿，只是进度算错。
内容团队一旦按"扩 res_type"的思路铺内容，全站进度立刻失真且极难定位。

**修法（改 1 处，3 行）：**

```ts
/** 计入完成度的实战类型白名单。新增类型必须显式加入这里，不加则不计分母。 */
export const PRACTICE_TYPES = new Set(['quiz', 'sql', 'sim', 'micro']);

export function practicesOf(res: NodeResourceDTO[]): NodeResourceDTO[] {
  return res.filter((r) => PRACTICE_TYPES.has(r.type));
}
```

改成白名单后，未知类型默认**不**计入分母——失败方向是安全的（进度偏乐观而非永久卡死）。

### 4.3 D1 表结构草案

完整可执行 SQL 见 `worker/src/migrations/schema-learn-redesign.sql`。摘要：

| 表 | 用途 | 关键字段 | 索引 | 运行时写入 |
|---|---|---|---|---|
| `flow_stages` | 先全貌后细节的阶段分层 | flow_id, stage_key, title, goal, sort | `(flow_id, sort)` + UNIQUE`(flow_id, stage_key)` | 无 |
| `node_explainers` | 分层讲解 | node_id, **tier**(overview/detail), **kind**(plain/example/mapping/misconception), body_md | `(node_id, tier, sort)` | 无 |
| `practice_hints` | 分级提示 | target_type, target_id, **level**(1/2/3), body_md | `(target_type, target_id, level)` + UNIQUE 同键 | 无 |
| `micro_practices` | SQL 前的低门槛台阶 | node_id, kind(match/order/pick), payload(JSON), answer(JSON, 不下发) | `(node_id, sort)` | 无 |

`flow_nodes` 增 2 列：`stage_key TEXT NOT NULL DEFAULT ''`、`one_liner TEXT NOT NULL DEFAULT ''`。

**内嵌坑：** SQLite / D1 的 `ALTER TABLE ADD COLUMN` **不支持 `IF NOT EXISTS`**，
重复执行报 `duplicate column name`。迁移文件里这两行已注释隔离，需单独执行且只跑一次。

`stage_key` 默认值**必须是空串**，不能是任何真实阶段名——原因见 §4B 的 BLOCK-04。

索引策略遵循项目现状：只建覆盖高频查询路径的单一复合索引，不预建组合索引。
D1 按扫描行数计费，`node_explainers(node_id, tier, sort)` 让抽屉查询只扫命中行，不做全表扫描。

## 4A. v1.1 增补：PM 阶段切分落地后暴露的两个冲突

PM 于 2026-08-08 给出三阶段切分（PRD 3.1），据真实节点数据复核后发现两处冲突。
两处都不是 PM 的方案错，是既有数据与新方案的接缝，必须在动工前解决。

> **读本节前先看 §4B。** PRD 已修订到 v1.2，阶段划分退回「待用户给定」。
> 本节里出现的 tour / basics / deep 与具体节点清单**只作为推演示例保留**，
> 用途是证明冲突真实存在、解法有效，**不是已定方案**。
> BLOCK-02 / BLOCK-03 两个结论本身与具体怎么切无关，PRD v1.2 §3.0 已采纳为产品口径。

### BLOCK-02：12 个节点每个都挂了 sql，tour 阶段会被 SQL 卡死

证据：`seed-flowchart-generic.sql` 12 节点 + 线上 36 resources（每节点 chapter+sql+quiz）。
PM 的 tour 阶段（cust-order / shopfloor / qc / shipping）意图是「还没到 SQL」，
但这 4 个节点各自都挂着 sql 资源。经 `practicesOf` 白名单后 sql 仍在分母里，
tour 的 4 个节点必须写完 SQL 才 `practiced`——**第一阶段就撞上最硬的门槛**，
与整个渐进设计背道而驰。

**解法：阶段级实战策略 `flow_stages.practice_types`（JSON 数组）。**
tour 设 `["micro","quiz"]`，basics / deep 用默认全集。
选它而不是给 36 条资源逐条打 stage 标签，是因为这是 **3 行配置 vs 36 行数据**，
且 PM 可直接改，不需要开发介入。
未列出的类型仍可自由练习（SQL 按钮照常在），只是不计入该阶段完成度。

`practicesOf` 相应升级为「白名单 ∩ 阶段策略」：

```ts
export const PRACTICE_TYPES = new Set(['quiz', 'sql', 'sim', 'micro']);

/** allowed 缺省时退回全集，保证无阶段数据时行为与今天一致。 */
export function practicesOf(
  res: NodeResourceDTO[],
  allowed: Set<string> = PRACTICE_TYPES,
): NodeResourceDTO[] {
  return res.filter((r) => PRACTICE_TYPES.has(r.type) && allowed.has(r.type));
}
```

**修正我在 v1 §5.2 的说法。** 当时写「useNodeStatus 不改语义」，那是在不知道
「每个节点都挂 sql」时下的判断。现在必须改：节点的实战集要按其所属阶段的策略过滤。
这不违反 ADR-014——`useNodeStatus` 仍是进度的唯一真值来源，只是多接一个策略入参。
关键是**不能**让阶段进度和节点三态各算各的：
PRD F10 的验收明确要求「节点状态与 useNodeStatus 派生结果一致」，
两套算法必然对不上，只能同源。

### BLOCK-03：学习序打破业务流序后，全局 nextKey 会指错

`useNodeStatus.nextKey` 是在 `orderedNodes`（`buildSteps` 的拓扑序）上取首个未练完节点。
拓扑序是 cust-order → order-review → mps → mrp → ...，
而 tour 的学习序是 cust-order → shopfloor → qc → shipping。
学习者做完 cust-order 后，全局 nextKey 会指向 order-review（basics 节点），
而当前阶段是 tour，应该指向 shopfloor。**「从这里开始」会把人带出当前阶段**，
F1/F2 的验收会直接挂。

**解法：nextKey 必须阶段内取，不能用全局值。**
`useStageProgress` 自己算 `stageNextKey`；`FactoryPage` 的主 CTA 一律用它，
`useNodeStatus.nextKey` 退化为「全部阶段都完成」时的兜底。

### 排序：不需要新增 learn_sort 列（已验算）

按 `(flow_stages.sort, flow_nodes.sort)` 排序，可精确复现 PM 的学习序：

| 阶段 | 节点 sort 值（升序） | 得到的顺序 | 与 PM 一致 |
|---|---|---|---|
| tour | 1, 9, 10, 12 | cust-order → shopfloor → qc → shipping | 是 |
| basics | 2, 6, 7, 8, 11 | order-review → bom-route → picking → dispatch → stock-in | 是 |
| deep | 3, 4, 5 | mps → mrp → purchase | 是 |

三段全中。原因是 PM 的重排只跨阶段打乱，**阶段内仍保持业务流序**。
省掉一列，也省掉「sort 与 learn_sort 不同步」这类必然会发生的数据漂移。
但这是**当前数据的巧合，不是结构保证**——若日后阶段内要逆序，必须回来加列。
已写入回归断言。

### F6「SQL 三阶梯」的 schema 支撑（v1 遗漏，此处补上）

PRD F6 要求 worked example → completion → free。现有 `sql_exercises` 无处安放前两阶。
补 3 列（迁移文件第 6 段，同样不可重入）：
`worked_sql` / `worked_note` / `completion_template`。

**判题零改动**：填空阶补全后得到的仍是目标查询，在 sql.js 里跑出结果集，
走既有归一化 SHA-256 比对 `answer_hash`。ADR-005 完全不动，不新增判题分支。

两条内容铁律：

1. `worked_sql` **不得等于** `answer_sql`。worked 阶要给的是「同类已解决的例子」，
   不是本题答案；相同的话阶梯就退化成直接看答案，F6 的教学意义归零。
2. `completion_template` 是人工撰写的挖空版，**不得**运行时由 `answer_sql` 生成，
   保持 R6 原义（`answer_sql` 永不出网）。占位符统一 `{{1}} {{2}}`。

**另一处必须防的静默进度膨胀**：「看例题」的一键运行**不得**派发
`factory:resource-done`。范例本来就是给答案的，跑一下就标完成的话，
学员点一下按钮进度就涨，C1「实战才算完成」当场失效。
`sql` 资源只在**自己写**阶通过时才算完成（学员主动跳过阶梯直接自己写亦可）。

## 4B. v1.2 对齐：用户砍掉比喻 + 阶段退回待定，带出一个新阻塞

PRD 修订到 v1.2 后有两项变更直接落在本文档的产物上，逐条对齐如下。

### 变更一：`node_explainers.kind` 删除 `analogy` 槽位

用户决定不走生活化比喻（PRD v1.2 §3.1，Out-of-Scope 首条）。
我把 `analogy` 从 schema 与 OpenAPI 的枚举里**删除**，而不是保留但不用。

保留一个不用的枚举值不是中立选择——它是一份写在契约里的邀请函。
内容侧看到 `kind` 里有 `analogy`，默认理解是「这条路开着」，
半年后一定会有人往里写，届时 PRD 的决策已无人记得。
删掉之后，任何想写比喻的人必须先改 schema，也就必须先经过一次讨论。
具象化职责整体移交 `example`，且约束收紧为**取自 SQL 沙盒真实记录**（见 §4C）。
决策记录：ADR-021。

`plain` / `example` / `misconception` 三槽的分工不变，
其中 `misconception` 按 PRD v1.2 从辅助升级为主力——它承接原本由比喻负责的「打通直觉」。

**新增第四槽 `mapping`（与设计侧对齐的结果）。** UIUX v1 §6.3 设计了一个「对照块」：
左边车间里的真实动作，右边系统里的真实记录（工人扫码 ↔ `production_records` 多一行）。
设计稿里它叫 `analogy`，并两次注明「非生活类比」——需要反复自我澄清的命名，本身就是坏命名。
两端都是真实存在的事物，是**对应关系**不是类比，不受不用比喻的决策约束，
教学价值也高（转岗学习者最缺的正是物理世界与系统世界的挂钩）。
因此保留为独立 kind，但改名 `mapping`。叫 `analogy` 的槽位迟早会被写进生活比喻。

### 附带交付：设计侧点名要核的 lucide-react@1.28.0 导出名

UIUX v1 §5.2 要新增 9 个语义名并提示「该版本用 `Circle*` 前缀命名，且已知无 `Code2`」。
已对 `node_modules/lucide-react/dist/lucide-react.d.ts` 逐个核验：

**9 个首选导出全部存在，无需启用任何备选**
（`LockOpen` / `ArrowLeftRight` / `Quote` / `MapPin` / `Flag` / `CirclePlay` /
`ChevronsDown` / `ListRestart` / `Key`）。
9 个备选也全部存在，可作为视觉微调时的自由选项。
`analogy` 这个语义名随槽位改名为 `mapping`，图标 `ArrowLeftRight` 不变。

### 变更二：阶段划分退回「待用户给定」

PRD v1.2 §3.2 明确不锁定方案。对架构侧的影响是：
**代码不得硬编码任何 stage_key 字面量**。排序一律走 `flow_stages.sort`，
「入门阶段」的定义是 `sort` 最小的那一行，不是名叫 `tour` 的那一行。
OpenAPI 的 `stageKey` 示例已从 `tour` 改为 `stage-1`，避免被当成约定值实现。

### BLOCK-04（新，阻塞）：迁移默认值 `DEFAULT 'tour'` 会造成静默进度事故

这是变更二和 PRD §3.0 撞在一起才出现的问题，v1.1 时不存在。

事故链：

1. 迁移执行 `ALTER TABLE flow_nodes ADD COLUMN stage_key TEXT NOT NULL DEFAULT 'tour'`
   → 存量 12 个节点**全部**落进入门阶段；
2. 内容侧按 PRD §3.0 决策一，给入门阶段配 `practice_types = ["micro","quiz"]`；
3. 于是 **全平台 `sql` 一次性退出完成度分母**；
4. 所有已做完 quiz 的节点瞬间变 `practiced`，进度条集体虚高跳涨，
   同时学习者既有的 SQL 成绩不再影响任何进度显示。

全程不报错、类型检查全绿、D1 里也查不出异常数据——
和 BLOCK-01 是同一类沉默失效，只是触发点从代码挪到了迁移默认值上。
危险之处在于它由**两个各自都合理的决定**相乘产生：默认值要保证节点不消失是对的，
入门阶段不计 SQL 也是对的。

**解法：默认值改空串 `''`，并定义中间态回落规则。**

`stage_key = ''` 表示尚未分配阶段，运行时保证**零行为变化**：

| 情形 | 行为 |
|---|---|
| 节点 `stage_key = ''` | 不参与阶段分组；完成度取 `PRACTICE_TYPES` 全集（sql 照常计入，与今天线上一致） |
| `flow_stages` 整表为空 | 前端不渲染阶段分组与阶段进度，完全回落现有全景视图 |
| 阶段数据齐备 | 按 `(stage.sort, node.sort)` 分组排序，按各阶段 `practice_types` 取分母 |

这条规则的实际价值是**把迁移和 PRD §3.2 解耦**：
schema 现在就能落地，阶段方案定稿前不产生任何用户可见变化，定稿后只需灌数据。
否则整个后端要空等一个产品决策。

**上线门禁**：阶段功能正式开启时先断言 `SELECT id FROM flow_nodes WHERE stage_key = '';` 返回 0 行。
否则会出现「幽灵节点」——图上可见，却不属于任何阶段，
学习者看到的是「全景 12 个节点，各阶段加起来只有 9 个」。

## 4C. 数据核对：PM 点名的 `qty_done` 对不上，是刻意埋的

PRD v1.2 §3.3 末尾要求架构侧全量核一次
`work_orders.qty_done` 与 `production_records` 报工汇总的差异，并先定性。
已全量核完（`web/src/features/sql-sandbox/dataset.sql`，7 张工单 / 8 条报工）。

### 结论：刻意设计，且教学叙事自洽，不是数据缺陷

决定性证据不在数据里，在内容里——`seed-flowchart-generic-resources-9more.sql`
已经存在一整套围绕这个差异的教学资源，挂在**生产入库**节点上：

| 资源 | 位置 | 内容 |
|---|---|---|
| 章节 | 第 222 行 | 「`qty_done` 理论上应等于各次报工 `qty_ok` 之和。两者对不上是常见的账实不符——可能漏报工、重复报、或系统状态滞后。入库前必须核对。」 |
| 小测 | 第 313 行 | 「系统完工数与历次报工合格数之和对不上，入库前首先应该？」 |
| SQL 练习 | 第 441 行 | 标题即「生产入库前先对账：报工和完工数对不上」，题面明写「样例库里**多数工单**对不上」 |

题面自己声明了「多数对不上」。这是设计意图的直接陈述，不需要再推测。

### 全量差异表（`SUM(qty_ok) - qty_done`）

| 工单 | state | qty_done | 报工合格合计 | 差异 |
|---|---|---|---|---|
| WO-20260801-01 | released | 0 | 75 | **+75** |
| WO-20260802-01 | released | 0 | 60 | **+60** |
| WO-20260802-02 | running | 90 | 115 | **+25** |
| WO-20260801-02 | running | 40 | 45 | **+5** |
| WO-20260803-01 | finished | 80 | 80 | 0 |
| WO-20260803-02 | released | 0 | 0 | 0 |
| WO-20260808-01 | released | 0 | 0 | 0 |

7 单中 4 单对不上，**差异全为正**，与章节里「差为正 → 报工比系统完工多 → 可能漏更工单状态」
的解释完全吻合。其中 WO-20260801-01 与 WO-20260802-01 状态还停在 `released`（已下达未开工）
却有几十件报工——这是最典型的「漏更状态」，比单纯数字对不上更好讲。

习题结果集为 4 行，按 `ABS(diff)` 降序为 75 / 60 / 25 / 5，**无并列**，
排序唯一确定，`answer_hash` 稳定。

### 附带发现：`answer_hash` 缺一条防回归断言

`WO-20260808-01` 是后续迁移追加的（dataset.sql 第 296-298 行，注释称「不改动既有数据」）。
它恰好 `diff = 0` 被 `HAVING` 过滤掉，所以现有 `answer_hash` 侥幸未变。
但这是运气，不是机制——dataset.sql 是 `answer_hash` 的唯一计算基准（ADR-005），
**任何一次追加数据只要让某道已有题的结果集多一行，全站该题判题即刻失效，且没有任何告警**。
建议加断言 13（见 §11）。此项与本次重构无因果关系，是顺手核出的既有风险。

### 给内容侧的一条硬约束（已同步 PM）

PM 在 PRD §3.3 选定的主线案例 `WO-20260801-02`，**正是这 4 条病灶工单之一**。
主线叙事是「实发 40 → 产出卡在 40」，但同一张工单的报工记录是 25 + 20 = 45 合格、4 不良。
按 F3「章节例子必须就是该节点 SQL 练习查的那几条记录」，
学习者会在连续三站看到同一张工单的三个数字：领料站 40、车间站 45、入库站差异 +5。

这不是要换案例——`WO-20260801-02` 是唯一一条 BOM 反算（60×1×1.03→62）、
缺料（发 40 差 22）、产出受限三段俱全的链，教学价值最高，换掉可惜。
唯一完全自洽的 `WO-20260803-01` 是顺利工单，讲不出缺料因果。

**约束是：这条差异必须由内容侧显式串起来，写成主线的收尾，不能各章各讲各的。**
领料站讲「发了 40，系统记完工 40」，入库站揭「报工其实报了 45，账实不符，来查」——
差异从 bug 变成主线的最后一课，且与既有习题严丝合缝，零内容成本。
反之若三站各说各的数字，零基础学员的第一反应是「这个平台数据是乱的」。

## 5. 渐进路径与解锁

### 5.1 解锁采用软引导，不做硬锁（ADR-018）

**不做硬锁的三个理由：**

1. `/api/v1/flowchart/:slug` 是 `noAuth` 公开接口，匿名用户就能逛全图。
   硬锁需要服务端持有匿名用户进度 → 要么强制登录（劝退零基础用户），要么服务端存匿名态（多一套存储）。
2. 用户明确说痛点是"不知道从哪学起"——这是**缺引导**，不是**缺限制**。
   把节点灰掉锁死，只会把"不知道学什么"换成"什么都点不动"。
3. 硬锁会与"先全貌"直接冲突：第一阶段的目的就是让人**先随便逛一圈**建立整体印象。

**做法：** 视觉分层 + 单一明确的行动召唤。
非当前阶段的节点降低视觉权重（用 `--meta` / `--border-soft` 等既有 token，不新增颜色），
但**保持可点击**；当前阶段高亮，并在首屏给一个「从这里开始」按钮指向 `nextKey`。

### 5.2 进度模型：useNodeStatus 不改语义，新增派生层（守 ADR-014）

`useNodeStatus` 现有三态 `practiced / touched / plain` 与 `practicableTotal` 分母逻辑
是进度的单一真值来源（ADR-014），**本次不动**，只修 4.2 的 `practicesOf` 白名单。

新增 `web/src/features/factory/useStageProgress.ts`（纯派生，不碰存储、不发请求，
与 useNodeStatus 同构）：

```ts
export interface StageProgress {
  stageKey: string;
  title: string;
  practiced: number;      // 该阶段已练完的环节数
  total: number;          // 该阶段有实战的环节数（已按 practice_types 过滤）
  state: 'active' | 'done' | 'ahead';  // ahead = 后续阶段，弱化展示但不锁
  /** 本阶段内的下一站。主 CTA 必须用它，不用全局 nextKey（BLOCK-03）。 */
  stageNextKey: string | null;
}

export function useStageProgress(
  stages: FlowStageDTO[],
  orderedNodes: LaidNode[],   // 按 (stage.sort, node.sort) 排序，非拓扑序
  status: NodeStatusApi,      // 复用 useNodeStatus 结果，不重算
): { stages: StageProgress[]; activeStageKey: string | null; nextKey: string | null };
```

`activeStageKey` = 首个 `practiced < total` 的阶段，全部完成则为 null。
返回的 `nextKey` = 活跃阶段的 `stageNextKey`，全部完成时退回 `status.nextKey` 兜底。

**FactoryPage 的主 CTA 一律绑这个 nextKey**，不得直接用 `useNodeStatus.nextKey`
（会把人带出当前阶段，见 BLOCK-03）。

单独成文件而非塞进 useNodeStatus——单一职责，且 useNodeStatus 现 74 行，不该被撑成大文件。

## 6. 互动反馈改动清单

### 6.1 「错了给提示」

| 层 | 改动 | 文件 |
|---|---|---|
| DB | 新增 `practice_hints` | migrations/schema-learn-redesign.sql |
| 后端 | 新增 `GET /api/v1/practice-hints`（按 level 单条下发） | modules/hints/hints.routes.ts + hints.service.ts + data/repositories/hints.repo.ts |
| 后端 | `/api/v1/quiz/grade` 响应加 `hintAvailable`（纯加字段） | modules/quiz/quiz.service.ts |
| 后端 | router.ts 注册 2 条路由 | worker/src/router.ts |
| 前端 | 判错后显示「给我个提示」，逐级解锁 | components/QuizDeck.tsx、features/sql-sandbox/SqlSandbox.tsx |

**安全铁律（ADR-019）：** 提示**一次只回一条**，且**绝不随题面接口下发**。
若把 hints 数组塞进 `GET /api/v1/quiz/questions`，学员打开 DevTools 就能看到 L3。
L3 提示文案本身也不得包含可直接提交的答案——
`questions.answer` / `sql_exercises.answer_sql` / `micro_practices.answer` 永不出网（沿用 R6）。
该端点挂 `writeLimit()` 防刷。

### 6.2 SQL 门槛（用户四大痛点里最硬的一个）

判题机制不动（ADR-005 归一化 SHA-256，客户端判定）。降门槛靠三件事，**全在前端**，零后端改动：

1. **前置微练习**：先用 `micro_practices` 确认学员看懂了表在说什么，再放 SQL 输入框。
2. **结果集差异反馈**：判错时不只说"错了"，把「你查出 8 行 / 期望 3 行」「缺少 status 列」这类
   结构差异当场指出来。sql.js 在浏览器内已有完整结果集，纯前端可算，不需要服务端答案。
3. **分级提示**：L1 给方向（该查哪张表）、L2 给关键点（要用 JOIN 还是 WHERE）、L3 给做法骨架。

### 6.3 仿真 sim 更友好

不改 `simEngine`（376 行，已超行数红线，本期不扩它）。改动限于：
进入前加一屏「这个仿真在模拟什么、你要达成什么」的目标说明（走 `node_explainers` 的 overview 层，
零新代码路径）；失败态复用 `practice_hints` 的 `target_type = 'sim'`。

## 7. API 端点清单

机器可读契约见 `docs/api/openapi-learn-redesign-v1.yaml`（前后端以该文件为唯一依据）。

| Method | Path | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/v1/flowchart/:slug` | noAuth | **变更**：加 `stages[]`（含 `practiceTypes`）、节点加 `stageKey`/`oneLiner`，纯加法 |
| GET | `/api/v1/sql-exercises/:id` | noAuth | **变更**：加 F6 的 `worked{sql,note}` 与 `completionTemplate`；`answer_sql` 仍不下发 |
| GET | `/api/v1/nodes/:nodeId/explainers?tier=` | noAuth | **新增**：分层通俗讲解 |
| GET | `/api/v1/practice-hints?targetType=&targetId=&level=` | noAuth + writeLimit | **新增**：按级取单条提示 |
| GET | `/api/v1/nodes/:nodeId/micro-practices` | noAuth | **新增**：微练习列表（不含答案） |
| POST | `/api/v1/micro-practices/:id/grade` | noAuth + writeLimit | **新增**：判分 + 即时反馈 |
| POST | `/api/v1/quiz/grade` | noAuth | **变更**：响应加 `hintAvailable` |

全部沿用 `/api/v1` 前缀与现有声明式路由表（`worker/src/router.ts`），
中间件走既有 `defaultMiddlewares`。

## 8. 代码组织约束

后端严格沿用现有三层（已核验全部 worker 源文件 ≤ 300 行，结构健康）：

```
worker/src/router.ts                              # 只声明路由表，不写逻辑
worker/src/modules/<resource>/<resource>.routes.ts  # 参数校验 → 调 service → 组装响应
worker/src/modules/<resource>/<resource>.service.ts # 业务规则
worker/src/data/repositories/<resource>.repo.ts     # 只做 SQL 读写
```

本次新增 3 个资源包：`explainers` / `hints` / `micro`。
禁止把新端点塞进 `content.routes.ts` 或 `quiz.routes.ts` 凑合。

**前端存量超限文件（advisory，不阻断本期，但改到即拆）：**
ProgressDashboard.tsx 420 / AdminPage.tsx 394 / SqlSandbox.tsx 381 / simEngine.ts 376 /
PortfolioPage.tsx 372 / endpoints.ts 356 / QuizDeck.tsx 329 / CourseDetailPage.tsx 311 /
HomeStudyInfo.tsx 302。
其中 **SqlSandbox.tsx 与 QuizDeck.tsx 本期必然要改**（加提示 UI），
要求改动时顺手拆出子组件，不得在超限文件上继续堆行数。

## 9. P0 红线合规

| 红线 | 本方案落实 |
|---|---|
| 禁 emoji 作功能图标 | 全部图标字段（`flow_stages.icon` / `node_explainers.icon`）存 Icon.tsx 语义名；本文档与 SQL 注释零 emoji |
| 锁定一套 SVG 图标库 | 沿用 `lucide-react@1.28.0` 经 `web/src/components/Icon.tsx` 单一出口（ADR-002 / ADR-016），不引第二个库 |
| 禁硬编码颜色 | 阶段状态一律用既有 token：`--accent` / `--success` / `--muted` / `--border-soft` / `--callout-*`；不新增 hex |
| 禁紫粉渐变 | 森林绿主题（`--accent: #547C70`）不变，方案不引入任何渐变 |

## 10. 本期不做（out-of-scope）

- 不引入向量库 / RAG / 语义搜索。
- 不做行为埋点与学习分析看板（WARN-02 写入配额）。
- 不改 SQL 判题机制（ADR-005 不动）。
- 不重写 simEngine。
- 不做 AI 实时生成讲解或提示作为主链路（WARN-04）。
- 不做硬性关卡解锁（ADR-018）。
- 不动 `learning_paths` / `roadmap` / `certifications` 既有模块的数据模型。

## 11. 端到端验证步骤

```bash
# 1. 迁移（本地）
cd worker
wrangler d1 execute mes-learning --local --file=./src/migrations/schema-learn-redesign.sql
# 增列单独跑一次（不可重入）
wrangler d1 execute mes-learning --local --command \
  "ALTER TABLE flow_nodes ADD COLUMN stage_key TEXT NOT NULL DEFAULT ''; \
   ALTER TABLE flow_nodes ADD COLUMN one_liner TEXT NOT NULL DEFAULT '';"

# 2. 构建门禁（必过）
cd .. && npm run typecheck && npm run build

# 3. 行数门禁：新增文件不得超 300 行
find worker/src/modules/explainers worker/src/modules/hints worker/src/modules/micro \
  -name '*.ts' | xargs wc -l | awk '$1>300 && $2!="total" {print "OVER LIMIT:", $0}'
```

**核心成功流：** 首页工厂全景 → 显示各阶段、当前阶段高亮 → 点「从这里开始」跳到 stageNextKey 节点 →
抽屉首屏出现 oneLiner + overview 层大白话与真实数据例子 → 做微练习 → 答对拿到具体反馈 →
进 SQL 沙盒（停在「看例题」阶）→ 进到自己写 → 答错 → 点「给我个提示」拿到 L1 → 再错拿 L2 →
做对 → 阶段进度 +1。

**关键错误流（必须验）：**

1. `GET /api/v1/practice-hints?targetType=sql&targetId=1&level=3` 的响应体
   **不得包含** `sql_exercises.answer_sql` 的任何片段。
2. `GET /api/v1/nodes/1/micro-practices` 响应体 **不得包含** `answer` 字段。
3. 断言 `GET /api/v1/flowchart/generic` 的 D1 查询数 ≤ 5（读 meta 或看 wrangler tail）。
4. **回归断言（防 BLOCK-01 复发）**：往 `node_resources` 插一条 `res_type='note'` 的脏数据，
   该节点的 `practicableTotal` **必须不变**。白名单没改对的话这条会红。
5. 存量 12 个节点在增列后仍全部渲染（`stage_key` 默认空串不影响渲染）。
6. **防 BLOCK-02 复发**：入门阶段节点在 `sql` 未完成、`micro`+`quiz` 已完成时，
   该阶段进度必须显示满格，且这些节点在图上为 `practiced` 态。
   两者只要有一个不成立，说明阶段策略没接进 `useNodeStatus`（进度双算法已分叉）。
7. **防 BLOCK-03 复发**：完成入门阶段首个节点后，主 CTA 必须指向**同阶段的下一个节点**，
   不得指向拓扑序上的下一个节点（除非两者恰好相同）。
8. **F6 内容断言**（SQL 门禁，进 CI）：
   `SELECT id FROM sql_exercises WHERE worked_sql <> '' AND worked_sql = answer_sql;` 必须返回 0 行。
9. **防进度膨胀**：在「看例题」阶点运行，该 sql 资源**不得**变为已完成。
10. **排序断言**：阶段划分定稿后，`(stage.sort, node.sort)` 的排序结果必须等于 PRD 给出的学习序。
    这条红了说明阶段内出现了逆序需求，必须回来加 `learn_sort` 列（PRD v1.2 §3.2 事实四）。
11. **防 BLOCK-04（迁移默认值）**：增列后立即断言
    `SELECT COUNT(*) FROM flow_nodes WHERE stage_key <> '';` 返回 0，
    且此时全站进度显示与迁移前**逐节点一致**（sql 仍在分母里）。
    有任何节点被默认塞进某个阶段，这条就红。
12. **上线门禁（阶段开启时）**：`SELECT id FROM flow_nodes WHERE stage_key = '';` 必须 0 行，
    否则存在不属于任何阶段的幽灵节点。
13. **判题防回归（既有风险，见 §4C）**：在 CI 里对每道 `sql_exercises` 重跑
    `answer_sql` 并比对存量 `answer_hash`，不一致即失败。
    现状是 `dataset.sql` 任何一次追加数据都可能悄悄改变某道题的结果集，
    而判题失效不会有任何告警——`WO-20260808-01` 那次是 `diff = 0` 恰好躲过。

## 12. 待 PM / UX 确认的开放问题

1. 阶段切几段、每段收哪些节点？（PRD v1.2 §3.2 退回待用户定；架构侧只提供 `flow_stages` 承载能力。
   已就位的两条约束：入门阶段 `practice_types = ["micro","quiz"]`、建议 ≤5 个节点）
2. ~~每个节点是否都必须配比喻~~ —— 已关闭。用户决定不用比喻，`analogy` 槽位已删（ADR-021）。
   新问题：`example` 要求取自 SQL 沙盒真实记录，那么**没有对应沙盒数据的节点**
   （如订单评审、生产派工）拿什么做具象化？可选：借用相邻节点的同一批记录，
   或允许这些节点只有 `plain` + `misconception`。归 PM 定。
3. ~~微练习覆盖到哪几个节点~~ —— 已关闭，PM 已定为 6 个节点，我的原建议（只覆盖 SQL 前置节点）
   被证伪：12 个节点全都挂了 sql，该 targeting 是空操作。
4. 主线案例 `WO-20260801-02` 的跨站数字差异（40 / 45 / +5）怎么串——
   建议写成主线收尾而非换案例，理由与全量数据见 §4C。归 PM 定。
