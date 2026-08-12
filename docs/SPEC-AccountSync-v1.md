# Spec - 账号云同步 v1（SPEC-AccountSync）

> 生成日期：2026-08-09
> 基于：用户系统提示词 + OD-017（终态）+ ADR-023
> 状态：待实现（确认后进入 Phase 2 设计细化 / Phase 3 开发）
> 关联：DESIGN-DualEnd-v1.md §5 / §7.1；ADR-023；影响 ADR-014

---

## 1. 产品定义

启用账号体系，以**邮箱 + 密码**认证、**强制注册**为基线，实现进度 / 笔记 / 收藏 / 错题的跨端实时云同步；全站内容需登录后可用。

## 2. MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 |
|--------|------|-------------|
| P0 | 邮箱+密码注册 / 登录 / 登出 | 建会话、限流、错误码规范 |
| P0 | 登录门禁（全站内容/学习路由） | 未登录重定向登录页 |
| P0 | 进度账号化 | `progress` 去 `anonId`，改 `user_id` 作用域 |
| P0 | 双向同步（pull / push） | 增量变更、per-field LWW |
| P0 | 密码安全 | WASM argon2id 哈希 + 阶梯锁 |
| P1 | 跨设备一键接力 deep link | 登录同账号后定位误差 ≤1 卡片 |
| P1 | 离线差异同步 | 飞行模式可用，恢复后回传 |
| P1 | Web Push 克制提醒 | 依赖账号订阅 |

## 3. 明确不做（Out-of-Scope）

| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| 第三方 SSO（微信/Google） | 配置成本/资质，v1 不需要 | v2 若用户增长 |
| 手机号+验证码 | 外部付费短信网关 + 实名合规 | 国内用户为主时 |
| CRDT / 字段级合并 | v1 复杂度过高 | 多端并发编辑冲突频发时 |
| 匿名可升级（v1） | 用户选定强制注册 | v1.1 可选加一键导入 |

## 4. 技术架构（锁定）

| 层 | 选型 | 说明 |
|----|------|------|
| 认证 | 邮箱+密码 | HMAC 会话复用 `SESSION_SECRET`；access 短期 + refresh 可选 |
| 密码哈希 | argon2id（WASM 兼容库，由架构师锁具体包） | Worker 侧执行，绝不存明文 |
| 限流 | 复用 `RateLimiter` DO 阶梯锁 | 注册/登录走登录管线（先限流后验密） |
| 数据库 | D1 新增 `users` / `sync_changes`；`progress` 加 `user_id` | 单库单线程，注意写入预算 |
| 同步 | 客户端事件/定时触发 pull+push | 服务端按 `(user_id, entity, field, updated_at)` LWW |

## 5. 数据模型（D1，新增/变更）

```sql
-- 新增
users(
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
sync_changes(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  entity TEXT NOT NULL,        -- progress|note|collection|wrong_question
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT,
  op TEXT NOT NULL,            -- upsert|delete
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_sync_user ON sync_changes(user_id, updated_at);

-- 变更：progress 去 anonId，加 user_id
ALTER TABLE progress ADD COLUMN user_id INTEGER REFERENCES users(id);
-- 旧 anonId 列：迁移后废弃（v1 直接弃用，不回填）
```

笔记/收藏/错题表同样加 `user_id` 作用域（具体 schema 见 Phase 2 细化）。

## 6. API 端点（锁定）

| Method | Path | 功能 | 认证 | 请求体 | 响应 |
|--------|------|------|------|--------|------|
| POST | /api/v1/auth/register | 注册 | 否（限流） | {email,password} | 201 + 会话 |
| POST | /api/v1/auth/login | 登录 | 否（阶梯锁） | {email,password} | 200 + 会话 |
| POST | /api/v1/auth/logout | 登出 | 是 | — | 200 |
| GET | /api/v1/auth/whoami | 当前用户 | 是 | — | 200 {user} |
| GET | /api/v1/sync/pull?since=:ts | 增量拉取 | 是 | — | 200 {changes[]} |
| POST | /api/v1/sync/push | 增量推送 | 是 | [{entity,entity_id,field,value,updated_at}] | 200 {merged[]} |

进度/笔记/收藏/错题的既有 CRUD 端点增加 `user_id` 作用域（服务端强制按会话 `user_id` 过滤，防越权）。

## 7. 冲突策略（per-field LWW）

- 每条变更带客户端 `updated_at`（毫秒）。
- 服务端 `push` 时按 `(user_id, entity, entity_id, field)` 比较 `updated_at`，后者覆盖前者；`delete` 优先于 `upsert` 同时间戳。
- `pull` 返回该用户 `since` 之后的合并后变更。
- v1 不做字段级合并/CRDT；并发编辑同字段以最后写入为准（可接受，学习数据非协作编辑）。

## 8. 登录门禁

- 全站内容/学习路由（CoursesPage / ChapterPage / SimulatorPage / QuizDeck / 笔记 / 收藏 / 错题）包 `RequireAuth`。
- 未登录访问 → 302 到 `/login`（或登录/注册同页）；登录后回跳原路由。
- Admin 路由已有鉴权，复用现有 `RequireAuth` 的 admin 分支。
- 移动端（≤768px）登录/注册页同样走 Token 体系，零重新登录（同 SPA 会话）。

## 9. 安全 checklist

- [ ] 密码 argon2id 哈希，盐随 hash 存储，明文不下库。
- [ ] 注册邮箱格式校验 + 限流（防爆破/垃圾注册）。
- [ ] 登录失败阶梯锁（5 次/1 分，10 次/15 分，复用 DO）。
- [ ] 会话 HMAC 常量时间比较（已有核心能力）。
- [ ] 所有 `user_id` 作用域端点服务端校验归属，防越权读他人数据。
- [ ] `sync/push` 校验变更 `user_id` == 会话 `user_id`。
- [ ] 错误码分区规范，不泄漏"邮箱是否存在"细节（注册 409 / 登录 401 统一模糊文案）。

## 10. 验收标准（EARS）

| 编号 | 功能 | EARS 格式验收标准 | 优先级 |
|------|------|-------------------|--------|
| AC-01 | 注册 | While 用户提交合法邮箱+密码，系统**必须**创建账号并建会话返回 201 | P0 |
| AC-02 | 注册 | If 邮箱已存在，系统**必须**返回 409（模糊文案，不泄存在性） | P0 |
| AC-03 | 登录 | While 用户凭正确凭据登录，系统**必须**建会话返回 200 | P0 |
| AC-04 | 登录 | If 连续 5 次失败，系统**必须**锁 1 分钟（阶梯锁） | P0 |
| AC-05 | 同步 | While 已登录用户 push 变更，系统**必须**按 LWW 合并并返回 200 | P0 |
| AC-06 | 同步 | While 已登录用户 pull(since)，系统**必须**返回该用户增量变更 | P0 |
| AC-07 | 门禁 | While 未登录访问内容路由，系统**必须**重定向到登录页 | P0 |
| AC-08 | 安全 | If 任意 sync 请求 `user_id` 不匹配会话，系统**必须**返回 403 | P0 |
| AC-09 | 接力 | When 登录同账号在另一设备打开接力 deep link，系统**必须**定位误差 ≤1 卡片 | P1 |

## 11. 端到端验证

```bash
# 1. 注册
curl -X POST localhost:8787/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"student@mes.dev","password":"Str0ng#Pass"}'   # 断言 201 + Set-Cookie 会话
# 2. 写进度（push）
curl -X POST localhost:8787/api/v1/sync/push -b cookie -H 'Content-Type: application/json' \
  -d '[{"entity":"progress","entity_id":"c12","field":"status","value":"done","updated_at":<now>}]'  # 200
# 3. 另一设备登录同账号 → pull
curl -X POST localhost:8787/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"student@mes.dev","password":"Str0ng#Pass"}' -c cookie2  # 200
curl -X GET 'localhost:8787/api/v1/sync/pull?since=0' -b cookie2  # 断言含 c12 done
# 4. 门禁
curl -X GET localhost:8787/api/v1/topics -c /dev/null -i  # 未登录 → 302 /login
```

## 12. 变更记录

| 日期 | 变更 | 原因 | 影响 |
|------|------|------|------|
| 2026-08-09 | 初版 v1，基于 OD-017 终态 + ADR-023 | 用户 18:30 反转启用账号云同步，拍板邮箱+密码+强制注册 | 全站 / 后端 / 数据模型 |
