# ADR-019: 分级提示按需单条下发，人工撰写不走 AI 主链路

## Status
Accepted (2026-08-08)

## Background

「错了给提示」是本次重构的核心互动需求。有两个设计岔路口：

1. 提示随题面一起下发（前端本地控制显示节奏），还是按需单独请求？
2. 提示由人工撰写入库，还是调 Workers AI 实时生成？

## Decision

**其一：按需单条下发。** 新增 `GET /api/v1/practice-hints?targetType=&targetId=&level=`，
`level` 必传，一次只返回一条，服务端不接受"返回全部提示"的调用形态。
禁止把 hints 数组塞进 `GET /api/v1/quiz/questions` 或 `GET /api/v1/sql-exercises/:id`。

**其二：提示人工撰写，存 `practice_hints` 表。** Workers AI 只作为
「还是不懂？换个说法」的可选增强，调用失败静默降级到已有的静态提示。

分级语义：L1 指方向、L2 给关键点、L3 给做法骨架。
**L3 也不得包含可直接提交的正确答案。**

## Consequences

**为什么不随题面下发**

提示如果跟着题面一起进浏览器，学员打开 DevTools 的 Network 面板就能直接读到 L3。
"逐级解锁"就只是个 UI 动画，实际防不住任何人。
既然判题答案（`questions.answer` / `sql_exercises.answer_sql`）已经守住了不出网（R6），
提示没有理由破这个例。

**为什么不用 AI 实时生成提示**

- 零基础学员最需要的恰恰是**准确、稳定、审校过**的台阶。AI 生成的提示不可控，
  一条把人带偏的提示比没有提示更糟。
- `aiLimit()` 限流下，答错高峰期会大量失败，而"答错了"正是最需要即时反馈的时刻。
- 推理延迟 1-3 秒，破坏即时反馈体验。
- 提示总量有限（每题最多 3 条），人工写一次长期复用，不值得为它引入不确定性。

**正面**

- 提示内容可审校、可迭代、质量可控。
- 零运行时写入，不占 D1 Free 每日 10 万行写入配额。
- 端点挂 `writeLimit()` 防刷；`(target_type, target_id, level)` 唯一索引让每次查询只扫一行。

**负面**

- 每解锁一级多一次网络往返。可接受：这是低频动作，且用户此刻本来就在停顿思考。
- 内容团队要为每道题写 1-3 条提示，是实打实的工作量。
  缓解：只给高频卡点题目配满 3 级，简单题配 1 级或不配
  （`hintAvailable` 为 0 时前端不显示提示入口）。

**验收断言**

`GET /api/v1/practice-hints?targetType=sql&targetId=1&level=3` 的响应体
不得包含 `sql_exercises.answer_sql` 的任何片段。

## Related ADRs
ADR-005（SQL 归一化 SHA-256 判题）、ADR-017（内容模型分离）
