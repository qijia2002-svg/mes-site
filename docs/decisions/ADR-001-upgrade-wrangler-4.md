# ADR-001: 升级 wrangler 到 4.x 以获得 ASSETS 绑定

## Status

Accepted (2026-07-31) · 决策人：高见远

## Background

`worker/package.json` 锁定 `wrangler ^3.99.0`（实装 3.114.17）。
`wrangler.toml` 用 `assets = { directory = "./worker/public", binding = "ASSETS", not_found_handling = "single-page-application" }`
声明前端静态资源，`worker/src/index.ts` 依赖 `env.ASSETS.fetch(req)` 处理所有非 `/api/` 请求。

实测对比两个版本的 `deploy --dry-run` 绑定表：

| wrangler | 输出 |
|----------|------|
| 3.114.17 | 只列出 `RATE_LIMITER` / `DB` / `NODE_ENV`，**没有 ASSETS** |
| 4.117.0 | `✨ Read 6 files from the assets directory`，绑定表含 `env.ASSETS  Assets` |

即：在 3.x 下部署，`env.ASSETS` 是 `undefined`，`index.ts:17` 会对**每一个前端请求**抛 TypeError → 整站 500，
只有 `/api/*` 存活。这是一个部署后才会暴露、且症状为"全站白屏"的静默故障。

另外 3.114 的 workerd 在本机 `wrangler dev` 时崩溃（`0xc0000005`），且提示 compatibility_date `2025-10-01`
超出其运行时支持上限 `2025-07-18` 并回退。

## Decision

`worker/package.json` 的 `wrangler` 依赖升级到 `^4.117.0`。

不采用的替代方案：
- **降级 compatibility_date 继续用 3.x** —— 解决不了 ASSETS 绑定缺失这个根因。
- **放弃 Static Assets，改用 Cloudflare Pages 分离部署** —— 引入第二个部署目标、第二套域名与跨域配置，
  为了绕开一个升级依赖就能解决的问题，代价过高。
- **在 Worker 里手写静态文件服务** —— 需要把构建产物内联进 Worker bundle，撞 1MB 脚本体积上限，且丢失 CDN 缓存。

## Consequences

**正面**
- `env.ASSETS` 正常绑定，前端可用；SPA 深链回退（`not_found_handling`）生效。
- compatibility_date `2025-10-01` 被支持，无需降级。
- 拿到 wrangler 4 的部署可观测性（绑定表、资源文件计数），dry-run 即可自检。

**负面**
- wrangler 4 有少量 CLI 行为变更（默认开启 telemetry、部分 flag 重命名），需要在 CI 脚本里复验。
  可用 `npx wrangler telemetry disable` 关闭。
- `wrangler dev` 在本机仍会崩溃 —— 那是 VC++ Redistributable 的问题，与版本无关（见 ADR-003）。

## Verification

```bash
npm install --save-dev wrangler@^4.117.0 --workspace worker
cd worker && npx wrangler deploy --dry-run --outdir=../dist-worker
# 绑定表必须出现：env.ASSETS   Assets
```

部署后：`curl -o /dev/null -w "%{http_code}" https://<域名>/` 必须为 200。

## Related ADRs

ADR-003（本地 workerd 崩溃与部署路径解耦）
