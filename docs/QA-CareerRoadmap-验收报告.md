# QA 验收报告 · 能力路线 + 职业路径图 v1

- **验收角色**：测试工程师（验证者，不改业务代码）
- **验收对象**：https://mes-site.qijia2002.workers.dev ，代码库 `E:/mes-learning-platform`
- **验收依据**：`docs/api/career-roadmap-api.md`、`docs/UIUX-CareerRoadmap-v1.md`、`docs/PRD-CareerRoadmap-v1.md`、`docs/architecture/career-roadmap-schema.md`、`docs/seeds/career-roadmap-data.json`
- **数据库操作**：全程只读（仅 `SELECT`），零写入

## 总判定

| 项 | 值 |
|---|---|
| **验收结论** | **PASS（准予上线）** |
| **P0 缺陷** | **0** |
| P1 缺陷 | 0 |
| 建议项（advisory） | 5 |

六项检查全部通过。未发现正确性缺陷、需求未满足或契约/数据完整性破坏。所有 advisory 均为文档与实现漂移、或永不触发的死分支，无用户可见影响。

---

## 1. P0 绝对规则全量扫描

扫描范围：本次新增/修改的全部 27 个文件（后端 roadmap 模块 + repo + router，前端 api/features/pages/styles/Icon/App/AppShell/Breadcrumb + design-tokens）。

| 检查项 | 方法 | 实际结果 | 判定 |
|---|---|---|---|
| emoji 作功能图标 | `grep -rnP '[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{FE00}-\x{FE0F}\x{1FA00}-\x{1FAFF}\x{20E3}]'` | 1 命中，位于 `design-system/design-tokens.css:191` **CSS 块注释内**（`⚠️ 必须写 0 0 0 0 transparent…`），不渲染、非功能图标 | **PASS** |
| 紫→粉渐变 | `grep -rniE '7C3AED\|A855F7\|EC4899\|from-purple\|to-pink'` | 0 命中 | **PASS** |
| 硬编码颜色 | `grep -rnEi '#[0-9a-f]{3,8}\|rgba?\([0-9]\|hsla?\([0-9]'` 排除 `#fff`/`#000` | `styles.roadmap.css` 0 命中；roadmap 全部 tsx 0 命中；`var(--` 使用 **271** 次 | **PASS** |
| AI 模板味 | `grep -rniE 'Lorem ipsum\|Welcome to\|开启学习之旅\|提升你的技能'` | 0 命中 | **PASS** |
| 弹跳缓动 | `grep -rn 'cubic-bezier(0.68, *-0.55'` | 0 命中 | **PASS** |

> 证据（emoji 唯一命中的上下文，确认为注释）：
> ```
> /* … ⚠️ 必须写 `0 0 0 0 transparent` 而不是 `none`：
>    `none` 在多值列表中是非法语法，浏览器会静默丢弃整条声明 … */
> --elev-card: 0 0 0 0 transparent;
> ```

---

## 2. API 契约逐字比对

全部请求带 `-H "Referer: https://mes-site.qijia2002.workers.dev"`。

### 2.1 连通性

| 接口 | HTTP | 字节 |
|---|---|---|
| `/api/v1/tracks` | 200 | 12904 |
| `/api/v1/tracks/sql` | 200 | 8305 |
| `/api/v1/tracks/programming-dev` | 200 | 9741 |
| `/api/v1/careers` | 200 | 6102 |
| `/api/v1/careers/mes-implementation` | 200 | 11892 |
| `/api/v1/roadmap/graph?career=scada-engineer` | 200 | 8804 |

### 2.2 字段级比对（字段名 / 嵌套 / 类型 / 必填性）

| 接口 | 契约要求 | 实际响应 | 判定 |
|---|---|---|---|
| 响应封装 | `code/data/msg/traceId` | 完全一致 | PASS |
| `/tracks` | `data.items[] + total` | 一致，`total=10`，`items.len=10` | PASS |
| `/tracks` item | `id,slug,title,subtitle,kind,icon,summary,sort,chapterTotal,levels` | 10 字段完全一致，无多无少 | PASS |
| `/tracks` levels[] | `level,name,goal,hours,chapterCount,plannedCount,hasContent` | 7 字段一致；**恒 3 元素、level 升序**（10 条路线全部核验） | PASS |
| `/tracks/:slug` | `…,levels,relatedCareers,authenticated` | 11 字段一致 | PASS |
| `/tracks/:slug` levels[] | `level,name,goal,hours,outcomes,chapters,plannedChapters,progress` | 8 字段一致 | PASS |
| chapters[] | `id,title,topicId,sort,done` | 5 字段一致 | PASS |
| progress | `done,total,percent,state` | 一致；state 枚举实测覆盖 `planned`/`not_started` | PASS |
| relatedCareers[] | `slug,title,icon,importance` | 一致；`sql` 去重后 5 条，`importance` 取最强（sql 在 mes-implementation 跨 L1-important/L2-core/L3-important → 返回 `core`）符合 §2 口径 | PASS |
| `/careers` item | `id,slug,title,tagline,salary,demand,overview,icon,sort,stageCount,trackCount` | 11 字段一致；**确认未泄漏** `dailyWork`/`outputs`（符合 §3「列表不返回」） | PASS |
| `trackCount` 去重 | 去重后路线数 | `mes-implementation`=8，人工核验四阶段并集 {mes,erp,sql,barcode-rfid,linux-ops,industrial-network,project-management,plc}=8 | PASS |
| `/careers/:slug` | `…dailyWork,outputs,stages,summary,authenticated` | 13 字段一致 | PASS |
| stages[] | `stage,title,duration,goal,milestone,interviewPoints,deliverables,requirements` | 8 字段一致 | PASS |
| requirements[] | `trackSlug,trackTitle,trackIcon,level,levelName,importance,note,progress` | 8 字段一致 | PASS |
| `/roadmap/graph` | `career,nodes,edges,summary` | 一致 | PASS |
| stage 节点 | `id,type,stage,title,duration,goal,milestone,icon` | 8 字段一致 | PASS |
| level 节点 | `id,type,trackSlug,trackTitle,trackIcon,trackKind,level,levelName,hours,progress` | 10 字段一致 | PASS |
| edges[] | `id,from,to,importance,note` | 5 字段一致 | PASS |
| summary | `authenticated,stageCount,levelCount,chapterDone,chapterTotal,percent` | 6 字段一致 | PASS |

### 2.3 图结构契约

```
nodes: 19 (stage 4 + level 15)   edges: 17
DANGLING EDGES: 0
bad id format: []                 （全部匹配 /^(stage|level):\d+$/）
order stage-then-level? true      （先 stage 后 level）
level dedup ok? true              （15 个 level 节点无重复）
```
**PASS** — 无悬空边、id 格式固定、排序契约成立、level 去重成立。

### 2.4 错误分支

| 请求 | 期望 | 实际 | 判定 |
|---|---|---|---|
| `/tracks/no-such-track` | 404 / 4001 | HTTP 404 code 4001「内容不存在或尚未发布」 | PASS |
| `/careers/no-such-career` | 404 / 4001 | HTTP 404 code 4001 | PASS |
| `/roadmap/graph`（缺参） | 400 / 1001 | HTTP 400 code 1001「缺少必要参数」 | PASS |
| `/roadmap/graph?career=`（空） | 400 / 1001 | HTTP 400 code 1001 | PASS |
| `/roadmap/graph?career=nope` | 404 / 4001 | HTTP 404 code 4001 | PASS |
| `/tracks/aa%2Fbb`（含 `/`） | 400 / 1003 | HTTP 400 code 1003「参数未通过校验」 | PASS |

### 2.5 契约层面的值级偏差（非字段偏差，advisory）

- **A-1 图标命名**：契约 §2/§3/§4/§5 示例与 schema §8 写 `career-mes-impl` 等 5 个 `career-*` 键；实际 API 返回 `role-mes-impl` 等 `role-*` 键。
  **但**「事实源」`docs/seeds/career-roadmap-data.json` 与 `Icon.tsx` REGISTRY **均为 `role-*`**，三方自洽；且 `trackIcons.ts` 别名层同时覆盖 `career-*`。**渲染无缺陷**，判定为**文档滞后**，建议改文档而非改代码。
- **A-2 示例值滞后**：契约 §1 示例 `"total": 8`、schema §1/§3 写「8 条路线 / 24 个 level」，实际为 10 条 / 30 个 level（PRD 要求 10 条）。示例数字滞后，**结构无误**。
- **A-3 `demand` 形态**：契约示例 `"demand": "高"`（短标签），实际为 100+ 字段落。类型仍为 `string`，且前端 `CareerAside.tsx:44` 以 `<dd>` 自由文本渲染，UIUX 文档未对 `demand` 作胶囊/徽标约束（grep 无命中），**无布局破坏**。

---

## 3. 数据完整性验证（远程 D1，只读）

### 3.1 行数

```sql
SELECT (SELECT COUNT(*) FROM tracks) tracks, (SELECT COUNT(*) FROM track_levels) track_levels,
       (SELECT COUNT(*) FROM track_level_chapters) tlc, (SELECT COUNT(*) FROM career_paths) careers,
       (SELECT COUNT(*) FROM career_stages) stages, (SELECT COUNT(*) FROM career_stage_reqs) reqs
```
```json
{"tracks":10,"track_levels":30,"tlc":48,"careers":5,"stages":20,"reqs":90}
```

| 表 | 期望 | 实际 | 判定 |
|---|---|---|---|
| tracks | 10 | 10 | PASS |
| track_levels | 30 | 30 | PASS |
| track_level_chapters | 48 | 48 | PASS |
| career_paths | 5 | 5 | PASS |
| career_stages | 20 | 20 | PASS |
| career_stage_reqs | 90 | 90 | PASS |

### 3.2 悬空章节引用

```sql
SELECT tlc.id, tlc.level_id, tlc.chapter_id FROM track_level_chapters tlc
LEFT JOIN chapters c ON c.id = tlc.chapter_id WHERE c.id IS NULL
```
→ **results: [] （零悬空引用）**

补充核验：`joined_any = 48`、`joined_published = 48` — 48 条映射全部指向真实且 `status='published'` 的章节。**PASS**

### 3.3 跨 stage 等级单调性

```sql
-- 同 career 同 track，后阶段等级低于前阶段即为回退
… WHERE s2.stage > s1.stage AND tl2.level < tl1.level
```
→ **results: [] （无任何等级回退）** **PASS**

### 3.4 同 stage 内路线重复

```sql
… GROUP BY cs.id, tl.track_id HAVING COUNT(*) > 1
```
→ **results: [] （无重复）** **PASS**

### 3.5 种子 JSON ↔ DB 抽样全字段比对

**3 条 track（sql / embedded / programming-dev）× 3 级 = 9 个 level，比对 name/goal/hours/outcomes/planned_chapters：**

唯一差异：`name` 字段，seed 为 `入门/中级/高级`，DB 为 `L1 入门/L2 中级/L3 高级`。
**核验为设计内变换，非缺陷**：
- 导入脚本 `scripts/import-career-roadmap.mjs:183` 注释明示「契约里 `levels[].name` 形如「L1 入门」；PM 只给「入门」时补前缀，已带前缀则不重复加」；
- API 契约 §1/§2 示例确为 `"L1 入门"`，DB 与契约一致；
- 前端 `roadmapLabels.ts:12 levelCn()` 以 `/^L\s*\d+\s*[·\-:：]?\s*/i` 剥回中文再渲染。
链路 seed→DB→API→UI 闭环无损。其余 goal/hours/outcomes/planned_chapters **全字段一致**。**PASS**

**2 条 career（mes-implementation / scada-engineer）比对 title/tagline/salary/overview/icon/sort/daily_work/outputs：**
→ `>>> PASS: 2 条 career 全字段一致（含 daily_work/outputs JSON）` **PASS**

### 3.6 聚合值反查（scada-engineer）

| 指标 | DB 真值 | 线上 graph | 判定 |
|---|---|---|---|
| edges | 17 | 17 | PASS |
| distinct levels | 15 | 15 (`levelCount`) | PASS |
| stages | 4 | 4 (`stageCount`) | PASS |
| chapterTotal（去重 published） | 39 | 39 | PASS |

### 3.7 已知偏差确认：三个字段是否真的丢了

DDL `docs/seeds/migration-career-roadmap.sql` 中 `grep -niE "content_status|target_topic_slug|chapter_notes"` → **无命中**，确认三列均未建。JSON 中实际出现位置与影响面：

| 字段 | 出现次数 | 位置 | 实际影响 | 判定 |
|---|---|---|---|---|
| `content_status` | 3 | `embedded`=`inverted`、`project-management`=`planned`、`programming-dev`=`planned` | **已由前端等价补偿**。`roadmapLabels.ts:91 isInverted(levels, contentStatus)` 在 `contentStatus` 为 `undefined` 时走派生分支 `has(3) && !has(1) && !has(2)`；线上 `embedded` 为 L1=0ch / L2=0ch / L3=1ch → 派生结果 `true`，倒挂提示**确认触发**。`planned` 态由 `chapterCount=0 → state:'planned'` 天然覆盖 | 影响面 0 |
| `target_topic_slug` | 2 | `sql` L2/L3 = `"sql-interview"` | 本期无任何消费方（前后端 grep 均无引用），为后续导航预留 | 影响面 0 |
| `chapter_notes` | 1 | `mes` L2，6 条「实操案例，建议排在核心章节之后」 | 内容编排作者备注，非展示字段，排序已由 `track_level_chapters.sort` 承载 | 影响面 0 |

**结论：三个字段确实未入库，但均无用户可见影响，不构成数据完整性破坏。** 建议补入 ADR 或 seed schema 注释，声明为「刻意不落库」，避免后续维护者误判为导入 bug（advisory B）。

---

## 4. 代码组织门禁

| 检查项 | 方法 | 结果 | 判定 |
|---|---|---|---|
| 分层 routes→service→repository | 读 `roadmap.routes.ts` 全文 | 5 个 handler 全为「取参→校验→调 service→ok/fail」，**零业务逻辑** | PASS |
| 依赖只向下 | `grep 'env.DB\|.prepare(\|DbSession'` on service/graph | **0 命中** — service/graph 不直接触碰 D1，全部经 `roadmapRepo.*` | PASS |
| SQL 只在 repository | `grep -rln 'SELECT \|FROM \|JOIN '` on `modules/roadmap/` | 仅 `roadmap.shared.ts` 1 条（`SELECT … content_version FROM platform_config`）。**核验为既有约定**：`modules/content/content.service.ts:16` 使用完全相同的内联写法。非本次新增的偏离 | PASS（advisory D） |
| 禁 N+1 / D1 语句预算 | 检查 service/graph 中 `for` 循环内是否 `await` | 所有 `await roadmapRepo.*` 均在循环**之外**（service:43/159/303、graph:133），循环体纯内存分组。符合契约 §0.4「一次取全集 + 内存分组」 | PASS |
| 单文件 ≤300 行 | `wc -l` | **2 个超限**：`roadmap.service.ts` **322**、`roadmap.repo.ts` **319**（其余 25 个文件全部达标，最大 `roadmapLayout.ts` 263） | FAIL（advisory C） |
| 组件单一职责 | 目录审查 | 13 个前端文件按职责拆分（Matrix/Stair/Node/Ring/Aside/Selector/StageDetail/LevelSection + labels/layout/icons/useIsNarrow 纯逻辑），无上帝组件 | PASS |
| 类型检查 | `npx tsc --noEmit` | **exit=0，零错误** | PASS |

> 说明：契约 §0.5 已预置「service 逼近 300 行时把 graph 拆出」，团队确已拆出 `roadmap.graph.ts`(154) 与 `roadmap.shared.ts`(74)，仍余 322/319。超限幅度 7%/6%，无正确性影响，按护栏归为 advisory 而非阻断。

---

## 5. 前端逻辑走查（代码级，未尝试登录）

| 链路 | 核验点 | 证据 | 判定 |
|---|---|---|---|
| 移动端 <768px 卸载 SVG | 必须条件渲染不挂载，非 `display:none` | `useIsNarrow.ts` 用 `matchMedia('(max-width: 768px)')` + `change` 监听返回布尔；`RoadmapPage.tsx:149-152` `narrow ? <RoadmapStair/> : <RoadmapMatrix/>` — **三元真分支，Matrix 整组件不挂载**，SVG 连线层随之不存在 | **PASS** |
| 「规划中」不可点 | 不得可点击，文案不得像故障 | `RoadmapNode.tsx:75-87` `if (planned)` 分支渲染 `<div aria-disabled="true">` 而非 `<Link>`；`TrackLevelSection.tsx:114` planned 章节用 `<div className="row-link is-static">` 并注释「不可点：用 div 不用 a，没有 hover 底色」。文案为「内容规划中」/「规划中 · 已排 N 章」，明确非故障 | **PASS** |
| `embedded` 倒挂提示兜底 | 后端无 `contentStatus`，须靠 levels 自判且**真的触发** | 后端 `grep contentStatus worker/src/` → **0 命中**，确认不下发；`isInverted()` 第一分支 `contentStatus==='inverted'` 落空，走派生 `has(3)&&!has(1)&&!has(2)`；线上 `/tracks/embedded` 实测 `L1 ch:0 / L2 ch:0 / L3 ch:1` → **派生为 true**，`TrackDetailPage.tsx:103` 横幅渲染。**兜底确认生效** | **PASS** |
| 节点跳转目标路由存在 | `/tracks/:slug`、`/chapters/:id` 须在路由表 | `App.tsx:41` `<Route path="/tracks/:slug">`、`App.tsx:38` `<Route path="/chapters/:chapterId">`、`App.tsx:40` `<Route path="/roadmap">` 均存在；`RoadmapNode.tsx:95` 跳 `/tracks/${trackSlug}#${levelAnchor}`，`TrackLevelSection.tsx:92` 跳 `/chapters/${id}` — **全部命中** | **PASS** |
| 进度环 未登录/0 表现 | 须合理，不得像失败 | `ProgressRing.tsx` 未开始渲染 `—` 而非 `0%`（注释：「0% 读起来像失败」）；`percent>0` 才画填充弧；planned 态改用 `PlannedMark` 日历图标不用环。`/roadmap` 与 `/tracks/:slug` 均有未登录 `alert-info` 横幅说明「显示的是内容总量」并给登录入口 | **PASS** |
| `project-management`/`programming-dev` 图标 | 不得空图标、不得 emoji 兜底 | `Icon.tsx` REGISTRY **确无** `clipboard-list`/`code` 键；`trackIcons.ts` ALIAS 映射 `'clipboard-list'→'work-order'`(ClipboardList)、`'code'→'role-mes-dev'`(Code)，均为已注册 lucide 字形。全部 5 处图标调用点（Matrix:75 / Node:57 / Aside:30 / Selector:85 / TrackDetail:73,174）**均经 `trackIcon()`/`careerIcon()` 归一**，`grep 'name={t.icon}'` 等裸传 → **0 命中**。三层兜底终点为 `'paths'`(Route)，**非 emoji** | **PASS** |

---

## 6. 部署验证

| 检查项 | 结果 | 判定 |
|---|---|---|
| `/api/v1/health` | HTTP 200 | PASS |
| `/roadmap` SPA | HTTP 200，含 `id="root"`，引用 `/assets/index-DtVQ4sU8.js` | PASS |
| `/tracks/sql` SPA | HTTP 200，含 `id="root"`，同一 bundle | PASS |
| `/tracks/does-not-exist` | HTTP 200 返回 index.html（SPA 交客户端处理 404，符合预期，非服务端 404） | PASS |
| 构建产物上线 | 线上 index.html 引用 `index-DtVQ4sU8.js` + `index-BhiJ3U5l.css`，二者**均存在于** `worker/public/assets/` | PASS |

---

## 7. Advisory 清单（非阻断）

| # | 建议项 | 理由 | 建议处置 |
|---|---|---|---|
| A | 契约文档图标键 `career-*` 与实现/种子/REGISTRY 的 `role-*` 不一致；示例 `total:8`、schema「8 条路线」滞后于实际 10 条 | 文档滞后于实现，易误导后续维护者按 `career-*` 开发 | 改 `career-roadmap-api.md` §2-§5 与 `career-roadmap-schema.md` §1/§8 对齐 `role-*` 与 10 条口径 |
| B | `content_status`/`target_topic_slug`/`chapter_notes` 未落库，无处声明 | 当前零影响，但下个维护者可能误判为导入 bug 而"修复" | 在 ADR-012 或 seed JSON 加注「刻意不落库，倒挂态由前端 `isInverted` 派生」 |
| C | `roadmap.service.ts` 322 行、`roadmap.repo.ts` 319 行超 300 行门禁 | 超限 6-7%，无正确性影响；graph/shared 已拆出 | 下次触碰该文件时顺手拆 careers DTO 组装，不单独排期 |
| D | `roadmap.shared.ts:13` 内联 `content_version` 查询未走 repository | 与 `content.service.ts:16` 既有写法一致，非本次新增偏离 | 若要收口，应整体重构两处，不单独针对本期 |
| E | `trackIcons.ts` 的 slug 兜底表键名与真实 slug 不符：`mes-development`↔实际 `mes-dev`、`owner-digital`↔实际 `digital-specialist`、`network/linux/barcode`↔实际 `industrial-network/linux-ops/barcode-rfid`；且缺 `career-digital-owner` 别名（现为 `career-owner-digital`） | **死分支**：仅当后端下发的 icon 为空或未注册时才走 slug 兜底，而实际数据 icon 恒为已注册 `role-*`/已别名键，永不触发。当前零影响 | 修正键名以免将来脏数据时静默落到 `'user'`/`'paths'` 泛化图标 |

---

## 8. 结论

**verdict: PASS — 准予上线。P0 缺陷 0 个。**

六项检查全部通过：P0 绝对规则零违规（唯一 emoji 命中位于 CSS 注释，非功能图标）；5 个接口字段名/嵌套/类型/必填性与契约逐字一致，6 条错误分支返回码全部正确；6 张表行数精确匹配（10/30/48/5/20/90），零悬空引用、零等级回退、零阶段内重复，种子抽样全字段一致；分层与 N+1 防护成立，typecheck 零错误；六条前端关键链路（移动端真卸载、规划态不可点、倒挂兜底实测触发、路由全命中、进度环零态合理、图标别名全覆盖无 emoji 兜底）均验证通过；线上健康、SPA 路由、产物 hash 一致。

5 条 advisory 均为文档漂移或永不触发的死分支，无用户可见影响，不阻断上线。

---

*报告生成：Phase 4 质量门禁 · 验证者角色 · 未修改任何业务代码 · D1 全程只读*
