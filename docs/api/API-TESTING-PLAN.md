# MES 实训平台 API 测试体系设计方案

> 作者：API 测试专家（接口探） ｜ 适用项目：`E:/mes-learning-platform`（Cloudflare Workers + D1 + DO 全栈）
> 目标：用系统化测试把"接口经常出问题"转变为"每次改动都有回归护栏"。

---

## 0. 现状诊断（为什么接口老出问题）

通过代码审计（`worker/src/router.ts`、`core/`、`middleware/`、`docs/api/openapi.yaml`）得出：

| 维度 | 现状 | 风险 |
|------|------|------|
| **API 测试覆盖** | 全仓库 **0** 个 API 测试文件；唯一 CI `quality-gates.yml` 仅做 typecheck + build + SQL 哈希回归 | 任何后端改动无功能/安全/性能兜底，回归即线上事故 |
| **契约覆盖率** | `router.ts` 登记 **63 条路由 / 53 个唯一端点**；`docs/api/openapi.yaml` 仅 **21 条** | 契约覆盖率 ≈ **33%**，前端按过期 openapi 生成类型 → 前后端不一致隐患 |
| **已知线上缺陷** | `production` 账号 course-detail 接口 500（`activePath` 已设但 `selectedPaths` 空） | 无回归测试，修复后易复发 |
| **安全中间件** | `security`(Origin 校验) / `auth`+`guardAdmin/guardAll` / `validate`(256KB) / `ratelimit`(DO 令牌桶) 已就位但**零测试** | 任一处回归（如漏挂守卫）即绕过鉴权/限流，且无人发现 |
| **答案保密** | 题面 GET 不放 `answer`/`reference_answer`，判题强制登录 | 依赖人工 review，无测试守护"答案泄露"回归 |
| **AI 外部依赖** | `ai/tutor`、`ai-grade`、`tts` 烧 Workers AI 配额且有兜底文案 | 无 mock → 测试 flaky + 烧钱 |

**结论**：问题不在"没有写测试的文化"，而在于**缺一套可落地的测试基础设施与门禁**。下面给出一套贴合现有栈、可立即启动的方案。

---

## 1. 测试目标与质量门禁

**核心目标**：阻断以下高频问题类——
1. 响应信封漂移（`{code,data,msg,traceId}` 缺失 / `traceId` 为空）
2. 鉴权缺失（应登录的接口漏挂 `guardAll`/`guardAdmin`）
3. Origin / CSRF 绕过（写请求 `Origin` ≠ `Host` 未拦截）
4. 500 裸错误（handler 抛错未信封化、泄露表名）
5. 限流失效（令牌桶不触发 429）
6. 答案泄露（题面下发 `answer`）
7. 契约漂移（openapi 与实际路由不一致）

**门禁指标（分阶段收紧）**：

| 指标 | 阶段 0 | 阶段 1 | 阶段 3（目标） |
|------|--------|--------|----------------|
| 路由功能覆盖 | 全路由冒烟 | 关键模块 happy+edge | ≥ 90% 端点 |
| 安全用例通过率 | 100% | 100% | 100% |
| 契约覆盖率（openapi↔router） | 无过期文档（防回归） | — | 100%（全对齐） |
| 本地 GET p95 | < 200ms（基线） | — | 预览环境 k6 压测达标 |
| 错误码分区正确率 | 100% | 100% | 100% |
| 全量执行时长 | — | — | ≤ 15 min |

**发布卡点**：`test` 全红 = 禁止 `deploy`；新增路由必须带对应测试（ADR 约定）。

---

## 2. 分层测试策略（四层）

```
L1 契约/信封层  ── 最快、最高 ROI：每个路由都过信封 + 错误码分区 + openapi 对齐
L2 功能/集成层  ── 每模块 happy path + 边界 + 业务规则（草稿隐藏、幂等、答案保密）
L3 安全/韧性层  ── OWASP API Top 10 映射：鉴权、Origin、限流、体量、注入、错误边界
L4 性能/容量层  ── 本地 p95 冒烟 + 预览环境 k6 负载（10x 容量、错误率 <0.1%）
```

| 层 | 测什么 | 工具 | 频率 |
|----|--------|------|------|
| L1 | 信封一致性、错误码、契约对齐 | Vitest + 自定义 matcher | 每次 PR / push |
| L2 | 模块业务正确性 | Vitest + Workers 池（真实 D1） | 每次 PR / push |
| L3 | 鉴权/限流/注入/500 信封化 | Vitest + Workers 池 | 每次 PR / push |
| L4 | 延迟/吞吐/容量 | 本地 Vitest 计时 + 预览环境 k6 | 每日 / 发布前 |

---

## 3. 技术选型（贴合现有栈，零额外运行时）

| 能力 | 选型 | 理由 |
|------|------|------|
| 测试运行器 | **Vitest** | TS 原生、与 worker 同构、快 |
| Workers 运行时 | **@cloudflare/vitest-pool** | 官方集成，**进程内真实 D1 + DO**，无需起 `wrangler dev` server |
| 断言 | Vitest `expect` + 自定义 `toMatchEnvelope` matcher | 统一信封断言 |
| 覆盖率 | **@vitest/coverage-v8** | 行/分支覆盖，阶段 3 设阈值 |
| 负载 | 本地并发计时（L4 冒烟）+ **k6**（预览环境） | 免费套餐避免烧云资源 |
| 契约源 | 以 `router.ts` 导出的 `routes` 为 **single source of truth** | 自动比对 openapi，防止文档漂移 |
| CI | 扩展 `quality-gates.yml` 或新增 `api-tests.yml` | 复用现有 Node22 + npm CI |

> 不引入 Playwright/REST Assured 等重框架——当前栈用 Vitest + Workers 池最轻、最贴合。

---

## 4. 测试环境与数据

- **本地密钥**：`.dev.vars` 已提供 `SESSION_SECRET` / `ADMIN_PASSWORD=qijia2002` → 测试直接 `POST /api/v1/auth/login` 拿管理员 `sid` cookie；Miniflare 自动读取 `.dev.vars`。
- **测试库**：`setup` 阶段把 `src/migrations/` 下全部 `schema*.sql` + `migration*.sql` 通过 `env.DB.exec` 应用到**全新本地 D1**，再插**极小 fixture**（topics/chapters/questions 各 1 条；`platform_config` 已由 schema 自带 `token_version=1`）。
- **隔离原则**：每个 suite 用独立 `anon_id` / `import_id`；**不依赖生产巨大 seed**（慢且易冲突）；生产 seed 的校验留给独立的数据完整性测试。
- **AI 外部依赖**：`ai/tutor`、`ai-grade`、`tts` 用 `vi.mock` 或本地 stub 返回兜底文案，**禁止真实调用 Workers AI**（防 flaky + 防烧配额）。
- **多域/Workers.dev 入口**：测试统一用 `http://localhost` 作为 Host，写请求带 `origin: http://localhost` 以通过 `security` 中间件（与线上同源策略一致）。

---

## 5. 关键场景用例清单（直接对应现有缺陷/风险）

### L1 契约与信封
- [ ] 每个 `routes` 条目结构完整（method/path/handler、无重复注册）
- [ ] 成功响应 = `{code:0, data, msg, traceId}` 且 `traceId` 非空
- [ ] 错误响应 = `{code, data:null, msg, traceId}`（错误码分区 1xxx/2xxx/3xxx/4xxx/5xxx/9xxx）
- [ ] 未知路由返回**信封化 404**（含 `traceId`）——已发现 `index.ts` 未走 `errorBoundary`、`traceId` 缺失，需修
- [ ] openapi 无过期路径（防文档漂移回归）；覆盖率打印报告

### L3 安全与韧性
- [ ] 写请求 `Origin` ≠ `Host` → **403 / 2004**
- [ ] `guardAll` 路由缺会话 → **401 / 2001**（例：`POST /api/v1/quiz/grade`）
- [ ] `guardAdmin` 路由缺会话 → **401 / 2001**（例：`GET /api/v1/admin/topics`）
- [ ] 伪造/过期 `sid` → **401**
- [ ] 请求体 `content-length` > 256KB → **413 / 1002**
- [ ] 参数注入（`';DROP TABLE...`、`abc`）→ **不 500**，返回 400/404 安全码
- [ ] 登录限流（同 IP/账号双桶）→ **429 / 3002**
- [ ] 写接口限流（令牌桶 cap 10）→ **429 / 3001**
- [ ] handler 抛错 → **500 但信封化（code 9000/5001），绝不裸 HTML / 泄露表名**
- [ ] 答案保密：题面 GET 不含 `answer`/`reference_answer`；`grade` 强制登录

### L2 功能（关键模块）
- [ ] 认证：错口令 401 / 对口令下发 cookie / whoami / logout 清 cookie
- [ ] 内容：列表/详情/章节 happy + 草稿隐藏(404/4001) + 非数字 id(400)
- [ ] 进度：记录幂等（同日同条目重复上报不翻倍）
- [ ] 题库：判题登录校验 + 答案不下发
- [ ] 后台：增删改需 admin cookie
- [ ] 引擎：可选登录（匿名全 pending）

### L4 性能
- [ ] `GET /api/v1/health` 本地 p95 < 200ms
- [ ] 并发 10 × `GET /api/v1/topics` 全 200、无 5xx

---

## 6. 目录结构与本次落地脚手架

```
worker/
├─ vitest.config.ts            # Workers 池配置（configPath → ../wrangler.toml）
├─ test/
│  ├─ setup.ts                # 全局 beforeAll：应用 schema + 插 fixture
│  ├─ helpers/
│  │  ├─ client.ts            # callApi()：构造 Request、带 cookie/origin、解信封
│  │  ├─ auth.ts              # getAdminCookie() / forgeCookie() / getSecret()
│  │  └─ db.ts                # seedTestDb()：应用 migrations + 极小 fixture
│  ├─ contract/
│  │  └─ envelope.test.ts     # L1：信封 + 错误码 + openapi 漂移
│  ├─ security/
│  │  └─ guards.test.ts       # L3：Origin/鉴权/限流/体量/注入/500信封
│  ├─ functional/
│  │  ├─ auth.test.ts         # L2：登录态全链路
│  │  └─ content.test.ts      # L2：内容模块 happy+edge
│  └─ performance/
│      └─ smoke.test.ts       # L4：p95 冒烟 + 并发
└─ package.json               # 新增 test / test:watch / coverage 脚本
.github/workflows/api-tests.yml  # 新 CI：npm ci → vitest run --coverage
```

---

## 7. 落地路线图（对齐 P0 文化，分阶段）

- **阶段 0（立即，本次已落地脚手架）**：L1 契约/信封 + L3 安全冒烟覆盖**全路由** → 一次性抓住最大风险面（信封漂移、鉴权缺失、Origin 绕过、500 裸错、限流失效）。
- **阶段 1**：L2 关键模块 happy+edge（content / auth / quiz / progress / admin）。
- **阶段 2**：L3 完整安全 + L4 性能 + AI mock + 错误码映射全覆盖；修 `index.ts` 404 缺 `traceId`。
- **阶段 3**：覆盖率 ≥ 90% + **契约漂移 CI 卡点**（openapi 必须 100% 对齐 router）+ 预览环境 k6 load + 接 `deploy` 卡点。

---

## 8. CI 集成

新增 `api-tests.yml`（或在 `quality-gates.yml` 增加 test 门禁）：

```yaml
on: [push, pull_request]
jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Write .dev.vars for tests
        run: |
          echo "SESSION_SECRET=${{ secrets.TEST_SESSION_SECRET || 'ci-dev-secret' }}" > .dev.vars
          echo "ADMIN_PASSWORD=${{ secrets.TEST_ADMIN_PASSWORD || 'ci-admin' }}" >> .dev.vars
          echo "NODE_ENV=test" >> .dev.vars
      - name: API tests
        run: npm run test --workspace worker -- --coverage
      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with: { name: api-coverage, path: worker/coverage }
```

`deploy` 步骤前置条件：test 门禁绿，否则阻断合并/发布。

---

## 9. 度量与持续改进

- 覆盖率仪表（行/分支/路由端点数）；失败分级：**P0** 安全/信封/鉴权，**P1** 功能，**P2** 性能。
- 每周回顾：新增路由必须带测试（写入 ADR，reviewer 复核）。
- openapi 反向驱动补全：阶段 3 前把 63 路由全部补进 `docs/api/openapi.yaml`，并把"契约覆盖率=100%"设为硬卡点。

---

## 10. 风险与约束

- **免费套餐 D1 单线程** → 测试并发受限，用串行/低并发；不要对测试库做高并发写压。
- **AI 配额** → `ai/*` 必须 mock，禁止真实调用。
- **openapi 需补全到 63 路由** → 契约测试先防"回归"（无过期文档），再逐步提升到"全对齐"。
- **`index.ts` 404 路径缺 `traceId`** → 阶段 2 修复，使其与 `errorBoundary` 一致（前端报障需要 traceId）。
