# ADR-003: sql.js 自托管 + 本地 workerd 故障与部署路径解耦

## Status

Accepted (2026-07-31) · 决策人：高见远

## Background

**问题 A：sql.js 依赖境外 CDN**
`web/src/features/sql-sandbox/SqlSandbox.tsx:13-14` 硬编码：

```ts
const SQL_JS_URL  = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
const SQL_WASM_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm';
```

浏览器端 SQL 沙箱是本项目最大卖点（SQL 不进 D1、物理隔离、不吃额度），
却把它的可用性压在一个国内访问不稳定的境外 CDN 上。
同时 `SqlSpacePage.tsx:8` 的文案宣称"无需后端、**可离线**"，与 CDN 硬依赖直接矛盾——
用户断网或 cdnjs 被拦截时，沙箱直接报"sql.js 脚本加载失败"。

**问题 B：本地 workerd 崩溃**
本机执行 `wrangler dev --local` 与 `wrangler d1 execute --local` 均崩溃：

```
*** Received structured exception #0xc0000005: access violation
X [ERROR] The Workers runtime failed to start.
On Windows, this may be caused by an outdated Microsoft Visual C++ Redistributable library.
```

wrangler 3.114 与 4.117 表现一致，说明**与 wrangler 版本无关**，是本机缺 VC++ 2015-2022 x64 运行库。

关键实测结论：**这不阻断上线**。以下命令全部走 Cloudflare HTTP API、不需要本地 workerd，实测均正常：
`wrangler d1 list`、`wrangler deploy --dry-run`、`wrangler deploy`、`wrangler d1 execute --remote`、`wrangler secret put`。

## Decision

**A. sql.js 改为自托管**
把 `sql-wasm.js` + `sql-wasm.wasm`（合计约 1.5 MB）放进 `worker/public/vendor/`，
由本项目自己的 Workers Static Assets 托管，改为同源加载：

```ts
const SQL_JS_URL   = '/vendor/sql-wasm.js';
const SQL_WASM_URL = '/vendor/sql-wasm.wasm';
```

不采用的替代方案：
- **npm 安装 sql.js 让 Vite 打包 wasm** —— 需要额外的 `vite-plugin-wasm` / `assetsInclude` 配置，
  且 wasm 会进构建产物哈希链，反而增加复杂度。当前"运行时 script 注入"的写法本身没问题，改 URL 即可。
- **换国内 CDN** —— 依然是第三方可用性外部化，且还要额外考虑 HTTPS 与版本一致性。

**B. 本地开发环路**
1. 建议安装 [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe) 恢复 `wrangler dev`。
2. 在此之前，**不把 `wrangler dev` 放进任何阻断性流程**：
   - 前端用 `vite dev`，在 `web/vite.config.ts` 加 `server.proxy` 把 `/api` 指向已部署的 workers.dev 域名；
   - 后端验证以"部署到远端 + `/api/v1/health` + `wrangler tail`"为准；
   - D1 迁移一律用 `--remote`。

## Consequences

**正面（A）**
- 沙箱可用性从"取决于 cdnjs"变成"取决于本站本身"——本站能打开，沙箱就能用。
- 同源加载，不受第三方 CDN 的 CORS / MIME / 版本漂移影响；走 Cloudflare 边缘缓存，首屏后近乎零延迟。
- "可离线"文案与实现终于一致（配合 Service Worker 后可真正离线，MVP 不做）。

**负面（A）**
- `worker/public` 增加约 1.5 MB。Workers Static Assets 免费额度对此完全无压力（静态资源请求不计 Worker 调用）。
- sql.js 升级需手动替换 vendor 文件，需在 README 记一笔来源与版本。

**正面（B）**
- 明确了"本机 workerd 坏了 ≠ 不能上线"，避免团队卡在一个与交付无关的环境问题上。

**负面（B）**
- 没有本地环路时，后端每次验证都要真部署一次，反馈变慢。因此 VC++ 修复仍列为 P1 建议项。

## Verification

```bash
# A：断开 cdnjs 后沙箱仍能初始化
grep -n "cdnjs" web/src/features/sql-sandbox/SqlSandbox.tsx   # 必须无匹配
ls -la worker/public/vendor/sql-wasm.js worker/public/vendor/sql-wasm.wasm

# B：不依赖 workerd 的链路可用
npx wrangler d1 list --json
cd worker && npx wrangler deploy --dry-run --outdir=../dist-worker
```

## Related ADRs

ADR-001（升级 wrangler 4）
