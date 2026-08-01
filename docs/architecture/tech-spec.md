# MES 实训平台 — 技术 Spec（Phase 1 技术调研结论）

作者：高见远（首席架构师） · 版本：v1 · 依据：对 `worker/` `web/` 全量源码实测审计

---

## 0. 审计结论一句话

**代码不是空壳，是"骨架完整但没血肉"**——19 个 API 端点全部有真实 service + repository 实现，
`npm run typecheck` 全绿，`wrangler deploy --dry-run` 通过；
但**数据库一行业务数据都没有**，**生产 D1 尚未创建**，**wrangler 3.x 会静默丢掉 ASSETS 绑定导致整站白屏**。
换句话说：离"能跑"差 3 个配置项，离"能看"差一批种子数据和一个章节详情页。

---

## 1. 实测证据（可复现）

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 类型检查 | `npm run typecheck` | 通过（worker + web 均 0 error） |
| Worker 可构建 | `wrangler deploy --dry-run` | 通过，65.4 KiB / gzip 15.5 KiB |
| **ASSETS 绑定（w3）** | `npx wrangler@3 deploy --dry-run` | **绑定表中无 ASSETS** |
| **ASSETS 绑定（w4）** | `npx wrangler@4 deploy --dry-run` | `env.ASSETS  Assets`，读到 6 个文件 |
| **远端 D1 清单** | `wrangler d1 list --json` | 仅 `mos-content`，**无 `mes-learning`** |
| Cloudflare API 通路 | 同上 | 正常（说明部署链路不依赖本地 workerd） |
| **本地 workerd** | `wrangler dev --local` | **崩溃 `0xc0000005`**（缺 VC++ Redist） |

---

## 2. 模块实现度矩阵（无空壳，但有桩）

| 模块 | routes | service | repository | 判定 |
|------|--------|---------|------------|------|
| health | 有 | — | — | 完整 |
| content（主题/章节） | 有 | 有（含 L2 缓存 + DTO 白名单） | chapter.repo 完整 | 完整 |
| auth（登录/登出） | 有 | 有（HMAC 无状态会话 + 常量时间比较） | — | 完整，**但缺 ADMIN_PASSWORD 必然 401** |
| progress | 有 | 有（幂等 + 当日聚合 UPSERT） | progress.repo 完整 | 完整 |
| admin（CRUD + 导入） | 有 | 有 | admin.repo 完整 | CRUD 完整；**import commit 只计数不物化行** |
| quiz / sql-exercises | 有 | 有（不下发 answer） | quiz.repo 完整 | **submitSql 是桩，不落库** |
| learning-paths | 有 | 有 | lp.repo 完整 | 完整 |
| certifications | 有 | 有 | cert.repo 完整 | 完整 |

六个 repository（admin / cert / chapter / lp / progress / quiz）**全部有实现**，
统一 prepare-bind、游标分页 `WHERE id > ? LIMIT 100`、头部标注依赖索引。这部分质量高于常见 MVP 水位。

**router.ts**：19 条路由注册正确；管线组合正确——
默认 `[errorBoundary, trace, security, auth, validate]`，
admin 额外插 `guardAdmin`，
login 单独走 `[trace, security, loginRateLimit, validate]`（先限流后验密，防口令爆破）。
`matchRoute` 用分段比较无正则回溯，无 ReDoS 面。

**index.ts 分流**：逻辑本身正确——`!pathname.startsWith('/api/')` → `env.ASSETS.fetch(req)`，否则进路由。
风险不在代码，在**绑定是否存在**（见 P0-1）。

**schema.sql**：17 张表（不是 10 张），DDL 完整、索引齐备、外键声明规范。
seed 数据**只有 `platform_config` 两行**（content_version=1 / token_version=1），
`topics` `chapters` `questions` `sql_exercises` `learning_paths` `certifications` **全空**。

---

## 3. 后端缺口清单（按影响 MVP 程度排序）

### P0 — 不修则无法上线 / 上线即白屏

**P0-1 · wrangler 3.x 丢失 ASSETS 绑定 → 全站 500**
`worker/package.json` 锁 `wrangler ^3.99.0`（实装 3.114.17）。实测该版本读不到 `assets` 配置，
`env.ASSETS` 为 `undefined`，则 `index.ts` 第 17 行对所有非 `/api/` 请求抛 TypeError——
**首页、任何前端路由、任何静态资源全部 500**，只有 `/api/*` 活着。
修复：`worker/package.json` → `"wrangler": "^4.117.0"`，重跑 dry-run 确认绑定表出现 `env.ASSETS`。

**P0-2 · 生产 D1 不存在，database_id 是假 UUID**
`wrangler d1 list` 证实账号下只有 `mos-content`。当前 `database_id = a1b2c3d4-...` 是占位符，
仅 local 模式被 miniflare 忽略；**一旦 deploy，所有走 D1 的接口（除 /health）全部 5xx**。
修复：`wrangler d1 create mes-learning` → 回填真实 uuid → `d1 execute --remote` 建表。

**P0-3 · ADMIN_PASSWORD 从未配置 → 后台 100% 登不进**
`auth.service.ts:16` `const expected = c.env.ADMIN_PASSWORD ?? ''`，
空值直接进 `if (!expected)` 分支抛 2001。`.dev.vars` 只有 SESSION_SECRET，wrangler.toml 也没配。
后果：`/login` 永远失败 → `/admin` 全部 401 → 内容根本录不进去 → 连带 P0-4 无解。
修复：`wrangler secret put ADMIN_PASSWORD`（生产）+ `.dev.vars` 加一行（本地）。

**P0-4 · 零业务种子数据 → 四个主页面全是"暂无内容"**
首页、课程、学习路径、题库四个页面的空态文案已经写好了（"待后台导入"），
意思是打开站点看到的就是四个空壳。这是"技术上跑通"和"能叫产品"之间的分水岭。
修复：写 `worker/src/migrations/seed.sql`，至少 3 主题 / 6 章节 / 10 选择题 / 5 SQL 实训题 / 2 学习路径 / 2 证书。

**P0-5 · 章节详情页整体缺失 → 学习平台读不了课文**
后端 `GET /api/v1/chapters/:id` 已返回 `md` 字段；
前端**没有 `/chapters/:id` 路由、没有 markdown 渲染组件**，
`markdown-it` 和 `dompurify` 装在 package.json 里但**全项目零 import**（grep 无匹配）。
课程页只列主题，点不进去。一个学不了东西的学习平台不能上线。
修复：新增章节详情路由 + `markdown-it` 渲染 + `DOMPurify.sanitize` 消毒（XSS 必须做，md 来自后台可编辑）。

### P1 — 上线后功能是断的

**P1-6 · SQL 判题链路断裂**
`quiz.service.ts` 注释说"判题在客户端比对 answer_sql 结果集"，但 `answer_sql` **从不下发**（DTO 白名单已剔除，安全上正确），
前端也**没有比对逻辑**——`SqlSandbox` 只是自由查询器，`QuizPage` 只列题目、跳转到沙箱就结束了。
结果：**没有任何一条路径能判定"这道题做对了"**。
修复（二选一，建议后者）：
- A：服务端 `POST /sql-exercises/:id/submit` 接收用户结果集，与 `answer_sql` 服务端执行结果比对——但 D1 不能跑任意 SQL，不可行。
- B：`submit` 接口返回**期望结果集的哈希**（建表时预计算存字段），前端把 sql.js 跑出的结果集规范化后哈希比对。零答案泄露、零额外 D1 开销。

**P1-7 · submitSql 是桩，练习无留痕**
`submitSqlSvc` 直接 `return { received: true, note: '...' }`，不写 `progress_events`、不写 `wrong_questions`、不 bump `stats_daily`。
后果：progress 接口永远返回 0，错题本表永远空。
修复：submit 内调用 `progressRepo.record` + `bumpStats`，错题写 `wrong_questions`。

**P1-8 · 后台发布后前台不更新（最长 360s）**
`content.service` 的 L2 缓存键含 `content_version`，设计是"发布即换键"；
但 `admin.service` 的 create/update/delete **从不递增 `platform_config.content_version`**，
再叠加 `cvCache` 的 60s isolate 缓存 + `cachedJson` 的 300s TTL。
运营改完内容刷新看不到，会判定"后台坏了"。
修复：admin 所有写操作成功后 `UPDATE platform_config SET value = CAST(value AS INTEGER)+1 WHERE key='content_version'`。

**P1-9 · sql.js 依赖 cdnjs 境外 CDN**（经 PM 风险复核，**提升为 P0 级发布阻塞**，见 ADR-005）
`SqlSandbox.tsx:13-14` 硬编码 `cdnjs.cloudflare.com/.../sql-wasm.js|.wasm`。
SQL 沙箱是本项目最大卖点，却把它压在一个国内访问不稳定的境外 CDN 上；
且 `SqlSpacePage` 文案宣称"可离线"，与 CDN 依赖直接矛盾。
修复：把 `sql-wasm.js` + `sql-wasm.wasm`（约 1.5MB）放进 `worker/public/vendor/`，由自家 Workers Static Assets 托管，改 `SQL_JS_URL` 为 `/vendor/sql-wasm.js`。同源、可缓存、文案也就真了。

**P1-10 · 本机 workerd 崩溃，本地开发环路不可用**
`wrangler dev --local` 与 `d1 execute --local` 均报 `0xc0000005 access violation`，
wrangler 自身提示指向 **Microsoft Visual C++ 2015-2022 x64 Redistributable 缺失/过旧**。
**不影响远端部署**——`deploy` / `d1 execute --remote` / `secret put` / `d1 list` 全走 Cloudflare HTTP API，实测正常。
修复：装 [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe)；
在此之前，前端用 `vite dev`（`web/vite.config.ts` 需加 `server.proxy` 指向已部署的 workers.dev 域名）联调。

**P1-11 · compatibility_date 超前**
配置 `2025-10-01`，本地 runtime 最高支持 `2025-07-18` 并已回退。升级 wrangler 4 后需复验；
若线上 runtime 不支持会 deploy 失败，届时回退到 `2025-07-18`。

### P2 — 可延后到 MVP 之后

- **P2-12** Excel 导入 `commitImportSvc` 只 `COUNT(*)` 分片，不解析不插行（代码注释已自认 `deferred to content phase`）。MVP 靠 seed.sql 灌数据即可绕开。
- **P2-13** 静态 HTML 无安全响应头——`security` 中间件只挂在 `/api/*` 管线上，`env.ASSETS.fetch` 的返回直接透传，HTML 文档没有 CSP / X-Frame-Options。建议在 `index.ts` 的 ASSETS 分支包一层响应头注入。
- **P2-14** `stats_daily` 的 `day` 用 `toISOString()` 取 UTC 日期，国内用户 08:00 前的学习会记到前一天。MVP 可接受，需在 PRD 标注。

---

## 4. 技术约束（前后端必须遵守）

### 4.1 Cloudflare 免费套餐硬约束

| 约束 | 数值 | 已有护栏 |
|------|------|----------|
| 单请求 D1 语句数 | 平台 50 条 | `DbSession` 40 条即抛 5002，留 20% 余量 |
| D1 库容量 | 500 MB | 章节 md 存 D1，需监控 |
| Worker CPU | 10 ms/请求（免费） | 只读接口走 `caches.default`，命中近零 CPU |
| DO | 必须 SQLite-backed | `wrangler.toml` 已声明 `new_sqlite_classes` |
| Workers 请求 | 100k/天 | 静态资源不计入 Worker 调用 |
| **Static Assets 文件数** | **20,000 文件/Worker 版本（免费）** | 实测来源：Cloudflare Platform Limits 页 |
| **Static Assets 单文件** | **25 MiB（免费，与付费同）** | 字体/sql-wasm 单文件均远小于此 |
| 资产请求计费 | 免费且无限量 | 首屏静态资源（含 6MB 字体包）零成本 |

### 4.2 编码约束（不可违反）

1. **仓库层只允许 prepare-bind**，任何字符串拼接 SQL 直接驳回（现有代码已 100% 合规，保持）。
2. **列表接口一律游标分页** `WHERE id > ? ORDER BY id LIMIT 100`，禁止 OFFSET。
3. **DTO 显式字段白名单**，禁止 `SELECT *` 后直接 `JSON.stringify`——`answer` / `answer_sql` / `solution_json` 永不出网。
4. **禁止在循环里查库**，`DbSession` 会在第 41 条语句处直接打断。
5. **响应格式统一** `{ code, data, msg, traceId }`，`code:0` 为成功。前端 `client.ts` 已按此实现，不要改。
6. **单文件 ≤ 300 行**，超出即拆。当前最大 `admin.service.ts` 165 行，`SqlSandbox.tsx` 219 行，均合规。
7. **新增主题零后端改动**——主题是 `topics` 表里的数据，不是代码里的枚举。任何"加主题要改 TS"的写法驳回。

### 4.3 安全约束

- 会话：HttpOnly + Secure + SameSite=Strict Cookie，HMAC 签名，8h 有效，`token_version` 可全局吊销。
- 写操作强制 Origin 同源校验（`security` 中间件已实现）。
- 错误响应只回固定文案 + traceId，**禁止把 D1 原始错误回传前端**（会泄露表名列名）。
- 章节 md 渲染**必须** `DOMPurify.sanitize`，后台可编辑内容等同不可信输入。
- `SESSION_SECRET` / `ADMIN_PASSWORD` 只能进 `wrangler secret put`，绝不入库、不入仓库。

---

## 5. 选型结论

### 5.1 图标库：lucide-react（锁定，全项目唯一）

⛔ **P0 铁律：禁止 emoji 充当功能图标。全项目只用这一套 SVG 图标库，不得混用第二套。**

| 候选 | 图标数 | React 19 | 体积/Tree-shaking | 判定 |
|------|--------|----------|-------------------|------|
| **lucide-react `1.28.0`** | 1500+ | peer 已含 `^19.0.0`（实测确认） | 纯 ESM 单图标独立导出，Vite 6 摇树干净 | **选中** |
| @tabler/icons-react | 5900+ | 支持 | barrel 导入在 Vite dev 下冷启动明显变慢 | 落选 |
| react-icons | 多套聚合 | 支持 | 天然鼓励混用多套风格，直接违反 P0 铁律 | 否决 |
| Heroicons | 300+ | 支持 | 数量不够覆盖 MES 领域（设备/工单/质检） | 落选 |

**选中理由**：24×24 栅格、`stroke-width=2` 统一线性风格，与现有极简 UI 一致；
MIT 协议；无字体文件、无 sprite，纯 React 组件；React 19 peer 官方声明支持（已实测 `npm view` 确认）。

**落地约束**：
- `web/package.json` 依赖写 `"lucide-react": "1.28.0"`（**不加 `^`，锁死版本**，避免图标改名导致构建炸）。
- 按需具名导入：`import { Database, BookOpen, CircleCheck } from 'lucide-react'`，禁止 `import * as Icons`。
- 统一封装 `web/src/components/Icon.tsx` 收口尺寸与 `strokeWidth`，页面不直接调原始组件。
- 现有代码中若出现 emoji 当图标，一律替换。

### 5.2 其余选型（沿用现状，不动）

| 层 | 选型 | 结论 |
|----|------|------|
| 运行时 | Cloudflare Workers | 保持 |
| 数据库 | D1 (SQLite) | 保持 |
| 有状态组件 | Durable Object（限流+登录锁定） | 保持，已声明 SQLite-backed |
| 前端 | React 19 + Vite 6 + react-router 7 | 保持 |
| 数据请求 | @tanstack/react-query 5 | 保持 |
| Markdown | markdown-it + DOMPurify | **已装未用**，P0-5 要接上 |
| SQL 沙箱 | sql.js 1.10.3 WASM | 保持方案，**改自托管**（P1-9） |
| 工具链 | **wrangler 4.117.0** | **必须从 3.x 升级**（P0-1） |

**明确不引入**：任何 UI 组件库（现有 350 行手写 CSS 够用）、任何状态管理库（react-query 已覆盖）、
任何 ORM（repository 层手写 SQL 更可控，且 D1 语句数需要精确计量）。

### 5.3 字体自托管：三套 Variable 包（详见 ADR-004）

DESIGN.md §3 原写静态版 `@fontsource/noto-sans-sc`（71.5 MB / 1905 文件），对 Cloudflare 免费档虽不破硬上限，但部署与首屏不可行。**改为三套 variable 包**：

| 包 | 版本 | 体积 / 文件数 |
|----|------|---------------|
| `@fontsource-variable/archivo` | ^5.3.0 | 1.08 MB / 34（含 wght+wdth 轴） |
| `@fontsource-variable/jetbrains-mono` | ^5.3.0 | 203 KB / 24 |
| `@fontsource-variable/noto-sans-sc` | ^5.3.0 | 4.7 MB / 112 |

全站字体资产合计 **~6 MB / ~170 文件**，远低于 20,000 文件 / 25 MiB 单文件上限。`web/package.json` 当前**三包均缺失**（设计侧已确认是 Phase 2 前置），需在 `main.tsx` 首行 import。

> 注：sql.js 在 `web/package.json` 现锁 `1.13.0`，本 Spec §5.2 写作 `1.10.3`——以 package.json 实际锁定为准，ADR-003 的"自托管 vendor"结论不受影响，无行动项，仅消除文档不一致。

### 5.4 SQL 判题哈希规范化规范（详见 ADR-005）

P1-6 方案 B 的判题契约，规范由架构定、前后端共用：

1. `dataset_json` 形状：`{"buildSql": "<DDL+DML 单字符串>"}`；浏览器/后端建库用 **`db.exec(buildSql)`**（统一 exec：`db.run(sql,params)` 带参时不支持多语句，exec 返回结果集更明确；`db.run` 不带参可跑多语句，故不要据此改 SqlSandbox）。
2. **行序敏感、列序保留**——规范化只做类型归约，不排序。ORDER BY 是受测能力点。
3. 浮点：两侧均 JS 原生 `number` 序列化；author 在 `answer_sql` 对小数 `ROUND(x,2)` 收敛（`ROUND(102.0,2)` 与 `102` 序列化一致）。
4. 哈希：`SHA256( JSON.stringify({ c: columns, v: values }) )`，小写 hex；`columns`/`values` 取自 `db.exec` 返回原样。
5. **引擎一致性**：`answer_hash` 必须由 **sql.js 1.13.0** 在 worker 端预计算（与前端自托管版本对齐），禁止用 node:sqlite 或抄 PM 临时 hash。
6. sql.js 安装点：`web/` 已有 `sql.js@1.13.0`；`worker/`（backend）缺，哈希预计算需加 devDependency。

---

## 6. MVP 放行标准（Definition of Done）

1. `npx wrangler@4 deploy --dry-run` 绑定表出现 `env.ASSETS`。
2. `wrangler d1 list` 出现 `mes-learning`，且 `wrangler.toml` 的 `database_id` 与之一致。
3. `curl https://<域名>/api/v1/health` 返回 `{"code":0,...,"status":"ok"}`。
4. `curl https://<域名>/api/v1/topics` 返回**非空数组**。
5. 浏览器打开首页不白屏，四个主页面均有真实内容（非"暂无"空态）。
6. 能从课程页点进章节详情，读到渲染后的 markdown 正文。
7. `/login` 用 `ADMIN_PASSWORD` 能登录成功并进入 `/admin`。
8. SQL 沙箱在断开 cdnjs 的情况下仍能初始化（证明已自托管）。
9. 至少一道 SQL 题能判出"正确/错误"。
10. 全项目 grep 不到 emoji 图标，图标全部来自 lucide-react。
