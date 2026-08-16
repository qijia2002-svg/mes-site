# ADR-027: 每岛独立迁移文件 + Schema 所有权

## Status
Proposed（待 ARCH-Extensible-v1 升格后转 Accepted）

## Context
现有迁移文件 `schema-*.sql` 与 `migration-*.sql` 混用，缺「每岛拥有自己 schema」的归属感。D1 是单库单写线程（免费套餐唯一选择），水平写扩展不可行。若未来某岛触发毕业阈值需抽 Worker，schema 归属不清将导致切割断裂；跨岛 `JOIN` 原始表更会让抽取时数据层断裂。

## Decision
1. 每个岛屿拥有**自己的一组迁移文件**，命名 `migrations/<island>-vN.sql`（如 `factory-sim-v1.sql`、`knowledge-v1.sql`）；废止 `schema-*.sql` / `migration-*.sql` 混用约定，从新建岛屿起强制执行。
2. 跨岛查询只允许通过**仓储层**与**桥接快照**（ADR-025），**禁止跨岛 `JOIN` 原始表**。
3. 读路径统一过 `Cache API`（L2 + 单飞），写路径走 `DbSession` 预算守卫（40 条/请求红线）。
4. 统计聚合走写时聚合（`stats_daily`），不在请求期计算。

## Consequences
- 容易：未来抽 Worker 时该岛 schema 可干净切走。
- 容易：单 D1 写线程下的读写分离纪律明确。
- 困难：跨岛分析需求需经桥接/仓储，不能随手 JOIN（略不便）。
- 放弃：自由跨表 JOIN 的便利，换取未来可拆性。
