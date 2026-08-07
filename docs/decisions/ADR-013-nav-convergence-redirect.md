# ADR-013: 外层导航收敛与默认着陆重定向策略

## Status

Accepted (2026-08-03) · 决策人：高见远（首席架构师）· 约束级别：P0（用户拍板）

## Background

需求要求把外层导航收敛为「学习」单入口（默认着陆页），删除独立 `/roadmap` 入口并 301 重定向到 `/engine?tab=career`，同时首页降级为轻量欢迎页或合并。

现状（`web/src/App.tsx`）：
- 路由库为 `react-router-dom@^7.18.2`（`:1`、`:26`），纯客户端 SPA 路由，与 ADR-010「保留 react-router-dom 7」一致。
- 侧栏导航有「首页」(`AppShell.tsx:114-119`)、「学习」(`:120-125`)、「职业路径」(`:152-157`) 三个一级入口；移动 TabBar 有「首页 / 学习」双入口(`:223-237`)。
- `/roadmap` 现挂载 `RoadmapPage`（`App.tsx:42`），`/tracks/:slug` 现挂载 `TrackDetailPage`（`:43`）。

待解决问题：如何在不迁移路由库、不破坏书签/外链（含 `?role=` / `#level-lN` 深链）的前提下，把多入口收敛为单入口。

## Decision

**沿用 react-router-dom 7，用客户端 `<Navigate replace>` 做重定向，不引入 TanStack Router 或任何服务端框架依赖。**

具体规则：
1. `/` → `<Navigate replace to="/engine" />`（默认着陆改为「学习」页）。
2. `/roadmap`（含 `/roadmap?role=:slug`）→ `<Navigate replace to="/engine?tab=career[&role=:slug]" />`（`role` 透传，兼容书签/外链/分享）。
3. `/tracks/:slug`（含 `#level-lN`）→ `<Navigate replace to={{ pathname:'/engine', search:`?tab=career&track=${:slug}`, hash }} />`（`hash` 透传，保留滚动定位）。
4. `HomePage` 降级挂载到 `/home`，保留 `GreetingBar` + `HomeStudyInfo` + 指向 `/engine` 的快捷入口；不再承载进度仪表盘（进度收敛见 ADR-014）。
5. 侧栏删「首页」「职业路径」两项，仅留「学习」→ `/engine`；移动 TabBar 改为 `[学习, SQL, 工厂, 词典, 我的]` 五槽。
6. 服务端 301（Worker Static Assets 层对 `/roadmap` 精确路径）列为**可选加固**，MVP 不强制；客户端 `<Navigate>` 已满足书签场景。

重定向组件设计为轻量函数组件，顶部无条件调用 `useSearchParams` / `useParams` / `useLocation` 后返回 `<Navigate replace to={...} />`，避免在提前 `return` 后调用 hook（防 React #310）。

## Consequences

**正面**
- 零新依赖、零路由库迁移，与 ADR-010 一脉相承。
- 书签/外链/分享链接（`?role=` / `#level-lN`）全部兼容，用户无感。
- 外层导航收敛为单入口，信息架构与需求一致。

**负面**
- 纯客户端重定向在「硬刷新打开旧链接」时是 SPA 启动后再跳（一次额外渲染），非 HTTP 301。如需真 301 语义需补 Worker 层（已列为可选）。
- 收敛后「首页」作为独立着陆消失，习惯旧入口的用户需适应（已用 `/home` 轻量欢迎页保留入口）。

## Related ADRs

- ADR-010（保留 react-router-dom 7）——本 ADR 的路由库前提。
- ADR-014（进度单一数据源）——首页降级后进度从首页移除，改由统一 store 在「学习」页呈现。
- ADR-015（四视图组合）——`/engine?tab=` 的 `tab` 由本 ADR 定义、由 ADR-015 消费。

## Verification

```bash
# 旧路由不再独立挂载
grep -rn "element={<RoadmapPage" web/src/App.tsx        # 应为空（改为重定向）
grep -rn "element={<TrackDetailPage" web/src/App.tsx    # 应为空（改为重定向）
# 重定向目标指向 /engine?tab=career
grep -rn "/engine?tab=career" web/src/App.tsx            # 必须有匹配
# 生产可达性
wrangler deployments status
```
