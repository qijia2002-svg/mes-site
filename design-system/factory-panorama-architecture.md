# 工厂全景（FactoryFlow）× 三大支柱 连接架构 v1

> 定位：把「工厂全景」从**一张导航图**改造成**一条实战学习主轴**。
> 每个流程节点 = 一个**学习站**，学习者在站内**真的动手做**（跑仿真 / 写 SQL / 答题），不是只读。
>
> 作者：首席架构师 · 基于 commit `6d3616d` 代码现状核实后编写
> P0 红线：图标只走 `web/src/components/Icon.tsx` 注册表（lucide 语义名）· 零 emoji · 零硬编码色（全 `var(--token)`）· 零紫粉渐变。
> 技术栈不动：Cloudflare Workers + D1 + Workers AI + React 19 + TanStack Query v5 + Vite 6 + react-router-dom。

---

## 0. 代码现状核实结论（已逐文件读过）

| 事项 | 核实结果 | 位置 |
|------|----------|------|
| `node_resources` 表 | 已建，字段 `(id, node_id, res_type, ref_id, title, sort)`，索引 `(node_id, sort)` | `worker/src/migrations/schema-flowchart.sql:51-59` |
| 后端已返回 `resources[]` | 已通。`getFlowchart` 调 `listResources(nodeIds)` 并映射为 `{id,nodeId,type,refId,title}` | `flowchart.routes.ts:24-27,48-54`；`flowchart.repo.ts:68-76` |
| 路由已注册且免登录 | `GET /api/v1/flowchart/:slug`，`noAuth: true` | `worker/src/router.ts:151` |
| 前端 DTO 已定义 | `NodeResourceDTO`、`FlowchartBundle.resources` | `web/src/api/endpoints.ts:200-212` |
| **缺口 ①：seed 零数据** | `seed-flowchart-generic.sql` 只插 flowcharts / flow_nodes(12) / flow_edges(12)，**一行 `node_resources` 都没有** → 接口恒返回 `resources: []` | `seed-flowchart-generic.sql:1-51` |
| **缺口 ②：前端不消费** | `FactoryFlow.tsx` 只解构 `nodes/edges`；面板渲染写死的 `DRILLS`（`/simulator`、`/quiz`、`/sql-space` 三个通用链接），**12 个节点长得一模一样** | `FactoryFlow.tsx:102-106, 447-459` |
| **缺口 ③：深链缺失** | `/chapters/:chapterId`、`/sql-space/:exerciseId` 已存在可直接用；**单题测验无路由**；`/simulator` 不读任何 query 参数 | `App.tsx:46,49,50` |
| `/quiz` 名不副实 | `QuizPage` 实际是 **SQL 题库页**（`api.sqlExercises`），不是 MCQ | `web/src/pages/QuizPage.tsx:24-28` |
| `flow_nodes` 自增 id | `id INTEGER PRIMARY KEY AUTOINCREMENT`，且 seed 头部 `DELETE` 重跑 → **id 必然重编号** | `schema-flowchart.sql:24`；`seed-flowchart-generic.sql:9-11` |
| 仿真无场景 key | `seedExampleFactory()` 硬编码 6 节点示例产线；`SimProject` 无 slug；`/simulator` 无参数入口 | `simReducer.ts:67-107` |
| `fault_scenarios` | 有 `variant`（`factory|blocks`）、`solution_json`，**无 slug、无蓝图字段**，且 sim 代码完全没接 | `schema.sql:78-88` |
| `chapters` / `questions` / `sql_exercises` | `chapters(id,topic_id,...)`；`questions(id,chapter_id,...)`；`sql_exercises(id,topic_id,title,prompt,dataset_json,answer_sql,answer_hash,schema_hint)` | `schema.sql:35-75` |
| 现存 SQL 题总量 | **仅 6 道**，分属 topic 1/2/3（工单、BOM、报工），覆盖不到 12 个节点 | `seed.sql:401-416` |
| topics 有 `status` 过滤 | 公开列表 `WHERE status='published'` → **`draft` 主题不会出现在 /courses** | `chapter.repo.ts:59` |

### 0.1 ⚠ 最重要的一条发现（决定了「节点级 SQL」怎么做）

**`sql_exercises.dataset_json` 在当前前端是死字段。**

`useSandboxDb` 恒定用前端静态文件建库：

```ts
// web/src/features/sql-sandbox/useSandboxDb.ts:7,30
import { SANDBOX_DATASET_SQL } from './dataset';   // = dataset.sql?raw
createDatabase(SANDBOX_DATASET_SQL)
```

`SqlSandbox.tsx` 只从 `dataset.ts` 取 `SANDBOX_TABLES / TABLE_SCHEMAS / SANDBOX_CHALLENGES`，**从未读 `exercise.dataset_json`**。
判题哈希契约（`web/src/lib/resultHash.ts:1-21`）也明确要求「两端同一份 dataset.sql」。

> **结论**：不能靠「每题带自己的 dataset_json」来实现节点级数据。
> 正确解法见 §4.2 —— **把 `dataset.sql` 扩成一座完整的工厂库**，节点 = 这座库的一个切片。
> 这个选择同时更符合教学目标：学习者看到的是**一个工厂的一个数据库**，不是 12 个互不相干的玩具库。

### 0.2 顺带发现的两处小偏差（P1 一并修）

1. `FactoryFlow.tsx:407` 用 `n.icon as IconName` 强转，绕过了 `Icon.tsx:235` 提供的 `isIconName()` 运行时守卫。后端 icon 是自由字符串，写错就渲染成未注册名。**改为 `isIconName(n.icon) ? n.icon : 'process'`**。
2. `/quiz` 路由承载的是 SQL 题库。P1 不改它（避免连带回归），但**节点面板不再链到 `/quiz`**，测验走新的单题深链（§3.3）。

---

## 1. 重新定义：工厂全景 = 实战学习主轴

### 1.1 一句话定义

> 工厂全景不是目录，是**产线**。学习者像一件产品一样**沿着流程走一遍**，每到一个工位（节点）都要**动手做完一件事**才算过站。

### 1.2 学习站模型（Learning Station）

每个 `flow_node` = 一个学习站，站内固定四类槽位，**顺序即教学顺序**：

```
┌─ 学习站：质量检验 (node_key = qc) ─────────────────────────┐
│                                                            │
│  [看] 知识    chapter   → 这一环在讲什么           1~2 分钟 │
│         ↓  （看完不算过站，只是热身）                       │
│  [做] 仿真    sim       → 看这条产线怎么转、卡在哪   P2      │
│  [做] SQL     sql       → 这一环在库里长什么样，查它  ★核心  │
│  [做] 测验    quiz      → 一道判定题，做错回上一步           │
│         ↓                                                  │
│  [过站] 四类各自独立打勾 → 站点进度环 → 推荐下一站          │
└────────────────────────────────────────────────────────────┘
```

### 1.3 「做」优先于「读」的三条硬约束

这三条是本次架构区别于「导航图 + 三个通用链接」的关键，**必须落到实现里**：

| 约束 | 具体规则 | 落地位置 |
|------|----------|----------|
| **C1 · 过站判定只认「做」** | 节点完成度**不计**「看过知识」。`nodeDone(node) = 所有 practice 类资源（sim/sql/quiz）全部完成`。chapter 只标「已读」，不进分母 | `useNodeProgress`（§3.4） |
| **C2 · 动作文案是祈使句，不是名词** | 禁止「SQL 实战 / 随堂测验」这类栏目名。必须是「**查出这批货为什么被判不合格**」「**算出这张工单缺几个料**」——一眼看出要做什么 | `node_resources.title` 承载（§2.2） |
| **C3 · 没有通用兜底入口** | 节点没有配某类资源，就**不渲染那一行**，绝不退化成 `/sql-space` 通用链接。宁可少一格，不可假装有内容 | 渲染层（§3.5） |

> C3 是对当前 `DRILLS` 的直接否定：现在 12 个节点渲染同样 3 个链接，学习者点进去发现和节点无关，信任一次就没了。

### 1.4 主轴顺序与「下一站」

沿用现有 `buildSteps()`（`FactoryFlow.tsx:114-152`，按最长路径分层，天然保住 采购/BOM 并行分支），
`nextKey` 语义从「第一个没点开过的节点」升级为「**第一个 practice 未做完的节点**」：

```ts
// 旧：visited（点开即算） → 新：practice 完成度
const nextKey = steps.flat().find(n => !isNodeDone(n.key))?.key ?? null;
```

---

## 2. 数据模型

### 2.1 总原则：表结构基本不动

| 表 | P1 改动 | 说明 |
|----|---------|------|
| `node_resources` | **不改表**，只填数据 | 现有 5 字段够用 |
| `flow_nodes` / `flow_edges` / `flowcharts` | **不改** | — |
| `chapters` / `questions` | **不改** | `ref_id` 直接指向其 `id` |
| `sql_exercises` | **不改表**，新增行 | 新增节点级题目（§4.2） |
| `fault_scenarios` | **P2 才动**（加 `slug` + `blueprint_json`） | P1 不碰 |
| 节点完成态 | **不上 D1**，走 `web/src/lib/userData.ts` | 见 §2.4 |

### 2.2 `node_resources` 使用规约

```sql
node_resources(
  id, node_id, res_type, ref_id, title, sort
)
```

| 字段 | 规约 |
|------|------|
| `node_id` | **必须用子查询取**，不得写死数字（§2.3） |
| `res_type` | 严格四选一：`chapter` / `sql` / `quiz` / `sim`。**不新增类型** |
| `ref_id` | `chapter`→`chapters.id`；`sql`→`sql_exercises.id`；`quiz`→`questions.id`；`sim`→`fault_scenarios.id`（P2） |
| `title` | **动作祈使句**（约束 C2），覆盖目标实体的标题。例：`查出这批货为什么被判不合格`。留空则前端回退到目标实体标题 |
| `sort` | 站内顺序。约定：`chapter`=10、`sim`=20、`sql`=30、`quiz`=40，中间留空位便于插入 |

**完整性约束（应用层保证，D1 无跨表 CHECK）**：`ref_id` 必须存在于对应表。
提供校验 SQL（部署后手跑一次，见 §5.1 验收标准）：

```sql
-- 悬空引用自检：应返回 0 行
SELECT nr.id, nr.res_type, nr.ref_id FROM node_resources nr
WHERE (nr.res_type='chapter' AND nr.ref_id NOT IN (SELECT id FROM chapters))
   OR (nr.res_type='sql'     AND nr.ref_id NOT IN (SELECT id FROM sql_exercises))
   OR (nr.res_type='quiz'    AND nr.ref_id NOT IN (SELECT id FROM questions))
   OR (nr.res_type='sim'     AND nr.ref_id NOT IN (SELECT id FROM fault_scenarios));
```

### 2.3 Seed 编写规范（强制）

`flow_nodes.id` 是 `AUTOINCREMENT`，且 `seed-flowchart-generic.sql:9-11` 每次重跑先 `DELETE` →
**id 每次重跑都会变**。因此：

**禁止**
```sql
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort)
VALUES (10, 'sql', 7, '...', 30);   -- ✗ 写死 node_id，重跑即错挂
```

**必须**
```sql
-- ✓ 子查询按 (flow slug, node_key) 双条件定位，多流程图也不会串
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort)
SELECT n.id, 'sql', e.id, '查出这批货为什么被判不合格', 30
FROM flow_nodes n
JOIN flowcharts f ON f.id = n.flow_id
JOIN sql_exercises e ON e.title = '不合格品追溯：查出被判废的工单与原因'
WHERE f.slug = 'generic-factory' AND n.node_key = 'qc';
```

**四条规范**

1. **`node_id` 一律子查询**：`(SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id=n.flow_id WHERE f.slug=? AND n.node_key=?)`。因为 `UNIQUE(flow_id, node_key)`，结果唯一。
2. **`ref_id` 优先用业务唯一键反查**（`sql_exercises.title`、`chapters.title`+`topic_id`），不写死自增 id。写死 id 只允许用于本文件内同批 INSERT 的场景，且必须紧邻注释说明。
3. **重跑安全**：`node_resources` 的清理必须**限定在本 flow 内**，不能全表删（未来多 flow 会互相清空）：
   ```sql
   DELETE FROM node_resources WHERE node_id IN (
     SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id=n.flow_id
     WHERE f.slug='generic-factory');
   ```
   注意：`flow_nodes` 上有 `ON DELETE CASCADE`，但 `seed-flowchart-generic.sql:8` 把 `foreign_keys` 关了，级联不生效 → **必须显式删**。
4. **文件拆分**：节点资源挂载**单独成文件** `seed-flowchart-generic-resources.sql`，不塞进 `seed-flowchart-generic.sql`。
   理由：拓扑（节点/连线）和内容（挂什么题）变更频率差一个量级，混在一起每次改内容都要重建拓扑，`flow_nodes.id` 就跟着抖，`node_resources` 全部作废。
   **执行顺序固定**：`schema-flowchart.sql` → `seed-flowchart-generic.sql` → `seed-flowchart-sql-exercises.sql` → `seed-flowchart-generic-resources.sql`。

### 2.4 节点完成态存哪：`userData.ts`，不上 D1

**结论：不建新表，也不直接裸用 `localStorage`，走已有的 `web/src/lib/userData.ts`。**

理由：

- 项目已有 `user_kv` 表 + `GET/PUT /api/v1/user/data/:key` + `userData.ts`（本地 `mes.ud.` 镜像 + 一次性 legacy 迁移 + `RequireAuth` 水合）。裸 `localStorage` 会重蹈「换设备进度丢失」的旧坑——这坑项目已经填过一次。
- 成本为零：只需在 `USER_DATA_KEYS`（`userData.ts:19`）加一个 key，不写迁移、不加接口。
- 完成态是**个人学习痕迹**，不是内容资产，没有分析/排行需求，不值得为它设计 D1 表结构和写接口。

**存储形状**（单 key，多 flow 天然支持）：

```ts
// key: 'factory.progress'   （加入 USER_DATA_KEYS）
type FactoryProgress = {
  v: 1;
  flows: {
    [flowSlug: string]: {
      // 资源级完成态：按 res_type + refId 记，节点改挂资源不会误判已完成
      done: { [resKey: string]: number };  // resKey = `${type}:${refId}`，值 = 完成时间戳
    };
  };
};
```

**为什么 key 用 `type:refId` 而不是 `node_resources.id`**：
`node_resources.id` 是自增，seed 重跑会变；`type:refId` 指向真实内容实体，稳定。
同一道题挂到两个节点时也天然共享完成态（做过就是做过）——这是想要的行为。

**为什么不复用现有 `progress_events`**：
它的 `item_type` 只认 `chapter | exercise | quiz`（`schema.sql:106`），语义是「全站学过多少」，
和「在工厂主轴上走到哪」是两回事，混用会污染 `stats_daily` 的统计口径。
但**SQL 判题的既有上报保持不变**（`api.submitSql`，`ExercisePage`→`SqlSandbox` 已有），两套并行不冲突。

**迁移现有 `factory.visited`**：`FactoryFlow.tsx:29` 的 `VISITED_KEY='factory.visited'` 语义是「点开过」，
与新的「做完了」不兼容。**直接废弃，不迁移**——旧值是「点开」，迁过来会给用户虚假的完成感。

### 2.5 P2：仿真场景 key —— 给 `fault_scenarios` 加列，不新建表

两个方案对比：

| 方案 | 优点 | 缺点 | 裁决 |
|------|------|------|------|
| A. `fault_scenarios` 加 `slug` + `blueprint_json` | 复用已有表/索引/`variant` 分型；`block_solutions` 外键不动；改动最小 | 表名叫 "fault" 但要装正常产线蓝图，语义略偏 | **采纳** |
| B. 新建 `sim_scenarios` 表 | 语义干净 | 多一张表 + 一套 repo/路由；和 `fault_scenarios`/`block_solutions` 形成两套并行概念，长期更乱 | 否决 |

语义偏差用 `variant` 消解：`variant='sim'` 表示「可运行产线蓝图」，`factory|blocks` 保持原义。

```sql
-- P2 迁移：worker/src/migrations/schema-sim-scenario.sql
ALTER TABLE fault_scenarios ADD COLUMN slug TEXT NOT NULL DEFAULT '';
ALTER TABLE fault_scenarios ADD COLUMN blueprint_json TEXT NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS idx_fault_slug ON fault_scenarios(slug) WHERE slug <> '';
```

- `slug`：稳定场景 key，如 `line-shopfloor-discrete`。深链用 slug 不用自增 id（同 §2.3 理由）。
- `blueprint_json`：存 `SimProject` 形状（`{ factories, activeFactoryId, activeLineId }`，见 `simTypes.ts`），
  即 `seedExampleFactory()` 的产物序列化，让 `simReducer` 能直接吃。
- 部分唯一索引（`WHERE slug <> ''`）：存量 `factory|blocks` 行 slug 为空串，不会互相冲突。

---

## 3. API 与深链

### 3.1 后端改动量：P1 为零

`GET /api/v1/flowchart/:slug` 已经返回 `resources[]`，seed 一填数据接口立刻活。
**P1 不需要任何 worker 代码改动**，只需要 SQL 文件。这是本方案最省的一块。

唯一可选优化（非阻塞，可 P3 再做）：`resources` 目前不返回目标实体的标题/状态，
前端要显示「章节真实标题」时只能靠 `node_resources.title`。
由于约束 C2 要求 title 一律写祈使句，**实际上不需要目标标题**，故 P1 明确不做 JOIN 扩展。

### 3.2 深链盘点

| 类型 | 目标路由 | 现状 | P1 动作 |
|------|----------|------|---------|
| `chapter` | `/chapters/:chapterId` | **已存在**，`ChapterPage` 用 `useParams` 取 id | 直接用，零改动 |
| `sql` | `/sql-space/:exerciseId` | **已存在**，`ExercisePage:14-23` 校验正整数后取题 | 直接用，零改动 |
| `quiz` | 无单题路由 | `questions` 只能按 `chapterId` / `topicId` 批量取（`endpoints.ts:276-279`），**没有 `GET /questions/:id`** | **需补**，见 §3.3 |
| `sim` | `/simulator` | 不读任何参数 | **P2 补** `?scenario=<slug>` |

**回程锚点（四类共用）**：所有深链带 `?from=factory&node=<node_key>`，
目标页顶部渲染「返回工厂全景 · 质量检验」，完成后回跳 `/engine?tab=factory#node-qc`。
没有这条，学习者点进去就出了主轴，闭环断掉。

### 3.3 测验单题：选「章节内锚点」还是「单题路由」

| 方案 | 改动 | 教学效果 | 裁决 |
|------|------|----------|------|
| A. `/chapters/:id?q=<questionId>` 锚点 | 前端 1 处：`ChapterPage` 读 `useSearchParams`，滚到该题并展开 | 差：把人扔进一整篇长章节里找一道题，「做一题」的爽感没了；且 `questions` 挂 chapter，节点未必对应整章 | 否决 |
| B. 新增 `GET /api/v1/quiz/questions/:id` + 路由 `/quiz/q/:questionId` | 后端 +1 handler +1 repo 方法；前端 +1 页面 | 好：一屏一题，答完即判，2 分钟闭环，可直接回工厂全景 | **采纳** |

**B 的具体改动（4 处，都很薄）**：

1. `worker/src/data/repositories/quiz.repo.ts` — 加 `getQuestion(db, id)`。
   该文件头部第 5-6 行已立「**R6 铁律：`answer` / `answer_sql` 两列永不出现在任何 SELECT 列表里**」。
   新方法的 SELECT 列表必须与现有 `listQuestions`（第 32 行）**逐列一致**：
   `SELECT id, chapter_id, type, stem, options FROM questions WHERE id = ?1`。
   注意 `explanation` **也不下发**——它由 `POST /quiz/grade` 在判题后返回，提前给出等于给答案。
2. `worker/src/modules/quiz/quiz.routes.ts` — 加 `getQuestionById`，404 走 `Err.notFound()`。
3. `worker/src/router.ts` — 注册 `{ method:'GET', path:'/api/v1/quiz/questions/:id', handler: getQuestionById }`，
   紧跟第 121 行的 query 版之后。静态路径与 `:id` 路径共存已有先例
   （`/api/v1/sql-exercises` 与 `/api/v1/sql-exercises/:id`，第 125-126 行），照抄那个写法即可。
4. 前端：`endpoints.ts` 加 `quizQuestion(id)`；新页 `web/src/pages/QuizQuestionPage.tsx`（懒加载）；
   `App.tsx` 加 `<Route path="/quiz/q/:questionId" element={<QuizQuestionPage />} />`。
   判题复用现有 `api.gradeQuestion(questionId, answer)`（`endpoints.ts:280`），**不新增判题逻辑**。

> 路径用 `/quiz/q/:questionId` 而不是 `/quiz/:questionId`：`/quiz` 现在是 SQL 题库页，
> 直接加 `:questionId` 会让两个语义在同一层级打架。加一段 `q/` 隔开，将来 `/quiz` 改名也不受影响。

### 3.4 前端：`useNodeProgress` Hook

新文件 `web/src/features/factory/useNodeProgress.ts`，把「资源 → 完成态」的读写收在一处，
组件里不出现任何存储细节（`FactoryFlow.tsx` 已 496 行，不能再往里塞状态逻辑）。

```ts
// 对外形状（实现细节隐藏）
export interface NodeProgressApi {
  isDone: (r: NodeResourceDTO) => boolean;
  markDone: (r: NodeResourceDTO) => void;
  /** 节点完成度：只统计 practice 类（sim/sql/quiz），chapter 不进分母 —— 约束 C1 */
  nodeStat: (nodeId: number) => { done: number; total: number; complete: boolean };
  /** 首个未完成的节点 key —— 驱动「从这里继续」 */
  nextNodeKey: (nodes: FlowNodeDTO[]) => string | null;
}
export function useNodeProgress(flowSlug: string, resources: NodeResourceDTO[]): NodeProgressApi;
```

实现要点：

- 内部 key = `` `${r.type}:${r.refId}` ``，落 `userData` 的 `factory.progress`（§2.4）。
- **写入时机**：`chapter` 用「点击即标已读」；`sql` / `quiz` 用**目标页回传**——
  P1 简化为「从工厂全景跳出去、带 `?from=factory` 参数、在目标页完成判题（`submitSql` 成功 / `gradeQuestion` 返回 correct）时写入」。
  不做「点了就算做了」，否则约束 C1 变成空话。
- `total === 0` 的节点（还没配 practice 资源）：`complete` 返回 `false` 但**不计入主轴进度分母**，
  UI 显示「内容建设中」，不显示假的空进度环。

### 3.5 前端渲染结构：`resources` 取代 `DRILLS`

**删除** `FactoryFlow.tsx:102-106` 的 `DRILLS` 常量，以及 `447-459` 的渲染块。

```
FactoryFlow.tsx  (保持 <500 行；超了就把面板拆成 NodeStationPanel.tsx)
├─ q.data.resources  ──►  useMemo: Map<nodeId, NodeResourceDTO[]>   // 按 nodeId 分组，组内按 sort
├─ useNodeProgress(slug, resources)
└─ 选中节点面板 .p-body
   ├─ 左列：description + 涉及系统 tag（不变）
   └─ 右列：<NodeStation node={selected} items={byNode.get(selected.id) ?? []} />
```

`NodeStation` 渲染规则（**按 `sort` 升序，不按类型硬排**，让 seed 能控制教学顺序）：

| `res_type` | 图标（注册表语义名） | 行前缀 | 跳转 |
|-----------|---------------------|--------|------|
| `chapter` | `chapter` | `看` | `/chapters/{refId}?from=factory&node={key}` |
| `sim` | `routing` | `做` | `/simulator?scenario={slug}&from=factory&node={key}`（P2） |
| `sql` | `sql` | `做` | `/sql-space/{refId}?from=factory&node={key}` |
| `quiz` | `quiz` | `做` | `/quiz/q/{refId}?from=factory&node={key}` |

**四条渲染约束**：

1. **空则不渲染**（约束 C3）：`items.length === 0` → 渲染一条 `EmptyState` 风格的说明
   「这一站的实战内容还在建设中」+ 一个次要链接回 `/sql-space` 自由练习。
   **绝不**渲染假装是本节点内容的通用三连。
2. **完成态标记**：已完成行右侧 `Icon name="check-circle"`，色 `var(--success)`；
   未完成行右侧 `chevron-right`，色 `var(--border-strong)`。**复用现有 `.drill` 样式类**，只加 `.drill.is-done`。
3. **站内进度条**：面板 `p-meta` 行追加「本站实战 {done}/{total}」，
   复用已有 `.ff-prog .bar` 样式（`--progress-track` / `--progress-fill`）。
4. **P0 合规**：`Icon` 名全部取自 §3.5 表格（`chapter`/`routing`/`sql`/`quiz`/`check-circle`/`chevron-right` 均已在
   `Icon.tsx` 注册表内，`chapter:108`、`routing:167`、`sql:110`、`quiz:111`、`check-circle:225`、`chevron-right:124`），
   **无需新增任何图标**；颜色全部 `var(--token)`；无 emoji；无渐变。

**同时修复**（§0.2）：节点图标改走守卫

```ts
import { Icon, isIconName, type IconName } from '../../components/Icon';
const safeIcon = (s: string): IconName => (isIconName(s) ? s : 'process');
```

---

## 4. 实战钩子设计（本文档的核心）

### 4.1 为什么现在的「实战」是假的

现在点任何节点，右列都是同样三行：工厂仿真 / 随堂测验 / SQL 实战，跳 `/simulator`、`/quiz`、`/sql-space`。
学习者在「质量检验」点「SQL 实战」，落到一个要先选课程的题库页——**主轴断了，也没人告诉他该查什么**。
实战钩子的全部目的：**把「这一环」和「一条能跑的具体任务」焊死**。

### 4.2 节点级 SQL：「这个环节在数据库里长什么样 → 写 SQL 查它」

#### 4.2.1 架构决策：一座工厂库，节点是它的切片

由 §0.1 的发现（`dataset_json` 是死字段，沙箱恒用 `dataset.sql`），三个方案：

| 方案 | 说明 | 判定 |
|------|------|------|
| A. 改 `useSandboxDb` 支持 per-exercise dataset | 每题带自己的库 | 否决：① 破坏 `resultHash.ts` 的「两端同一份 dataset」哈希契约，判题会静默全错——文件头已用最重的措辞警告过；② 12 个互不相干的玩具库，学不到「工厂是一个数据库」 |
| B. **扩 `dataset.sql` 成完整工厂库，节点查各自切片** | 一座库贯穿订单→交付 | **采纳** |
| C. 只给已有 3 个 topic 的节点配 SQL，其余节点无 SQL | 零内容成本 | 否决：违反「节点级专属」拍板 |

**B 的教学价值才是关键**：学习者第一次真切看到——
客户下单在 `sales_orders`，评审改的是 `sales_orders.promise_date`，MRP 算的是 `bom` × `sales_order_items` 减 `inventory`，
车间报工写 `production_records`，质检写 `quality_checks`，发货写 `shipments`。
**同一张 `work_orders` 表，在 8 个节点被从 8 个角度查**。这就是 MES 实施工程师真实的认知结构。

#### 4.2.2 `dataset.sql` 扩展（P1 必做）

现有 7 张表（`dataset.sql`：`products / materials / bom / equipment / work_orders / production_records / quality_checks`）
只覆盖 生产·质量 段。按 12 节点补齐两端：

| 新增表 | 服务节点 | 关键列（够出题即可，不求完备） |
|--------|----------|-------------------------------|
| `customers` | cust-order | `id, name, level` |
| `sales_orders` | cust-order / order-review | `id, customer_id, order_no, order_date, due_date, promise_date, status` |
| `sales_order_items` | cust-order / mrp | `id, order_id, product_id, qty` |
| `mps_plans` | mps | `id, product_id, week, qty_plan, source_order_id` |
| `mrp_requirements` | mrp | `id, material_id, req_qty, on_hand, gap_qty, need_date, source` |
| `suppliers` | purchase | `id, name, lead_time_days, on_time_rate` |
| `purchase_orders` | purchase | `id, supplier_id, material_id, qty, po_date, eta, arrived_at, status` |
| `routings` | bom-route | `id, product_id, seq, process_name, work_center, std_hours` |
| `pick_lists` | picking | `id, wo_id, material_id, qty_required, qty_issued, issued_at` |
| `inventory` | picking / stock-in | `id, item_type, item_id, warehouse, qty, updated_at` |
| `stock_in_records` | stock-in | `id, wo_id, product_id, qty, in_at, warehouse` |
| `shipments` | shipping | `id, order_id, ship_no, ship_date, qty, carrier, status` |

**数据规模**：每表 8~30 行。要求**数据里必须埋进真实病灶**，因为节点级 SQL 题的价值全在这：

- `purchase_orders` 里有 2 条 `eta < 需求日期` 但 `arrived_at IS NULL` → 采购节点「查出会导致停线的逾期到货」。
- `pick_lists` 里有 `qty_issued < qty_required` 的行 → 领料节点「查出哪张工单缺料、缺多少」。
- `quality_checks` 里某台设备（`equipment`）不良率显著偏高 → 质检节点「找出最可能的设备元凶」。
- `sales_orders.promise_date` 有 3 条早于 `work_orders` 的计划完工 → 订单评审节点「查出承诺不了的订单」。

**改动纪律**（`dataset.sql` 是判题哈希的一端，改它风险最高）：

1. **只增不改**：新增表和新增行，**绝不修改现有 7 表的任何一行数据**。改了就会让现存 6 道题的 `answer_hash` 全部失效，且失效方式是**静默判错**（`resultHash.ts:5-6` 的警告）。
2. 新表 `CREATE TABLE` 语句统一追加到文件**末尾**，保持现有语句字节不变。
3. 改完必须跑回归：现存 6 道题逐题在沙箱执行标准答案，比对 `answer_hash` 未变（见 §5.1 验收）。

#### 4.2.3 节点级 SQL 题的挂靠

`sql_exercises.topic_id` 是 `NOT NULL REFERENCES topics(id)`，节点级题目需要一个合法 topic。

**决策**：新建一个 `status='draft'` 的承载主题，**不污染课程列表**。
依据：`chapter.repo.ts:59` 公开主题列表 `WHERE status='published'`，draft 不会出现在 `/courses`，
`QuizPage` 的课程下拉走同一接口，也看不到它。

```sql
INSERT INTO topics (slug, title, description, modules, sort, status, ...)
VALUES ('factory-mainline', '工厂主线实战（节点级）',
        '挂载在工厂全景各节点下的实战题，不作为独立课程展示。',
        '["sql"]', 99, 'draft', ...);
```

`answer_hash` 生成：算法必须与 `web/src/lib/resultHash.ts:30-37` **逐字一致**
（最后一个结果集 → 只取值不取列名 → 每行 `JSON.stringify(row.map(v => v ?? null))` → 不排序 → `\n` 连接 → UTF-8 SHA-256 小写 hex）。
建议在 `scripts/` 下新增 `gen-answer-hash.mjs`：读同一份 `dataset.sql` 建 sql.js 库 → 跑 `answer_sql` → 复用 canonical 算法输出 hex。
**不要手算，也不要另写一份归一化逻辑。**

#### 4.2.4 节点 → SQL 题 映射（P1 目标，12 节点各 1 道）

| 节点 | 题目（`node_resources.title` 写祈使句） | 主表 |
|------|----------------------------------------|------|
| cust-order | 查出本月下单量最大的三个客户和他们的订单金额 | `sales_orders`,`sales_order_items`,`customers` |
| order-review | 查出承诺交期早于计划完工的订单（接不了的单） | `sales_orders`,`work_orders` |
| mps | 按周汇总各产品的计划产量，找出产能最紧的一周 | `mps_plans` |
| mrp | 按 BOM 展开算出缺口物料和缺多少 | `bom`,`sales_order_items`,`inventory` |
| purchase | 查出会导致停线的逾期未到采购单 | `purchase_orders`,`suppliers` |
| bom-route | 列出某产品的完整工艺路线和标准工时合计 | `routings`,`products` |
| picking | 查出哪张工单缺料、缺哪几种、各缺多少 | `pick_lists`,`materials` |
| dispatch | 查出还没派工的工单，按交期紧急度排序 | `work_orders` |
| shopfloor | 统计各工序的实际工时与标准工时偏差 | `production_records`,`routings` |
| qc | 找出不良率最高的设备，并列出它的不合格记录 | `quality_checks`,`equipment` |
| stock-in | 核对完工入库数量与报工合格数是否对得上 | `stock_in_records`,`production_records` |
| shipping | 查出已发货但数量少于订单量的发货单 | `shipments`,`sales_orders` |

（题面/答案 SQL 由内容侧按此清单撰写；架构侧只约束表、`topic_id`、`answer_hash` 生成方式。）

### 4.3 节点级测验：一题定生死

- 每节点 1 道 `single`/`judge` 题，`ref_id` → `questions.id`，深链 `/quiz/q/:id`。
- 题干必须是**这一环的判断题**，不是名词解释。
  反例：「MRP 的全称是什么」。正例：「某物料在制 200、在库 50、需求 300，MRP 建议采购量是多少」。
- `questions.chapter_id` 是 `NOT NULL`：节点级题挂到该节点 `chapter` 资源指向的同一章，保持归属一致。
  节点没有配 chapter 的，挂到 `factory-mainline` 主题下新建的一个占位章（`status='draft'`）。
- 判题走既有 `POST /api/v1/quiz/grade`，答对即 `markDone`；答错展示 `explanation` 并提示「回上一步看知识」。

### 4.4 节点级知识：不新写内容，做「切片引用」

- P1 **复用现有 `chapters`**，`ref_id` 指向最贴近该节点的一章。找不到贴切章节的节点（如 cust-order），
  P1 **就不配 chapter 资源**（约束 C3：宁缺勿滥），面板左列的 `node.description` 已经承担了一句话锚点。
- P3 再补节点级短章（每篇 300~600 字，只讲「这一环在干什么 + 在 MES 里对应哪张单据/哪张表」）。

### 4.5 P2 沙盒：让节点 =「看这条产线怎么转」

#### 4.5.1 场景 key 与蓝图

- `fault_scenarios` 加 `slug` + `blueprint_json`（§2.5），`variant='sim'`。
- `blueprint_json` 存 `SimProject` 形状，即把 `simReducer.ts:67-93` 的 `seedExampleFactory()` 产物序列化。
- 节点资源：`res_type='sim'`，`ref_id` = `fault_scenarios.id`，深链参数用 **slug**（稳定），
  故 `resources` 里 sim 类型需要携带 slug —— 这是 P2 唯一需要的后端 DTO 扩展：
  `flowchart.routes.ts` 对 `res_type='sim'` 的行 LEFT JOIN `fault_scenarios` 补一个 `refSlug` 字段。

#### 4.5.2 `/simulator?scenario=<slug>` 加载链路

```
SimulatorPage
  └─ useSearchParams().get('scenario')
       ├─ 有 slug → useQuery(api.simScenario(slug)) → hydrate(blueprint_json) → dispatch RESET_TO
       └─ 无 slug → 现有行为不变（loadFromStorage() ?? seedExampleState()）
```

`simReducer.ts` 需要的最小改动：把 `seedExampleState()` 泛化为
`stateFromProject(p: SimProject): SimState`，`seedExampleState()` 变成 `stateFromProject(seedExampleFactory 包装)` 的特例。
**不改 `SimState` 形状，不改任何 action**，避免波及 `SimCanvas` / `SimEngine`。

#### 4.5.3 存档冲突处理（必须显式设计，否则 P2 一定出 bug）

现有沙盒把状态存 `sim_project`（已在 `USER_DATA_KEYS` 里，云端镜像）。
带 `?scenario=` 进来会和用户自己的存档打架。规则：

- 场景模式**不覆盖**用户存档：进入时把当前 `sim_project` 挂起，场景状态存在内存 + 单独 key `sim.scenario.<slug>`。
- 顶部显示「正在运行：车间执行 · 离散产线」+「回到我的工厂」按钮，退出即恢复原存档。
- 这条不做，用户搭了半天的产线会被节点跳转静默清空——是会掉用户的那种 bug。

#### 4.5.4 沙盒的「做」是什么

不是「看动画」。进场景后给一个**可判定的任务**（复用 `fault_scenarios.prompt` + `solution_json`）：

- 车间执行：「跑一轮，找出瓶颈工序」→ 答对瓶颈节点即通过。
- 质量检验：「把不合格品回流边接对，让返工率降到 5% 以下」→ 跑引擎校验指标。
- 领料发料：「线边仓容量不够导致堵料，调整批量让在制品不超过 X」。

判定用现有 `simEngine.ts` 的运行结果，**P2 只做「跑一轮 + 指标达标即通过」，不做复杂评分**。

---

## 5. 分阶段实施计划

### P1 · 知识 + SQL + 测验闭环跑通（本轮交付）

**目标**：12 个节点每站至少 1 道节点级 SQL + 1 道节点级测验，能做、能判、能标完成、能回主轴。

| # | 文件 | 改动 | 类型 |
|---|------|------|------|
| 1 | `web/src/features/sql-sandbox/dataset.sql` | 末尾追加 12 张新表 + 埋病灶数据。**现有 7 表一字节不改** | 内容 |
| 2 | `web/src/features/sql-sandbox/dataset.ts` | `SANDBOX_TABLES` / `TABLE_SCHEMAS` 补新表（结构提示要跟上，否则学员看不到表结构） | 前端 |
| 3 | `scripts/gen-answer-hash.mjs` | 新增：同一份 dataset.sql 建库 → 跑 answer_sql → 复用 `canonicalizeRows` 算法出 hex | 工具 |
| 4 | `worker/src/migrations/seed-flowchart-sql-exercises.sql` | 新增：`factory-mainline` draft topic + 12 道节点级 SQL 题（含 `answer_hash`） | 内容 |
| 5 | `worker/src/migrations/seed-flowchart-questions.sql` | 新增：12 道节点级 MCQ（+ 必要的 draft 占位章） | 内容 |
| 6 | `worker/src/migrations/seed-flowchart-generic-resources.sql` | 新增：`node_resources` 挂载，**全部子查询取 id**（§2.3），含限定范围的重跑清理 | 内容 |
| 7 | `worker/src/data/repositories/quiz.repo.ts` | 加 `getQuestion(db,id)`，列表照抄 `listQuestions`（不含 `answer`/`reference_answer`/`explanation`，R6 铁律） | 后端 |
| 8 | `worker/src/modules/quiz/quiz.routes.ts` | 加 `getQuestionById` | 后端 |
| 9 | `worker/src/router.ts` | 注册 `GET /api/v1/quiz/questions/:id`，**排在 121 行 query 版之后** | 后端 |
| 10 | `web/src/api/endpoints.ts` | 加 `quizQuestion(id)`；`NodeResourceDTO.type` 收窄为 `'chapter'\|'quiz'\|'sql'\|'sim'` | 前端 |
| 11 | `web/src/lib/userData.ts` | `USER_DATA_KEYS` 加 `'factory.progress'` | 前端 |
| 12 | `web/src/features/factory/useNodeProgress.ts` | 新增 Hook（§3.4） | 前端 |
| 13 | `web/src/features/factory/NodeStation.tsx` | 新增：站内资源列表渲染（§3.5） | 前端 |
| 14 | `web/src/features/factory/FactoryFlow.tsx` | 删 `DRILLS`(102-106) 与其渲染块(447-459)；接 `resources` 分组 + `useNodeProgress`；`nextKey` 改判据；`safeIcon` 守卫；废弃 `factory.visited` | 前端 |
| 15 | `web/src/pages/QuizQuestionPage.tsx` + `App.tsx` | 新增单题页 + 路由 `/quiz/q/:questionId`（lazy） | 前端 |
| 16 | `ChapterPage.tsx` / `ExercisePage.tsx` / `QuizQuestionPage.tsx` | 读 `?from=factory&node=`，顶部渲染「返回工厂全景 · {节点名}」，完成后回跳 | 前端 |

**P1 验收标准（逐条可验，缺一不算完）**

1. `wrangler d1 execute mes-learning --remote --file=...` 四个 seed 文件按 §2.3 顺序执行成功。
2. **重跑幂等**：`seed-flowchart-generic.sql` + resources 连跑两遍，`SELECT COUNT(*) FROM node_resources` 前后一致，且 §2.2 的悬空引用自检返回 **0 行**。
3. `GET /api/v1/flowchart/generic-factory`（带 `Origin: https://mes-site.qijia2002.workers.dev`）返回 `resources.length >= 24`，且每个 `nodeId` 至少 2 条。
4. **判题回归**：现存 6 道 SQL 题逐题跑标准答案，`hashResultSet` 结果与库中 `answer_hash` 一致（证明 dataset.sql 扩展没打破契约）。
5. **新题可判**：12 道节点级 SQL 题各跑一次标准答案，全部判 pass。
6. 前端点任意节点，右列显示的是**该节点专属**的动作条目（12 个节点两两不同），无 `/simulator`、`/quiz`、`/sql-space` 通用链接残留。
7. 做完一道节点 SQL → 回工厂全景 → 该行显示 `check-circle`，站内进度 `1/2`；刷新页面/换设备后仍保留。
8. `nextKey` 指向的是第一个 practice 未做完的节点，不是第一个没点开的节点。
9. **P0 门禁**：`node scripts/p0scan.mjs`（或 `tmp/p0gate_v10.py`）对新增/改动前端文件扫描——emoji 0、硬编码 hex 0、rgba 0、渐变 0。
10. `npm run typecheck` worker + web 双通过；`npm run build` 后 `worker/dist/index.html` **非 0 字节**（Windows EPERM 坑）。

### P2 · 沙盒场景化

| 文件 | 改动 |
|------|------|
| `worker/src/migrations/schema-sim-scenario.sql` | 新增：`fault_scenarios` 加 `slug` + `blueprint_json` + 部分唯一索引 |
| `worker/src/migrations/seed-sim-scenarios.sql` | 新增：3~5 个 `variant='sim'` 场景蓝图 |
| `worker/src/data/repositories/*.repo.ts` + 新 route | `GET /api/v1/sim-scenarios/:slug` |
| `worker/src/modules/flowchart/flowchart.routes.ts` | `res_type='sim'` 行 LEFT JOIN 补 `refSlug` |
| `web/src/features/simulator/simReducer.ts` | `seedExampleState()` → 泛化 `stateFromProject(p)`；不改 `SimState` 形状 |
| `web/src/features/simulator/SimulatorPage.tsx` | 读 `?scenario=`；存档挂起/恢复（§4.5.3）；顶部场景条 + 「回到我的工厂」 |
| `web/src/features/factory/NodeStation.tsx` | 打开 `sim` 行 |

**P2 验收**：① 带 `?scenario=` 进入加载对应蓝图，画布节点数/连线数与蓝图一致；
② **退出场景后用户原存档完好**（进场景前后 `sim_project` 内容比对一致）——这条是 P2 的主要风险点；
③ 跑一轮引擎，达标即 `markDone`，回工厂全景该站显示已完成；④ 无 `scenario` 参数时行为与今天完全一致（回归）。

### P3 · 节点级内容精修 + 多流程图扩展

- 为 P1 未配 chapter 的节点补节点级短章（300~600 字），`res_type='chapter'` 补挂。
- 每节点 SQL 从 1 道加到 2~3 道（易/中/难），`sort` 拉开梯度。
- 第二张流程图（如 `process-factory` 流程行业）：**只写 seed，零代码**——
  §2.3 的子查询规范 + `FactoryFlow({slug})` 已有的 slug 入参保证机制天然支持多 flow。
  验收标准即：新增一个 flow 只改 SQL 文件，前端零改动。
- 可选：`flow_nodes` 加 `phase` 字段，替换 `FactoryFlow.tsx:71` 的 `PHASE_BY_KEY` 前端硬编码映射
  （目前新流程图的节点全部落到默认 `plan` 相位）。

---

## 6. 风险清单

| 风险 | 影响 | 缓解 |
|------|------|------|
| 改 `dataset.sql` 打破 `answer_hash` 契约 | **最高**：全站 SQL 判题静默判错，用户以为自己写错 | 只增不改 + 现存 6 题回归（验收 4）；改动集中在文件末尾 |
| `node_resources` 写死 `node_id` | seed 重跑后资源错挂到别的节点 | §2.3 强制子查询；悬空自检（验收 2）；code review 直接搜 `INSERT INTO node_resources` 后是否跟 `VALUES (` 数字 |
| 单题接口下发 `answer` | 泄题 | `getQuestion` 的 SELECT 列表与 `listQuestions` 对齐；review 必查 |
| P2 场景覆盖用户沙盒存档 | 掉用户数据 | §4.5.3 挂起/恢复；验收 ② 显式比对 |
| 内容工作量（12 SQL + 12 MCQ + 12 张表数据） | P1 周期拉长 | 架构侧已把代码改动压到最小（后端仅 3 个薄文件）；内容可按节点分批 seed，`resources` 有多少渲染多少（约束 C3 天然支持增量上线） |
| `FactoryFlow.tsx` 继续膨胀 | 单文件已 496 行 | 面板拆 `NodeStation.tsx`、状态拆 `useNodeProgress.ts`；单文件 ≤ 300 行为目标 |

---

## 7. 与既有文档的关系

- **取代** `design-system/factory-panorama-learning-loop.md`（v12 方向草案）：本文在其基础上补齐了
  代码核实结论、§0.1 的 dataset 死字段发现、seed 规范、进度存储裁决、验收标准。旧文档建议标记为 superseded。
- **不改动** `design-system/factory-flow-redesign.md`（v10/v11.5 视觉规范）：本方案不动节点卡片视觉、
  不动折行网格、不动就近展开面板，只替换面板右列的内容来源。
