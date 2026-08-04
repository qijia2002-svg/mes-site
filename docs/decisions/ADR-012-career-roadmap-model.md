# ADR-012: 职业—能力—章节 三层图谱的数据模型

## Status

Accepted (2026-08-02) · 决策人：高见远 · 影响范围：D1 schema + 只读 API + 前端路线图页

> **编号说明**：总监指定的文件名为 `ADR-004-career-roadmap-model.md`，但仓库中
> `ADR-004-selfhost-fonts-variable.md` 已占用 004，且现有序列已排到 011。
> 为避免出现两个 ADR-004，本决策落为 **012**。如需改回请一并处理编号冲突。

## Background

平台已上线，栈锁定为 Cloudflare Workers + D1(SQLite) + wrangler + React/Vite，本次为增量需求。

要落地的是三层图谱：
**5 条岗位职业路径 → 若干成长阶段 → 阶段所需的「能力路线 × 等级」 → 具体章节**。
能力路线 8 条（ERP / MES / SQL / PLC / 嵌入式 / 工业网络 / Linux 运维 / 条码 RFID），每条分 L1/L2/L3。

已有资产与约束：

- `topics` / `chapters` 是现有内容主体，`chapters.id` 是章节的唯一标识。
- `learning_paths`（老学习路径表，`topic_ids` 存 JSON 数组）已上线，本次**保留不动**。
- `progress_events` 记录学习事件，`anon_id` 实际存登录会话 `sub`，`item_id` 为 TEXT。
- `DbSession` 有硬护栏：单请求 D1 语句数 > 40 直接抛 5002。
- D1 **永远强制外键**，`PRAGMA foreign_keys = off` 被静默忽略
  （https://developers.cloudflare.com/d1/sql-api/foreign-keys/）。

数据契约由 PM 以 `docs/seeds/career-roadmap-data.json` 给出，schema 必须无损承载。

## Decision

### D1. 新建 6 张表，不复用也不改造 `learning_paths`

`tracks` / `track_levels` / `track_level_chapters` / `career_paths` / `career_stages` / `career_stage_reqs`。

`learning_paths` 是「有序 topic 串联」的一维模型，语义上装不下「岗位—阶段—能力等级—章节」的四层关系；
改造它会破坏已上线的 `/api/v1/learning-paths`。新体系另起表，老表原样保留，
待前端全量切换后由产品决定下线时机。

### D2. 「阶段→能力等级」的需求关系建独立表，不塞 JSON

`career_stage_reqs` 就是路径图的**边**。图接口要按阶段取边、JOIN 出路线标题、逐边挂完成度，
还要支持反查「该能力等级被哪些岗位要求」。存 JSON 意味着每次画图都在 Worker 里手写 join，且无法索引。

### D3. `chapter_ids` 落成映射表 `track_level_chapters`，`planned_chapters` 留 JSON

这是对总监「5 张表」建议的**唯一一处偏离**。

- **映射表**：进度分母必须是「真实存在且 published 的章节数」。映射表 `INNER JOIN chapters` 一次算准；
  JSON 数组要么被脏 id 撑大分母，要么每次 `json_each` 全表扫。带 `sort` 列，数组顺序无损。
  额外收益：`idx_tlc_chapter` 支持反查章节归属，章节页面包屑迟早要用。
- **`planned_chapters` 留 JSON**：纯展示占位，无 id、无引用、不参与任何计算。建表只会多一张
  永远只读一次的空壳表。同理 `outcomes` / `daily_work` / `outputs` / `interview_points` / `deliverables`
  全部留 JSON——都是只整体读出直接渲染的字符串数组。

判据统一为一句话：**参与查询/JOIN/聚合的关系建表，只整体读出渲染的数组留 JSON。**

### D4. 外键分两类：子系统内强约束 CASCADE，跨出子系统软引用

- **强 FK + `ON DELETE CASCADE`**：`track_levels→tracks`、`track_level_chapters→track_levels`、
  `career_stages→career_paths`、`career_stage_reqs→career_stages`、`career_stage_reqs→track_levels`。
  同批插入、生命周期一致，删一条路线即整棵子树干净消失。
- **软引用（无 FK）**：`track_level_chapters.chapter_id → chapters(id)`。
  因为 D1 的强 FK 不可关闭，而 (a) seed 数据先于内容落库、引用未建章节是常态，硬 FK 会让整批 seed
  **原子失败**；(b) 后台 `import/content` 重建章节时硬 FK 会直接阻塞导入。
  完整性改由写入侧 `WHERE EXISTS` 过滤 + 读取侧 `INNER JOIN chapters` 保证——悬空 id 只是不显示。
- **不引入指向 `topics(id)` 的外键**：路线与主题是交叉多对多（一条路线的章节常横跨多个 topic），
  挂 topic 粒度会丢精度；需要时经 `chapters.topic_id` 反查。

### D5. 进度只读 `progress_events`，不建任何冗余进度表

某 level 完成度 = `已 done 的 published 章节数 / 该 level 的 published 章节总数`，
`planned_chapters` 不进分母。复用现有索引 `idx_progress_anon_item`，零新增索引。
未登录时不发进度查询，`done` 直接填 0。

不建 `user_track_progress` 之类的物化表：24 个 level 的规模下，一条 `GROUP BY` 就够，
物化表只会引入与事件表不同步的风险。

### D6. 路线图接口固定 ≤5 条 D1 语句，图接口只缓存骨架

`DbSession` 40 条上限意味着「按阶段循环查库」的 N+1 写法在内容扩充后必然触发 5002。
统一「一次取全集 + 内存分组」。

`/roadmap/graph` 响应含用户进度，**禁止整体缓存**（会串号）。骨架走
`cachedJson('cv{v}:roadmap/graph/{slug}')`，进度逐请求叠加且必须深拷贝骨架。

### D7. 图标沿用 ADR-002，`icon` 字段存语义名

`tracks.icon` / `career_paths.icon` 存 `Icon.tsx` REGISTRY 的语义名字符串
（`sql` / `plc` / `network` / `career-mes-impl` …），不存 emoji、组件名或 URL。
本期需给 REGISTRY 补 13 个语义键，对应 lucide 组件已在 `lucide-react@1.28.0` 中逐一实测存在。
**不引入第二套图标库。**

## Consequences

**正面**

- 图接口一次请求出全图，前端零串行请求；冷缓存 5 条语句、热缓存 2 条，离 40 上限很远。
- seed 可重复执行：`CREATE TABLE IF NOT EXISTS` + `UNIQUE(track_id, level)` / `UNIQUE(stage_id, level_id)`
  让重灌数据收敛而非报错；CASCADE 保证不留孤儿。
- 章节与路线解耦：内容侧继续用 `topics/chapters` 自由增删，不受路线图约束。
- `learning_paths` 零改动，已上线接口无回归风险。

**负面**

- 比总监建议多了 1 张表（`track_level_chapters`）。若不接受，回退为 JSON 数组的成本约 40 行 service 代码，
  代价是分母准确性要在应用层兜。
- `chapter_id` 软引用意味着数据库层不拦脏数据，必须靠 seed 后的一致性校验脚本兜底
  （校验 SQL 已附在 `migration-career-roadmap.sql` 文件末尾）。
- 路线图允许匿名访问，与站内其余只读接口 `guardAll` 强制登录的策略不一致，需产品拍板。
- 前端在 `Icon.tsx` 补齐 13 个语义键之前，路线/岗位图标会渲染不出来——这是 Phase 2 的前置依赖。

## Related ADRs

- ADR-002 锁定 lucide-react 为唯一图标库（本决策的 `icon` 字段直接受其约束）
- ADR-003 自托管 sql.js 与本地开发（本次 DDL 用 sql.js 做了离线执行验证）

## Verification

```bash
# 1. DDL 幂等 + 级联 + CHECK（已通过，用 sql.js 离线执行两遍）
wrangler d1 execute mes-learning --local --file=./docs/seeds/migration-career-roadmap.sql
wrangler d1 execute mes-learning --local --file=./docs/seeds/migration-career-roadmap.sql   # 二次执行不报错

# 2. 未动任何现有表
grep -niE "drop table|alter table|learning_paths" docs/seeds/migration-career-roadmap.sql   # 必须无匹配

# 3. 图标库唯一性 + 无 emoji（ADR-002 继承项）
grep -rn "react-icons\|@tabler/icons\|heroicons" web/src web/package.json                   # 必须无匹配
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src                                  # 必须无匹配

# 4. 灌数后：悬空章节引用应为空集
wrangler d1 execute mes-learning --local --command \
  "SELECT tlc.level_id, tlc.chapter_id FROM track_level_chapters tlc \
   LEFT JOIN chapters c ON c.id=tlc.chapter_id AND c.status='published' WHERE c.id IS NULL"
```
