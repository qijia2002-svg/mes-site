# MES 实施运维实训平台

基于《后端架构方案 v1》落地的全栈项目：Cloudflare **Workers + D1 + Durable Object**，前端 **React 19 + sql.js（浏览器端 SQL 沙箱）**，全程零成本（免费套餐约束）。

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | React 19 + Vite + TanStack Query | 客户端渲染，SPA |
| UI 图标 | lucide-react | 语义化图标，零 emoji |
| SQL 沙箱 | sql.js（WASM，浏览器端） | 物理隔离、不吃 D1 额度、可离线、可练完整写操作 |
| 后端 | Cloudflare Worker（单实例） | 单体内部模块化，非分布式 |
| 数据库 | D1（单库单线程 500MB） | 免费版唯一选择 |
| 限流/锁定 | Durable Object（令牌桶 + 登录阶梯锁） | 免费版已开放 SQLite-backed |
| 缓存 | Cache API（L2 只读缓存） | 直接缓解单线程 D1 |

**明确不做**：消息队列、CQRS、多区域复制、服务拆分（单人项目 + 免费套餐下是负资产）。

## 设计系统

视觉规范参见 `design-system/`：
- `design-tokens.css` — v3.0 token 体系（A1-identity → A1-structure → A2 → B-slot → C-extension 五层），组件 CSS 零裸 hex
- `VISUAL-UPGRADE-v3.md` — v3 视觉升级诊断与方案（明度阶梯修正 / Hairline First / accent 配额制 / 主按钮转墨色）

核心约束（P0 五条红线）：禁止 emoji 作功能图标、禁止紫粉渐变、禁止硬编码色值、禁止弹跳缓动、禁止千篇一律 Hero。

## 目录结构

```
.
├── wrangler.toml              # 部署配置
├── design-system/             # 设计 token + 视觉规范
├── worker/                    # 后端（Worker + D1 + DO）
│   └── src/
│       ├── core/              # 内核层：pipeline / context / response / errors / session / cache
│       ├── middleware/        # 洋葱管道：trace → security → auth → ratelimit → validate
│       ├── modules/           # 领域层：health / content / auth / progress / admin / quiz / lp / cert
│       ├── data/              # 数据层：DbSession 预算守卫 + repositories
│       ├── do/                # RateLimiter（令牌桶 + 登录阶梯锁）
│       └── migrations/        # schema.sql + seed SQL
├── web/                       # 前端（Vite + React 19）
│   └── src/
│       ├── api/               # 统一 API 客户端（endpoints.ts）
│       ├── components/        # AppShell / Icon / Breadcrumb / GreetingBar / ProgressDashboard / QuizDeck
│       ├── pages/             # HomePage / CoursesPage / CourseDetailPage / ChapterPage / ProfilePage / SimulatorPage
│       ├── features/          # sql-sandbox（浏览器端 SQL 编辑器 + 判题）
│       └── lib/               # markdown 渲染 / anonId
└── docs/                      # PRD / ADR / SPEC / API spec
```

## 本地开发前置

1. 安装依赖：`npm install`
2. 创建 D1 数据库，并把返回的 **id** 填进 `wrangler.toml` 的 `database_id`：
   ```bash
   npx wrangler d1 create mes-learning
   ```
3. 写入密钥（**绝不入库**）：
   ```bash
   npx wrangler secret put SESSION_SECRET   # 32+ 字节随机串，HMAC 会话签名
   npx wrangler secret put ADMIN_PASSWORD   # 后台登录口令
   ```
4. 执行建表 + 种子数据：
   ```bash
   npx wrangler d1 execute mes-learning --local --file=./worker/src/migrations/schema.sql
   npx wrangler d1 execute mes-learning --local --file=./worker/src/migrations/seed-knowledge.sql
   npx wrangler d1 execute mes-learning --local --file=./worker/src/migrations/seed-roadmaps.sql
   # 远程同理，把 --local 换成 --remote
   ```

## 开发 / 构建 / 部署

```bash
# 前端开发（Vite，默认 5173）
npm run dev

# 后端开发（wrangler dev）
npm run dev --workspace worker

# 类型检查
npm run typecheck

# 生产构建
npm run build

# 部署
npm run deploy
```

> 生产环境前后端同源（Worker Static Assets 托管），API 走相对路径 `/api/v1/*`，无需跨域。

## 已落地范围

### Phase 0 · 内核 + 只读内容
- ✅ 内核层：洋葱管道、统一响应、错误码分区、结构化日志、HMAC 会话、Cache 单飞
- ✅ 数据层：`DbSession` 查询预算守卫 + 慢查询日志 + mapD1Error
- ✅ DO：`RateLimiter` 令牌桶 + 登录阶梯锁定
- ✅ 路由表：静态映射、零正则回溯、三类管线（默认/登录/后台）
- ✅ 内容 API：`/api/v1/topics`、`/api/v1/topics/:id/chapters`、`/api/v1/chapters/:id`（只读 + L2 缓存 + DTO 白名单）
- ✅ 认证：`/api/v1/auth/login|logout`

### Phase 0.5 · 进度追踪
- ✅ `/api/v1/progress` — 匿名进度记录（浏览器 localStorage 标识，无需注册）
- ✅ `completedChapterIds` / `passedExerciseIds` 实时同步

### Phase 1 · 后台管理
- ✅ Admin CRUD（topics / chapters）+ Excel 分片导入（staging → commit 两阶段）

### Phase 2 · 题库 / SQL 实训
- ✅ 题目下发（不含答案，R6 安全边界）
- ✅ `/api/v1/quiz/grade` — 服务端答案校验（单选/多选/判断）
- ✅ `/api/v1/quiz/topic-questions` — 模块汇总抽题
- ✅ 浏览器端 SQL 沙箱（sql.js WASM）+ 判题（hash 比对，answer_sql 永不下发）
- ✅ 卡片式考试组件（QuizDeck）

### 前端体验
- ✅ 深色侧栏驾驶舱导航 + 可展开分组
- ✅ 首页学习仪表盘（GreetingBar + ProgressDashboard + 进度环 + 快速入口）
- ✅ 移动端底部 TabBar（≤768px 自适应）
- ✅ 个人中心（昵称设置、学习统计）

## 后续阶段

| 阶段 | 内容 |
|---|---|
| 3 | practice 记录 + solutions 下发 + 错题本 |
| 4 | stats_daily 写时聚合 + 全局仪表盘 |
| 5 | 工艺路线搭建器（SimulatorPage → 拖拽式产线搭建 + 仿真运行） |
| 6 | 学习路径体系上线（learning-paths / certifications 前端消费） |

## 关键安全/成本红线

- 题目下发 DTO 显式字段白名单，禁止 `SELECT *` 直出（防答案泄露，R6）。
- SQL 实训判题：客户端算结果 hash → 服务端比对 answer_hash，`answer_sql` 永不下发。
- 只读接口挂 L2 缓存、不挂 DO；DO 只服务敏感写/登录端点（避免双额度消耗）。
- 学员端接口无鉴权但**必须限流**。
- 改 `MAX_STMT_PER_REQUEST` / `SLOW_QUERY_MS` 前先读方案 §A11.2 扩容触发点。
