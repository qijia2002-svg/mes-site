# 职业路线图 API 契约 v1

> 关联：`docs/architecture/career-roadmap-schema.md`、`docs/seeds/migration-career-roadmap.sql`、`docs/decisions/ADR-012-career-roadmap-model.md`
> 本期**只读**。管理端写接口不做，数据由 `docs/seeds/career-roadmap-data.json` 灌入。

---

## 0. 通用约定（前后端都必须先读这段）

### 0.1 响应封装

沿用 `worker/src/core/response.ts`，**不新增封装格式**：

```jsonc
// 成功
{ "code": 0, "data": <T>, "msg": "ok", "traceId": "01JB..." }
// 失败
{ "code": 4001, "data": null, "msg": "内容不存在或尚未发布", "traceId": "01JB..." }
```

错误码全部复用 `core/errors.ts`，**不新增错误码**：

| code | HTTP | 触发场景 |
|------|------|----------|
| 1001 | 400 | `?career=` 缺失或为空 |
| 1003 | 400 | slug 非法（长度 >64 或含 `/`） |
| 4001 | 404 | slug 不存在，或 `status != 'published'` |
| 5001 | 503 | D1 过载 |
| 5002 | 500 | 单请求 D1 语句数超 40（`DbSession` 预算护栏） |

### 0.2 认证：可选登录（重要，别写错）

5 个接口**都允许匿名访问**，但登录用户要能看到进度。

`router.ts` 的 `defaultMiddlewares` 有个坑：`noAuth: true` 走的是 `[trace, security, validate]`，
**根本不执行 `auth` 中间件**，于是 `c.auth` 永远为空——已登录用户也拿不到进度。
所以这 5 条路由必须**显式指定中间件数组**，用 `auth` 但不挂 `guardAll`：

```ts
// worker/src/router.ts
import { listTracks, getTrack, listCareers, getCareer, getRoadmapGraph }
  from './modules/roadmap/roadmap.routes';

/** 可选登录管线：解析会话但不拦截匿名（进度按未登录处理） */
const optionalAuth: Middleware[] = [trace, security, auth, validate];

// 追加到 routes 数组末尾
{ method: 'GET', path: '/api/v1/tracks',         middlewares: optionalAuth, handler: listTracks },
{ method: 'GET', path: '/api/v1/tracks/:slug',   middlewares: optionalAuth, handler: getTrack },
{ method: 'GET', path: '/api/v1/careers',        middlewares: optionalAuth, handler: listCareers },
{ method: 'GET', path: '/api/v1/careers/:slug',  middlewares: optionalAuth, handler: getCareer },
{ method: 'GET', path: '/api/v1/roadmap/graph',  middlewares: optionalAuth, handler: getRoadmapGraph },
```

> **待产品确认**：站内其余只读接口（`/topics`、`/chapters`）都是 `guardAll` 强制登录，
> 路线图设为公开与现状不一致。若决定改回强制登录，删掉 `middlewares` 覆盖即可，
> 前端的「未登录 → 进度 0」分支不用改（永远走不到而已）。

### 0.3 缓存策略

`response.ts` 对所有响应写死 `cache-control: no-store`，**浏览器/CDN 不缓存**。
真正的缓存在服务端 L2（`core/cache.ts` 的 `cachedJson` + `caches.default`），
键为 `cv{content_version}:{path}`，后台发布内容时 `content_version` 自增即整体失效，无需 purge。

| 接口 | L2 缓存 | TTL | 缓存键 |
|------|---------|-----|--------|
| `GET /tracks` | 是 | 300s | `cv{v}:tracks` |
| `GET /tracks/:slug` | 是 | 300s | `cv{v}:tracks/{slug}` |
| `GET /careers` | 是 | 300s | `cv{v}:careers` |
| `GET /careers/:slug` | 是 | 300s | `cv{v}:careers/{slug}` |
| `GET /roadmap/graph` | **仅骨架** | 300s | `cv{v}:roadmap/graph/{career}` |

**`/roadmap/graph` 绝不整体缓存**——响应里含用户进度，整体缓存会把 A 的进度发给 B。
实现方式：骨架（节点/边/分母）走 `cachedJson`，进度用**一条**查询单独取，在内存里叠加。

### 0.4 D1 语句预算（`DbSession` 上限 40，超限抛 5002）

| 接口 | 冷缓存语句数 | 热缓存 |
|------|--------------|--------|
| `/tracks` | 3 | 1 |
| `/tracks/:slug` | 4 | 1 |
| `/careers` | 2 | 1 |
| `/careers/:slug` | 4 | 1 |
| `/roadmap/graph` | 5 | 2 |

**硬性要求：禁止按 stage / level 循环查库。** 一律「一次取全集 + 内存分组」。
5 个岗位 × 4 阶段的 N+1 写法会直接把语句数打到 20+，并在内容扩充后触发 5002。

### 0.5 代码落位（照 learning-paths 模块的样子来）

```
worker/src/modules/roadmap/roadmap.routes.ts    薄路由：取参 → 调 service → ok/fail
worker/src/modules/roadmap/roadmap.service.ts   tracks / careers 的 DTO 组装 + L2 缓存
worker/src/modules/roadmap/roadmap.graph.ts     graph 聚合（骨架缓存 + 进度叠加）
worker/src/data/repositories/roadmap.repo.ts    纯 SQL，无业务分支
```

`roadmap.service.ts` 逼近 300 行时把 graph 拆到 `roadmap.graph.ts`（上表已按拆分后列出）。
DTO 一律**显式字段白名单**构造，禁止 `SELECT *` 直接 `JSON.stringify`。

### 0.6 图标字段

`icon` 返回的是**语义名字符串**（ADR-002 / ADR-012），前端一律 `<Icon name={t.icon} />`。
不是 emoji、不是组件名、不是 URL。取值必须在 `web/src/components/Icon.tsx` 的 `IconName` 里；
本期需先给 `Icon.tsx` 补 13 个语义键，清单见 schema 文档 §8。
**前端拿到未注册的语义名时不要 fallback 成 emoji**，退化成 `paths`（Route 图标）即可。

---

## 1. `GET /api/v1/tracks`

能力路线列表。首页 / 路线总览页用。

**请求参数**：无。（`status != 'published'` 的行永不返回，不提供 `?status=` 开关。）

**认证**：可选登录。本接口**不含进度**，登录与否响应完全一致。

**响应**

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 3,
        "slug": "sql",
        "title": "SQL 与数据分析",
        "subtitle": "从单表查询到生产报表",
        "kind": "core",
        "icon": "sql",
        "summary": "MES/ERP 岗位的通用底座能力。能独立写出车间日报、良率统计、追溯查询三类 SQL 即达标。",
        "sort": 30,
        "chapterTotal": 24,
        "levels": [
          {
            "level": 1,
            "name": "L1 入门",
            "goal": "看懂表结构，写出带条件的单表查询",
            "hours": 12,
            "chapterCount": 9,
            "plannedCount": 0,
            "hasContent": true
          },
          {
            "level": 2,
            "name": "L2 中级",
            "goal": "多表 JOIN、聚合、窗口函数，能出车间日报",
            "hours": 18,
            "chapterCount": 11,
            "plannedCount": 2,
            "hasContent": true
          },
          {
            "level": 3,
            "name": "L3 高级",
            "goal": "执行计划、索引调优、千万级追溯表查询优化",
            "hours": 20,
            "chapterCount": 4,
            "plannedCount": 6,
            "hasContent": true
          }
        ]
      }
    ],
    "total": 8
  },
  "msg": "ok",
  "traceId": "01JBQ7M2X8NRT3K9V4F6ZP0AWD"
}
```

**字段口径**

| 字段 | 类型 | 说明 |
|------|------|------|
| `kind` | `"core" \| "elective"` | 主干必修 / 选修 |
| `icon` | `string` | Icon.tsx 语义名 |
| `chapterTotal` | `number` | 全路线 published 章节数 = 三级之和；**不含 planned** |
| `levels[].chapterCount` | `number` | 该级 published 章节数（进度分母） |
| `levels[].plannedCount` | `number` | `planned_chapters` 数组长度，**不进分母**，前端画虚线占位 |
| `levels[].hasContent` | `boolean` | `chapterCount > 0`；为 `false` 时前端渲染「建设中」而非 0% 进度环 |

`levels` 恒为 3 个元素且按 `level` 升序；某级尚未建行时后端补默认值（`hours:0`、`chapterCount:0`、`hasContent:false`），
**前端可以放心按定长 3 渲染**。

---

## 2. `GET /api/v1/tracks/:slug`

单条路线详情。

**请求参数**：路径段 `slug`，如 `/api/v1/tracks/sql`。仅接受 slug，**不兼容数字 id**
（与 `/topics/:id` 的双兼容不同，新表没有对外暴露 id 的场景）。

**认证**：可选登录。登录时额外返回 `chapters[].done` 与 `levels[].progress`；未登录时 `done` 恒 `false`、`progress.done` 恒 `0`。

**响应**

```json
{
  "code": 0,
  "data": {
    "id": 3,
    "slug": "sql",
    "title": "SQL 与数据分析",
    "subtitle": "从单表查询到生产报表",
    "kind": "core",
    "icon": "sql",
    "summary": "MES/ERP 岗位的通用底座能力。",
    "sort": 30,
    "authenticated": true,
    "levels": [
      {
        "level": 2,
        "name": "L2 中级",
        "goal": "多表 JOIN、聚合、窗口函数，能出车间日报",
        "hours": 18,
        "outcomes": [
          "能用 JOIN 关联工单表与报工表算出实际产出",
          "能写出按班次分组的良率统计",
          "看得懂别人写的三层嵌套子查询"
        ],
        "chapters": [
          { "id": 118, "title": "多表 JOIN 与工单关联", "topicId": 4, "sort": 0, "done": true },
          { "id": 119, "title": "GROUP BY 与班次良率统计", "topicId": 4, "sort": 1, "done": true },
          { "id": 123, "title": "窗口函数：环比与累计产量", "topicId": 4, "sort": 2, "done": false }
        ],
        "plannedChapters": [
          { "title": "CTE 递归查询 BOM 展开", "desc": "多层 BOM 用递归 CTE 一次展开到底层物料" },
          { "title": "日期维度表与生产日历", "desc": "跨月统计为什么必须建日期维表" }
        ],
        "progress": { "done": 2, "total": 3, "percent": 67, "state": "in_progress" }
      }
    ],
    "relatedCareers": [
      { "slug": "mes-implementation", "title": "MES 实施工程师", "icon": "career-mes-impl", "importance": "core" },
      { "slug": "scada-engineer",     "title": "SCADA 数采工程师", "icon": "career-scada",   "importance": "important" }
    ]
  },
  "msg": "ok",
  "traceId": "01JBQ7M2X8NRT3K9V4F6ZP0AWE"
}
```

**字段口径**

- `outcomes` / `plannedChapters`：由 `track_levels` 的 JSON 列解析而来。解析失败一律降级为 `[]`，
  **不抛异常**（照 `lp.service.ts` 的 `parseIds` 写法）。
- `chapters`：`track_level_chapters INNER JOIN chapters`，只含 `status='published'` 的行，按 `sort, id` 排序。
  悬空 id 静默丢弃，不出现在数组里。
- `relatedCareers`：经 `career_stage_reqs → career_stages → career_paths` 反查，按路线**整体**去重
  （同一岗位在多级出现只保留一条，`importance` 取最强，core > important > optional）。
- `progress.state`：`"planned"`（total=0）| `"not_started"`（done=0）| `"in_progress"` | `"completed"`。
- `percent`：`Math.round(done / total * 100)`，`total=0` 时为 `0`。

**404**：slug 不存在或 `status='draft'` → `{ "code": 4001, ... }`（HTTP 404）。

---

## 3. `GET /api/v1/careers`

岗位列表。

**请求参数**：无。
**认证**：可选登录。不含进度。

**响应**

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1,
        "slug": "mes-implementation",
        "title": "MES 实施工程师",
        "tagline": "把系统装进车间，让工人愿意用",
        "salary": "10-18K / 月（长三角，2 年经验）",
        "demand": "高",
        "overview": "负责 MES 项目从蓝图确认到上线陪产的全过程，是甲方和研发之间的翻译层。",
        "icon": "career-mes-impl",
        "sort": 10,
        "stageCount": 4,
        "trackCount": 6
      }
    ],
    "total": 5
  },
  "msg": "ok",
  "traceId": "01JBQ7M2X8NRT3K9V4F6ZP0AWF"
}
```

| 字段 | 说明 |
|------|------|
| `salary` / `demand` | **展示用原文字符串**，后端不做区间解析、不排序、不筛选 |
| `stageCount` | 阶段数 |
| `trackCount` | 该岗位涉及的**去重后**能力路线条数（不是需求边数量） |

列表接口**不返回** `daily_work` / `outputs`，避免首屏拉一堆用不上的数组。要用去详情。

---

## 4. `GET /api/v1/careers/:slug`

岗位详情。阶段 + 每阶段需求，需求已 JOIN 出路线标题与图标。

**请求参数**：路径段 `slug`，如 `/api/v1/careers/mes-implementation`。
**认证**：可选登录。登录时 `requirements[].progress` 为真实值，未登录恒 0。

**响应**

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "slug": "mes-implementation",
    "title": "MES 实施工程师",
    "tagline": "把系统装进车间，让工人愿意用",
    "salary": "10-18K / 月（长三角，2 年经验）",
    "demand": "高",
    "overview": "负责 MES 项目从蓝图确认到上线陪产的全过程，是甲方和研发之间的翻译层。",
    "icon": "career-mes-impl",
    "authenticated": true,
    "dailyWork": [
      "现场调研产线工艺，画出工单流转路径",
      "配置 MES 基础数据：工厂建模、BOM、工艺路线",
      "培训一线班组长扫码报工，处理上线首周的爆炸式反馈"
    ],
    "outputs": [
      "《业务蓝图确认书》",
      "《基础数据导入模板》与实际导入结果",
      "《上线切换方案》与回滚预案"
    ],
    "stages": [
      {
        "stage": 1,
        "title": "打底：看懂制造业在干什么",
        "duration": "1-2 个月",
        "goal": "能听懂车间黑话，说清工单从下达到入库的完整链路",
        "milestone": "能独立画出一张工厂的工艺路线图并被产线主管认可",
        "interviewPoints": [
          "工单、派工单、报工单三者的区别",
          "为什么在制品（WIP）数量对不上"
        ],
        "deliverables": ["一张手绘的产线工艺路线图"],
        "requirements": [
          {
            "trackSlug": "mes",
            "trackTitle": "MES 制造执行",
            "trackIcon": "mes",
            "level": 1,
            "levelName": "L1 入门",
            "importance": "core",
            "note": "重点吃透工单流转和在制品口径",
            "progress": { "done": 5, "total": 8, "percent": 63, "state": "in_progress" }
          },
          {
            "trackSlug": "sql",
            "trackTitle": "SQL 与数据分析",
            "trackIcon": "sql",
            "level": 1,
            "levelName": "L1 入门",
            "importance": "important",
            "note": "先能查，再谈分析",
            "progress": { "done": 9, "total": 9, "percent": 100, "state": "completed" }
          }
        ]
      }
    ],
    "summary": { "chapterDone": 14, "chapterTotal": 46, "percent": 30 }
  },
  "msg": "ok",
  "traceId": "01JBQ7M2X8NRT3K9V4F6ZP0AWG"
}
```

`stages` 按 `stage` 升序；`requirements` 按 `sort, id` 升序。
`summary` 是该岗位**涉及的所有路线等级去重后**的章节完成情况（同一 level 被两个阶段引用只算一次）。

**404**：同 §2。

---

## 5. `GET /api/v1/roadmap/graph?career=:slug`

**路径图专用聚合接口**。一次返回画图所需的全部节点和边，前端不用再发第二个请求。

**请求参数**

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| `career` | query | 是 | 岗位 slug。缺失/空 → `1001`；长度 >64 或含 `/` → `1003`；查不到 → `4001` |

**认证**：可选登录。**未登录时所有 `progress.done` 与 `percent` 返回 0，`total` 照常返回真实值**，
`summary.authenticated = false`，前端据此提示「登录后查看学习进度」。

**响应**

```json
{
  "code": 0,
  "data": {
    "career": {
      "slug": "mes-implementation",
      "title": "MES 实施工程师",
      "tagline": "把系统装进车间，让工人愿意用",
      "icon": "career-mes-impl"
    },
    "nodes": [
      {
        "id": "stage:1",
        "type": "stage",
        "stage": 1,
        "title": "打底：看懂制造业在干什么",
        "duration": "1-2 个月",
        "goal": "能听懂车间黑话，说清工单从下达到入库的完整链路",
        "milestone": "能独立画出一张工厂的工艺路线图并被产线主管认可",
        "icon": "stage"
      },
      {
        "id": "level:7",
        "type": "level",
        "trackSlug": "mes",
        "trackTitle": "MES 制造执行",
        "trackIcon": "mes",
        "trackKind": "core",
        "level": 1,
        "levelName": "L1 入门",
        "hours": 10,
        "progress": { "done": 5, "total": 8, "percent": 63, "state": "in_progress" }
      },
      {
        "id": "level:12",
        "type": "level",
        "trackSlug": "barcode-rfid",
        "trackTitle": "条码与 RFID",
        "trackIcon": "barcode",
        "trackKind": "elective",
        "level": 1,
        "levelName": "L1 入门",
        "hours": 6,
        "progress": { "done": 0, "total": 0, "percent": 0, "state": "planned" }
      }
    ],
    "edges": [
      {
        "id": "edge:1:7",
        "from": "stage:1",
        "to": "level:7",
        "importance": "core",
        "note": "重点吃透工单流转和在制品口径"
      },
      {
        "id": "edge:1:12",
        "from": "stage:1",
        "to": "level:12",
        "importance": "optional",
        "note": "有条码基础会加分，没有也不卡"
      }
    ],
    "summary": {
      "authenticated": true,
      "stageCount": 4,
      "levelCount": 9,
      "chapterDone": 14,
      "chapterTotal": 46,
      "percent": 30
    }
  },
  "msg": "ok",
  "traceId": "01JBQ7M2X8NRT3K9V4F6ZP0AWH"
}
```

**图结构契约（前端画图直接照这个来）**

- `nodes[].id` 是**全局唯一字符串**，格式固定：`stage:{stage_id}` / `level:{track_level_id}`。
  `edges[].from` / `edges[].to` 只会引用 `nodes` 里出现过的 id，**不会有悬空边**。
- `nodes` 顺序：先全部 `stage` 节点（按 `stage` 升序），再全部 `level` 节点
  （按 `tracks.sort`、`level` 升序）。前端可以直接按序布局成两列/两行。
- `level` 节点**已按 `track_level_chapters.level_id` 去重**：同一能力等级被多个阶段要求时
  只出一个节点、多条边。这正是这张图的价值——一眼看出哪个能力被反复依赖。
- 边只有一种方向：`stage → level`。不存在 level→level 的前置依赖边（本期不建模能力先修关系）。
- `progress.state` 枚举同 §2。`state = "planned"` 表示该等级章节还没建，前端画虚线边框空心节点。

**进度计算（后端实现口径，写代码照抄）**

```sql
-- 分母 + 分子一次算完，一条语句搞定；:uid 为空（未登录）时 done 恒为 0
SELECT tlc.level_id                                            AS level_id,
       COUNT(c.id)                                             AS total,
       COUNT(pe.event_id)                                      AS done
FROM   track_level_chapters tlc
JOIN   chapters c
       ON  c.id = tlc.chapter_id
       AND c.status = 'published'
LEFT   JOIN progress_events pe
       ON  pe.anon_id   = ?1                 -- 会话 c.auth.sub；未登录传 '' 即可全部 miss
       AND pe.item_type = 'chapter'
       AND pe.status    = 'done'
       AND pe.item_id   = CAST(c.id AS TEXT) -- item_id 是 TEXT，必须 CAST，否则静默不匹配
WHERE  tlc.level_id IN (/* 本岗位涉及的 level_id，由上一条查询得出，参数化展开 */)
GROUP  BY tlc.level_id;
```

三个务必注意的点：

1. `progress_events.anon_id` 存的是**登录会话 `c.auth.sub`**，不是匿名 UUID（历史命名，见 `progress.repo.ts`）。
2. `item_id` 是 `TEXT`、`chapters.id` 是 `INTEGER`，比较必须 `CAST(c.id AS TEXT)`。
3. `planned_chapters` **不参与这条 SQL**，因此永远不进分母——这是产品口径，不要"顺手"加上。

**未登录短路**：`c.auth` 为空时**不发这条查询**（省一条语句），直接用骨架里的 `total`、`done` 填 0。

**缓存**：骨架（career + nodes 的静态部分 + edges + 各 level 的 `total`）走
`cachedJson('cv{v}:roadmap/graph/{slug}', 300, ...)`；`done` / `percent` / `state` / `summary`
在缓存之外逐请求叠加。**叠加时必须深拷贝骨架**，否则会把 A 的进度写进被 B 复用的缓存对象。
