# SPEC — 零基础重学重构 v1（Phase 1.5 规格即契约）

> 本文件是 Phase 2 设计细化与 Phase 3 并行开发的**唯一依据**。任何实现偏离须回到本 Spec 修订并说明。

## 0. 来源与状态
- 输入文档：`PRD-ZeroBasis-Relearn-v1.md`(v1.2) · `ARCH-LearnRedesign-v1.md`(v1.2) · `UIUX-Beginner-Redesign-v1.md`(v1) · `ADR-017`~`ADR-021`
- 已对齐的三项用户裁决：① 不要比喻（直接讲系统）② 反馈只取结构层（无徽章/吉祥物/撒花）③ 6 站主线按业务流
- 状态：Spec 已锁定；**待补 §6 内容播种的「节点→6站」分配**（PM 映射细案回传后填表）

## 1. 已锁定的产品裁决（不可回退）
1. 学习者 = 零基础小白；4 个重做方向全做（重排路径 / 通俗讲解 / 互动反馈结构层 / 整体架构重做）
2. 不要比喻：具象化由 `example`（真实数据例子）与 `mapping`（车间动作↔系统记录对照）承担，schema 删除 `analogy` 槽位（ADR-021）
3. 反馈只取结构层：单路径 + 锁定/解锁（**软引导非硬锁**，ADR-018）+ 三态微进度 + 即时判分；无徽章/吉祥物/撒花
4. 6 站主线（业务流）：`tour`(全貌) / `plan`(计划订单) / `procure`(采购齐套) / `produce`(生产工单) / `quality`(质检) / `ship`(仓储发运)
5. 主线案例 `SO-20260725-01`（伺服电机 60 台）因果链贯穿多站
6. 完成度：入门阶段仅 `micro`+`quiz` 计入，SQL 不计入（BLOCK-02）；其余阶段恢复全集
7. `qty_done` 差异 = **刻意病灶**（7 单 4 单对不上，全为正），保留主线案例，显式写为「最后一课」——转 bug 为教学，零内容成本（架构师已与 PM 对齐）

## 2. 数据模型（`worker/src/migrations/schema-learn-redesign.sql`，已落盘待执行）
- `flow_stages(flow_id, stage_key 自由文本, title, subtitle, goal, icon, practice_types JSON, sort)`：阶段级完成度口径；入门阶段内容侧配 `["micro","quiz"]`
- `node_explainers(node_id, tier[overview|detail], kind[plain|example|mapping|misconception], title, body_md, icon, sort)`：独立「读物」表，**永不进入完成度分母**（ADR-017）
- `practice_hints(target_type, target_id, level[1|2|3], body_md)`：**仅按需单条下发**（ADR-019），禁止随题面接口下发
- `micro_practices(node_id, kind[match|order|pick], prompt, payload, answer 服务端留存, feedback_ok/bad)`：SQL 前台阶，计入完成度
- `flow_nodes` 增列 `stage_key TEXT NOT NULL DEFAULT ''`(BLOCK-04) + `one_liner`
- ⚠️ ALTER 段在迁移文件以**注释**形式给出（SQLite 不可重入），Phase 3 部署时单独取消注释执行；D1 Free 单次查询 ≤50 行、每日写入 ≤10 万行

## 3. API 契约（`docs/api/openapi-learn-redesign-v1.yaml` 已定）
- `GET /api/v1/flowchart/:flowId` → `{nodes, edges, resources, stages}`
- `GET /api/v1/nodes/:nodeId/explainers`
- `GET /api/v1/nodes/:nodeId/hints?level=2`（分级，不随题面下发）
- `POST /api/v1/micro/:id/submit`
- `POST /api/v1/progress`（沿用 `user_kv` 单键 JSON；**禁止每次答题写 progress_events**）
- 规约：响应 DTO camelCase；请求体 snake_case；统一 `ok(c,{code:0,data,msg})` 包裹

## 4. BLOCK 清单（Phase 3 动工前必落地，按序）
| ID | 问题 | 解法 | 落点 |
|---|---|---|---|
| BLOCK-01 | `practicesOf` 黑名单，新类型自动进分母 → 节点永久不完成 | 白名单 `PRACTICE_TYPES={quiz,sql,sim,micro}` | `web/src/features/factory/factoryFlow.data.ts:94-96`（**已批准先行落地**） |
| BLOCK-02 | 12 节点每节点挂 sql，入门即撞最硬门槛 | `flow_stages.practice_types` 阶段级，入门 `["micro","quiz"]` | schema + 内容播种 |
| BLOCK-03 | 全局 nextKey 走拓扑序，完成首站被带出阶段 | `useStageProgress` 自算 `stageNextKey`，主 CTA 绑它 | `useStageProgress.ts` |
| BLOCK-04 | 迁移默认 `DEFAULT 'tour'` 让全平台 sql 一夜不计分（静默事故） | `DEFAULT ''` + 中间态回落（空串不参与分组 / 完成度取全集 / 空表回落全景） | schema 注释 + 上线门禁 `SELECT stage_key='' 必 0 行` |

## 5. 前端页面与导航
- **F1 单一入口**（RICE 最高）：首页单焦点「跟一张订单走完工厂」
- 6 站 `MainlineStepper` 三态（done / current / locked，锁 = 软引导）
- 节点抽屉四层渐进披露：一句话 → 知识 → 系统对应 → 实战(quiz/sql/sim/micro)
- 设计 token：森林绿 v3(`--accent #547C70`) + 暖米(`--bg #F3F3E9`)；`[data-density='learn']` 块；**零硬编码 hex、零渐变、零 emoji**
- 图标：`Icon.tsx` 注册表 + lucide-react@1.28.0（9 语义名已核验存在）；新增 9 名（unlock / mapping / example / you-are-here / station / start / deep-dive / recap / answer）待 Phase 3 写入

## 6. 内容播种计划（12 节点 → 6 站 · 已锁定）

> 映射由项目总监基于 PRD v1.2 + 现有 DEFAULT_FLOW 12 节点 + 用户裁决「业务流 6 站」合成。
> 节点 `stage_key` / `one_liner` 通过增量 UPDATE 种子回填（ALTER 已加列，默认空串）。

**阶段实践口径（BLOCK-02）**：
- 入门段（`tour` + `plan`，共 4 节点 ≤5）：`practice_types = ["micro","quiz"]` —— SQL 不计入完成度分母
- 后续段（`procure` / `produce` / `quality` / `ship`）：`practice_types = ["micro","quiz","sql","sim"]` —— 恢复全集
- 上线门禁：回填后 `SELECT id FROM flow_nodes WHERE stage_key = ''` 必须 0 行（BLOCK-04）

| 站(stage_key) | 节点 key | 一句话(one_liner) | 挂接资源类型 | 主线案例锚点 |
|---|---|---|---|---|
| tour | cust-order | 一张订单进厂：客户要什么、多少、何时要 | micro / quiz | `SO-20260725-01` 起点（伺服电机 60 台） |
| plan | order-review | 评审交期、产能、物料齐套，决定接不接这单 | micro / quiz | — |
| plan | mps | 把订单排成可执行的月度/周生产计划（MPS） | micro / quiz | — |
| plan | mrp | 按 BOM 展开，算出自制/外购物料的需求量与时间 | micro / quiz | — |
| procure | purchase | 下采购单、跟供应商交期、到货与进料检（IQC） | micro / quiz / sql / sim | — |
| procure | bom-route | 定 BOM 与工艺路线，驱动齐套 | micro / quiz / sql / sim | BOM 损耗 3% → 需求 62 |
| produce | picking | 仓储按工单发料到线边仓（WMS） | micro / quiz / sql / sim | — |
| produce | dispatch | 把生产指令下到产线（MES 工单） | micro / quiz / sql / sim | `WO-20260801-02` 计划60/完成40 |
| produce | shopfloor | 工序加工、报工、在制品跟踪（MES） | micro / quiz / sql / sim | — |
| quality | qc | 首检/巡检/终检，质量追溯（QMS） | micro / quiz / sql / sim + **最后一课** | `qty_done` 差异 40 vs 45（刻意病灶→收尾课） |
| ship | stock-in | 成品入库，更新库存（WMS） | micro / quiz / sql / sim | — |
| ship | shipping | 拣货、装车、物流交付客户 | micro / quiz / sql / sim | `PK-20260804-01` 实发40 → 工单卡40 |

**flow_stages 种子（6 行，按 sort 升序）**：
| sort | stage_key | title | subtitle | icon | practice_types |
|---|---|---|---|---|---|
| 1 | tour | 先走一圈 | 用一张订单，把工厂全貌看一遍 | compass | ["micro","quiz"] |
| 2 | plan | 计划订单 | 这张单怎么变成可生产的计划 | clipboard-check | ["micro","quiz"] |
| 3 | procure | 采购齐套 | 物料怎么买齐、怎么验收入库 | truck | ["micro","quiz","sql","sim"] |
| 4 | produce | 生产工单 | 计划怎么下到产线、怎么报工 | factory | ["micro","quiz","sql","sim"] |
| 5 | quality | 质量检验 | 怎么做首检巡检、怎么追溯 | check-circle | ["micro","quiz","sql","sim"] |
| 6 | ship | 仓储发运 | 成品怎么入库、怎么发到客户手上 | log-out | ["micro","quiz","sql","sim"] |

> 内容正文（micro_practices / node_explainers / practice_hints 的具体题目与讲解）由内容播种任务按上表逐节点撰写，本 Spec 只锁结构与口径。

## 7. 构建门禁（Phase 2 首提交必跑）
- `npm run typecheck && npm run build`
- 单文件 ≤300 行门禁
- P0 扫描：零 emoji、零硬编码 hex、零紫粉渐变
- 断言 11（BLOCK-04：迁移后 `SELECT stage_key='' ` 0 行）· 12（`answer_hash` 防回归）· 13（`dataset.sql` 判题基准重跑）
- 图标注册表：新增名必在 lucide-react@1.28.0 导出

## 8. 不动项与风险
- 不碰 FactoryFlow v10 视觉
- 解锁做软引导不硬锁（避免强制登录劝退小白）
- 不引第二图标库
- 迁移 ALTER 不可重入，部署单独执行并先断言
- D1 Free 约束：禁按节点循环拉讲解（走批量接口）；每日写入 ≤10 万行

## 9. Phase 3 并行切分
- **后端**：执行 schema（取消注释 ALTER）→ 5 端点 → BLOCK-02 内容口径
- **前端**：`useStageProgress`(BLOCK-03) + `MainlineStepper` + 节点抽屉 + BLOCK-01 白名单 + `Icon.tsx` 9 名
- **内容**：PM 映射 → 种子数据（flow_stages / micro_practices / node_explainers / practice_hints）
