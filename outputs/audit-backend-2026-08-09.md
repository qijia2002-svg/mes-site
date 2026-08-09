# 后端体检报告 — MES 实训平台

审计人：贝洛奇（后端）· 日期：2026-08-09 · 范围：`worker/src/**` + D1 · **只读，未改任何代码**

---

## 0. 结论

**verdict: fail** — 1 条 BLOCKING（未登录可拖走全部题库答案，且与代码自述的契约相反）。

其余为「稳定运行的技术债」：**58 个已注册端点中 12 个前端零调用（21%）**，2 个整文件死代码，
9 张僵尸表（其中 1 张有 14 行已撰写内容却无任何代码读取）。这些不影响线上稳定，但正是用户问的
「有功能有但是没有用」。

| 项目 | 数量 | 说明 |
|---|---|---|
| 后端注册端点 | 58 | `worker/src/router.ts` 集中注册 |
| 僵尸端点（前端零调用） | **12** | 全部 HTTP 可达（401/200），非 404 |
| 反向缺口（前端调了后端没有） | **0** | 无隐藏 404 |
| 整文件死代码 | 2 个文件 107 行 | `registry/` 下两个文件 |
| D1 表 | 35（除系统表） | 其中 9 张运行时代码零引用 |
| 单文件 >300 行 | 1 | `engine.service.ts` 320 行 |
| 分层违规 | 4 处 routes→repo 跨层 | 稳定运行，非缺陷 |

---

## 1. 审计方法（证据口径）

僵尸接口结论**均双向验证**，单向搜索不采信：

1. 解析 `router.ts` 的 `routes[]`（含多行对象）拿到 58 条 `method+path` 权威清单；
2. 前端侧提取 `apiGet/apiPost/apiPut/apiDelete` + 原生 `fetch` 的调用对，**整文件匹配**（换行不漏）；
3. **方法感知比对**——`GET /topics/:id` 与 `GET /topics` 不混淆；
4. 第三层校验：某端点若在前端仅被一个**无人消费的包装函数**引用，仍判定为僵尸
   （如 `api.progressToday` 定义了但没有任何页面引用它）；
5. 线上 `curl` 带 `Origin` 白名单头实测，区分 401（已注册需登录）与 404（未注册）。

脚本留档：`tmp/audit-endpoints3.mjs`、`tmp/audit-wrappers.mjs`、`tmp/audit-tables.mjs`、`tmp/probe.sh`。

> 纠偏记录：首版脚本按行匹配，把多行书写的 `apiPost(\n '/api/v1/quiz/grade'...)` 误判成僵尸；
> 又把 `queryFn: api.progress`（无括号引用）误判成死包装。两处均已修正后重跑，本报告数据为修正后结果。

---

## 2. BLOCKING

### B1 · 未登录即可批量拖走全部题库答案与解析（契约破坏 + 越权读取）

- **位置**：`worker/src/modules/quiz/quiz.service.ts:97-101`（`gradeAnswerSvc` 返回值）
  ／路由 `worker/src/router.ts:131` 标注 `noAuth: true`
- **问题**：`gradeAnswerSvc` **无条件**返回 `correctAnswer` 与 `explanation`，不区分用户是否答对。
  配合 `noAuth`，任何人无需登录、遍历 `question_id` 即可导出整个题库答案（`questions` 表 90 行）。
- **与自述契约相反**（这是判定为 blocking 而非 advisory 的关键）：
  - `worker/src/router.ts:127` 注释：「题库 / SQL 实训（题面与答案分离，防缓存泄露 R6）」
  - `worker/src/modules/quiz/quiz.routes.ts:20` 注释：「返回对错+解析，**不下发正确答案直到提交后**」
  - 代码中不存在任何「提交后」的门控，一次错误猜测即返回答案。
- **线上实证**（未带任何 Cookie，故意答错）：

  ```
  POST /api/v1/quiz/grade  {"question_id":9201,"answer":"__wrong__"}
  -> {"code":0,"data":{"correct":false,
       "correctAnswer":"报表把短交的采购单算成了按期到货",
       "explanation":"短交是最隐蔽的缺料源头……"}}
  ```
  9202、9203 同样返回完整答案（三次全中，见 `tmp/g9201.json`~`g9203.json`）。

- **期望**：`correct === false` 时不下发 `correctAnswer`/`explanation`；或改为登录后可见 +
  仅在该题已提交过的前提下返回。同时给该端点按会话维度限流（现仅按 IP 5/s，遍历 90 题约 18 秒完成）。
- **失效模式归类**：缺失系统上下文（鉴权/授权维度未逐项验收）+ 沉默逻辑错误
  （无测试覆盖「答错时返回体字段白名单」，行为悄悄偏离注释声明的契约）。

---

## 3. ADVISORY

### A1 · 12 个僵尸端点（后端注册且线上可达，前端零调用）

线上探测证明全部**已注册**（401=需登录，非 404；对照组 `/api/v1/no-such-route-xyz` → 404）。

| # | 端点 | router.ts | 判定依据 |
|---|---|---|---|
| 1 | `GET /api/v1/topics/:id` | :99 | 前端无 `api.topic(id)`，仅有列表 `api.topics` |
| 2 | `GET /api/v1/admin/topics/:id` | :111 | 后台只用列表 + PUT/DELETE，无单条 GET |
| 3 | `GET /api/v1/admin/chapters/:id` | :117 | 同上 |
| 4 | `POST /api/v1/admin/import/start` | :122 | 三阶段导入全链路无前端调用 |
| 5 | `POST /api/v1/admin/import/chunk` | :123 | 同上 |
| 6 | `POST /api/v1/admin/import/commit` | :124 | 同上 |
| 7 | `GET /api/v1/certifications` | :140 | 全前端零引用（grep `certifications` 无命中） |
| 8 | `GET /api/v1/progress/today` | :106 | 唯一引用是死包装 `endpoints.ts:364` |
| 9 | `GET /api/v1/learning-paths/:id` | :139 | 唯一引用是死包装 `endpoints.ts:335` |
| 10 | `GET /api/v1/careers` | :146 | 唯一引用是死包装 `roadmap.ts:216` |
| 11 | `GET /api/v1/careers/:slug` | :147 | 唯一引用是死包装 `roadmap.ts:217` |
| 12 | `GET /api/v1/roadmap/graph` | :148 | 唯一引用是死包装 `roadmap.ts:219` |

**前端侧对应的 4 个死包装**（定义了但无任何页面/组件引用）：
`api.learningPath`、`api.progressToday`、`api.userDataGet`、`api.userDataPut`
（`endpoints.ts:335/364/413/415`）。注意 `userDataGet/Put` 的**端点仍存活**——
真实调用走 `web/src/lib/userData.ts:65,86` 直接 `apiGet/apiPut`，包装是重复实现，删包装不影响功能。

**三条最值得处理的成片死代码**：

- **A1-a 职业路线图 careers 分支**：`GET /careers`、`/careers/:slug`、`/roadmap/graph` 三端点全死，
  背后是 `roadmap.graph.ts`（154 行）+ `roadmap.repo.ts` 的 careers 查询段
  （`listRequirements` 等，:242-274）。
  **数据仍在且线上可取**：`career_paths` 5 行、`career_stages` 20 行、`career_stage_reqs` 90 行，
  合计 115 行已撰写内容。实测 `GET /api/v1/careers` → HTTP 200，返回 5 个岗位的
  title/tagline/salary 完整内容，**但没有任何页面渲染它**。
  这是 pivot 后遗留的完整功能切片，属用户所说「功能有但是没有用」的最大一块。
- **A1-b 证书体系**：`cert.routes.ts`(8) + `cert.service.ts`(15) + `cert.repo.ts`(21) 三件套俱全，
  `certifications` 表 6 行且全部 `status='published'`（cert-data-basics 等），前端零消费。
- **A1-c 三阶段 Excel 导入**：`importStart/Chunk/Commit`（`admin.routes.ts:65,69,72`）+
  `admin.repo.ts:138-152` 的 `import_chunks` 读写，`import_chunks` 表 0 行。
  已被仍在使用的 `POST /admin/import/content` 取代。

> **`GET /api/v1/netinfo`（router.ts:83）不计入僵尸**：它是运维自检页，设计上就由人手敲地址栏访问
> （router.ts:80-82 明确说明「刻意不挂 security，否则导航请求带不上 Origin 就永远打不开」），
> 前端无引用属预期。实测返回网络自检 HTML，功能正常。**建议保留。**

### A2 · 2 个整文件死代码（107 行）

- `worker/src/registry/modules.ts`（26 行）：`MODULE_REGISTRY` / `sanitizeModules` / `ModuleKey`
  全部仅文件内自引用，跨文件零消费。
- `worker/src/registry/demoSchemas.ts`（81 行）：`DEMO_SCHEMAS` / `validateDemoConfig` /
  `isKnownDemoKind` 同上。

> 已排除误报：`hmacSign`/`hmacVerify`（`core/crypto.ts:21,36`）、`mapD1Error`（`data/db.ts:78`）、
> `buildEventId`（`progress.service.ts:60`）看似跨文件无人调用，实为**文件内被调用**
> （crypto.ts:51,62；db.ts:69；progress.service.ts:66）。它们只是导出范围过宽，**不是死代码，不建议删**。

### A3 · 9 张僵尸表；1 张有内容却无人读

`SELECT name FROM sqlite_master WHERE type='table'` 全表 37（含 2 张系统表），逐张 grep `worker/src` 运行时代码：

| 表 | 行数 | 说明 |
|---|---|---|
| **`practice_hints`** | **14** | **有内容、代码零引用**——分级提示（level 1/2/3），如 target `micro:9401`「判断急单要同时看两个字段」。已撰写但从未接线 |
| `block_solutions` | 0 | 空 |
| `media` | 0 | 空 |
| `mes_sandbox_save` | 0 | 空 |
| `node_explainers` | 0 | 空（表结构完整：tier/kind/body_md，功能未启用） |
| `sql_datasets` | 0 | 空 |
| `tags` / `topic_tags` | 0 / 0 | 空 |
| `wrong_questions` | 0 | 空（错题本未实现） |

8 张空表只是 schema 冗余，风险为零；**`practice_hints` 的 14 行提示内容是纯浪费的已产出资产**，
建议要么接线到微练习，要么归档。

### A4 · 单文件超 300 行（1 处）

- `worker/src/modules/engine/engine.service.ts` — **320 代码行 / 409 总行**，超硬上限 20 行。
  其中 `:25-70` 是 7 个 DTO interface。按 `code-organization.md` §4.7「类型/Schema 单独成文件」，
  抽 `engine.types.ts` 即可回到 ~250 行。其余 57 个文件全部合规（次高 `roadmap.service.ts` 283 行）。

### A5 · 分层：4 处 routes 跨层直连 repo

`ai.routes.ts:4`、`dict.routes.ts:4`、`flowchart.routes.ts:4`、`userdata.routes.ts:4`
直接 `import ... from '../../data/repositories/*.repo'`，跳过 service 层，违反
`code-organization.md` §5「禁止 controller → repository」。

这 4 处均为薄 CRUD 转发、线上稳定，**属技术债不属缺陷**；若后续要加业务规则（如权限、审计）
会没有落点。建议在下次触碰这些模块时顺手补 service，不建议为此单独发版。

> `service → core/context` 的 11 处引用（各 `*.service.ts:1`）**不算违规**：本项目 `Ctx` 是
> 自研上下文，承载 `c.db`/`c.env`/`c.log`，非 Express 的 `req`/`res`。service 未返回 HTTP 响应，
> 符合分层意图。

---

## 4. 明确「不是问题」的项（防止误判返工）

审计中触发告警但核实为安全的，逐条澄清：

1. **`roadmap.shared.ts:73` 的 `JSON.parse`** —— 是 `JSON.parse(JSON.stringify(o))` 深拷贝，
   输入是自己刚序列化的对象，非不可信输入。**安全。**
2. **3 处 SQL 模板插值** —— 全部核实为安全：
   - `flowchart.repo.ts:98` 的 `${placeholders}` 是 `?,?,?` 占位符串，值仍参数化绑定；
   - `progress.repo.ts:83,85` 的 `${col}` 来自 `statsColumn()` 封闭枚举（:51-56），非用户输入，
     且 D1 不支持列名绑定，代码已在 :77-78 注释说明；
   - `roadmap.repo.ts:266` 的 `${PUBLISHED_TOTAL}` 是模块常量。
   **无 SQL 注入面。**
3. **`user/data/:key` 无 IDOR** —— 读写均以 `c.auth!.sub` 为主键
   （`userdata.routes.ts:39,70`），key 过 `^[a-zA-Z0-9_.\-]{1,64}$` 白名单（:18），
   value 限 256KB（:20）。**隔离正确。**
4. **`errorBoundary` 不泄露内部细节** —— `middleware/errorBoundary.ts:11-16`
   把 stack 写进服务端日志，对外统一返回 `9000 / 服务器内部错误`。**正确。**
5. **`engine` 与 `roadmap` 不是僵尸模块**（与交办时的怀疑相反，已查证）：
   - `POST /api/v1/engine/status` 被 `web/src/pages/CourseDetailPage.tsx:253` 调用；
   - `GET /tracks`、`/tracks/:slug` 被 `CareerPage.tsx:14`、`TrackDetailPage.tsx:27` 调用，
     路由在 `App.tsx:47-48` 已注册（`/roadmap`、`/tracks/:slug`）。
   **僵尸的只是 roadmap 的 careers/graph 分支（见 A1-a），不是整个模块。**
6. **`quiz.service.ts` 的 `parseOptions()` 双重编码兜底**（:18-25）已按交办说明跳过复检。
7. **反向对账 0 缺口** —— 前端 52 个 `/api` 调用点全部命中后端已注册路由，无隐藏 404。

---

## 5. 一条跨团队缺陷（不在我范围，已同步贾思敏）

`web/src/pages/AdminPage.tsx:236` 条件式调用 Hook：

```js
const detailQ = chapter ? useQuery({ ... }) : null;
```

同一个 `ChapterEditForm` 实例在「新建章节」（`chapter` 为 undefined）与「编辑章节」之间切换时
Hook 数量变化，React 会抛 *Rendered more hooks than during the previous render* 直接白屏。
紧邻的 `:238` 还在 render 期间调 `setMd`/`setMdLoaded`。属真实崩溃风险，非风格问题。

---

## 6. 建议处置顺序

| 优先级 | 动作 | 影响面 |
|---|---|---|
| P0 | 修 B1：`correct===false` 时不返回 `correctAnswer`/`explanation` | 改 1 个函数返回值 + 前端答错态文案确认 |
| P1 | 决策 A1-a：careers/graph 是补前端页面还是下线（115 行内容资产） | 产品决策，非纯技术 |
| P1 | 决策 A3：`practice_hints` 14 行提示接线或归档 | 产品决策 |
| P2 | 删 A2 两个死文件 + 4 个死包装 + A1-c 三阶段导入 | 纯删除，零功能影响 |
| P3 | A4 抽 `engine.types.ts`；A5 顺手补 service 层 | 触碰该模块时再做 |

> 除 P0 外均为「稳定运行的技术债」，不建议为此单独发版。
> 删除类动作（P2）建议一次性合并，删前用本报告的 grep 口径复跑一遍确认。
