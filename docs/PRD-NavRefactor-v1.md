# PRD · MES 实训平台导航级重构（Navigation Refactor）

> 版本：v1　|　作者：产品经理 许清楚　|　日期：2026-08-04
> 关联决策：/roadmap 旧链 301 重定向、首页降级、职业 Tab 复用 RoadmapPage、nextCourse 仅概览主轴、进度单一数据源
> 设计约束：遵守 P0 五条红线（禁 emoji 图标 / 禁紫粉渐变 / 禁硬编码色值 / 禁弹跳缓动 / 禁千篇一律 Hero）；UI 全走 `web/src/components/Icon.tsx` 的 lucide REGISTRY；设计变量一律用 `var(--token)`，单文件 ≤300 行。

---

## 1. 目标用户画像

**主要用户（MES 实施 / 运维实训学员）**
- 身份：制造业信息化从业者、MES/ERP 实施顾问、工厂 IT/运维、相关在校生。
- 场景：利用碎片时间在浏览器里系统学 MES 业务（工单/BOM/报工/质量/追溯）+ 浏览器端 SQL 实训；目标是"学完能上岗 / 能排障"。
- 技术水平：懂业务、会用电脑，但不是前端用户；对"导航里好多入口先点哪个"没有耐心。
- 痛点：当前顶层有 首页 / 学习 / 课程体系 / 学习路径 / 职业路径 5 个相关入口，落地后不知道"下一步学什么"，且同一份进度在侧栏、首页、个人中心三处数字还不一致。

**次要用户（培训组织者 / 招聘方）**
- 通过"职业路径"对照岗位能力线评估学员差距，需要 career→课程 的反向可达性（点开岗位要求 → 直接去学对应课）。

---

## 2. 核心问题陈述

学员打开平台，面对**五个高度重叠的学习入口**（首页仪表盘、学习、课程体系、学习路径、职业路径），却找不到"我现在该学什么"的单一主轴；同时**同一份进度数据被三套独立逻辑分别计算**（侧栏 `SidebarProgress`、首页 `ProgressDashboard`、个人中心 `ProfilePage`），导致"总进度 %"在不同页面出现不同数字，信任度下降。

现状证据（已读代码）：
- 入口冗余：
  - `web/src/App.tsx:37` 路由 `/`（首页仪表盘）
  - `web/src/App.tsx:49` 路由 `/engine`（学习）
  - `web/src/App.tsx:38` 路由 `/courses`（课程体系）
  - `web/src/App.tsx:41` 路由 `/learning-paths`（学习路径）
  - `web/src/App.tsx:42` 路由 `/roadmap`（职业路径）
  - `web/src/components/AppShell.tsx:153` 侧栏"成长"组还有独立的 `职业路径` 入口
  - `web/src/pages/EnginePage.tsx:134-143` 学习页内又塞了"课程体系 / 学习路径 / 职业路径"三个文字链接——同一份内容被第 4 次暴露
- 进度三实现：
  - `web/src/components/AppShell.tsx:20-52` `SidebarProgress`：用 `api.progress`+`api.topics`+`api.chapters` 现算 `doneChapters/totalChapters/pct`
  - `web/src/components/ProgressDashboard.tsx:96-419`（整文件）`ProgressDashboard`：用 `api.learningPaths`+`api.topics`+`api.chapters`+`api.progress` 算 `globalPct/pathStats/nextStep/plan`
  - `web/src/pages/ProfilePage.tsx:53-102`：用 `api.progress`+`api.topics`+`api.chapters` 算 `doneChapters/pct/moduleStats/level/streak`

**三处实现的关键不一致**（必改项）：
1. `SidebarProgress` 与 `ProfilePage` 遍历**全部 topics**（含 roadmap 专题 `id>=5000`），而 `CoursesPage.tsx:168` 显式排除 `id>=5000`，`ProgressDashboard` 用 `learningPaths` 的 topicIds——三者"总进度"分母不同，数字天然对不上。
2. 锁定态图标用了 emoji：见第 6 节 P0 违规。

---

## 3. 现有导航四入口冗余位置（精确）

| 当前入口 | 文件 / 行号 | 对应新「学习」四视图 |
|---|---|---|
| 首页仪表盘（GreetingBar+ProgressDashboard+…） | `HomePage.tsx:13-18`（`web/src/pages/HomePage.tsx`） | → 概览 |
| 学习（路径选择器+nextCourse+课程列表） | `EnginePage.tsx:64-387` | → 概览（nextCourse 主轴）+ 路径能力基底 |
| 课程体系（Bloom 分层 topic 卡） | `CoursesPage.tsx:85-226` | → 课程 |
| 学习路径（path 面板+阶段步骤） | `LearningPathsPage.tsx:8-189` | → 路径 |
| 职业路径（岗位矩阵/阶梯） | `RoadmapPage.tsx:22-169` + `web/src/features/roadmap/*` | → 职业 |

收敛动作：
- 删除 `AppShell.tsx:150-158` 的"成长"组 `/roadmap` 独立项；侧栏保留 `首页` + `学习` 两项入口（首页在 P1 降级/合并）。
- 删除 `EnginePage.tsx:134-143` 的三个文字链接（由四视图分段控制器取代）。
- `App.tsx:42` 的 `/roadmap` 路由改为 301 重定向（见第 8 节）。

---

## 4. 三份进度实现差异与统一目标

| 实现 | 数据来源（queryKey） | 计算产物 | 计数的 topic 范围 |
|---|---|---|---|
| `SidebarProgress`（`AppShell.tsx:20-52`） | `['progress']` `['topics']` `['chapters',id]` | `doneChapters/totalChapters/pct` | 全部 topics（含 `id>=5000`） |
| `ProgressDashboard`（`ProgressDashboard.tsx`） | `['learning-paths']` `['topics']` `['chapters',id]` `['progress']` | `globalPct/pathStats/nextStep/plan` | `learningPaths.topicIds` |
| `ProfilePage`（`ProfilePage.tsx:53-102`） | `['progress']` `['topics']` `['chapters',id]` | `doneChapters/pct/moduleStats/level/streak` | 全部 topics（含 `id>=5000`） |

**统一目标**：三处共用同一份派生结果，且"总进度"分母统一定义为**课程 topics（排除 `id>=5000` 的 roadmap 专题）**，与 `CoursesPage` 口径一致。roadmap 专题章节进度由职业视图的服务端接口单独呈现，不混入"课程总进度"。

---

## 5. 四视图信息架构（「学习」页内分段控制器）

`/engine` 渲染一个 `EngineLayout`：顶部**分段控制器**（概览 / 课程 / 路径 / 职业）+ 下方当前视图。`?tab=` 驱动激活视图（默认无 tab = 概览；`?tab=career` 承接重定向）。四个视图**复用现有页面组件作为子视图**，不重写。

| 视图 | 复用组件 | 承载内容 | 读取的进度切面 |
|---|---|---|---|
| 概览 Overview | `HomePage` 现有（`GreetingBar`+`HomeStudyInfo`+`ProgressDashboard`+`HomeLearningPaths`），抽为 `OverviewView` | **nextCourse 主轴（仅此处）** + 总进度环 + 各路径摘要卡 + 快速跳转到其余三视图 | `nextStep` + `globalPct` + `pathStats` 摘要 |
| 课程 Courses | `CoursesPage` → `CoursesView` | Bloom 分层 topic 卡、课程进度、各章状态 | `moduleStats`（course topics，排除 `id>=5000`） |
| 路径 Paths | `LearningPathsPage` → `PathsView` | 各学习路径面板、阶段步骤、课程清单、解锁逻辑 | `pathStats`（按 `learningPaths`） |
| 职业 Career | `RoadmapPage`（`RoleSelector`+`RoadmapMatrix`/`RoadmapStair`+`CareerAside`）→ `CareerView` | 岗位能力矩阵/阶梯 + 岗位画像 + **career→topic 反向链接** | roadmapApi 服务端进度（`summary.percent`/节点 `progress.state`） |

约束：
- `nextCourse` 主轴**只在概览顶部出现一次**（`EnginePage.tsx:196-239` 的 nextCourse 区块上移为概览专属；课程/路径/职业视图不重复）。
- 每段视图文件 ≤300 行；当前 `EnginePage.tsx` 共 387 行（已超 P0 红线），本重构将其拆分为 `EngineLayout` + 4 个 View 文件，**顺带满足单文件 ≤300 行**。

---

## 6. P0 红线违规发现（必须随重构一并修复）

代码现状违反"禁 emoji 作功能图标"（ADR-002 / `Icon.tsx:4-9`）：
- `web/src/pages/EnginePage.tsx:230` `` 🔒 需先完成：{…} ``
- `web/src/pages/EnginePage.tsx:256` `` · 🔒 未解锁 ``
- `web/src/pages/EnginePage.tsx:342` `` <span …>🔒</span> ``

而 `Icon.tsx` REGISTRY（第 97-202 行）**未注册 `lock`**。修复方案：
1. 在 `Icon.tsx` REGISTRY 增加 `lock: Lock`（lucide-react@1.28.0 含 `Lock`；如需"已解锁"配 `lock-open: LockOpen`）。
2. 上述三处 emoji 替换为 `<Icon name="lock" size={16} />`（锁定原因文案保留）。
3. 全仓 grep 确认再无功能性 emoji（装饰性除外，但本平台约定零 emoji）。

**verdict 关联**：此项为 P0 合规硬门槛，未修复 = 整批退回。

---

## 7. MVP 范围表（P0 / P1，含验收标准摘要 + RICE）

RICE = (Reach × Impact × Confidence) / Effort。Reach 1-10（每季度受影响用户比例），Impact 0.25/0.5/1/2/3，Confidence 50%/80%/100%，Effort 1-10（人月）。

| # | 功能 | 优先级 | 验收标准摘要 | Reach | Impact | Conf | Effort | Score | MVP |
|---|---|---|---|---|---|---|---|---|---|
| F1 | 外层导航收敛为「学习」单入口 + 默认着陆 `/engine` | P0 | 侧栏仅保留"首页/学习"；"成长→职业路径"项删除；App 默认进 `/engine` | 10 | 3 | 100% | 5 | 6.0 | ✅ |
| F2 | `/roadmap` → `/engine?tab=career` 301 重定向 | P0 | Worker 层 301（书签/外链直达）+ SPA `<Navigate replace>`；旧链不 404 | 8 | 2 | 100% | 1 | 16.0 | ✅ |
| F3 | 「学习」页四视图分段控制器 | P0 | 概览/课程/路径/职业 切换即时；`?tab=` 可深链；每段 ≤300 行 | 10 | 3 | 80% | 8 | 3.0 | ✅ |
| F4 | 职业视图复用 RoadmapPage 组件为「职业」Tab | P0 | `CareerView` 挂载 `RoleSelector`+矩阵/阶梯+`CareerAside`，交互与现 `/roadmap` 一致 | 8 | 2 | 80% | 5 | 2.56 | ✅ |
| F5 | nextCourse 主轴仅置于概览顶部 | P0 | 概览顶部有且仅有 1 个 nextCourse；其余三视图不含 nextCourse 区块 | 10 | 2 | 100% | 2 | 10.0 | ✅ |
| F6 | 统一进度 store（替换三份实现） | P0 | `useLearningProgress()` 一处派生；侧栏/概览/课程/路径/个人中心数字全等；分母统一为 course topics | 10 | 3 | 80% | 8 | 3.0 | ✅ |
| F7 | career→topic 反向链接 + 课程/路径→职业 闭环 | P0 | 职业节点可跳课程/路径；课程/路径页"相关岗位"跳 `/engine?tab=career&role=` | 7 | 2 | 80% | 4 | 2.8 | ✅ |
| F8 | 修复 emoji 锁图标违规（F6 同批） | P0 | `Icon.tsx` 注册 `lock`；`EnginePage` 三处 emoji 清除；全仓无功能性 emoji | 10 | 0.5 | 100% | 1 | 5.0 | ✅ |
| F9 | 首页降级为轻量欢迎页/合并进学习 | P1 | 首页仅欢迎语+进度概览入口；或合并至概览视图 | 6 | 1 | 80% | 3 | 1.6 | ⬜ |
| F10 | 移动端 TabBar 同步 | P1 | 移除首页/roadmap 独立项，主入口为"学习"；保留 SQL/工厂/我的 | 7 | 1 | 80% | 2 | 2.8 | ⬜ |
| F11 | 进度/导航埋点 | P1 | 上报 nextCourse 点击、tab 切换、反向链接点击、概览着陆 | 5 | 1 | 80% | 2 | 2.0 | ⬜ |

**MVP 构建集合 = F1~F8（全部 P0）**。P1 视首版验证后再排。

---

## 8. 重定向规则描述（`/roadmap` → `/engine?tab=career`）

目标：兼容已有书签、外链、搜索引擎收录；用户在站内任何指向 `/roadmap` 的链接都无缝落到「学习·职业」视图。

实现三层（缺一不可）：
1. **Worker 层 301（真重定向，针对直接 URL 命中/书签/外链）**：在 `worker` 路由或 `wrangler.toml` 静态资源重定向规则中，对 `/roadmap` 及 `/roadmap?role=xxx` 返回 `301` 到 `/engine?tab=career&role=xxx`（保留 `role` 查询参数）。
2. **SPA 兜底**：`App.tsx:42` 的 `<Route path="/roadmap" …>` 改为渲染 `<Navigate to="/engine?tab=career" replace />`（保留 query），防止 Worker 重定向未覆盖时的客户端兜底。
3. **代码内链接替换**：
   - `AppShell.tsx:153` 删除"职业路径"独立项（入口收进「学习」）。
   - `EnginePage.tsx:140-142` 三文字链接改指 `/engine?tab=courses|paths|career`（或分段控制器自身）。
   - `TrackDetailPage.tsx:172` `relatedCareers` 链接 `to="/roadmap?role=…"` → 改为 `to="/engine?tab=career&role=…"`（反向闭环落点修正）。
   - `RoadmapPage.tsx:142` 空态 `to="/tracks/mes"` 保留（track 详情仍存在）。

验收（Given/When/Then）：
- Given 用户浏览器书签为 `https://域名/roadmap?role=mes-impl`，When 直接访问，Then HTTP 301 且地址栏落到 `/engine?tab=career&role=mes-impl`，职业视图选中该岗位。
- Given 站内任意"职业路径"链接，When 点击，Then 不出现 404，落地「学习·职业」且 `role` 保留。

---

## 9. store 统一方案（单一进度数据源替换三份实现）

**原则**：不新增后端端点、不引入状态管理库（Zustand/Redux）。进度真相已是 `api.progress`（`completedChapterIds`/`passedExerciseIds`/`events`）+ `api.topics` + `api.chapters(id)`，TanStack Query 已按 `queryKey` 去重——问题在于**派生逻辑散落三处**。统一 = 把派生收进**一个自定义 hook**。

**新增文件**：`web/src/features/progress/useLearningProgress.ts`
- 内部调用既有 `useQuery`：`['progress']`、`['topics']`、`['chapters', id]`（queryKey 不变 → 零新增网络请求）。
- 导出单一派生对象（选择器按需取）：
  ```
  {
    completedSet,                 // Set<string>
    doneChapters, totalChapters,  // 仅 course topics（排除 id>=5000）
    globalPct,                    // 课程总进度
    moduleStats,                  // Map<topicId,{done,total,pct}>（course topics）
    pathStats,                    // 按 learningPaths：[{path,done,total,pct}]
    nextStep,                     // 下一章/下一课（沿用 ProgressDashboard 推算）
    plan,                         // ETA（沿用 ProgressDashboard 节奏估算）
    streak, level                 // 沿用 ProfilePage 计算
  }
  ```
- 关键口径：分母 = `topics` 中 `id < 5000` 的课程专题（与 `CoursesPage.tsx:168` 一致）。roadmap 专题（`id>=5000`）章节**不计入** globalPct/moduleStats，改由职业视图的服务端 `summary.percent` 呈现。

**三处实现改造**（仅替换数据源，UI 不动或微调）：
- `SidebarProgress`（`AppShell.tsx:20-52`）：删掉本地 `useQueries`+`useMemo`，改 `const { doneChapters, totalChapters, pct } = useLearningProgress()`。CTA 链接保持 `/courses`。
- `ProgressDashboard`（`ProgressDashboard.tsx`）：`pathStats/globalPct/nextStep/plan` 改从 hook 取；该组件整体作为「概览」视图内容。
- `ProfilePage`（`ProfilePage.tsx:53-102`）：`moduleStats/doneChapters/streak/level` 改从 hook 取。

**四视图接入**：概览读 `nextStep+globalPct+pathStats` 摘要；课程读 `moduleStats`；路径读 `pathStats`；职业读 roadmapApi（独立服务端进度，详见第 5/10 节）。四视图 = 同一份进度的不同切面，数字天然一致。

**一致性验收**：
- Given 学员在「课程」完成 1 章，When 切到「概览/路径/个人中心/侧栏」，Then 五处百分比完全相等（同一分母）。
- Given 平台含 roadmap 专题（id>=5000），When 计算"课程总进度"，Then 该专题章节不计入（与 `CoursesPage` 口径一致）。

---

## 10. 职业视图复用与 career→topic 反向链接（学习闭环）

**复用**（零重写）：`CareerView` 直接挂载 `RoadmapPage` 已有组件——
- `web/src/features/roadmap/RoleSelector.tsx`（岗位选择，WAI-ARIA Tabs，保留）
- `web/src/features/roadmap/RoadmapMatrix.tsx` + `RoadmapStair.tsx`（桌面矩阵 / 移动阶梯）
- `web/src/features/roadmap/CareerAside.tsx`（岗位画像）
- `web/src/features/roadmap/roadmapLayout.ts` `buildMatrix`（纯函数，复用）
- 数据：`roadmapApi.careers/graph/career`（`web/src/api/roadmap.ts`）——职业进度为**服务端按 `completedChapterIds` 计算**，天然与课程进度同源，无需前端再聚合。

**career→topic 反向链接（形成闭环）**：
- 现有 `RoadmapNode.tsx:95` 链接到 `/tracks/:slug#level-lN`（track 详情）。track 详情 `TrackDetailPage` 的 `levels[].chapters[].topicId`（`api/roadmap.ts:53-59` 的 `TrackChapter.topicId`）即对应课程。
- 在「职业」视图，每个能力节点提供显式行动：**"去学这门课"** 链接到 `/engine?tab=courses&topic=:topicId`（或 `/courses/:topicId`），以及 **"看学习路径"** 链接到 `/engine?tab=paths`。
- 反向：`TrackDetailPage.tsx:172` 的 `relatedCareers`（UIUX-CareerRoadmap-v1 §6.2 已定义"哪些岗位需要这条线"）链接目标由 `/roadmap?role=` 改为 `/engine?tab=career&role=`（见第 8 节）。
- 闭环：职业视图看岗位要求 → 跳课程/路径学习 → 进度更新 → 回到职业视图节点显示"已完成"。

验收：
- Given 职业视图某 L3 节点，When 点击"去学这门课"，Then 跳到对应课程详情且进度上下文保留。
- Given 课程详情页 `relatedCareers`，When 点击岗位，Then 落到 `/engine?tab=career&role=` 且选中该岗位。

---

## 11. 竞品对标（联网调研，2 个）

- **Duolingo（2022 主页重构，blog.duolingo.com / cnet 评测）**：把分散的"技能树/故事/贴士"折叠进**单一引导路径**；首页只保留一个主轴 **Continue / Jump Here**；用**一条连续进度环**替代多份进度。→ 印证本方案："学习"单入口 + nextCourse 唯一主轴 + 四视图共享一份进度。
- **Coursera（My Courses / My Learning 仪表盘，pcmag 评测）**：落地即"Continue Learning"按钮 + 已报名课程卡；但 PCMag 指出其仪表盘**并非每页可达**（"should be more prominently linked"）。→ 反面教训：我们用「学习」常驻单入口 + career→课程 反向链接，确保进度/下一步**任何视图都可触达**，避免 Coursera 的可达性短板。

---

## 12. 明确不做清单（Out-of-Scope）

| 条目 | 原因 | 何时考虑 |
|---|---|---|
| 新增后端进度聚合端点 | 真相已在 `api.progress+topics+chapters`，前端聚合即可；新增端点动 D1 预算与后端风险 | 需全站排行/服务端指标时 |
| 首页完全删除 | 仅降级合并为 P1；保留轻量欢迎页成本低、不阻断主流程 | 下迭代确认「学习」页可完整承接欢迎信息后 |
| 职业视图重写（不复用 RoadmapPage） | 矩阵/阶梯/角色选择器已成熟（QA 验收 PASS），重写是负资产 | 永不（除非 roadmap 数据模型大改） |
| 移动端底栏大改 | 当前 5 项已含"学习"；仅同步入口（F10）即可 | 若「学习」页内 tab 需独立移动导航 |
| 多语言 / i18n | 当前仅中文受众 | 海外推广时 |
| 社交/排行/证书体系 | 超出导航重构范围 | 专门立项 |
| 网站↔脑库 双向同步 | 已知独立立项（PRD-KnowledgeRestructure-v1 §L3） | 冲突解决机制立项后 |
| 引入 Zustand/Redux 等状态库 | TanStack Query 已按 key 去重，统一 store = 一个 hook，新依赖违反"零成本/最小依赖"基调 | 需跨路由写状态时 |

---

## 13. 边界条件

- **空状态**：无学习路径（`engineStatus.paths` 空）→ 概览显示"还没有学习路径"空态（沿用 `EnginePage.tsx:113-115`）；无职业路径 → 职业视图显示"还没有配置岗位路径"（沿用 `RoadmapPage.tsx:73-84`）。
- **进度接口过期/未登录**：`ProgressDashboard.tsx:239-243` 已处理"会话失效降级 0 进度不整页报错"，统一 hook 须保留该降级语义。
- **窄屏**：职业视图 `useIsNarrow()` 切换矩阵/阶梯（沿用）；分段控制器在移动端横向滚动或转为下拉，不换行挤压。
- **重定向参数保留**：`/roadmap?role=xxx` 301 必须带上 `role`，否则职业视图丢失岗位选中。
- **emoji 回归防护**：CI/MR 模板增加"禁功能性 emoji"检查（承接 ADR-002）。

---

## 14. 非功能需求

| 类别 | 要求 | 优先级 |
|---|---|---|
| 性能 | 四视图切换本地即时（数据源已缓存）；首屏「学习」≤ 同现状；不新增阻塞请求 | P0 |
| 一致性 | 五处进度数字全等（同一 hook 派生） | P0 |
| 可访问性 | 分段控制器用 `role="tablist"`/`tab`/`tabpanel`（参考 `RoleSelector`）；图标走 `Icon` 带 `aria-hidden`；锁态用 `Icon name="lock"` 非 emoji | P0 |
| 视觉 | 禁紫粉渐变、禁硬编码 hex（一律 `var(--token)`）、禁弹跳缓动；图标尺寸 16/20/24 三档 | P0 |
| 兼容性 | Chrome/Safari/Firefox 最新 2 版 + iOS/Android 微信最新版；移动端底栏保留 SQL/工厂/我的 | P1 |
| 埋点 | F11：nextCourse 点击、tab 切换、反向链接点击、概览着陆（`trackEvent` 封装，禁上报隐私字段） | P1 |
| 可维护性 | 每个 View 文件 ≤300 行；图标仅经 `Icon.tsx` REGISTRY | P0 |

---

## 15. 验收总结（Given/When/Then 关键项）

1. **导航收敛**：Given 任意学员，When 打开平台，Then 默认落 `/engine`，侧栏无独立"职业路径"项，学习页顶部为四视图分段控制器。
2. **重定向**：Given 访问 `/roadmap?role=mes-impl`，When 加载，Then 301 到 `/engine?tab=career&role=mes-impl` 且职业视图选中该岗位。
3. **nextCourse 唯一主轴**：Given 进入「学习」，When 看概览，Then 顶部有且仅有一个 nextCourse；切到课程/路径/职业，Then 无 nextCourse 区块。
4. **进度单一源**：Given 在课程完成 1 章，When 切任意视图/侧栏/个人中心，Then 五处百分比全等，分母均为 course topics（排除 id>=5000）。
5. **职业复用+闭环**：Given 职业视图某节点，When 点"去学这门课"，Then 跳对应课程；Given 课程页相关岗位，When 点击，Then 落 `/engine?tab=career&role=`。
6. **P0 图标合规**：Given 全仓检索，When 查功能性 emoji，Then `EnginePage` 三处 🔒 已替换为 `Icon name="lock"`，无功能性 emoji 残留。

---

> 结论：**verdict = pass**。PRD 已基于真实代码（见 evidence）完成需求挖掘、竞品对标、范围与验收定义；P0 红线（含发现的 emoji 违规）已明确为硬门槛。建议直接进入架构设计（store hook 落点 + EngineLayout 拆分），设计师同步确认分段控制器与职业视图在「学习」容器内的视觉归属。
