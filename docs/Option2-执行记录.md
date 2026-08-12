# 选项 2 执行记录 · 零基础首章改写 + F1 单入口

> 执行时间：2026-08-09｜角色：MvpDevExpertTeam 项目总监（cz）｜依据：`docs/research/零基础适配体验审计-v1.md` 选项 2

## 做了什么

### 1. 第一章《工单的生命周期与状态流转》重写为零基础教科书
文件：`worker/src/migrations/seed.sql`（chapters 表 id=1 的 `md_text`）

改动要点（对照审计发现的"从业者参考风"短板）：
- **真实单号贯穿全章**：以样例库真实工单 `WO-20260801-02`（计划 60 / 已报工 40 / 状态 running / 二号车间）做主线例子，不再空谈定义。
- **结构按零基础认知顺序重排**：真实工单引入 → 工单从哪来 → 状态机走查（5 态表）→ 三条铁律（每条都讲"为什么"：对账 / 成本 / 权限）→ 出问题时先查哪三个字段 → 小结 & 下一步。
- **自然术语触发术语弹卡**：直接写「工单 / ERP / MES / MRP / 报工 / 在制 / 领料 / 成本归集」等词，由既有 `TermAwareHtml` 自动高亮点解（无需特殊语法）。
- **明确"下一步去哪"**：章末指向第二章《工单主表结构与高频查询》，并提示去做章末测试。

> ⚠️ 关键约束：章节正文渲染器只支持**纯 markdown + DOMPurify**，不支持 `[[sql:8]]` / `[[micro:9409]]` 这类行内锚点（已核查 `web/src/lib/markdown.ts` 与 `TermAwareHtml.tsx`，全仓无该语法）。因此本次改写**不引入锚点**，避免写出不渲染的死文本（`tmp/ch1_new.json` 里的 `[[...]]` 写法不可直接采用）。

### 2. 补上第一章的章节自测
文件：同上（新增 4 行 `questions`，`chapter_id=1`）

此前第一章**没有任何题目**，导致 `ChapterPage` 的「章节测试」区块不出现。新增 4 题（均带答案解析，沿用既有列序）：
1. single — 工单（WO）在 MES 里最核心的作用是什么
2. judge — 工单状态可以从 running 直接退回 released（错）
3. single — 一张 created 状态的工单能否直接报工（不能）
4. single — WO-20260801-02 在制状态判定（正常在制，非异常）

部署后第一章末将出现「开始测试」按钮（复用既有 `QuizDeck`）。

### 3. F1 单入口 CTA 强化
文件：`web/src/pages/FactoryPage.tsx`（`FactoryHeader`）

- 主 CTA 已绑定 `stageNextKey`（首节点，BLOCK-03），结构上本就是首屏唯一主行动。
- 本次把零进度用户的文案从「从这里继续」改为 **「从这里开始：{首节点}」**（`status.practicedCount === 0` 判定）；有进度则维持「从这里继续」。
- 维持单一 `btn-primary`，次要动作「搭建产线」仍为 `btn-secondary` —— 首屏单入口锁定。

> 注：F1 的"其余 11 节点降级弱化"**未做结构化改造**（会动全景/旅程布局、风险高，且用户将自行真机体验后迭代），留作后续轮次。

## 未做 / 待用户真机验证
- 真实用户研究（SUS / 可用性任务）仍 `待执行`；本次为内容短板修复，非实证结论。
- 本地 `node_modules` 为空、沙箱离线，未跑 `tsc`/`vite build`；已逐处人工核对括号配平、SQL 单引号转义（`''running''`）、列名与 `status.practicedCount` 作用域。
- 需本机 `npm install && npm run dev` 或重新部署后清缓存体验：看首章可读性 + 章末测试是否出现 + 工厂首屏 CTA 文案。

## 改动文件清单
- `worker/src/migrations/seed.sql` — 第一章 md_text 改写 + 4 道自测题
- `web/src/pages/FactoryPage.tsx` — F1 单入口 CTA 文案
