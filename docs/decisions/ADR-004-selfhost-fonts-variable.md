# ADR-004: 字体自托管采用三套 Variable 字体包（替换 DESIGN.md 中的静态 Noto Sans SC）

## Status: Accepted (2026-08-01)

## Background

DESIGN.md §3 规定全站自托管三族字体，禁止 Google Fonts CDN（国内首屏不可控）：
- `@fontsource-variable/archivo`（展示/正文拉丁 + CJK 回落）
- `@fontsource-variable/jetbrains-mono`（SQL 编辑器 / 数字列 / 工单号）
- `@fontsource/noto-sans-sc`（**静态版**，CJK 主体）

设计师在 Phase 1 设计调研中写入的是**静态版 Noto Sans SC**。实测 npm registry 体积：

| 包 | 版本 | 解包体积 | 文件数 | 备注 |
|----|------|----------|--------|------|
| `@fontsource-variable/archivo` | 5.3.0 | 1.08 MB | 34 | 含 `wght` + `wdth` 轴（表头压 90% 用） |
| `@fontsource-variable/jetbrains-mono` | 5.3.0 | 203 KB | 24 | 含 `wght` 轴 |
| `@fontsource-variable/noto-sans-sc` | 5.3.0 | 4.7 MB | 112 | 含 `wght` 轴，按 unicode-range 分片 |
| `@fontsource/noto-sans-sc`（静态，DESIGN.md 现写） | 5.3.0 | **71.5 MB** | **1905** | 400/500/600 三档 × 全 CJK 分片 |

静态版 Noto Sans SC 的 71.5 MB / 1905 文件对 Cloudflare Workers Static Assets 是**事实不可行**：虽然免费档单文件 25 MiB、单版本 2 万文件上限都"够"，但 71.5 MB 资产包会让 `wrangler deploy` 上传极慢、且首屏即便按 unicode-range 也需拉取 CJK 子集；更严重的是会让 `web` 构建产物与部署资产膨胀一个数量级，拖累本地 dev 与 CI。

## Decision

`web/package.json` 锁定三套 **variable** 包，全部 `^5.3.0`（fontsource 用 `^` 可接受，字体文件不参与 lucide 那种"改名炸构建"风险）：

```json
"dependencies": {
  "@fontsource-variable/archivo": "^5.3.0",
  "@fontsource-variable/jetbrains-mono": "^5.3.0",
  "@fontsource-variable/noto-sans-sc": "^5.3.0"
}
```

- 在 `web/src/main.tsx` 首行 `import` 三套字体的 variable 入口（先于 `design-tokens.css`）：
  ```ts
  import '@fontsource-variable/archivo';
  import '@fontsource-variable/jetbrains-mono';
  import '@fontsource-variable/noto-sans-sc';
  ```
- `font-display` 由 fontsource 包默认 `swap`，不覆盖。
- CJK 字重：variable 包提供连续 `wght` 轴，DESIGN.md 要求的 400/500/600 直接取 `wght:400/500/600`；DESIGN.md §3 提到的"510/590"可精确取 `wght:510/590`（variable 比静态三档更准）。
- 表头压缩：Archivo variable 含 `wdth` 轴，`design-tokens.css` 对表头用 `font-variation-settings:'wdth' 90` 实现 Density 6 的窄列（DESIGN.md §3 已确认 Archivo 带 `wdth 62–125`）。

## Consequences

- 正面：CJK 自托管体积从 71.5 MB 降到 4.7 MB（**15× 缩小**），全站字体资产合计 ~6 MB / ~170 文件，远低于 Cloudflare 免费档 2 万文件 / 25 MiB 单文件上限，余量极大。
- 正面：variable 字体给连续字重与字宽控制，比静态三档更贴合 DESIGN.md 的 510/590 字重与 90% 表头压缩需求。
- 正面：仍 100% 自托管、零 Google CDN，满足 DESIGN.md 国内首屏可控要求。
- 负面：4.7 MB 仍是 CJK 全量覆盖的下限（fontsource 不提供"按字重裁剪的 variable CJK"构建）。缓解：fontsource 已按 unicode-range 分片，单页仅拉取用到的 CJK 区段；配合 `swap` 不阻塞首屏。
- 负面（可选更轻方案，本次不采用）：若 4.7 MB 仍嫌重，可放弃自托管 CJK、仅自托管 Archivo + JetBrains Mono，CJK 回落系统字体（PingFang SC / Microsoft YaHei）。代价是跨平台字体不一致（Windows 用 YaHei 而非 Noto），与 DESIGN.md 一致性诉求冲突，故不采用。
- 需同步：DESIGN.md §3 第 91 行原文"`@fontsource/noto-sans-sc`（STATIC）"需更正为 variable 版；本 ADR 为权威来源。

## Related ADRs
- ADR-002（lucide 图标锁库，无 emoji）——同批 Phase 1 设计/架构闭环决策。
- ADR-003（sql.js 自托管 + 解耦本地 dev）——同属"去境外 CDN 依赖"原则。
