# ADR-026: 内容即数据（Content-as-Data）

## Status
Proposed（待 ARCH-Extensible-v1 升格后转 Accepted）

## Context
内容体检报告：33 门课中 25 门（76%）无练习题，147 章仅 37 章有题。若每门新课/新章节/新工厂模型都写新模块，扩展成本随内容量线性爆炸，必崩。平台 90% 的「新功能」本质是数据而非代码。

## Decision
**内容即数据**：课程线（ERP / 生产模式 ETO·MTO·MTS / 离散 vs 流程）、章节、题目、工厂模型，均以**种子数据 + 统一渲染器**落地，新增内容 = 一份 seed（+可选 explainer 数据文件），**零新模块**。

配套一条**内容生产管线**：Obsidian/Markdown → 校验 → staging → commit（复用 admin 的 Excel 分片导入两阶段思路），让非工程师也能扩内容。

复用既有 `ChapterPage` / `QuizDeck` / `SqlSandbox` 作为统一渲染面，不引入每课私有 UI（除非 P0 红线特批）。

## Consequences
- 容易：课程/题目扩展成本趋零，直接回应内容缺口。
- 容易：内容可由非开发角色维护（管线化）。
- 困难：极致定制化「每课一套交互」受限——但当前 90% 需求不需要。
- 放弃：为单个课程写专用页面/模块的灵活性。
