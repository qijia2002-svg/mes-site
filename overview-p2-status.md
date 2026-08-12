# 状态总览 · 微练习 9401 修复 + P2 learning_tracks 核查（2026-08-10）

## 一、微练习 9401 修复（已完成并上线）

**根因**：`web/src/features/factory/MicroPractice.tsx` 误读字段名 `payload.multiple`，但后端 API / D1 返回的字段是 `payload.multi`。
- `payload.multi === true` 判定 `undefined === true` → `false` → 永远渲染成 `radio` 单选。
- 9401 的正确答案是多选 2 项（`["SO-20260807-01","SO-20260808-01"]`），于是"选哪个都没有正确答案"。

**修复（3 处，已提交 `d7aa9e1`）**：
1. `payload.multiple` → `payload.multi`（逻辑修正，checkbox 正确渲染）。
2. `<input>` 补 `value={o.id}`（此前 DOM 值默认 `"on"`，submit 携带错误 id）。
3. `useQuery` 包 8s `AbortController` 超时 + `retry:0`；`apiGet`/`request` 透传 `AbortSignal`。
   - 兜住 D1 Free 套餐偶发"查询挂起不返回"导致的永久 pending（用户感知的"网络错误"）。

**验证**：线上 bundle 实测 checkbox 渲染、8s 超时快速降级（"题目加载中…"）均生效。后端 `grade` 判分 `correct:true` 已 curl 确认。
**清理**：node workspace 下 8 个临时诊断脚本已删除（仅留 diag / mobile-check / p0-progress-check / p1-drawer-smoke 四个通用脚本）。
**Task #49** 已标记完成。

## 二、P2 learning_tracks 核查（关键发现：核心已上线）

直接核查线上 `shuojia.qzz.io`，结论：**P2 的 6 站学习轨道（flow_stages）已经构建并部署，且实现严格符合 SPEC-LearnRedesign-v1**。

| 验收项 | 结果 |
|---|---|
| 6 站主线（tour→plan→procure→produce→quality→ship） | ✅ 接口 `stages` 返回 6 站；12 节点 `stageKey`/`oneLiner` 已回填 |
| BLOCK-02 阶段口径 | ✅ `tour`/`plan` = `["micro","quiz"]`（入门段不卡 SQL）；其余 4 站 = 全集合 `["micro","quiz","sql","sim"]` |
| BLOCK-03 站内 nextKey | ✅ `useStageProgress.ts` 自算 `stageNextKey`，`FactoryPage` 主 CTA 已绑定 |
| ADR-018 软引导 | ✅ `MainlineStepper.tsx` 三态（done/current/locked）+ 锁定站给因果文案 + "仍然去看看"放行 |
| BLOCK-04 中间态回落 | ✅ `factoryStages.data.ts` 静态兜底（`DEFAULT_STAGES` / `STAGE_BY_NODE` / `ONE_LINER_BY_NODE`）就位 |
| 后端接口 | ✅ `flowchart.routes.ts` 已返回 `stages` / 节点 `stageKey` / `oneLiner` |

**涉及文件（均已存在，无需新建）**：
- `worker/src/modules/flowchart/flowchart.routes.ts`
- `web/src/features/factory/useStageProgress.ts`
- `web/src/features/factory/MainlineStepper.tsx`
- `web/src/pages/FactoryPage.tsx`
- `web/src/features/factory/factoryStages.data.ts`
- `worker/src/migrations/schema-learn-redesign.sql` + `seed-learn-redesign-content.sql`（flow_stages 6 行 + 12 节点 UPDATE 已写入）

## 三、待你拍板：P2 这次具体交付什么（已暂停，等你回来）

由于 6 站轨道骨架已 live，P2 的"切入点"需要你定。候选方向（你此前在选项里暂停了）：
- **A（推荐）验收+打磨现有 6 站轨道**：真机端到端核对三态/软引导/阶段进度/站内 nextKey，修偏差；补每站叙事导语与站间因果衔接（含 `qty_done` 收尾课）。不新建模块。
- **B 做独立「学习路径」多轨模块**：多条可追踪路径（计划员/质检员/仓管员），与 P3 角色视图联动。新模块，工作量较大。
- **C 升级轨道为主导航体验**：弱化全景四泳道，把"跟一张订单走完工厂"推到 C 位。信息架构重排。
- **D 先出 P2 验收报告**：不动代码，完整跑一遍验收出报告，再决定下一步。

## 四、旁挂（未处理，非本次范围）
- AI 护栏与成本治理相关改动（`worker/src/modules/ai/ai.routes.ts`、`worker/src/core/ai-guard.ts`、`worker/src/modules/ai/ai.judge.ts`、`scripts/shadow-test.mjs`）仍处未提交状态——属你之前让我"看看"的并行任务，未纳入本次提交。需要时可单独提交或部署。
