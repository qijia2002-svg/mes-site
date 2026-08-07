# Spec - MES 实训平台导航级重构 v1

> 生成日期：2026-08-04
> 基于：PRD-NavRefactor-v1 + architecture-nav-refactor + engine-nav-restructure（UIUX）
> 状态：已确认（用户 Phase 1 确认；ETA 决策：去掉，主轴不显示预计完成时间）

---

## 1. 产品定义
- **一句话描述**：把五个重叠的学习入口收敛为「学习」单入口，以 nextCourse 为主轴串联四视图，进度数据统一为单一数据源。
- **目标用户**：MES 实施 / 运维实训学员（制造业信息化从业者、在校生）；次要为培训组织者 / 招聘方。
- **核心问题**：入口冗余导致找不到「下一步学什么」；同一份进度被三套独立逻辑计算，不同页面数字不一致。

## 2. MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 | RICE |
|--------|------|-------------|------|
| P0 | F1 外层导航收敛「学习」单入口 + 默认 /engine | 侧栏仅首页/学习；删成长组；默认进 /engine | 6.0 |
| P0 | F2 /roadmap → /engine?tab=career 301（Worker 边缘 + SPA 兜底） | 旧链不 404，角色参数透传 | 16.0 |
| P0 | F3 四视图分段控制器 | 切换即时；?tab= 深链可还原；每段 ≤300 行 | 3.0 |
| P0 | F4 职业视图复用 RoadmapPage 组件 | CareerView 挂载矩阵/阶梯/画像，交互一致 | 2.56 |
| P0 | F5 nextCourse 仅概览顶部 | 概览有且仅有 1 个；其余三视图不含 | 10.0 |
| P0 | F6 统一进度 store | useProgress 一处派生；五处数字全等；分母统一 course topics | 3.0 |
| P0 | F7 career→topic 反向链接 + 闭环 | 职业节点跳课程/路径；课程/路径「相关岗位」跳回职业 | 2.8 |
| P0 | F8 修复 emoji 锁图标违规 | Icon 注册 lock；EnginePage 三处清除；全仓无功能性 emoji | 5.0 |
| P1 | F9 首页降级轻量欢迎页/合并 | 首页仅欢迎 + 进度入口或并入概览 | 1.6 |
| P1 | F10 移动端 TabBar 同步 | 移除首页/roadmap 独立项，主入口「学习」 | 2.8 |
| P1 | F11 进度/导航埋点 | 上报 nextCourse 点击 / tab 切换 / 反向链接 / 概览着陆 | 2.0 |

MVP 构建集合 = F1~F8（全 P0）。

## 3. 明确不做（Out-of-Scope — 锁定）

| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| 新增后端进度聚合端点 | 真相已在前端三接口，新增动预算 | 需全站排行时 |
| 首页完全删除 | 仅降级为 P1，轻量欢迎页成本低 | 下迭代确认学习页可承接 |
| 职业视图重写 | 组件已成熟（QA PASS），重写负资产 | 永不（除非数据模型大改） |
| 移动端底栏大改 | 当前含「学习」，仅同步入口(F10) | 若需独立移动导航 |
| 多语言 / i18n | 仅中文受众 | 海外推广 |
| 社交 / 排行 / 证书 | 超出导航范围 | 专门立项 |
| 网站↔脑库双向同步 | 已知独立立项 | 冲突解决立项后 |
| 引入 Zustand / Redux | Query 已去重，统一 store=一个 hook | 需跨路由写状态 |

## 4. 技术架构（锁定 — 含版本锚定）

| 层 | 技术 | 实际版本 | 锁定原因 |
|----|------|----------|----------|
| 前端框架 | React | 19 | 沿用现状 |
| 路由 | react-router-dom | ^7.18.2 | 沿用 ADR-010；`<Navigate replace>` 客户端重定向 |
| 图标 | lucide-react | 1.28.0 | REGISTRY 唯一出口（ADR-002/016）；四 Tab 复用 stage/courses/paths/briefcase，新增 lock:Lock |
| 状态 | React Query | v5 | 缓存去重；新增 `useProgress` hook，不引新状态库 |
| 构建 | Vite | 6 | 输出 worker/dist；注意 woff2 EPERM（字体放 public/fonts 一次性复制，构建不回写） |
| 部署 | Cloudflare Workers + D1 | - | 后端与 API 契约不变 |
| 边缘重定向 | Worker 路由处理器 | - | GET /roadmap、/tracks/:slug 返回 301 到 /engine?tab=career（role/track 透传） |

**文件改动清单（锁定，详见 architecture-nav-refactor.md §5）**
- 新增 6：`web/src/features/progress/useProgress.ts`、`web/src/features/engine/EngineLayout.tsx`、`OverviewView.tsx`、`CoursesView.tsx`、`PathsView.tsx`、`CareerView.tsx`
- 修改 9：`App.tsx`（路由收敛 + 301）、`AppShell.tsx`（删成长组 + SidebarProgress 改用 useProgress + MobileTabBar）、`Icon.tsx`（REGISTRY 补 lock）、`EnginePage.tsx`（降级/清 emoji）、`ProfilePage.tsx`（改用 useProgress）、`RoadmapPage.tsx`（复用为 CareerView + 链接改写）、`TrackDetailPage.tsx`（relatedCareers 改写）、`features/roadmap/RoadmapNode.tsx`（加「去学这门课」）、`features/roadmap/TrackLevelSection.tsx`（加「进课程」）；另 `design-tokens.css` + `design-tokens.json`（token 合并）
- 删除 1：`web/src/components/ProgressDashboard.tsx`（逻辑迁 OverviewView）

## 5. API 端点清单（锁定——无新增/修改后端 API）

复用既有：`['progress']`、`['topics']`、`['chapters',id]`、`engineStatus`、`roadmapApi`（careers/tracks/graph）。后端 schema 与契约不变。

**Worker 路由变更（边缘 301）**
| Method | Path | 行为 | 备注 |
|--------|------|------|------|
| GET | /roadmap | 301 → /engine?tab=career&role=<透传> | 兼容书签/外链 |
| GET | /tracks/:slug | 301 → /engine?tab=career&track=:slug（hash 透传） | 兼容旧路径 |

客户端兜底：`App.tsx` 中 `/roadmap` → `<Navigate to="/engine?tab=career" replace/>`（role 从 search 透传）。

## 6. 数据库表清单（锁定）
无变更。D1 schema 不变。

## 7. 页面清单（锁定）

| 页面 | 路由 | 核心组件 | 对应数据 | 设计 Token 主题 |
|------|------|----------|----------|-----------------|
| 学习（编排） | /engine | EngineLayout + 分段控制器 | useProgress / engineStatus | 森绿 v3 |
| 概览 | /engine?tab=overview | OverviewView（复用 HomePage 子集） | nextStep + globalPct + pathStats 摘要 | §9.1–9.3 |
| 课程 | /engine?tab=courses | CoursesView（原 CoursesPage） | moduleStats（排除 id>=5000） | §9.1/9.3 |
| 路径 | /engine?tab=paths | PathsView（原 LearningPathsPage） | pathStats | §9.1/9.3 |
| 职业 | /engine?tab=career | CareerView（复用 RoadmapPage） | roadmapApi 服务端进度 | §9.1/9.4 |
| 首页（合并进概览 / / 重定向至 /engine） | / 或 /home → /engine?tab=overview | 欢迎内容并入概览首屏，侧栏不再单列 | useProgress 摘要 | §9.3 |

## 8. 设计 Token（锁定）
- **主色**：accent `#547C70` 森绿 / ink `#2d3a33` / bg `#F3F3E9` 暖米 / surface `#fff`（v3，以 `design-tokens.css` 为唯一真源（OD-014 已决），不回写 `design-tokens.json`；若组件从 JSON import 裸色值则改走 CSS 变量）
- **字体**：Archivo Variable + Noto Sans SC + JetBrains Mono
- **图标库**：lucide REGISTRY（ADR-002/016）；尺寸 16/20/24px；`lock: Lock` 替代 🔒 emoji
- **分段控制器**：§9.1（`--seg-*`：轨道 surface-2 + 1px border + pill 半径；选中白药丸 + elev-ring + 600 字重；150ms `cubic-bezier(0.2,0,0,1)`；禁弹性 `cubic-bezier(0.68,-0.55,0.265,1.55)`）
- **nextCourse 主轴**：§9.2（`--axis-*`：eyebrow / 课程名 18px·600 / 状态 tag / 百分比 accent 等宽）
- **统一进度**：§9.3（`--progress-ring-*` 环 r52 viewBox120 rotate-90；`--progress-h-sm` 4px / `--progress-h-md` 6px）
- **职业↔课程链接**：§9.4（`--loop-link-fg` accent / `--loop-link-icon` muted）
- **对标品牌**：Linear（克制分段）/ Notion（视图切换）/ Duolingo（下一课锚点）/ Coursera（My Learning）
- **红线**：禁紫粉渐变、禁硬编码 hex（#fff/#000 例外）、禁弹性缓动、禁千篇一律 Hero（主轴即真实内容）

## 9. 验收标准（锁定——QA 测试唯一依据，EARS 格式）

| 编号 | 功能 | EARS 格式验收标准 | 优先级 |
|------|------|-------------------|--------|
| AC-01 | 重定向 | While 访问 `/roadmap?role=mes-impl`，系统**必须** 301 到 `/engine?tab=career&role=mes-impl` | P0 |
| AC-02 | 默认着陆 | When 用户打开应用根路径，系统**必须**默认进入 `/engine`（tab=overview） | P0 |
| AC-03 | 分段控制器 | While 在「学习」页，系统**必须**渲染分段控制器且切换即时、`?tab=` 可深链还原 | P0 |
| AC-04 | nextCourse 主轴 | If 处于概览视图，系统**必须**在顶部展示且仅展示一个 nextCourse 主轴区块 | P0 |
| AC-05 | 进度单一源 | If 完成 1 章，系统**必须**使五处（侧栏/概览/课程/路径/个人中心）百分比全等且分母均为 course topics（排除 id>=5000） | P0 |
| AC-06 | 职业→课程 | While 在职业视图，系统**必须**对每个节点提供「去学这门课」跳 `/engine?tab=courses&topic=:topicId` | P0 |
| AC-07 | 课程→职业 | If 在课程/路径视图展示相关岗位，系统**必须**提供链接跳 `/engine?tab=career&role=` | P0 |
| AC-08 | 图标合规 | If 渲染锁态图标，系统**必须**使用 `<Icon name="lock"/>` 且全仓无功能性 emoji | P0 |
| AC-09 | 单文件约束 | While 任一 Engine 子视图，单文件**必须** ≤300 行 | P0 |
| AC-10 | 部署验证 | If 生产部署，系统**必须**通过 `wrangler deployments status` 验证 100% 流量且 `/roadmap` 301 生效 | P0 |

## 10. 边界与约束
- 不支持 IE；响应式断点 1024 / 768；分段控制器 <1024px 可横滚/换行、段高 ≥44；主轴卡 <768px 塌单栏
- 进度接口过期 / 未登录降级 0 进度，不整页报错（保留 ProgressDashboard 既有降级语义）
- 重定向必须带 role / track 参数
- emoji 回归防护进 CI（grep）
- 嵌套 section 视觉语义后续统一（非阻断）

## 11. 内嵌已知坑（从项目记忆拉取）

| 坑 | 技术栈指纹 | 根因 | 修法 |
|----|------------|------|------|
| React #130 | Icon REGISTRY | 未注册图标 `REGISTRY[name]=undefined` → 渲染 undefined 组件崩溃 | 所有图标登记 REGISTRY；`Icon.tsx:228` 已有降级 null 兜底 |
| React #310 | hooks 顺序 | 条件调用 hook → "rendered more hooks than previous render" | `useProgress` 及 EngineLayout 顶部无条件调用全部 hook |
| woff2 EPERM | vite build | Windows 覆盖写字体被拒 | 字体放 `public/fonts` 一次性复制，构建不回写 |
| 生产域沙箱 | workers.dev | 客户端重定向依赖 SPA 启动 | Worker 301 兜底；`wrangler deployments status` 验证 |

## 12. 端到端验证步骤（Spec 锁定最后一项）

```bash
# 1. 前端构建（注意 woff2 EPERM：字体已在 public/fonts，构建不回写）
cd E:/mes-learning-platform/web && npm run build

# 2. 部署
cd E:/mes-learning-platform && npx wrangler deploy

# 3. 部署验证（100% 流量）
npx wrangler deployments status

# 4. 边缘 301 验证
curl -I https://<domain>/roadmap?role=mes-impl
# 断言：HTTP/1.1 301 + Location: /engine?tab=career&role=mes-impl

# 5. 进度单一源验证（手动/自动化）
# 完成 1 章后断言 侧栏/概览/课程/路径/个人中心 五处百分比全等

# 6. emoji 回归防护
grep -rn "🔒" E:/mes-learning-platform/web/src
# 断言：无输出（全仓无功能性 emoji）
```

## 13. 变更记录

| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-08-04 | 生成 Spec v1 | 基于三文档（PRD/架构/设计）确认 | 全导航重构 |
| 2026-08-04 | ETA 决策去掉 | 用户确认主轴不显示预计完成时间 | nextCourse 主轴展示 |
| 2026-08-04 | store hook 命名统一为 `useProgress.ts` | 裁定 PM/架构/设计命名不一致 | 架构 §4.2、PRD §9 同步 |
