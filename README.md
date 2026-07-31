# MES 实施运维实训平台

基于《后端架构方案 v1》落地的全栈项目：Cloudflare **Workers + D1 + Durable Object**，前端 **React 19 + sql.js（浏览器端 SQL 沙箱）**，全程零成本（免费套餐约束）。

## 技术栈

| 层 | 选型 | 理由（见方案） |
|---|---|---|
| 前端 | React 19 + Vite + TanStack Query | 客户端渲染，SPA |
| SQL 沙箱 | sql.js（WASM，浏览器端） | 物理隔离、不吃 D1 额度、可离线、可练完整写操作 |
| 后端 | Cloudflare Worker（单实例） | 单体内部模块化，非分布式 |
| 数据库 | D1（单库单线程 500MB） | 免费版唯一选择 |
| 限流/锁定 | Durable Object（令牌桶 + 登录阶梯锁） | 免费版已开放 SQLite-backed |
| 缓存 | Cache API（L2 只读缓存） | 本方案最大增量，直接缓解单线程 D1 |

**明确不做**：消息队列、CQRS、多区域复制、服务拆分（单人项目 + 免费套餐下是负资产）。

## 目录结构

```
.
├── wrangler.toml            # 部署配置（含 DO migrations 补正、Static Assets）
├── worker/                 # 后端（Worker + D1 + DO）
│   └── src/
│       ├── core/           # 内核层（与业务无关，可整体复用）
│       ├── middleware/     # 洋葱管道：trace→security→auth→ratelimit→validate
│       ├── modules/        # 领域层：health / content / auth
│       ├── data/           # 数据层：DbSession 预算守卫 + repositories
│       ├── do/             # RateLimiter（令牌桶 + 登录阶梯锁）
│       ├── registry/       # 模块注册表 + demo config 白名单
│       └── migrations/     # schema.sql
└── web/                    # 前端（Vite + React 19）
    └── src/
        ├── api/            # 统一 API 客户端
        └── features/sql-sandbox/  # 浏览器端 SQL 沙箱
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
   npx wrangler secret put ADMIN_PASSWORD   # 后台登录口令（Phase 1 启用后台时使用）
   ```
4. 执行建表（本地 + 远程各一次）：
   ```bash
   npx wrangler d1 execute mes-learning --local --file=./worker/src/migrations/schema.sql
   npx wrangler d1 execute mes-learning --remote --file=./worker/src/migrations/schema.sql
   ```

## 开发 / 构建 / 部署

```bash
# 前端开发（Vite，默认 5173）
npm run dev

# 后端开发（wrangler dev，会托管 worker/public 的静态产物）
npm run dev --workspace worker

# 类型检查
npm run typecheck

# 生产构建（先构建前端到 worker/public，再 dry-run worker）
npm run build

# 部署
npm run deploy
```

> 生产环境前端与后端同源（都由 Worker Static Assets 托管），API 走相对路径 `/api/v1/*`，无需跨域。
> 本地前端独立开发时若需代理 `/api` 到 wrangler，可在 `web/vite.config.ts` 加 `server.proxy`。

## 已落地范围（Phase 0）

- ✅ 内核层：洋葱管道、统一响应、错误码分区、结构化日志、HMAC 会话、Cache 单飞
- ✅ 数据层：`DbSession` 查询预算守卫（40 条/请求）+ 慢查询日志 + mapD1Error
- ✅ Durable Object：`RateLimiter` 令牌桶 + 登录阶梯锁定（5 次锁 1 分 / 10 次锁 15 分）
- ✅ 中间件管道：trace / security / auth / ratelimit / validate / errorBoundary
- ✅ 路由表：静态映射、零正则回溯、默认/登录/后台三类管线
- ✅ 领域模块：`/api/v1/health`、`/api/v1/topics`、`/api/v1/topics/:id/chapters`、`/api/v1/chapters/:id`（只读 + L2 缓存 + DTO 白名单）、`/api/v1/auth/login|logout`
- ✅ 前端骨架 + **浏览器端 SQL 沙箱**（MES 样例库，WASM 执行）
- ✅ 建表 SQL（platform_config / topics / chapters / questions / sql_exercises / fault_scenarios / block_solutions / progress_events / stats_daily / import_chunks）

## 后续阶段（见方案 §A11）

| 阶段 | 内容 |
|---|---|
| 0.5 | content 竖切 + progress/batch 幂等写入 |
| 1 | admin CRUD + Excel 分片导入（staging→commit 两阶段）+ 导出 |
| 2 | quiz 判题 + 错题本 |
| 3 | practice 记录 + solutions 下发 |
| 4 | stats_daily 写时聚合 + 仪表盘 |

## 关键安全/成本红线

- 题目下发 DTO 显式字段白名单，禁止 `SELECT *` 直出（防答案泄露，R6）。
- 只读接口挂 L2 缓存、不挂 DO；DO 只服务敏感写/登录端点（避免双额度消耗）。
- 学员端接口无鉴权但**必须限流**。
- 改 `MAX_STMT_PER_REQUEST` / `SLOW_QUERY_MS` 前先读方案 §A11.2 扩容触发点。
