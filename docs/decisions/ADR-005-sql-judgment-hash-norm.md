# ADR-005: SQL 判题哈希规范化规范 + sql.js 自托管提升为 P0

## Status: Accepted (2026-08-01)

## Background

P1-6 方案 B：前端用 sql.js 跑学员 SQL → 规范化结果集 → SHA-256 → 与 API 下发的 `answer_hash` 比对判"正确/错误"。
PM 交付 `docs/seed-content-v1.json`（机器可读内容，backend 机械转 INSERT）+ `docs/verify-seed-sql.mjs`（node:sqlite 实跑验证），并实跑确认 6 道 SQL 题建库/执行/结果确定一致，提出 3 个需架构拍板的点 + 2 个 backend 提醒 + 1 个部署风险。

## Decision

**D1 · `dataset_json` 形状**
采用 `{"buildSql": "<DDL+DML 单字符串>"}`，与 `schema.sql` 的 `sql_datasets.build_sql` 约定一致。
浏览器/后端建库均用 **`db.exec(buildSql)`**。
理由：`sql.js` 的 `db.run(sql, params)` **带 params 时不支持多语句**（多语句会被静默截断）；`db.exec` 原生支持多语句且返回结果集、语义明确。统一 `db.exec` 可消除「误给 `db.run` 传参导致建库不全」的误用面。
**重要勘误**：`db.run(sql)` **不带参时其实能跑多语句**（现有 `SqlSandbox.tsx` 即用 `db.run(SEED_SQL)` 建库且正常，PM 用 sql.js 1.13.0 实测佐证）。故结论不是「`db.run` 不能跑多语句」，而是「统一 `db.exec` 规避带参那条限制、且返回结果集更明确」——不要据此去"修"本就正常的 `SqlSandbox`。
`sql_exercises.dataset_json` 存该 JSON 字符串。

**D2 · 行序敏感（规范化不对行排序），列序也保留**
理由：`ORDER BY` 是受测能力点，6 道 prompt 已明文要求排序（如"按交期升序"）；若规范化对行排序，排序要求形同虚设，导致漏判（学员漏写 ORDER BY 也能过）。
规范化**仅做类型归约，不动行/列顺序**。预计后果：数据对但排序错的答案判错——这是预期的教学行为，prompt 已写明排序要求。前端可在判题返回中附"行序与标准不符"提示（增强项，非阻塞）。

**D3 · 浮点处理**
两侧均用 JS 原生 `number` 序列化（`JSON.stringify`），author 在 `answer_sql` 对小数列 `ROUND(x,2)` 收敛。已验证 `ROUND(102.0,2)` 在 JS 侧为 `number 102`，与整数字面量 `102` 的 JSON 序列化完全相同（`true`）——REAL/INTEGER 不会撕裂哈希。前提：前后端都用 JS 原生 number，不强制转字符串。

**D4 · 规范化产物与哈希**
取 `db.exec` 返回 `{ columns: string[], values: any[][] }`，**原样保留顺序**，计算：
`hash = SHA256( JSON.stringify({ c: columns, v: values }) )`（小写 hex）。
columns/values 的 JS 类型：INTEGER/REAL→number，TEXT→string，NULL→null。

**D5 · 引擎一致性（关键，反驳 PM 提醒 A）**
`answer_hash` **必须**由 **sql.js 1.13.0** 在 worker 端（部署前本地）预计算，与前端自托管后版本对齐。
**不得**用 node:sqlite，也**不得**抄 PM `verify-seed-sql.mjs` 算出的 hash——PM 脚本仅证明"SQL 跑得通、结果确定"，用的是 node:sqlite + 自猜规范化，非权威值。前端也是 sql.js，同引擎才保证语义一致。

**D6 · sql.js 安装点（勘误 PM 提醒 B）**
`web/package.json` 第 20 行**已有** `"sql.js": "1.13.0"`（SqlSandbox 当前走 CDN 未用此包）；**缺 sql.js 的是 `worker/`（backend）包**。哈希预计算需在 `worker/` 装 `sql.js@1.13.0`（设为 devDependency，仅构建/脚本期用，不进 worker 运行时产物）。

**D7 · 部署风险提升（反驳 PM 部署风险）**
P1-9（sql.js 依赖 cdnjs 境外 CDN）提升为 **P0 级发布阻塞**：核心差异化能力 + 目标用户为工厂内网（国内 cdnjs 可达性低）+ README「可离线」当前为假。
按 ADR-003 自托管：`sql-wasm.js` + `sql-wasm.wasm` 入 `worker/public/vendor/`，`SQL_JS_URL=/vendor/sql-wasm.js`，同源可缓存、文案成真。

## Consequences

- 正面：判题语义明确，ORDER BY 真考；前后端同引擎（sql.js 1.13.0）哈希一致；核心功能脱离境外 CDN。
- 负面：行序敏感会使"数据对但排序错"判错——预期教学行为，prompt 已覆盖。
- 负面：worker 引入 sql.js 仅用于本地算 hash（devDep），不进运行时。
- 需同步：前端 `SqlSandbox` 由 CDN 切到本地 `sql.js@1.13.0` + `/vendor/sql-wasm.*`（ADR-003 + D7）；README「可离线」在自托管落地后改为真。

## Related ADRs
- ADR-003（sql.js 自托管 + 解耦本地 dev）
- P1-6（判题方案 B：哈希比对）
- P1-9（cdnjs 依赖，本 ADR 提升为 P0）

## Errata / Amendments

- **2026-08-01 · D1 原理由勘误（PM 用 sql.js 1.13.0 实测证伪）**
  原 D1 写成「`db.run` 只执行首条语句，会导致后续 CREATE/INSERT 丢失」——**该断言为假**。`db.run(buildSql)` 不带参时多语句全部执行成功（PM 实测建出 products/work_orders 两表、work_orders 8 行；现有 `SqlSandbox.tsx` 即用 `db.run(SEED_SQL)` 多语句建库且正常）。
  **真实限制**：`sql.js` 的 `db.run(sql, params)` **带 params 时不支持多语句**。`db.exec` 原生支持多语句且返回结果集。
  **更正**：统一 `db.exec` 的理由改为「规避 `db.run` 带参时的多语句截断限制 + 返回结果集语义更明确」，结论（统一 `db.exec`）不变。请勿据此「修」本就正常的 `SqlSandbox`。
  PM 原则成立：权威 ADR 不应携带可证伪的技术断言，否则会诱导后人误改正常代码或过度规避 `db.run`。

- **2026-08-01 · 交叉引擎验证基线（供 backend 对照）**
  PM 用 sql.js 1.13.0（权威引擎）复跑 6 道 `answer_sql`，行数与 node:sqlite 完全一致：ex-wo-01:4 / ex-wo-02:3 / ex-bom-01:4 / ex-bom-02:4 / ex-report-01:3 / ex-report-02:2，无空结果集。记入 `seed-content-v1.json._meta.crossEngineVerified`。**不替代 D5 的权威哈希重算**，仅为 backend 落 hash 时的行数对照基准——行数对不上即说明建库或规范化有问题。
