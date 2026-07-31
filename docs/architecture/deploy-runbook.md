# MVP 部署 Runbook（Cloudflare Workers + D1 + DO）

作者：高见远 · 适用：`E:\mes-learning-platform` · 前提：本机 wrangler 已 OAuth 登录（实测具备 d1 / workers_scripts 写权限）

> **本 Runbook 只写本项目实际能跑的命令。不涉及任何其他平台。**
> 所有命令在项目根 `E:\mes-learning-platform` 执行，除非另有标注。

---

## 步骤 0 · 前置修复（不做则后面全白干）

### 0.1 升级 wrangler 到 4.x（P0，必做）

wrangler 3.114 **读不到 `assets` 配置，`env.ASSETS` 会是 undefined**，
部署后所有非 `/api/` 请求（= 整个前端）直接 500。

```bash
npm install --save-dev wrangler@^4.117.0 --workspace worker
```

**验证**（绑定表必须出现 `env.ASSETS`）：

```bash
cd worker && npx wrangler deploy --dry-run --outdir=../dist-worker
```

期望输出包含：

```
✨ Read N files from the assets directory .../worker/public
env.RATE_LIMITER (RateLimiter)   Durable Object
env.DB (mes-learning)            D1 Database
env.ASSETS                       Assets          ← 必须有这一行
```

### 0.2 修复本地 workerd（P1，不阻断部署）

`wrangler dev` / `d1 execute --local` 当前崩溃（`0xc0000005 access violation`），
原因是 **Microsoft Visual C++ 2015-2022 x64 Redistributable 缺失或过旧**。

安装：<https://aka.ms/vs/17/release/vc_redist.x64.exe> → 重启终端。

> **这一步不影响上线。** `deploy`、`d1 execute --remote`、`secret put`、`d1 list`
> 全部走 Cloudflare HTTP API，不需要本地 workerd —— 已实测通过。
> 装不上也能部署，只是没有本地调试环路。

---

## 步骤 1 · 创建生产 D1 并回填真实 database_id

**当前 `wrangler.toml` 里的 `a1b2c3d4-e5f6-7890-abcd-ef1234567890` 是占位假 UUID。**
`wrangler d1 list` 实测显示账号下**没有** `mes-learning` 这个库。
不换成真 id 就部署 → 所有查库接口 5xx。

```bash
npx wrangler d1 create mes-learning
```

输出形如：

```
✅ Successfully created DB 'mes-learning'

[[d1_databases]]
binding = "DB"
database_name = "mes-learning"
database_id = "7f3a1c9e-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   ← 复制这一行的 uuid
```

**把真实 uuid 回填到 `wrangler.toml` 第 15 行**，替换占位值：

```toml
[[d1_databases]]
binding = "DB"
database_name = "mes-learning"
database_id = "7f3a1c9e-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← 换成上面返回的真实 id
```

**校验**（名字和 uuid 必须对上）：

```bash
npx wrangler d1 list --json
```

---

## 步骤 2 · 远端建表 + 灌种子数据

```bash
# 建表（17 张表 + 索引 + platform_config 两行）
npx wrangler d1 execute mes-learning --remote --file=worker/src/migrations/schema.sql

# 灌业务种子（P0-4：不灌则四个页面全是"暂无内容"）
npx wrangler d1 execute mes-learning --remote --file=worker/src/migrations/seed.sql
```

> `seed.sql` 目前**还不存在**，属于 P0 缺口，需后端补齐后再执行第二条。

**校验建表成功**：

```bash
npx wrangler d1 execute mes-learning --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
npx wrangler d1 execute mes-learning --remote --command="SELECT key, value FROM platform_config"
```

期望：17 张表；`content_version=1`、`token_version=1`。

**校验种子生效**：

```bash
npx wrangler d1 execute mes-learning --remote --command="SELECT COUNT(*) AS n FROM topics WHERE status='published'"
```

期望 `n > 0`。这条返回 0 就别部署了，部了也是空站。

---

## 步骤 3 · 配置生产机密

`.dev.vars` **只对 `wrangler dev` 生效，不会上传**。生产必须用 `secret put`。

```bash
# 会话签名密钥（建议 32+ 字节随机串）
npx wrangler secret put SESSION_SECRET

# 后台登录口令（不配则 /login 永远 401，后台完全进不去）
npx wrangler secret put ADMIN_PASSWORD
```

生成随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**校验**：

```bash
npx wrangler secret list
```

期望看到 `SESSION_SECRET` 与 `ADMIN_PASSWORD` 两项。

> 本地也要补：在 `.dev.vars` 追加一行 `ADMIN_PASSWORD=<本地口令>`，否则本地也登不进后台。

---

## 步骤 4 · 构建并部署

`npm run deploy` 已经串好两步：先 `vite build`（产物落 `worker/public`），再 `wrangler deploy`。

```bash
npm run deploy
```

等价于：

```bash
npm run build --workspace web      # vite build → outDir = ../worker/public
npm run deploy --workspace worker  # wrangler deploy（含 DO migration tag v1）
```

> `vite.config.ts` 设了 `emptyOutDir: false`（本机安全删除拦截器会让 rm 失败）。
> 后果：`worker/public` 里的旧 hash 资源不会被清理，会越堆越多。
> 上线前手动清一次：删除 `worker/public/assets` 后再 build。

---

## 步骤 5 · 部署后健康检查（按顺序，任何一条不过就回滚）

```bash
# 1) API 活着（不查库，验管线）
curl -s https://<你的域名>/api/v1/health

# 2) D1 通了且有数据（这条是真正的验收点）
curl -s https://<你的域名>/api/v1/topics

# 3) 静态资源分流正常（验 env.ASSETS 绑定）
curl -s -o /dev/null -w "%{http_code}\n" https://<你的域名>/

# 4) SPA 深链回退正常（not_found_handling = single-page-application）
curl -s -o /dev/null -w "%{http_code}\n" https://<你的域名>/learning-paths

# 5) 未注册路由正确 404（不能返回 index.html）
curl -s https://<你的域名>/api/v1/not-exist
```

| # | 期望 | 不符时的排查方向 |
|---|------|------------------|
| 1 | `{"code":0,"data":{"status":"ok","degrade":"L0",...}}` | Worker 没部署成功，看 `wrangler tail` |
| 2 | `{"code":0,"data":[...]}` 且**数组非空** | 空数组 → 步骤 2 种子没灌；5xx → `database_id` 还是假的 |
| 3 | `200` | `500` → **ASSETS 绑定缺失，回到步骤 0.1 升级 wrangler** |
| 4 | `200` | `404` → `not_found_handling` 未生效，检查 `wrangler.toml` assets 配置 |
| 5 | `{"code":404,"msg":"not found"}` | 返回 HTML → 静态资源抢在 Worker 前面了，检查路由优先级 |

**实时日志**（排障用）：

```bash
npx wrangler tail
```

---

## 步骤 6 · 回滚

```bash
npx wrangler deployments list          # 找到上一个健康版本的 version id
npx wrangler rollback <version-id>
```

> **D1 数据不会随 rollback 回滚。** schema 变更前先备份：
> ```bash
> npx wrangler d1 export mes-learning --remote --output=backup-$(date +%Y%m%d).sql
> ```

---

## 附：命令速查

| 目的 | 命令 |
|------|------|
| 建生产库 | `npx wrangler d1 create mes-learning` |
| 列库确认 id | `npx wrangler d1 list --json` |
| 远端建表 | `npx wrangler d1 execute mes-learning --remote --file=worker/src/migrations/schema.sql` |
| 远端灌种子 | `npx wrangler d1 execute mes-learning --remote --file=worker/src/migrations/seed.sql` |
| 远端查数据 | `npx wrangler d1 execute mes-learning --remote --command="SELECT ..."` |
| 设机密 | `npx wrangler secret put SESSION_SECRET` / `ADMIN_PASSWORD` |
| 构建+部署 | `npm run deploy` |
| 干跑校验绑定 | `cd worker && npx wrangler deploy --dry-run --outdir=../dist-worker` |
| 实时日志 | `npx wrangler tail` |
| 备份 | `npx wrangler d1 export mes-learning --remote --output=backup.sql` |
| 回滚 | `npx wrangler rollback <version-id>` |

---

## 部署顺序依赖图

```
0.1 升级 wrangler@4 ──┐
                      ├──> 1. d1 create + 回填真实 id ──> 2. 远端建表 ──> 2b. 灌种子(需先补 seed.sql)
0.2 装 VC++ (可选) ───┘                                                        │
                                                                               v
                                              3. secret put ────────────> 4. npm run deploy ──> 5. 健康检查
```

**关键路径上的三个"不做就白搭"**：升 wrangler 4、回填真实 database_id、灌种子数据。
