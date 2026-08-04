# MES 学习平台 · 代码审查标准与流程

> 版本：v1.0 · 生效日期：2026-08-03
> 适用范围：`mes-learning-platform`（Worker + D1 + DO + React 19 全栈）
> 维护者：平台核心贡献者 · 修订须经 ADR 流程（`docs/decisions/`）

---

## 0. 目的与定位

本项目**架构纪律已经很强**（洋葱管道、DbSession 预算守卫、R6 答案隔离、设计 P0 红线、ADR 决策记录），但**工程纪律是空的**：全员直推 `master`、零自动化测试、无 ESLint/Prettier、无 PR 评审门禁。

本文档只补后者——把零散的"作者自觉"升级为"可执行的评审_gate + 清单 + 流程"，让代码质量不依赖个人水平。

**三条基本原则：**
1. 评审教人，不只挑错。评论要讲清"为什么"和"怎么改"。
2. 架构红线（`README` P0 / R6 / §A11.2 / DbSession 预算）是**硬约束**，不是建议。
3. 门禁优先于人工评审——能靠 CI 拦住的，不浪费评审者时间。

---

## 1. 现状诊断（制定依据）

| 维度 | 现状 | 结论 |
|------|------|------|
| 分支/合并 | 单 `master`，直推，无 PR | 🔴 首要补 PR 门禁 |
| 自动化测试 | 全仓 0 个 `*.test.*` | 🔴 补基线测试（先护核心路径） |
| 静态检查 | 仅 `tsc --strict`，无 ESLint/Prettier | 🟡 补 ESLint + Prettier |
| 类型严格度 | `strict:true` 但 `noUncheckedIndexedAccess:false` | 🟡 开启，拦下标越界 |
| 架构/安全 | 洋葱管道、CSP、HMAC、R6 隔离齐备 | ✅ 固化为清单 |
| 文档 | ADR/规格/审计齐全 | ✅ 评审引用而非重述 |
| 设计系统 | P0 五条红线已定义 | ✅ 固化为前端清单 |

**已观察到的技术债（评审需重点盯）：**
- `worker/src/modules/quiz/quiz.service.ts`：`gradeAnswerSvc` 内单/多选 + `answer` 索引/文本双口径兼容分支复杂，易回归。
- 双命名债：`schemaHint`/`schema_hint`、`clientHash`/`client_hash` 并存（`quiz.service.ts`、`web` 端）。
- `parseJson` 失败静默返回 `[]`（`quiz.service.ts`），可能掩盖数据损坏。
- 大量 `opts[i]` 下标取值，在 `noUncheckedIndexedAccess:false` 下类型检查不拦。

---

## 2. 审查分级体系

所有评审意见必须标注级别。级别与本项目既有"红线词汇"对齐：

| 级别 | 含义 | 合并规则 | 项目内典型触发 |
|------|------|----------|----------------|
| 🔴 **阻塞（Blocker）** | 必须修，否则不合并 | 清零前禁止合并 | 触碰 P0 设计红线 / R6 答案泄露 / 绕过 DbSession 预算 / Origin·CSP 缺失 / 密钥入仓 / 越权写 / 数据损坏风险 |
| 🟡 **建议（Suggestion）** | 应当修，可协商 | 至少回复说明，或开 follow-up issue | 缺失输入校验 / 双命名债 / 慢查询 / 无测试的核心路径 / 复制粘贴重复 |
| 💭 **提示（Nit）** | 可选优化 | 不阻塞 | 命名微调 / 注释补充 / 风格不统一（已由 Prettier 管的除外） |

> 💭 级若已由 ESLint/Prettier 自动覆盖，则**不再作为人工评审项**——评审者只评机器拦不住的东西。

---

## 3. 强制门禁（CI / 提交前）

在建立评审流程前，先把能自动化的门禁装上。以下为**落地优先级**：

### 3.1 已有（保留并强化）
- `npm run typecheck` —— 保留；**追加** `noUncheckedIndexedAccess: true`（`worker/tsconfig.json`），并在 PR 模板要求 typecheck 绿。

### 3.2 缺失（需补，按此顺序）
1. **Prettier**（格式化，零争议）：单引号/2 空格/无尾逗号由 Prettier 决定，评审不再纠结格式。
2. **ESLint（flat config）**：规则重点——`no-explicit-any` 限制、未用变量、危险正则、SQL 字符串拼接检测（`no-restricted-syntax` 兜底）。Worker 端加 `@cloudflare/eslint-config`。
3. **基线测试**：先护最易回归且最贵的路径——`quiz.service.ts` 判题逻辑、`db.ts` 预算守卫、`client.ts` 包络解包、前端 `resultHash`/`simReducer`。
4. **密钥扫描**：`git-secrets` 或 GitHub 自带 secret scanning；`SESSION_SECRET`/`ADMIN_PASSWORD` 永不入仓（见 `README` 与 `wrangler.toml` 注释）。

### 3.3 门禁即 CI
PR 上挂 GitHub Actions：`typecheck` + `lint` + `test` 全绿才允许合并（详见 §5.4）。

---

## 4. 分层审查清单

评审者按"通用 → 所属层专项"逐条过。打钩项出现在 PR 模板的自检区。

### 4.1 通用（所有改动）
- [ ] 🔴 **安全**：用户输入是否参数化（SQL 必须 `prepare().bind()`，禁止字符串拼接——`quiz.repo.ts` 契约）；外部输入是否被信任前校验。
- [ ] 🔴 **正确性**：错误路径是否都有处理（空结果、网络失败、`JSON.parse` 失败）；`parseJson` 类静默兜底是否会掩盖损坏（见 §1 技术债）。
- [ ] 🔴 **密钥/配置**：有无 `secret` 写入仓库或 `wrangler.toml` vars；敏感值是否走 `wrangler secret put`。
- [ ] 🟡 **性能**：是否有 N+1（循环内查库——DbSession 会拦，但应在评审层先发现）；新增 SQL 是否走索引、是否超 `MAX_STMT_PER_REQUEST=40`（`db.ts`）。
- [ ] 🟡 **可维护**：命名是否自解释；是否有应提取的重复；是否补了"为什么"注释而非"是什么"。
- [ ] 💭 **测试**：核心路径是否补了测试；若无，是否在 PR 说明原因或开 follow-up。

### 4.2 后端 Worker 专项
- [ ] 🔴 **R6 答案隔离**：任何 SELECT 列表不得含 `answer` / `answer_sql`（`quiz.repo.ts` 白名单）；新增题目相关接口必须显式列字段，禁止 `SELECT *`。
- [ ] 🔴 **DbSession 预算**：新增查询必须走 `DbSession`（`.first/.all/.run/.batch`），不得裸调 `db.prepare` 绕过 `#charge`；批量写用 `batch`。
- [ ] 🔴 **安全中间件**：写操作（POST/PUT/DELETE）是否经 `security`（Origin 校验 + CSP）；新增敏感写是否挂 `ratelimit`/`auth` 管线（非匿名端点）。
- [ ] 🟡 **DTO 白名单**：对外响应是否只含必要字段；是否误带内部列/密钥/答案。
- [ ] 🟡 **AI 调用容错**：`aiGradeSvc` 类外部调用失败必须兜底（`parseAiResponse` 已有），不得抛错中断前端（见 `quiz.service.ts`）。
- [ ] 🟡 **限流/额度**：新增端点是否按匿名/登录选对管线；DO 是否只用于敏感写/登录（避免双额度）。

### 4.3 前端 Web 专项
- [ ] 🔴 **设计 P0 红线**：无 emoji 作功能图标（用 `lucide-react` + `Icon.tsx`）、无紫粉渐变、无硬编码色值（除 `#fff/#000`，走 `design-tokens.css`）、无弹跳缓动、无千篇一律 Hero（`README` 约束）。
- [ ] 🔴 **错误边界**：`fetch` 失败是否收敛为 `ApiError`（`client.ts` `toApiError`），UI 是否渲染可恢复状态而非白屏。
- [ ] 🟡 **双命名债**：新增字段避免 `camelCase`/`snake_case` 双口径并存（§1）；与后端契约一致的命名优先。
- [ ] 🟡 **SQL 沙箱**：`sql.js` 判题是否只在客户端、`answer_hash` 比对、`answer_sql` 永不下发（`features/sql-sandbox/`）。
- [ ] 💭 **无障碍/响应式**：交互元素可聚焦；≤768px 布局（`useIsNarrow`、`RoadmapMatrix` 已有范式）。

### 4.4 数据 / 迁移专项
- [ ] 🔴 **迁移幂等**：`migrations/*.sql` 是否可重复执行（`IF NOT EXISTS` / `INSERT OR IGNORE`）；是否破坏线上表。
- [ ] 🟡 **种子数据**：`seed-*.sql` / `docs/seeds/` 是否与 schema 一致；大批量导入是否走 staging→commit 两阶段（参考 Admin 导入）。
- [ ] 🟡 **索引**：新增高频查询是否已有 `idx_*`（见 `quiz.repo.ts` 顶部依赖索引注释）。

---

## 5. 审查流程

### 5.1 分支策略（取代直推 master）
- 所有改动从 `master` 拉 `feat/`、`fix/`、`refactor/` 短生命周期分支。
- `master` 设为保护分支：禁止直推、要求 PR + 至少 1 审批 + CI 绿。
- 重大架构/设计决策仍走 **ADR**（`docs/decisions/`，已建立），评审前先有 ADR 链接。

### 5.2 角色与职责
- **作者**：完成 §4 自检 + 填 PR 模板（含自测证据、影响面、风险点）；主动标出"希望评审重点看哪里"。
- **评审者（≥1，建议非作者本人）**：按 §4 逐条评；每个意见标 🔴/🟡/💭；阻塞项必须给"如何改"的具体建议。
- **合并者**：确认所有 🔴 清零、CI 绿、争议已解决； squash 合并、commit message 遵循现有 conventional-commit 风格。

### 5.3 评审步骤（建议 SLA：24h 内首评）
1. 作者开 PR，CI 自动跑 typecheck/lint/test。
2. 评审者先读 PR 描述与 ADR（如有），再读 diff，最后对照 §4 清单。
3. 逐条评论，级别分明；用"建议/考虑"而非命令式。
4. 作者改完 push，评审者复核；🟡 可协商转为 follow-up issue。
5. 合并者按 §5.2 合并。

### 5.4 合并硬规则
- CI（typecheck+lint+test）必须全绿。
- 🔴 阻塞项数量为 0。
- 至少 1 个非作者审批（单人项目可由另一核心成员或 AI 评审先行 + 人工抽检）。
- 不得用 `--no-verify` 跳过钩子。

### 5.5 度量与改进（每月一次）
- 跟踪：PR 平均评审轮次、🔴 复发类型（如双命名债、R6 边界）、测试覆盖率变化。
- 高频 🔴 若可自动化，升级进 ESLint 规则或 DbSession 守卫（"用架构约束替代人工纪律"——本项目已有成功先例）。
- 本文档随实践修订，修订走 ADR。

---

## 附录 A · PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`）

见同目录 `PULL_REQUEST_TEMPLATE.md`，含：变更摘要、ADR 链接、影响面、自测证据、§4 自检勾选、重点求评区。

## 附录 B · 落地第一步（把 §3 门禁补上）

建议按顺序执行，每一步可独立 PR：
1. 加 `prettier` + `.prettierrc`，对全仓格式化一次（单独 PR，便于 diff 干净）。
2. 加 `eslint`（flat config），修或 suppress 现有告警，设 `npm run lint`。
3. `worker/tsconfig.json` 开 `noUncheckedIndexedAccess: true`，修由此暴露的隐患。
4. 加 Vitest，先写 `quiz.service` 判题 + `db` 预算 + `client` 包络三个测试。
5. 加 GitHub Actions 串起 typecheck+lint+test，并对 `master` 开保护分支。

> 需要我直接把 ESLint/Prettier/Vitest 配置和 CI workflow 脚手架生成到仓库吗？确认后我可一次性补上（§3.2–3.3）。
