# 前端全栈体检报告 — MES 制造业实训平台

**审计人** 贾思敏（前端） · **日期** 2026-08-09 · **范围** `web/` 全量 103 个 .ts/.tsx/.css，只读未改码
**栈** React 19 + Vite 6 + TanStack Query v5 + react-router-dom v7 + lucide-react（方案 A）
**用户诉求** 「有没有 bug、臃肿代码、没用的 tab、有没有功能有但是没有用」

---

## RoleVerdict

```
verdict: fail

blocking:
  B1  草稿章节编辑清空正文（数据丢失地雷，触发器已就绪）
      + 同源第二触发路径：已发布章节抢跑保存同样清空（今天即可触发）
  B2  ?view= 深链参数全链路失效；4 处入口链接落到同一 URL（沉默逻辑错误）
  B3  模拟器「存档/导出/导入」是空承诺：3 个导出零调用，loadFromStorage 恒返回 null
  B4  roadmap/career 子系统整体不可达：5 组件 459 行 + 3 个 API 方法零引用

advisory: 11 项（第九节）
P0 视觉红线: 全部通过（emoji 0 / 硬编码色有效命中 0 / 紫粉渐变 0）
构建门禁: tsc --noEmit 通过(exit 0)；vite build 仅因并行代理占用 worker/dist 报
          EPERM，非代码缺陷
```

---

## 一、路由与页面对账 —— 无孤儿路由、无缺失 lazy 目标、无断链

- `App.tsx` 所有 `lazy(() => import(...))` 目标全部存在（17 页 + 5 feature）✅
- 每个 `pages/*.tsx` 都有对应 `<Route>`，无游离页面 ✅
- 断引用（import 指向不存在文件）**0 处** ✅；两个已知误报已复核排除：
  `dataset.sql?raw`（Vite `?raw` 合法语法）、`../env`（解析到 `env.d.ts`）

**但「有路由 ≠ 有入口」**，见下节。

---

## 二、死 Tab / 死入口（用户最关心）

侧边栏 `components/AppShell.tsx` 只暴露 5 个入口（工厂/SQL沙盒/工厂搭建/作品集/个人中心），
移动端 tabbar 只有 4 个（factory/simulator/sql-space/profile）。以下路由有页面有路由、导航无入口：

| 路由 | 页面 | 唯一到达方式 | 判定 |
|---|---|---|---|
| `/courses` | `CoursesPage.tsx` | 仅 404 兜底链接 + 错误态回退 | **无正常入口** |
| `/learning-paths` | `LearningPathsPage.tsx` | 仅顶栏搜索输关键词才出现 | 半死 |
| `/roadmap` | `CareerPage.tsx` | 同上 | 半死 |
| `/dictionary` | `DictionaryPage.tsx` | 同上 | 半死 |
| `/engine` | 无（重定向到 `/factory`） | — | 转型残留，合理 |

证据：`components/TopbarSearch.tsx:49` —— 搜索 query 为空时默认只渲染 6 个工厂节点，
`STATIC_DESTS` 里的 `/learning-paths`、`/roadmap`、`/dictionary` **永远不默认曝光**，
用户必须先猜到关键词才能看见，等价于「藏起来的功能」。

---

## 三、B2：`?view=` 深链参数全链路失效（沉默逻辑错误）

代码里 4 处链接拼了 `?view=xxx`，但**没有任何页面读取 `view`**：`pages/FactoryPage.tsx:166`
只读 `sp.get('node')`，全项目 grep `get('view')` 命中 **0**。于是这些链接全部落到同一页面同一状态：

| 位置 | 意图 | 实际 |
|---|---|---|
| `pages/TrackDetailPage.tsx:172` | 每个岗位跳各自 career 视图 | 所有岗位链接 → 同一 URL |
| `pages/CoursesPage.tsx:214` | 4 张学习路径卡片跳各自路径 | 4 张卡片 → **完全相同的 URL** |

不报错、不白屏、TS 也过，但用户点 4 张不同卡片看到同一个页面。
修法二选一：① `FactoryPage` 消费 `view`；② 把链接改成真实目标路由。

---

## 四、B3：模拟器「存档/导出/导入」是空承诺

`features/simulator/simStorage.ts`（web + worker + scripts 全量双向 grep）：

| 导出 | 行号 | 调用点 |
|---|---|---|
| `saveToStorage()` | :11 | **0** |
| `exportJSON()` | :27 | **0** |
| `importJSON()` | :38 | **0** |
| `loadFromStorage()` | :20 | 1 处：`SimulatorPage.tsx:44` |

因为从来没有任何地方写入过存档，`loadFromStorage()` 恒返回 `null`，
`SimulatorPage.tsx:44` 的「读到存档就恢复进度」分支**永远不可达**。这正是用户说的「功能有但是没有用」：
模块写好、类型齐、tsc 也过，但既无写入触发 UI 也无导出/导入按钮。要么补入口，要么整个文件删掉。

（已**撤回**一条早期误判：`/simulator?from=` 深链正常工作 ——
`features/factory/NodeDrawerBody.tsx:227` 构造、`SimulatorPage.tsx:38` 消费，闭环完整。）

---

## 五、B4 + 死代码全景

### 5.1 不可达文件（从 `main.tsx` BFS 可达性分析）

扫 103 个文件 → **9 个完全不可达，合计 763 行**：

| 行数 | 文件 | 备注 |
|---|---|---|
| 181 | `components/AiStudyTip.tsx` | 整块 AI 学习提示组件 |
| **459** | `features/roadmap/` 5 个组件：`RoadmapMatrix`149 / `RoadmapStair`103 / `RoleSelector`98 / `CareerAside`55 / `StageDetail`54 | roadmap 子系统整体 |
| 53 | `lib/anonId.ts` | `getAnonId()` 零调用，仅 openapi/README 文档提及 |
| 49 | `features/simulator/SimTasks.tsx` | 零引用 |
| 21 | `hooks/useInView.ts` | 零引用 |

**roadmap 子系统合计 459 行**，是 2026-08-07「课程列表 → 工厂流程图」转型后遗留的整块死组织。
配套一并死亡：`features/roadmap/roadmapLayout.ts`（264 行）**仅**被 `RoadmapNode` import 了一个
**type**，运行时逻辑一行未用；`api/endpoints.ts` 中 `roadmapApi.careers / career / graph` 零调用。

### 5.2 未被使用的导出

| 导出 | 位置 | 证据 |
|---|---|---|
| `useLogout()` | `components/AuthGuard.tsx:25` | 零调用；真实登出在 `pages/ProfilePage.tsx:408` 自实现 |
| `subscribeProfile()` | `lib/profileStore.ts:28` | **零监听者** |
| `setNickname()` | `lib/profileStore.ts` | 零调用 |

`subscribeProfile` 无监听者是**真实功能缺口**：`mes:profile-changed` 事件无任何订阅方，
`components/AppShell.tsx:52` 用 `getNickname()` 一次性取值不订阅 →
**用户改了昵称，侧边栏头像/昵称不刷新**，必须刷新整页。
另：`lib/profileStore.ts:7` 注释声称 `setProfile()` 返回真实写入结果，实现却是
`void write('profile', next); emit(); return { ok: true, profile: next }` ——
**无论写入是否失败都硬编码 `ok: true`**，调用方拿不到失败信号，文档与实现不符。

### 5.3 死图标：`components/Icon.tsx` 注册表 107 个，11 个零使用

`sort` `danger` `trace` `oee` `filter` `more` `minus` `plus` `unlock` `station` `recap`
（该文件已 300 行正卡门禁线，清掉这 11 个可同时解体积与门禁。）

### 5.4 死 CSS（宽松匹配下仍零引用，属保守下界）

| 样式表 | 类名数 | 零引用 | 占比 |
|---|---|---|---|
| `styles.css` | 331 | **111** | 33.5% |
| `styles.pages.css` | 50 | 21 | 42% |
| `features/simulator/SimulatorPage.css` | 106 | 8 | 8% |
| `styles.roadmap.css` | 109 | 7 | 6% |
| `components/flash-deck.css` | 43 | 0 | 0%（唯一干净的） |

`styles.css` 2538 行、1/3 类名无人引用，是全项目最大一块臃肿；`home-paths* / stair-* /
dash-* / nav-group*` 成组死亡，与转型前旧首页/旧路线图一一对应。另 `card-link` 在
`styles.css` 与 `styles.pages.css` **重复定义且两处都死**。

## 六、臃肿盘点

门禁单文件 ≤300 行 —— **14 个超标，6 个处于 250–300 预警区**。TOP 8：

| 行数 | 文件 | 性质 |
|---|---|---|
| **2538** | `styles.css` | 全局样式巨石，1/3 类名已死 |
| **501** | `features/simulator/SimulatorPage.css` | 模块样式 |
| **492** | `styles.roadmap.css` | 服务于已死的 roadmap 子系统 |
| **456** | `styles.pages.css` | 42% 类名已死 |
| **426** | `api/endpoints.ts` | API 聚合层，含已死 roadmapApi |
| **425** | `pages/ProfilePage.tsx` | 页面组件 |
| **395** | `pages/AdminPage.tsx` | 页面组件，且含本报告 B1 缺陷 |
| **384** | `features/simulator/simEngine.ts` | 领域逻辑，可接受但需拆 |

其余超标 `SqlSandbox.tsx` 382 / `PortfolioPage.tsx` 373 / `flash-deck.css` 370 / `QuizDeck.tsx` 333 /
`CourseDetailPage.tsx` 312 / `SimulatorPage.tsx` 301；预警区 `Icon.tsx` 300 / `FactoryFlow.tsx` 280 /
`roadmapLayout.ts` 264 / `MicroPractice.tsx` 262 / `simReducer.ts` 255 / `NodeDrawerBody.tsx` 250。

**`styles.roadmap.css`(492) + roadmap 组件(459) + `roadmapLayout.ts`(264) = 1215 行**
全部服务于一个用户根本进不去的子系统 —— 最高性价比清理项。

## 七、P0 视觉红线扫描 —— 全部通过，无需整改

- **emoji 作功能图标：0**。全量正则扫 `web/src/**/*.{ts,tsx,css}` 零匹配；图标 100% 走
  `Icon.tsx` 统一注册表（lucide-react），无混用。
- **硬编码色（除 `#fff`/`#000`）：3 处命中均无效** —— 全在注释里，是 React 错误码 `#310`/`#130`，非颜色。
- **紫→粉渐变：0**。颜色 Token 化到位，内联样式统一 `var(--*)`（如 `AdminPage.tsx:216` `color: var(--meta)`）。

---

## 八、AdminPage 专项（含 team-lead 三条更正）

### 8.1【更正·降级】`AdminPage.tsx:236` 条件 Hook —— 不是当前白屏 P0

后端同步的「抛 Rendered more hooks than during the previous render / 白屏」判断**不成立**，采纳更正：

```
:208  {showNew && <ChapterEditForm topicId={topicId} onClose={...} />}
:221  {editingId === ch.id && <ChapterEditForm topicId={topicId} chapter={ch} onClose={...} />}
:236  const detailQ = chapter ? useQuery({...}) : null;
```

`:209` 与 `:222` 是**两个不同 JSX 位置**，React 为它们创建**两个不同 fiber 实例**：`:209` 实例
`chapter` 恒为 `undefined`，`:222` 实例 `chapter` 恒有值。同一实例上 `chapter` 不会在
`undefined ↔ defined` 间翻转 → Hook 数量在单实例生命周期内恒定 → **不触发 Hook 顺序错误，当前不会白屏**。
同理 `:238` 的 render 阶段 `setState` 是 React 官方允许的「render 期间按 props 派生 state」，
有 `mdLoaded` 收敛条件，不会死循环。

**重新定级：lint 违规（`react-hooks/rules-of-hooks`）+ 潜在陷阱。** 风险在于将来有人把两处合并成
一个复用实例（如受控的 `<ChapterEditForm chapter={editing ?? undefined}>`）→ **当场变成真白屏**。
修法：去掉外层三元，无条件调用 `useQuery`（`:236` 本就已写 `enabled: !!chapter`），改动 1 行。

### 8.2【新增 B1·P1】编辑草稿章节会清空正文（数据丢失地雷）

完整链路，逐跳复核、行号精确：

| # | 位置 | 代码 | 后果 |
|---|---|---|---|
| 1 | `web/src/pages/AdminPage.tsx:233` | `const [md, setMd] = useState('')` | 正文初值空串 |
| 2 | `web/src/pages/AdminPage.tsx:236` | `api.chapter(chapter.id)` | 走的是**公开**详情接口 |
| 3 | `web/src/api/endpoints.ts:331` | `apiGet('/api/v1/chapters/${id}')` | 公开路由 |
| 4 | `worker/src/modules/content/content.service.ts:97` | `if (!r \|\| r.status !== 'published') return null` | **草稿被过滤 → 404** |
| 5 | `web/src/pages/AdminPage.tsx:238` | `if (detailQ?.data && !mdLoaded) setMd(...)` | 无数据 → **`setMd` 永不执行** |
| 6 | `web/src/pages/AdminPage.tsx:242` | `api.updateChapter(id, { ..., md_text: md })` | 提交 `md_text: ''` |
| 7 | `web/src/api/endpoints.ts:376` | `PUT /api/v1/admin/chapters/${id}` | 空串上行 |
| 8 | `worker/src/modules/admin/admin.service.ts:135` | `md_text: asStr(b.md_text)` | **无空值守卫 → 正文被覆盖为空** |

**触发器已就绪**：`AdminPage.tsx:252` 状态下拉框明确提供 `<option value="draft">草稿</option>`，
任何人把一章存成草稿、之后再点「编辑」→「保存」，该章正文即丢失。
**当前尚未发生丢失**：库里 147/147 章节 `status` 全为 `published`，草稿路径未被走过。
故定级 **P1（地雷已埋、引信已装、尚未踩）**，不是 P0。

### 8.3【本次新发现·同源第二触发路径】已发布章节抢跑保存，同样清空正文

这条**今天就能触发，不需要草稿**：`AdminPage.tsx:233` `md` 初值 `''`，`:238` 只在 `detailQ.data`
到达后才回填；而 `:256` 保存按钮禁用条件**只有** `disabled={saveMut.isPending}`，
没有任何 `detailQ.isLoading` / `mdLoaded` 守卫。于是：点「编辑」→ 详情请求还在飞 →
用户看到空 textarea → 直接点「保存」→ 提交 `md_text: ''` → 走到 8.2 第 8 步 →
**已发布章节正文被清空**。慢网、冷缓存、或用户手快时完全现实，与 8.2 同源，建议一并修。

### 8.4【更正·采纳】后端 A1 表第 3 条僵尸接口**不能删**

`worker/src/router.ts:117` 的 `GET /api/v1/admin/chapters/:id` 被后端标为「零调用僵尸接口」，
**本报告主张保留**，理由已复核：

- 它走 `getChapterSvc`，**返回 `md` 且不做 `status` 过滤**，正是 8.2 的正确修法；
- 管理端章节列表 DTO（`api/endpoints.ts:21` `Chapter { id, topicId, title, sort, status, updatedAt }`）
  **不含 `md`**，详情请求是必需的，不能靠列表数据省掉；
- 修法只需把 `AdminPage.tsx:236` 的 `api.chapter(id)` 换成管理端详情（新增
  `api.adminChapter(id)` → `/api/v1/admin/chapters/${id}`），一处改动同解 8.2 与 8.3。

**它不是僵尸，是解药 —— 只是还没被接上。**

### 8.5 主题（Topic）编辑表单同款排查 —— **已核，无同款问题**

| 核查点 | 结果 |
|---|---|
| Topic 表单是否用公开详情接口取数？ | ❌ 否。`AdminPage.tsx:159-184` `TopicEditForm` 直接从列表项 `topic` prop 读初值，**无任何详情请求** |
| 管理端主题列表 DTO 是否含全部可编辑字段？ | ✅ 是。`worker/src/modules/admin/admin.service.ts:21-33` `listTopicsSvc` 返回 `id, slug, title, description, modules, sort, status, updatedAt`，表单要改的字段全在列表里 |
| 是否存在空值覆盖风险？ | ❌ 否。初值直接来自已有数据，不存在「取不到→变空串→覆盖」链路 |

**次要隐患（advisory）**：`AdminPage.tsx:167` 调用
`api.updateTopic(topic.id, { slug, title, description, modules, sort: 0, status })` 中
**`sort` 硬编码为 `0`**，而列表 DTO 明明返回了真实 `sort`。现状下每次编辑主题都会把 `sort` 改写成 0，
将来引入主题排序功能会表现为「排序莫名全乱」。建议改 `sort: topic.sort ?? 0`。

## 九、Advisory 清单（不阻塞，建议排期）

| # | 项 | 位置 | 理由 |
|---|---|---|---|
| A1 | 改昵称侧边栏不刷新 | `lib/profileStore.ts:28` / `components/AppShell.tsx:52` | 事件无监听者 |
| A2 | `setProfile()` 恒返回 `ok:true` | `lib/profileStore.ts` | 文档实现不符，吞写入失败 |
| A3 | `updateTopic` 硬编码 `sort: 0` | `pages/AdminPage.tsx:167` | 见 8.5 |
| A4 | 条件 Hook lint 违规 | `pages/AdminPage.tsx:236` | 见 8.1，1 行可修 |
| A5 | 11 个死图标 | `components/Icon.tsx` | 顺带解 300 行门禁 |
| A6 | `/courses` 无正常入口 | `components/AppShell.tsx` | 加入口或下线 |
| A7 | 3 页面仅搜索可达 | `components/TopbarSearch.tsx:49` | 默认态不曝光 |
| A8 | `useLogout()` 零调用 | `components/AuthGuard.tsx:25` | 与 ProfilePage 自实现重复 |
| A9 | `getAnonId()` 零调用 | `lib/anonId.ts` | 文档仍在引用，需同步 |
| A10 | 14 文件超 300 行 | 见第六节 | 门禁违规 |
| A11 | `guardAdmin` ≡ `guardAll` | `worker/src/middleware/auth.ts:38` | 无角色区分；单管理员项目可接受，**请后端确认是否有意** |

## 十、失效模式自检（6 类）

| # | 失效模式 | 核查方式 | 结果 |
|---|---|---|---|
| 1 | Happy-path 偏差 | 逐一走 loading/error/empty 分支 | ⚠️ AdminPage 保存按钮缺 loading 守卫（8.3） |
| 2 | **沉默逻辑错误** | 深链参数、重复 URL、恒 null 分支 | ❌ 命中 3 处：B1 / B2 / B3 |
| 3 | 幻觉依赖/接口 | 全量断引用扫描 + `tsc --noEmit` | ✅ 0 断引用，类型检查通过 |
| 4 | 缺失系统上下文 | 鉴权中间件、草稿/发布可见性 | ⚠️ A11 待后端确认；8.2 即状态可见性漏判 |
| 5 | 性能盲区 | 大文件、全局样式、图标注册表 | ⚠️ `styles.css` 2538 行、1/3 死类全量下发 |
| 6 | 静默缺失 | 漏 import / 未处理 Promise | ✅ lint + tsc 未拦到 |

---

## 十一、方法与护栏

为规避环境坑（Git Bash `find`/`xargs` 静默溢出、`node -e` 转义丢失），全部扫描以 `.mjs` 脚本 +
`readdirSync` 递归实现、结果落盘 txt 再读：`tmp/fe_lines.mjs`、`tmp/fe_graph.mjs`、`tmp/fe_css.mjs`。
死代码结论**均已双向复核**（图分析给候选 → 每个符号在 `web/+worker/+scripts/` 全量 grep 反查 → 0 才写入）。
**过度设计护栏**：只记录①正确性缺陷 ②未满足的显式需求 ③契约违背 ④门禁违规，不含风格偏好；
已主动撤回 1 条早期误判（`/simulator?from=` 深链实为正常）。

## 十二、建议修复顺序

1. **B1 + 8.3（一处改动同解两缺陷）**：`AdminPage.tsx:236` 改用管理端详情
   `/api/v1/admin/chapters/:id`（`router.ts:117`，**勿删**）；`:256` 加
   `disabled={saveMut.isPending || (chapter && !mdLoaded)}`；后端 `admin.service.ts:135` 补空值守卫。
2. **B2**：定 `?view=` 去留 —— 要么 `FactoryPage` 消费它，要么把 `TrackDetailPage.tsx:172` /
   `CoursesPage.tsx:214` 改成真实路由。
3. **B4 + 死 CSS**：整块删 roadmap 子系统（1215 行）+ `styles.css` 111 个死类。
4. **B3**：模拟器存档二选一 —— 补入口，或删 `simStorage.ts`。5. A1–A4 小修；A10 拆文件。
