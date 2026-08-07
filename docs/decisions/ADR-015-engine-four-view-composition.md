# ADR-015: 「学习」页四视图组合与职业 Tab 复用

## Status

Accepted (2026-08-03) · 决策人：高见远（首席架构师）· 约束级别：P0（需求核心）

## Background

需求：「学习」页（`/engine`）以 `nextCourse`「下一步」为主轴（仅置于「概览」顶部），分段控制器切「概览 / 课程 / 路径 / 职业」四视图；课程体系 / 学习路径 / 职业路径三个冗余入口合并进四视图；职业视图复用现有 `RoadmapPage`/`TrackDetailPage` 并实现 career→topic 反向链接，形成学习闭环。

现状：
- `EnginePage.tsx` 是 388 行单文件单视图（`nextCourse` 在 `:196-239`，与路径/阶段/课程列表混排），不满足「四视图 + 单文件 ≤300 行」。
- `RoadmapPage.tsx:23` 用 `useSearchParams` 读 `?role=`（全局 search，可在 Tab 内复用）；`TrackDetailPage.tsx:22` 用 `useParams()` 读 `:slug`（依赖路由参数，Tab 内无 `:slug`）。
- `TrackChapter.topicId` 存在（`api/roadmap.ts:56`），`TrackLevelSection.tsx:88-104` 章节行仅链到 `/chapters/:id`，未链回课程/路径。
- 路线图节点/链接当前指向 `/tracks/:slug` 与 `/roadmap`（`:RoadmapNode.tsx:95`、`:RoadmapMatrix.tsx:74,140`、`:TrackDetailPage.tsx:121,172`、`:TrackLevelSection.tsx:80`）。

## Decision

**EnginePage 降级为编排器，按 `?tab=` 渲染四个子视图组件（均 ≤300 行）；「职业」Tab 直接复用现有 `RoadmapPage` / `TrackDetailPage` 作为子视图；通过链接改写 + `TrackDetailPage` slug 可注入实现 career→topic 反向链接闭环。**

文件组织：
```
web/src/pages/EnginePage.tsx              编排器：读 ?tab=，渲染四子视图之一（~100 行）
web/src/features/engine/EngineTabs.tsx    分段控制器，读写 ?tab=（~70 行）
web/src/features/engine/EngineOverview.tsx 概览：nextCourse + 完成度 + 路径快照（~150 行，抽自 EnginePage.tsx:196-241）
web/src/features/engine/EngineCourses.tsx  课程：<CoursesPage />（复用，~10 行）
web/src/features/engine/EnginePaths.tsx    路径：<LearningPathsPage />（复用，~10 行）
web/src/features/engine/EngineCareer.tsx   职业：<RoadmapPage /> 或 <TrackDetailPage slug={track} />（~30 行）
```

四视图映射：
- `概览`(默认)：仅此处渲染 `nextCourse`（来自 `engineStatus.nextCourse`，服务端主轴）；下方完成度 + 当前路径快照。**课程/路径/职业视图不渲染 nextCourse**。
- `课程`：渲染 `CoursesPage`（布鲁姆分层课程网格，不变）。
- `路径`：渲染 `LearningPathsPage`（路径阶段步骤，不变）。
- `职业`：`const track = params.get('track'); return track ? <TrackDetailPage slug={track}/> : <RoadmapPage embedded />;`

复用边界与改造：
1. `RoadmapPage` 加可选 `embedded?: boolean` prop（防「套娃」）：嵌入「职业」Tab 时传 `embedded`，组件内**跳过自身 `<header class="page-head"><h1>岗位能力路径</h1>`**，避免与 EngineLayout 的 `.engine-head`（h1「学习」）形成双重标题 / 嵌套 card-in-card；`RoleSelector + RoadmapMatrix/RoadmapStair + CareerAside` 原样复用。`useSearchParams` 读全局 `?role=`，在 `/engine?tab=career&role=mes` 下正常工作。嵌入态下内部 `RoleSelector` 作为**第二个** `role="tablist"`（`aria-label="岗位"`），与外层「学习视图」tablist 互不嵌套冲突（两个独立 tablist）。
2. `TrackDetailPage` 改为可选 `slug` prop：`const { slug: pSlug } = useParams(); const slug = propSlug ?? pSlug ?? '';`（向后兼容独立 `/tracks/:slug` 路由短期仍可保留，长期由 ADR-013 重定向接管）。
3. career→topic 反向链接：`TrackLevelSection.tsx:88-104` 每章 `TrackChapter.topicId` 加「进课程」入口 → `/courses/:topicId`（或切 `?tab=courses`）。形成 职业 → 路线 → 章节 → 课程 闭环。图标复用 REGISTRY 的 `courses`（ADR-016）。

4. 职业视图防「套娃」设计契约（来自 designer container 规范）：`RoadmapPage` 以子视图形态嵌入 `.engine-panel` 时**禁止 card-in-card**——`.rm-*` 卡片须为一级元素，复用 `--card-bg/--card-border/--radius-md/--space-*`，不得再包一层 `.panel/.card`；职业视图 accent 配额 ≤2（进度环 `done` 弧 = 1 处系统级 + 「去学习」链接 = 1 处），选中态用白药丸浮灰轨道、不为选中态额外烧 accent（见 designer §2.2 / §4.4）。

链接改写（防死链，必须随重构一并改，`RoadmapNode.tsx:95`、`RoadmapMatrix.tsx:74,140`、`TrackDetailPage.tsx:121,172`、`TrackLevelSection.tsx:80`）：`/tracks/:slug` → `/engine?tab=career&track=:slug`、`/roadmap` → `/engine?tab=career`、`/roadmap?role=` → `/engine?tab=career&role=`。

React #310 防护：编排器只顶部调 `useSearchParams`，按 `tab` 条件渲染整组件（子组件 hook 以单元挂载/卸载，不触发 #310）；**禁止**在编排器内按 tab 分支调用不同 hook。

## Consequences

**正面**
- 四视图共存于单一「学习」入口，信息架构与需求一致；`nextCourse` 主轴唯一、不重复。
- `RoadmapPage`/`TrackDetailPage`/`CoursesPage`/`LearningPathsPage` 全部复用，零重写，回归风险低。
- career→topic 反向链接闭合学习环，职业视图不再是孤岛。
- 每文件 ≤300 行，符合代码组织硬规则；子组件职责单一。

**负面**
- `RoadmapPage` 嵌入「职业」Tab 时若不传 `embedded`，会与 EngineLayout `.engine-head` 形成双重标题 + 嵌套（套娃）——必须由 `embedded` prop 跳过自身 header（已写入 Decision 第 1 点，防回归）。`.rm-*` 卡片须保持一级、禁止 card-in-card（设计契约第 4 点）。
- `EngineCareer` 把 `?role`/`?track`/`#hash` 都压在 `/engine` 的 search/hash 上，URL 较长是可接受的代价（换取单入口）。
- 链接改写清单若遗漏任一处即产生死链（已列清单 + §验证 grep 兜底）。

## Related ADRs

- ADR-013（导航收敛）——`?tab=` 由 ADR-013 定义、本 ADR 消费；`/roadmap`/`/tracks` 重定向目标指向本 ADR 的四视图。
- ADR-014（进度单一数据源）——「概览」nextCourse 来自 `engineStatus`（服务端），与客户端统一 store 并存。
- ADR-016（图标锁）——四视图分段控制器图标复用 REGISTRY，无新增图标库。
- ADR-012（职业三层图谱）——`RoadmapPage`/`TrackDetailPage` 的数据模型与后端接口本 ADR 直接复用，未改动。

## Verification

```bash
# nextCourse 仅出现在概览
grep -rn "nextCourse" web/src/features/engine/        # 应只在 EngineOverview.tsx
# RoadmapPage 在职业 Tab 内复用
grep -rn "RoadmapPage\|TrackDetailPage" web/src/features/engine/EngineCareer.tsx   # 应有引用
# RoadmapPage 支持 embedded 防套娃
grep -n "embedded" web/src/pages/RoadmapPage.tsx                                  # 应有 embedded?: boolean + 条件跳过 header
# 链接全量改写
grep -rn "/tracks/\|/roadmap" web/src/features/roadmap   # 应全部指向 /engine?tab=career
# 单文件行数约束
wc -l web/src/features/engine/*.tsx web/src/pages/EnginePage.tsx   # 各 ≤300
# 类型检查 + 构建
npm run typecheck && npm run build
```
