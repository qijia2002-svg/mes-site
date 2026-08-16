# ADR-025: 跨岛桥接协议（sim ↔ sql ↔ content）

## Status
Proposed（待 ARCH-Extensible-v1 升格后转 Accepted）

## Context
`simToSql.ts` 已把仿真结果与 SQL 实操打通，是平台「王牌差异化」的技术核心。但当前为临时耦合——若每次跨岛交互都直接 import 实现，仿真岛与 SQL 岛会锁死，未来扩展可视化/知识图谱复用仿真数据时无从下手。

## Decision
跨岛交互一律走**显式版本化桥接接口**，禁止岛间直接 import 实现：

1. 仿真岛(C) 产出 `FactoryStateSnapshot`（版本化 JSON Schema，v1 先冻结最小字段：WIP / leadTimeMin / 工序状态 / 物料流转），变更走 semver 且向后兼容。
2. SQL 岛(B) 消费快照并注入为可查询数据集；可视化岛(D)、知识图谱(F) 未来也可消费同一快照（一次仿真，多岛复用）。
3. 桥接失败各岛独立可用（仿真可玩、SQL 可练），符合 ADR-018 软引导精神。
4. 契约字段变更须评估向后兼容；破坏性变更升主版本并保留兼容窗口。

## Consequences
- 容易：岛可独立演进、独立降级、未来复用仿真数据。
- 容易：抽 Worker 时桥接仅 transport 从进程内变 HTTP，契约不变。
- 困难：需先定义并维护契约（过度设计风险——以 v1 最小字段 + semver 缓解）。
- 放弃：一次性直接耦合带来的开发速度。
