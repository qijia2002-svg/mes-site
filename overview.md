# MES 实训平台 — Phase 0 落地概述

> 依据：《后端架构方案 v1.md》（上游为《生产规范-SKILL-v2.md》）
> 日期：2026-07-31
> 状态：✅ Phase 0 已完成并通过类型检查 + 前端构建 + Worker 打包验证

## 做了什么

按方案 §A11 落地顺序，先把**可运行地基**搭起来：单体 Worker 内部的四层架构 + 前端骨架 + 浏览器端 SQL 沙箱。

### 后端（worker/）
- **core 内核层**：洋葱 `compose`、统一响应 `{code,data,msg,traceId}`、错误码分区（1xxx–9xxx）、结构化 JSON 日志、HMAC 会话签名 + 常量时间比较、Cache API 单飞封装。
- **数据层**：`DbSession` 查询预算守卫（40 条/请求红线，留 20% 余量）+ 慢查询日志 + `mapD1Error`（overloaded→5001）。
- **Durable Object**：`RateLimiter` 令牌桶 + 登录阶梯锁定（5 次锁 1 分 / 10 次锁 15 分）。
- **中间件管道**：trace→security→auth→ratelimit→validate→handler，固定顺序；登录路由单独配置「先限流后验密」。
- **路由**：静态映射表、零正则回溯、默认/登录/后台三类管线组合。
- **领域模块（Phase 0）**：`/api/v1/health`、`/api/v1/topics`、`/api/v1/topics/:id/chapters`、`/api/v1/chapters/:id`（只读 + L2 缓存 + DTO 白名单）、`/api/v1/auth/login|logout`。
- **registry**：模块注册表（新增主题零后端改动）+ demo config 声明式白名单校验。
- **migrations/schema.sql**：10 张表（含 platform_config / topics / chapters / questions / sql_exercises / fault_scenarios / block_solutions / progress_events / stats_daily / import_chunks）。

### 前端（web/）
- Vite + React 19 + TanStack Query 骨架；统一 API 客户端（带 credentials、统一错误）。
- **浏览器端 SQL 沙箱（SqlSandbox.tsx）**：sql.js WASM，内置 MES 样例库（products/equipment/work_orders），本地执行、可离线、可练完整写操作 —— 直接对应 jshiyan 的 SQLSpace，但走 v2 §4 的客户端方案（物理隔离、不吃 D1 额度）。
- 首页演示：API 健康态、主题列表、SQL 沙箱。

## 验证结果
- ✅ `npm run typecheck`（worker + web 均 0 错误，修复了 TS 5.7 Uint8Array 泛型 / Workers lib / 返回类型等 7 处）
- ✅ `npm run build --workspace web` → 产出 `worker/public`（75 KB gzip）
- ✅ `wrangler deploy --dry-run` → 打包 11.9 KB gzip，D1/DO/vars 绑定校验通过，SQLite-backed migrations 已识别

## 下一步（方案 §A11）
- **0.5**：content 竖切 + `progress/batch` 幂等写入
- **1**：admin CRUD + Excel 分片导入（staging→commit）+ 导出
- **2**：quiz 判题 + 错题本
- **3**：practice 记录 + solutions 下发
- **4**：stats_daily 写时聚合 + 仪表盘

## 上手前必做（见 README.md）
1. `npm install`
2. `npx wrangler d1 create mes-learning` → 把 id 填进 `wrangler.toml`
3. `npx wrangler secret put SESSION_SECRET`（HMAC 密钥）
4. `npx wrangler d1 execute mes-learning --local --file=./worker/src/migrations/schema.sql`
