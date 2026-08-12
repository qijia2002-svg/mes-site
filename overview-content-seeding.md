# 内容播种交付总览（P0/P1 之后）

> 用户拍板：P1 抽屉已上线但「进阶详解」生产 0 行降级，先补 D1 内容让抽屉有真实内容看。
> 本次只动数据（seed），不动前端/架构。

## 交付物（commit `b279b04`，已部署 remote D1 `mes-learning`）

| 文件 | 动作 | 内容 |
|---|---|---|
| `worker/src/migrations/seed-learn-redesign-explainers.sql` | 新增 | 12 节点 × 2 条 `tier='detail'` 进阶详解（24 行，id 9501–9524） |
| `worker/src/migrations/seed-learn-redesign-hints-micro.sql` | 新增 | micro 9401–9412 全量 L1/L2/L3 分级提示（36 行） |
| `worker/src/migrations/seed-learn-redesign-content.sql` | 改 | 移出内联的 6 条 micro 提示及其 DELETE 守卫（micro 提示改由新文件单一负责） |

## 内容设计要点
- **全部取自真数据**：`sql-sandbox/dataset.sql`（WO/SO/PO/PK 单号、数量、状态、日期皆可查），零杜撰。
- **detail 层级 = 已上线抽屉「进阶详解」折叠区实际消费的内容**（首屏「知识卡」由前端 `beginnerPath.data.ts` 本地提供，不依赖本表）。
- **overview 层级留待抽屉重构消费时再补**（当前前端不读，避免写入死数据）。
- **ADR-019 L3 铁律**：分级提示 L3 只摆判据、不点破最终选项。

## 验证闭环（全绿）
- dry-run（sql.js 内重演）：幂等 `24→24` / `36→36`，引用完整。
- remote D1 行数：`node_explainers` 24、`practice_hints` micro 36 / quiz 2 / sql 6。
- 线上 curl：`node_id=1`/`12` 的 detail 返回真实条目；micro 9401 的 L1/L2 `hasNext=true`、L3 `hasNext=false`；此前缺失的 9402 L1 已补。
- 浏览器实跑（Playwright，BASE=`shuojia.qzz.io`）：`/factory?node=cust-order` 抽屉动机/4 知识卡/4 步/micro 全渲染，展开「进阶详解」得 2 条 `.nd-deep-item`，`pageErrors=[]`。

## 后续（按拍板路线，未做）
- P2 `learning_tracks`、P3 角色视图。
- `node_explainers` overview 层级待抽屉重构消费时补。
