# ADR-024: 模块化单体 + 岛屿(Island)扩展契约

## Status
Proposed（待 ARCH-Extensible-v1 升格后转 Accepted）

## Context
平台已从「内容+SQL」扩展为 11 个后端模块 + 6 个前端 feature 岛（factory、factory-sim、glossary、knowledge、roadmap、sql-sandbox）。岛屿模式已自发涌现，但缺乏正式契约：新功能若随手在核心层写 `if(islandX)` 或直接跨模块 import 实现，会侵蚀边界，未来无法干净抽取。

既有 ADR 已明确「免费套餐 + 单人项目下，微服务/服务拆分是负资产」，因此扩展不能靠拆部署单元，只能靠**单体内部边界的严明**。

## Decision
采用 **模块化单体 + 岛屿(Island)扩展契约**：

1. 岛屿(Island) = 自包含功能域，聚合 `路由 + 数据模型(迁移) + 仓储 + 组件 + 懒加载入口`。
2. 每个岛提供声明式 `IslandContract`（id / routes / migrations / lazyEntry / dependsOn），在**唯一注册处**登记；核心层（pipeline / AppShell）只消费契约数组，不出现 `if(island===...)`。
3. 新加一个域的改动成本收敛到「1 个文件夹 + 1 处注册」，复用既有 module registry「新增主题零后端改动」思路。
4. 岛屿间依赖只声明 `dependsOn`，实现交互一律走桥接协议（见 ADR-025），禁止直接 import 他岛实现。

## Consequences
- 容易：新增课程线 / 前端岛 / 未来抽 Worker（边界已清晰）。
- 容易：CI 可静态校验岛屿依赖方向，防止耦合回潮。
- 困难：一次性定义契约略慢于直接 hack；需用纪律维持（PR 须声明岛屿归属）。
- 放弃：每个域一套私有 UI / 直接跨模块调用的便利。
