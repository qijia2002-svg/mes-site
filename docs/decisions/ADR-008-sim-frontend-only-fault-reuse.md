# ADR-008: 仿真引擎全部运行在前端；异常注入复用 fault_scenarios / block_solutions

## Status

Proposed (2026-08-01) · 决策人：高见远 · 约束级别：P0

## Background

仿真需要逐 tick（100ms = 1 仿真分钟）推进工单状态机、发料/回冲、触发异常并即时标红。异常注入（缺料/质检不合格/设备故障）需要可复用现有故障题库。

`worker/src/migrations/schema.sql` 已预留 `fault_scenarios(variant, prompt, solution_json)` 与 `block_solutions(rule_json)` 表。Workers 免费版 **10 ms CPU/次调用**——逐 tick 仿真远超预算，且会把 D1 单线程队列占满。

## Decision

**① 仿真全部在前端运行。** 后端只下发素材（只读+L2 缓存）、只收"提交运行结果"摘要。前端/后端边界：

| 职责 | 端 | 依据 |
|------|----|------|
| 场景素材下发、故障 `inject` 下发 | 后端 | 只读共享、需版本化；L2 命中后 0 D1 读 |
| 故障 `expect`（答案） | 后端保留，**永不下发** | 对齐 `sql_exercises.answer_sql` 的 R6 防泄露 |
| 仿真 tick 推进、异常触发与标红 | 前端 | Workers 10ms CPU 跑不动逐 tick |
| "学员是否解决故障"判定 | 前端算，后端只收摘要 | 与 ADR-005 客户端判题同构 |
| 结果落库 | 后端 | 走现有 `progress_events` + `stats_daily` |

**② 异常注入零 DDL 变更，纯约定复用现有表：**
- `fault_scenarios.variant = 'sim'`（现有 `factory`/`blocks` 不受影响）。
- `fault_scenarios.solution_json = { scenarioSlug, inject[], expect{} }`——`inject` 下发给前端，`expect` 服务端剥离。
- `inject.at.type` 三种触发器：`tick`（时间点）/ `operation_enter`（第 n 工单进某工序）/ `wo_state`（工单进某状态），覆盖三类教学场景，**不建通用规则引擎**。
- `block_solutions.rule_json` 承载多解容错：同一"OP-20 缺料卡死"可①补料②改路线绕过③加缓冲区，任一命中即通过——正是该表原始设计意图（"积木容错规则"）。

**关于"前端判题能否被绕过"**：能。学习平台非考试系统，采用**诚实客户端 + 结果摘要**模型，与 ADR-005 已确立立场一致。后端只做合理性校验（`scenarioSlug` 存在、`ticks>0`、`elapsedMs ≥ ticks×最小可能耗时`、`anon_id` 限流），**不做服务端重放**。此事已决，实现阶段不再讨论。

## Consequences

**正面**
- 零 DDL 新增复用故障题库，异常脚本与现有 factory/blocks 题库共用维护链路。
- 仿真性能不受 Workers CPU 预算限制，可跑满 60fps。

**负面**
- 判题在客户端，理论上可绕过（已接受，学习平台定位）。
- `solution_json` 的 `expect` 字段需在 DTO 层显式剥离，CR 需逐字段核对（与 `content.service.ts` 白名单模式一致）。

## Related ADRs

- ADR-005（SQL 判题走客户端 hash 比对）——架构同构，诚实客户端立场一致。
- ADR-007（仿真全前端 + 结果走 progress_events）——本 ADR 的边界划分基础。

## Verification

```bash
# 参考答案/expect 不得经 API 下发
grep -n "SELECT \*" worker/src/modules/simulator/   # 必须无匹配（强制显式白名单 DTO）
# 异常注入不应新建表
grep -rn "CREATE TABLE.*sim_fault" worker/src/migrations/   # 必须无匹配
```
