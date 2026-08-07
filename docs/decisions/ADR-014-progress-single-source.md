# ADR-014: 进度数据单一数据源（store 统一）

## Status

Accepted (2026-08-03) · 决策人：高见远（首席架构师）· 约束级别：P0（需求硬约束）

## Background

需求要求把进度数据从三份独立实现收敛为单一数据源：
- （a）侧栏 `SidebarProgress`（`web/src/components/AppShell.tsx:20-52`）
- （b）首页深色 dashboard `ProgressDashboard`（`web/src/components/ProgressDashboard.tsx:96-419`，由 `HomePage.tsx:7,16` 挂载）
- （c）个人中心浅色卡 `ProfilePage`（`web/src/pages/ProfilePage.tsx:53-102`）

三者各自独立调用 `api.progress` + `api.topics` + `api.chapters(id)`（`useQueries`），各自重算 `done/total/pct/completedSet`，逻辑重复且易漂移（例如 `SidebarProgress` 只算总章进度，`ProgressDashboard` 额外算 `nextStep/plan/pathStats`，`ProfilePage` 算 `moduleStats/streak/level`）。任一进度口径调整都要改三处。

约束（来自 MEMORY.md / 团队铁律）：不能引入循环依赖；hook 必须置顶调用（防 React #310）；不引入第二个图标库。

## Decision

**不引入新状态库。新增一个纯数据 hook `web/src/features/progress/useProgress.ts`，底层复用 React Query 既有 `queryKey`（`['progress']` / `['topics']` / `['chapters',id]`），由 React Query 全局去重保证「单一缓存 = 单一数据源」。三处消费方改为调用该 hook，删除 `ProgressDashboard` 的独立计算。**

Hook 契约：
```
输入：无（内部调 api.topics / api.progress / api.chapters(id)）
输出：{ topics, progress(含 completedChapterIds/passedExerciseIds/events),
        completedSet:Set<string>, chapterByTopic:Map<number,Chapter[]>,
        done, total, pct, passedSql, isLoading, isError }
```

强制约束：
1. Hooks 顺序固定且全部顶部无条件调用：`useQuery(['topics'])` → `useQuery(['progress'])` → `useQueries(['chapters',id])`（**cap 30**，对齐 `CoursesPage.tsx:92` 防 fan-out）→ `useMemo(chapterByTopic)` → `useMemo(done/total/pct)`。任何 `if (loading) return` 之前不得有 hook。
2. 不引入 `useNavigate`/`useQueryClient` 等导航依赖（保持纯数据，无循环依赖风险）；`ProgressDashboard` 原有的自登录兜底删除后由 `RequireAuth`（`App.tsx:34`，基于 `whoami`）统一接管。
3. `useProgress` 仅依赖 `api/endpoints` 与类型；消费方单向 import，无反向依赖。

消费方改造：
- `SidebarProgress`：删内部 3 查询 + `useMemo`，改为 `const { done, total, pct } = useProgress();`。
- `ProfilePage`：删 3 查询，用 `useProgress()` 的 `completedSet`/`chapterByTopic` 派生 `moduleStats`（保留其自有 `streak`/`level` useMemo）。
- `ProgressDashboard.tsx`：**整文件删除**；其 `nextStep` 由 EnginePage 的 `engineStatus.nextCourse`（服务端计算）取代（见 ADR-015）。
- `HomePage.tsx`：删 `<ProgressDashboard />` 引用。

## Consequences

**正面**
- 进度口径单一来源：一次拉取、全局共享缓存，三处视图是同一份数据的不同切面，消除漂移。
- 零新依赖（无 Redux/Zustand 等）；React Query 去重天然生效。
- 删除一份最重的独立计算（`ProgressDashboard` ~320 行），代码量减少、可维护性提升。
- Hook 顶部无条件调用，结构层面规避 React #310；`Icon.tsx` 未注册图标降级 `null` 规避 #130。

**负面**
- `ProgressDashboard` 的客户端 `nextStep` / 完成日期 ETA 随之消失；「下一步」主轴改由 EnginePage `engineStatus.nextCourse` 在「概览」呈现，且该主轴不显示 ETA（若 PM 要保留 ETA，需后续在 `engineStatus` 端点补估算字段——非本 ADR 范围）。
- 删除 `ProgressDashboard` 后，`progress` 401 的自定义「重新登录」兜底消失，依赖 `RequireAuth` 覆盖；需验证 `RequireAuth` 已对 progress 401 生效（advisory）。

## Related ADRs

- ADR-013（导航收敛）——首页降级后进度从首页移除，与此 ADR 联动。
- ADR-015（四视图组合）——EnginePage「概览」的 `nextCourse` 来自 `engineStatus`（服务端），与客户端统一 store 并存、各司其职。
- ADR-002（图标锁）——本 ADR 不新增任何图标。

## Verification

```bash
# 三处独立进度计算已收敛
grep -rn "useProgress" web/src/components/AppShell.tsx web/src/pages/ProfilePage.tsx   # 应有引用
grep -rn "ProgressDashboard" web/src                                                  # 应清零
# useProgress 仅依赖 api/endpoints（无循环）
grep -rn "from '.*AppShell'\|from '.*ProfilePage'" web/src/features/progress/useProgress.ts  # 应为空
# 类型检查 + 构建
npm run typecheck && npm run build
```
