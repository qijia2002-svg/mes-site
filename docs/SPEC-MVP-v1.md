# Spec - MES 实训平台 MVP v1

> 生成日期：2026-07-31
> 基于：PRD-MVP-v1.md + 架构 tech-spec.md/deploy-runbook.md + DESIGN.md + ADR-001~003
> 状态：已确认（用户 2026-07-31 确认方案：种子内容由助手起草，目标可上线 MVP）
> 唯一交互点已通过，自动进入 Phase 2/3/4。

---

## 1. 产品定义
- **一句话描述**：面向制造业信息化（MES）实施运维人员的实训平台，浏览器内可学（章节正文）、可练（SQL 沙箱 + 判题）、可记录进度，零成本跑在 Cloudflare 免费套餐。
- **目标用户**：MES 实施顾问、运维工程师、产线信息化学习者。
- **核心问题**：现有 Phase 0 骨架完整但零内容零闭环，上线即满屏空壳；部署链路有三处阻断。

## 2. MVP 范围（锁定 — 不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 | 来源 |
|--------|------|-------------|------|
| P0 | F1 种子内容 | 3 主题×3 章节真实教材正文 + ~9 SQL 题 + ~12 选择题 + 2 学习路径，无占位文案 | PM-F1 |
| P0 | F2 章节阅读页 | 前端路由 + markdown-it + dompurify 渲染 `/chapters/:id` 返回的 md | PM-F2 |
| P0 | F3 SQL 练习闭环含判题 | 题目→沙箱跑 SQL→比对结果集哈希→判对/错→记录 | PM-F3 |
| P0 | F4 匿名 localStorage 身份 | 生成 anon_id 存 localStorage，全链路透传，零登录即可练 | PM-F4 |
| P0 | F5 进度记录 + 今日统计 | 练习/阅读事件落 progress_events；首页展示今日完成数 | PM-F5 |
| P0 | F6 空/错误态与可用性修复 | 替换 emoji 图标→lucide、消除硬编码色、落字体栈、focus-visible/reduced-motion、可见 label | PM-F6/设计 |

## 3. 明确不做（Out-of-Scope — 锁定）
学员账号体系、Excel 导入前端、证书、排障沙盘、错题本、视频、数据看板、多租户、后台 CRUD 前端（MVP 内容经 seed.sql 入库，不依赖后台录入）。

## 4. 技术架构（锁定 — 含版本锚定）
| 层 | 技术 | 实际版本 | 锁定原因 |
|----|------|----------|----------|
| 构建/部署 | wrangler | **^4.117.0**（从 ^3.99.0 升级） | 3.x 读不到 assets 配置 → ASSETS undefined → 部署白屏（P0-1） |
| 后端 | Cloudflare Workers | 兼容日期 2025-10-01 + nodejs_compat | 既定 |
| 数据库 | D1 | 库名 `mes-learning`（远程需 `d1 create` + 回填真 id） | P0-2 |
| 限流 | Durable Object RateLimiter | SQLite-backed | 既定 |
| 前端 | React 19 + Vite | 既定 | 既定 |
| SQL 沙箱 | sql.js（WASM） | 自托管到 `worker/public/vendor/`（弃 cdnjs） | P1-9/ADR-003 |
| 图标 | **lucide-react** | **1.28.0（锁死，不加 ^）** | ADR-002，全站唯一 |
| 字体 | Archivo + Noto Sans SC + JetBrains Mono | @fontsource 自托管 | 设计，禁 Google CDN |
| 机密 | SESSION_SECRET / ADMIN_PASSWORD | `wrangler secret put` | P0-3 |

## 5. API 端点清单（锁定）
既有 19 端点保留。新增/变更如下（开发以 openapi.yaml 为准）：
- `GET /api/v1/chapters/:id` — 已存在，返回 md；DTO 现状保留，前端新增渲染。
- `GET /api/v1/sql-exercises/:id` — **DTO 白名单**：返回 `{id, title, prompt, schema_hint, answer_hash}`，**绝不返回 answer_sql**（R6）。
- `POST /api/v1/sql-exercises/:id/submit` — 收 `{anon_id, passed, client_hash}`（client_hash 供审计/防作弊，判题以客户端比对为准），落 progress_events，返回 `{ok, progress_updated}`。**替换原 submitSql 桩**。
- `GET /api/v1/progress?anon_id=` — 返回该匿名用户进度汇总。
- `GET /api/v1/progress/today?anon_id=` — 返回今日完成数（阅读/练习/通过）。
- `POST /api/v1/progress` — 收 `{anon_id, item_type, item_id, status}`，记录阅读/练习事件（F5）。
- admin 写操作（content 发布）**必须 `content_version = content_version + 1`**（P1-8，修复 L2 缓存 360s 不刷新）。

## 6. 数据库表清单（锁定）
既有 17 张表保留。变更：
- `sql_exercises` 增加列 `answer_hash TEXT`（规范化结果集哈希；`answer_sql` 仍存但 API 不返回）。
- `progress_events` 已有；确保 `(anon_id, item_type, item_id)` 可查。
- seed：新增 `seed.sql`（与 schema.sql 分离、可重复执行），写入 topics/chapters/sql_exercises(含 answer_hash)/questions(选择题)/learning_paths 及关联。

## 7. 页面清单（锁定）
| 页面 | 路由 | 核心组件 | 对应 API | 备注 |
|------|------|----------|----------|------|
| App Shell | — | Sidebar 240 + Topbar 52 + 面包屑 + 404 | — | 最高杠杆，一改全站变样 |
| 首页工作台 | `/` | 继续学习 + 进度 + 快速入口 | /progress/today | 不做 Hero |
| 课程列表 | `/courses` | 主题卡 | /topics | 现有 |
| 课程详情 | `/courses/:id` | 章节列表 + 题库入口 | /topics/:id/chapters | 现有路由，补渲染 |
| 章节阅读 | `/chapters/:id` | md 渲染（markdown-it+dompurify） | /chapters/:id | **F2 新增页面** |
| SQL 工作台 | `/sql-space` 或 `/chapters/:id/exercise/:eid` | SqlSandbox 三栏 + 判题反馈 | /sql-exercises/:id + /submit | **F3** |
| 学习路径 | `/learning-paths` + `/learning-paths/:id` | 阶梯可视化 | /learning-paths | 设计师重点 |
| 题库 | 并入课程详情 | 选择题作答 | /quiz | QuizPage 改下拉 |
| 登录/后台 | `/login` `/admin` | 可见 label + 不违规 | /auth/login | 最小可用 |

## 8. 设计 Token（锁定）
来自 `design-system/design-tokens.json` + `DESIGN.md`：
- 主色 `--accent #0E7490`（工程青，对白 5.36:1，兼作链接/按钮底）；避开 Indigo #6366F1 与全部紫粉。
- 中性冷调：`--bg #F7F9FB` `--surface #FFF` `--fg #0F1B26` `--muted #5A6E80` `--border #DDE5EC`。
- 语义：`--ok #15803D` `--warn #B45309` `--danger #B91C1C`（对齐设备状态）。
- 字体：Archivo（UI/铭牌）+ Noto Sans SC（中文）+ JetBrains Mono（代码）；UI 15px / 长文 17px；自托管。
- 间距 4px 网格；圆角 3/6/8/12（无 ≥16）；Hairline 默认无阴影；动效 150ms。
- 图标：**lucide-react 1.28.0**，16/20/24 三档，`strokeWidth 1.75`，`currentColor`，统一封装 `web/src/components/Icon.tsx`。

## 9. 验收标准（EARS，锁定 — QA 测试唯一依据）
| 编号 | 功能 | EARS 验收标准 | 优先级 |
|------|------|--------------|--------|
| AC-01 | 种子内容 | While 站点部署完成，系统**必须**使 `GET /api/v1/topics` 返回非空数组（≥3 主题） | P0 |
| AC-02 | 章节阅读 | When 用户打开 `/chapters/:id`，系统**必须**渲染非空 markdown 正文 | P0 |
| AC-03 | SQL 判题 | When 用户在沙箱执行与答案结果集等价的 SQL，系统**必须**判定通过（比对 answer_hash） | P0 |
| AC-04 | SQL 判题 R6 | If 客户端请求 `/sql-exercises/:id`，系统**必须**只返回 answer_hash、**禁止**返回 answer_sql | P0 |
| AC-05 | 匿名身份 | When 用户首次访问，系统**必须**在 localStorage 写入 anon_id 并透传至进度接口 | P0 |
| AC-06 | 进度 | When 用户完成练习/阅读，系统**必须**写入 progress_events 且 `/progress/today` 反映该事件 | P0 |
| AC-07 | 部署白屏 | If 部署后访问 `/`，系统**必须**返回 200 且 ASSETS 绑定成功（wrangler ≥4.117） | P0 |
| AC-08 | 图标 | While 全站渲染，系统**必须**仅使用 lucide-react 图标，零 emoji 功能图标 | P0 |
| AC-09 | 颜色 | While 全站渲染，系统**必须**仅引用 Design Token，零硬编码 hex | P0 |
| AC-10 | 可用性 | While 全站渲染，系统**必须**提供 `:focus-visible` 与 `prefers-reduced-motion` 兜底 | P0 |

## 10. 边界与约束
- 不支持 IE；响应式断点 640/1024。
- 性能：只读接口挂 L2 缓存；DO 只服务敏感写/登录。
- 判题在客户端（sql.js），服务端只存哈希；答案 SQL 永不出网。
- 学员端无鉴权但**必须限流**。

## 11. 内嵌已知坑（从 Phase 1 审计拉取）
| 坑 | 指纹 | 根因 | 修法 |
|----|------|------|------|
| 部署白屏 | wrangler ^3.x + assets | 3.x 不读 assets 配置，ASSETS undefined | 升 wrangler@^4.117.0 |
| 生产 5xx | database_id 假 UUID | 未 `d1 create` 回填 | 部署前建库回填真 id |
| 后台登不进 | ADMIN_PASSWORD 未配置 | auth.service expected='' | secret put ADMIN_PASSWORD |
| 本地 workerd 崩 | 0xc0000005 缺 VC++ Redist | 本机 workerd 不可用 | 走 HTTP API 部署/迁移，不依赖本地 |
| cdnjs 单点 | sql.js 走境外 CDN | 最大卖点压境外 | 自托管 worker/public/vendor |

## 12. 端到端验证步骤（Spec 锁定的最后一项）
```bash
# 0. 升 wrangler
npm i -D wrangler@^4.117.0 -w worker
# 1. 建库 + 回填真 id（手动改 wrangler.toml 第 15 行）
npx wrangler d1 create mes-learning
# 2. 迁移 + 种子
npx wrangler d1 execute mes-learning --remote --file=worker/src/migrations/schema.sql
npx wrangler d1 execute mes-learning --remote --file=worker/src/migrations/seed.sql
# 3. 机密
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_PASSWORD
# 4. 部署
npm run deploy
# 5. 断言
curl https://mes-learning-platform.workers.dev/api/v1/health   # => ok
curl https://mes-learning-platform.workers.dev/api/v1/topics   # => 非空数组
curl -I https://mes-learning-platform.workers.dev/             # => 200（ASSETS 生效）
curl -I https://mes-learning-platform.workers.dev/learning-paths  # => 200（深链）
```

## 13. 变更记录
| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-07-31 | 初版 Spec | Phase 1 三方调研收敛 | 全 MVP |
