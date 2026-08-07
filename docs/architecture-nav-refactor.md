# 架构文档：MES 实训平台 · 导航级重构（「学习」单入口 + 进度单一数据源）

> 范围：导航收敛、默认着陆、进度数据源统一、EnginePage 四视图组合、RoadmapPage/TrackDetailPage 复用为「职业」Tab 子视图。
> 本文档只给出**可落地的重构方案与风险**，不含业务代码实现。
> 关联决策：ADR-002（图标锁）、ADR-010（保留 react-router-dom 7）、ADR-012（职业—能力—章节三层图谱）。

---

## 1. 目标复述（来自需求）

1. 外层导航收敛为「学习」单入口（默认着陆页）；删除独立 `/roadmap` 入口，改为 301 重定向到 `/engine?tab=career`；课程体系 / 学习路径 / 职业路径三个冗余入口合并进「学习」页内四视图。
2. 「学习」页以 `nextCourse`「下一步」为主轴（仅置于「概览」顶部），分段控制器切「概览 / 课程 / 路径 / 职业」四视图；职业视图复用现有 RoadmapPage/TrackDetailPage 并实现 career→topic 反向链接到课程/路径，形成学习闭环。
3. 进度数据从（a）首页深色 dashboard、（b）侧栏 SidebarProgress、（c）个人中心浅色卡 三份实现收敛为单一数据源（统一 store），四视图只是同一份进度的不同切面。

---

## 2. 现状对齐（代码证据）

| 关注点 | 证据 | 结论 |
|---|---|---|
| 路由库 | `web/src/App.tsx:1`（`react-router-dom`）、`:26`（`<Routes>`）；`web/package.json:22` `react-router-dom@^7.18.2` | 沿用 react-router-dom 7（客户端路由），重定向用 `<Navigate replace>`。与 ADR-010 一致。 |
| 图标库 | `web/src/components/Icon.tsx:94`（仅 `lucide-react` 具名导入）、`:97-202`（REGISTRY）、`web/package.json:18` `"lucide-react": "1.28.0"` | 锁定 lucide-react@1.28.0（ADR-002），REGISTRY 是唯一图标出口，未注册名降级为 `null` 不渲染 emoji（`:228-231`）。 |
| 进度·侧栏 | `web/src/components/AppShell.tsx:20-52`（`SidebarProgress` 调 `['progress']`+`['topics']`+`useQueries(['chapters',id])`） | 三份实现之一，独立计算 `done/total/pct`。 |
| 进度·首页 | `web/src/pages/HomePage.tsx:7` → `ProgressDashboard.tsx:96-419`（同样调 `['progress']`+`['topics']`+`['chapters',id]`，额外算 `nextStep/plan/pathStats`） | 三份实现之二，计算最重。 |
| 进度·个人中心 | `web/src/pages/ProfilePage.tsx:53-102`（同样三查询，算 `moduleStats/streak/level`） | 三份实现之三。 |
| EnginePage 现状 | `web/src/pages/EnginePage.tsx`（单视图：路径选择器 + 完成度卡 + `nextCourse` `:196-239` + 阶段视图 `:244-264` + 课程列表 `:267-348` + 所有路径 `:351-384`） | 已有四视图雏形，但全在一个 388 行文件，`nextCourse` 与课程/路径内容混排。 |
| RoadmapPage | `web/src/pages/RoadmapPage.tsx:22-48`（读 `?role=`，调 `roadmapApi.careers/graph/career`） | 自包含页，可作为「职业」Tab 子视图直接复用。 |
| TrackDetailPage | `web/src/pages/TrackDetailPage.tsx:22`（`useParams()` 取 `slug`）；`:73` 用 `trackIcon`；`:127-141` 渲染 `levels` | 取 slug 依赖路由参数，需改造为可注入 slug 才能在 Tab 内复用。 |
| 反向链接数据 | `web/src/api/roadmap.ts:53-59`（`TrackChapter.topicId` 存在）；`web/src/features/roadmap/RoadmapNode.tsx:95`（`to={/tracks/${slug}#...}`） | topicId 可用 → career→topic 反向链接可行；但链接当前指向 `/tracks/:slug`，需改写。 |
| 后端路线图 | `worker/src/modules/roadmap/`（roadmap.graph.ts / roadmap.service.ts / roadmap.routes.ts） | 后端已就绪，`/api/v1/roadmap/graph`、`/api/v1/tracks/:slug`、`/api/v1/careers` 无需改动。 |

**关键认知**：EnginePage 的 `nextCourse` 来自 `api.engineStatus`（服务端计算，`EnginePage.tsx:71-79`），与三份客户端进度实现是**不同数据源**。本次收敛目标 = 消除三份客户端 `['progress']+['topics']+['chapters']` 的重复计算；EnginePage 的 `nextCourse` 作为服务端主轴保留，仅限定出现在「概览」视图。

---

## 3. 技术约束与选型结论

| 维度 | 结论 | 依据 |
|---|---|---|
| 路由 | 沿用 react-router-dom 7，客户端 `<Navigate replace>` 实现重定向；不引入 TanStack Router | ADR-010 已拍板；重定向是 SPA 内跳转，无需换库。 |
| 图标库 | 延续 ADR-002 锁 lucide-react@1.28.0；四 Tab 图标复用既有 REGISTRY 语义名 `stage`/`courses`/`paths`/`portfolio`；**禁止引入第二图标库、禁止 emoji** | P0 铁律 + ADR-002。新增语义名必须进 REGISTRY 且确认在 1.28.0 中存在。 |
| 状态/数据源 | 不引新状态库；新增 `useProgress` hook，底层仍走 React Query 既有 `queryKey`（`['progress']`/`['topics']`/`['chapters',id]`）天然去重 | 单一缓存即单一数据源，零新依赖。 |
| 构建 | `vite build` 注意 ADR-004 自托管字体 woff2 被 Windows 锁定（EPERM）——字体放 `public/` 一次性复制，构建不回写 | 已知坑（MEMORY.md）。 |

---

## 4. 可行性方案

### 4.1 路由重构（默认着陆 + /roadmap 收敛）

**路由表 diff（概念）**

```
Before                                    After
/                  → HomePage              /                  → <Navigate replace to="/engine" />
/courses           → CoursesPage           /courses           → CoursesPage          (不变)
/engine            → EnginePage            /engine            → EnginePage (四视图，?tab= 控制)
/roadmap           → RoadmapPage           /roadmap           → <Navigate replace to="/engine?tab=career[&role=]">
/tracks/:slug      → TrackDetailPage       /tracks/:slug      → <Navigate replace to="/engine?tab=career&track=:slug[#hash]">
/home              (无)                    /home              → HomePage (轻量欢迎，见下)
```

- `/roadmap?role=mes` 这类书签 → 重定向到 `/engine?tab=career&role=mes`（`role` 透传，兼容外链/分享）。
- `/tracks/mes#L2` 这类深链 → 重定向到 `/engine?tab=career&track=mes#L2`（`hash` 透传，保留滚动定位）。
- `/` → `/engine`。HomePage 降级为 `/home` 轻量欢迎页（保留 `GreetingBar` + `HomeStudyInfo` + 指向 `/engine` 的快捷入口），**移除 `ProgressDashboard`**（消除三份进度实现之一，进度改由「学习」页统一呈现）。
- 实现形式（设计，非实现文件）：`App.tsx` 路由表增加两个轻量重定向组件 `RoadmapLegacyRedirect` / `TrackLegacyRedirect`，均 `useSearchParams` / `useParams` / `useLocation` 顶部调用后返回 `<Navigate replace to={...} />`。

**服务端 301 强化（可选，advisory）**：纯客户端 `<Navigate>` 已满足书签场景（SPA 启动后即跳）。若需真正的 HTTP 301（SEO/缓存语义），在 Worker Static Assets 层对 `/roadmap` 精确路径加 301。MVP 阶段非必须，列入后续加固。

**导航收敛（AppShell）**
- 桌面侧栏（`AppShell.tsx:113-158`）：删除「首页」(`:114-119`) 与「职业路径」(`:152-157`) 两项，仅保留「学习」(`:120-125`) 作为单入口 → `/engine`。「工具」组（SQL/工厂/词典）与个人中心入口保留。
- 移动 TabBar（`AppShell.tsx:223-237`）：移除「首页」槽位，改为 `[学习(/engine), SQL, 工厂, 词典, 我的]`（5 槽），「学习」即统一着陆 hub。

### 4.2 进度单一数据源（store 统一）

**新增 `web/src/features/progress/useProgress.ts`**（纯数据 hook，不碰导航）

契约（输入/输出）：
```
输入：无（内部调 api.topics / api.progress / api.chapters(id)）
输出：{
  topics: Topic[] | undefined,
  progress: ProgressSummary | undefined,        // 含 completedChapterIds / passedExerciseIds / events
  completedSet: Set<string>,                     // 已读章节 id
  chapterByTopic: Map<number, Chapter[]>,        // topicId -> 章节（供各视图派生）
  done: number, total: number, pct: number,      // 全局章节进度
  passedSql: number,                             // SQL 通过数
  isLoading: boolean, isError: boolean,
}
```

**Hooks 顺序（强制，防 React #310）**：`useQuery(['topics'])` → `useQuery(['progress'])` → `useQueries(['chapters',id])`（**cap 30**，与 `CoursesPage.tsx:92` 对齐，防海量 fan-out）→ `useMemo(chapterByTopic)` → `useMemo(done/total/pct)`。所有 hook 无条件顶部调用，任何 `if (loading) return` 之前。

**消费方改造**
| 文件 | 改动 |
|---|---|
| `AppShell.tsx:20-52` `SidebarProgress` | 删除其内部 3 查询 + `useMemo`，改为 `const { done, total, pct } = useProgress();` |
| `ProfilePage.tsx:53-102` | 删除 3 查询；`const p = useProgress();` 用 `p.completedSet` / `p.chapterByTopic` 派生 `moduleStats`（保留其自有 `streak`/`level` useMemo） |
| `ProgressDashboard.tsx` | **删除整个文件**；其 nextStep/plan 逻辑由 EnginePage 的 `engineStatus.nextCourse`（服务端）取代 |
| `HomePage.tsx:7,16` | 删除 `<ProgressDashboard />` 引用 |

**单一性保证**：React Query 按 `queryKey` 全局去重，三处消费方共享同一份 `['progress']`/`['topics']`/`['chapters',id]` 缓存 → 一次拉取、单一真实源。无循环依赖（`useProgress` 仅依赖 `api/endpoints` 与类型；消费方单向 import）。

**注意**：ProgressDashboard 原有 `progressUnauthorized` 自登录兜底（`:239-251`）删除后，登录失效由 `RequireAuth`（`App.tsx:34`，基于 `whoami`）统一接管跳登录页——需验证 `RequireAuth` 已覆盖 progress 401（advisory，见 §6）。

### 4.3 视图组合（EnginePage 四视图 + 职业 Tab 复用）

**文件组织（单文件 ≤300 行）**

```
web/src/pages/EnginePage.tsx              → 编排器：读 ?tab=，渲染四子视图之一（~100 行）
web/src/features/engine/EngineTabs.tsx    → 分段控制器，读写 ?tab=（~70 行）
web/src/features/engine/EngineOverview.tsx→ 概览：nextCourse + 完成度 + 当前路径快照（~150 行，抽自 EnginePage.tsx:196-241）
web/src/features/engine/EngineCourses.tsx → 课程：直接 <CoursesPage />（~10 行，复用）
web/src/features/engine/EnginePaths.tsx   → 路径：直接 <LearningPathsPage />（~10 行，复用）
web/src/features/engine/EngineCareer.tsx  → 职业：<RoadmapPage /> 或 <TrackDetailPage slug={track} />（~30 行，复用）
```

**编排器防 #310**：`EnginePage` 只顶部调 `useSearchParams`；根据 `tab` 条件渲染子组件（整组件挂载/卸载，hooks 以单元变化，不触发 #310）。**不得**按 tab 在编排器内分支调用不同 hook。

**四视图内容映射**
- `概览`(overview，默认)：仅此处放 `nextCourse`（来自 `engineStatus.nextCourse`）；下方完成度大数 + 当前路径阶段快照 + 继续 CTA。**课程/路径/职业视图不放 nextCourse**。
- `课程`(courses)：渲染 `CoursesPage`（布鲁姆分层课程网格，现状不变）。
- `路径`(paths)：渲染 `LearningPathsPage`（路径阶段步骤，现状不变）。
- `职业`(career)：渲染路线图矩阵 + 路线详情（见复用边界）。

**职业 Tab 复用边界**
- `RoadmapPage`（`RoadmapPage.tsx:23` `useSearchParams` 读 `?role=`）：search params 全局共享，在 `/engine?tab=career&role=mes` 下能直接读到 `role` → **无需改造即可在 Tab 内渲染**。
- `TrackDetailPage`（`TrackDetailPage.tsx:22` `useParams()` 取 `slug`）：`/engine` 路由无 `:slug` 参数 → **改造为可选 `slug` prop**（`const { slug: pSlug } = useParams(); const slug = propSlug ?? pSlug ?? '';`），向后兼容。EngineCareer 用 `<TrackDetailPage slug={trackParam} />` 注入。
- `EngineCareer` 判定：`const track = params.get('track'); return track ? <TrackDetailPage slug={track}/> : <RoadmapPage/>;`（role 由 RoadmapPage 自行读全局 search）。

**career→topic 反向链接（学习闭环）**
- `web/src/features/roadmap/TrackLevelSection.tsx:88-104` 章节列表：每个 `TrackChapter` 已有 `topicId`（`api/roadmap.ts:56`）。在章节行追加「进课程」入口 `→ /courses/:topicId`（或切到 `?tab=courses`）。形成 职业 → 路线 → 章节 → 课程 闭环。
- 视觉：章节行现有 `chapter.done` 状态图标保留，新增次级「进课程」文字链接（不引入 emoji，复用 `courses` 语义名图标）。

**链接改写清单（防死链，必须随重构一并改）**
| 文件:行 | 现状 | 改为 |
|---|---|---|
| `RoadmapNode.tsx:95` | `to={/tracks/${slug}#${levelAnchor}}` | `to={/engine?tab=career&track=${slug}#${levelAnchor}}` |
| `RoadmapMatrix.tsx:74,140` | `/tracks/${col.slug}` | `/engine?tab=career&track=${col.slug}` |
| `TrackDetailPage.tsx:121` | `to="/roadmap"`（回岗位路径） | `to="/engine?tab=career"` |
| `TrackDetailPage.tsx:172` | `/roadmap?role=${career.slug}` | `/engine?tab=career&role=${career.slug}` |
| `TrackLevelSection.tsx:80` | `to="/roadmap"` | `to="/engine?tab=career"` |
| `EnginePage.tsx:140`（现状「职业路径」链接） | `/roadmap` | 删除（改为 Tab 自身） |

---

## 5. 重构影响面 · 文件改动清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 改 | `web/src/App.tsx` | 路由表：加 `/`→/engine、`/roadmap`→重定向、`/tracks/:slug`→重定向、`/home`→HomePage；删原 `/roadmap`/`/tracks` 直接挂载 |
| 改 | `web/src/components/AppShell.tsx` | 侧栏删「首页」「职业路径」；MobileTabBar 改 5 槽（学习/SQL/工厂/词典/我的）；`SidebarProgress` 改用 `useProgress()` |
| 新增 | `web/src/features/progress/useProgress.ts` | 进度单一数据源 hook |
| 新增 | `web/src/features/engine/EngineTabs.tsx` | 分段控制器 |
| 新增 | `web/src/features/engine/EngineOverview.tsx` | 概览子视图（抽自 EnginePage） |
| 新增 | `web/src/features/engine/EngineCourses.tsx` | 课程子视图（复用 CoursesPage） |
| 新增 | `web/src/features/engine/EnginePaths.tsx` | 路径子视图（复用 LearningPathsPage） |
| 新增 | `web/src/features/engine/EngineCareer.tsx` | 职业子视图（复用 RoadmapPage/TrackDetailPage） |
| 改 | `web/src/pages/EnginePage.tsx` | 降级为编排器（读 ?tab=，渲染四子视图） |
| 改 | `web/src/pages/TrackDetailPage.tsx` | `slug` 支持 prop 注入（向后兼容） |
| 改 | `web/src/pages/ProfilePage.tsx` | 进度改用 `useProgress()` |
| 改 | `web/src/pages/HomePage.tsx` | 删 `<ProgressDashboard />`，保留 GreetingBar + HomeStudyInfo + 快捷入口 |
| 改 | `web/src/features/roadmap/RoadmapNode.tsx` | 节点链接改 `/engine?tab=career&track=...` |
| 改 | `web/src/features/roadmap/RoadmapMatrix.tsx` | 列头/溢出链接改 `/engine?tab=career&track=...` |
| 改 | `web/src/features/roadmap/TrackLevelSection.tsx` | 「回岗位路径」链接改写 + 章节加「进课程」反向链接 |
| 删除 | `web/src/components/ProgressDashboard.tsx` | 进度独立计算收敛进 `useProgress` + EnginePage |
| 不变 | `worker/**`、`api/roadmap.ts`、`api/endpoints.ts` | 后端与 API 契约无需改动 |

---

## 6. 风险与不可行警告（advisory，非阻断）

1. **React #130（未注册图标 → 渲染 undefined 崩溃）**：四 Tab 图标复用既有 REGISTRY 名（`stage`/`courses`/`paths`/`portfolio` 均在 `Icon.tsx:99,100,102,190`），不新增注册即零风险；`Icon.tsx:228-231` 已有未注册降级为 `null` 的兜底。任何新语义名必须先进 REGISTRY 并确认 lucide-react@1.28.0 含该具名导出。
2. **React #310（hooks 顺序）**：`useProgress` 与 `EnginePage` 编排器均须顶部无条件调用全部 hook（见 §4.2 / §4.3）。`ProgressDashboard.tsx:132-135` 已记载此教训，新 hook 沿用同款约束。
3. **woff2 EPERM（Windows 构建）**：`vite build` 覆盖自托管字体（ADR-004）会被 Windows 拒写。字体放 `public/fonts` 一次性复制，构建脚本不回写该目录。CI/本地 Windows 构建须验证。
4. **生产域沙箱硬阻断**：客户端重定向依赖 SPA 启动；若生产域对 `/roadmap` 路径做硬阻断（罕见），用 `wrangler deployments status` 验证，必要时加 Worker 层 301（§4.1）。
5. **行为变化（需 PM 确认）**：删除 `ProgressDashboard` 后，首页不再有客户端计算的 `nextStep` / 完成日期 ETA；「下一步」主轴改由 EnginePage `engineStatus.nextCourse`（服务端）在「概览」呈现，且该主轴不显示 ETA。若 PM 要保留 ETA，后续在 `engineStatus` 端点补估算字段。
6. **嵌套 `<section>`**：RoadmapPage/TrackDetailPage/CoursesPage/LearningPathsPage 自带 `<section>`，嵌入 EnginePage 子视图后会出现 `<section>` 嵌套。功能无碍，视觉/可访问性建议后续统一容器语义（非 MVP 阻断）。
7. **链接改写遗漏 → 死链**：§4.3 链接清单须全量改；建议用 `grep -rn "/tracks/\|/roadmap" web/src` 在 PR 前核验无残留。

---

## 7. 验收清单（落地后命令）

```bash
# 图标库唯一 + 无 emoji（ADR-002 继承）
grep -rn "react-icons\|@tabler/icons\|heroicons" web/src web/package.json   # 无匹配
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src                  # 无匹配

# 旧路由已无独立挂载、进度独立计算已收敛
grep -rn "ProgressDashboard" web/src                                        # 仅历史引用清零
grep -rn "/roadmap\b" web/src/pages                                        # 仅重定向组件内出现

# 链接全量改写
grep -rn "/tracks/\|/roadmap" web/src/features/roadmap                     # 应全部指向 /engine?tab=career

# 类型检查 + 构建（验证 woff2 EPERM 不触发）
npm run typecheck && npm run build

# 生产可达性
wrangler deployments status
```
