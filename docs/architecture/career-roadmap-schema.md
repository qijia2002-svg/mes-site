# 职业—能力—章节 三层图谱 · 表结构设计

> 增量需求，栈不变（Cloudflare Workers + D1）。
> 配套：`docs/seeds/migration-career-roadmap.sql`、`docs/api/career-roadmap-api.md`、`docs/decisions/ADR-012-career-roadmap-model.md`

## 1. 边界

三层：**岗位职业路径 → 阶段需求 → 能力路线等级 → 章节**。8 条路线 × 3 级 = 24 个 level 节点；5 条岗位挂若干阶段，每阶段引用若干「路线×等级」。

`learning_paths` 老表**原样保留、不读不写不删**。新体系完全另起，待前端切完再由产品决定老表下线。

## 2. ER 关系

```
career_paths 1──n career_stages 1──n career_stage_reqs
                                            │ n
                                            │ (level_id, 强 FK)
                                            ▼ 1
tracks 1──n track_levels 1──n track_level_chapters ┈┈▷ chapters(id)
                 │                                    （软引用，无 FK）
                 └─ planned_chapters JSON（未建章节，不计入进度分母）
```

## 3. 表清单

| 表 | 职责 | 行数量级 |
|----|------|----------|
| `tracks` | 路线主体：slug/title/subtitle/kind/icon/summary/sort | 8 |
| `track_levels` | L1/L2/L3，含 goal/hours/outcomes(JSON)/planned_chapters(JSON) | 24 |
| `track_level_chapters` | level ↔ 已建章节的有序映射 | 数百 |
| `career_paths` | 岗位：tagline/salary/demand/overview/daily_work/outputs | 5 |
| `career_stages` | 阶段：stage/title/duration/goal/milestone/interview_points/deliverables | ~20 |
| `career_stage_reqs` | 阶段 → 路线等级的需求边：importance/note | ~60 |

## 4. 为什么这么拆

判据一句话：**参与查询/JOIN/聚合的关系建表，只整体读出渲染的数组留 JSON。**

1. **`career_stage_reqs` 必须独立成表**。它就是路径图的**边**：图接口要按 `stage_id` 取边、JOIN 出路线标题、逐边挂完成度。存 JSON 等于每次画图都在 Worker 里手写 join，且无法索引。
2. **`chapter_ids` 用映射表而非 JSON 数组**——这是对总监「5 张表」建议的**唯一一处偏离，请裁决**。进度分母必须是「真实存在且 published 的章节数」，映射表 `INNER JOIN chapters` 一次算准；JSON 数组要么被脏 id 撑大分母，要么每次 `json_each` 全表扫。带 `sort` 列，顺序无损。额外收益：可反查「本章节属于哪些能力等级」，章节页面包屑迟早要用。若坚持 5 张表，回退成本约 40 行 service 代码。
3. **`planned_chapters` 留 JSON**（按总监指定）。纯展示占位，无 id、无引用、不参与计算，建表只会多一张永远只读一次的空壳表。
4. **`outcomes`/`daily_work`/`outputs`/`interview_points`/`deliverables` 留 JSON**。同理，纯字符串数组，无按元素查询排序的场景。

## 5. 外键策略（D1 行为已核实）

D1 **永远强制外键**，等价于每个隐式事务都 `PRAGMA foreign_keys = on`；`PRAGMA foreign_keys = off` 会被**静默忽略**（不报错也不生效）。唯一逃生口是 `PRAGMA defer_foreign_keys = on`——只推迟到事务末尾校验，不是关闭。
来源：https://developers.cloudflare.com/d1/sql-api/foreign-keys/

**强约束（子系统内部，同批插入，可控）** — 全部 `ON DELETE CASCADE`：
`track_levels→tracks`、`track_level_chapters→track_levels`、`career_stages→career_paths`、`career_stage_reqs→career_stages`、`career_stage_reqs→track_levels`。
删一条路线/岗位即整棵子树干净消失，重跑 seed 不留孤儿。

**软引用（跨出子系统，不加 FK）** — `track_level_chapters.chapter_id`：

- PM 的 seed JSON 先于内容落库，引用尚不存在的章节 id 是常态；强 FK 会让**整批 seed 原子失败**。
- 后台 `POST /admin/import/content` 会重建章节，硬 FK 直接阻塞导入。
- 代价可控：写入侧 `INSERT ... SELECT ... WHERE EXISTS(chapters)` 过滤，读取侧一律 `INNER JOIN chapters`。悬空 id 只是**不显示**，不报错也不污染分母。

**不引入指向 `topics(id)` 的外键**：路线与主题是交叉多对多（一条路线的章节常横跨多个 topic），挂 topic 粒度会丢精度；需要时经 `chapters.topic_id` 反查。

## 6. 索引策略

| 索引 | 支撑查询 |
|------|----------|
| `tracks.slug` / `career_paths.slug` UNIQUE（隐式） | 按 slug 查详情 |
| `idx_tracks_sort` / `idx_careers_sort` | 列表页排序 |
| `idx_track_levels_track (track_id, level)` | 取某路线三级 |
| `idx_tlc_level (level_id, sort)` | 取某级章节清单（有序） |
| `idx_tlc_chapter (chapter_id)` | 反查章节归属 |
| `idx_career_stages_career (career_id, stage)` | 按岗位取阶段 |
| `idx_csr_stage (stage_id, sort)` | 按阶段取需求边 |
| `idx_csr_level (level_id)` | 反查该能力等级被哪些岗位要求 |

D1 单库单线程，本子系统总行数不过千，**不建任何复合冗余索引**，等真慢了再加。进度查询直接复用已有的 `idx_progress_anon_item`，零新增索引。

## 7. 进度计算

**口径**：某 level 完成度 = 该级「已学章节数 / published 章节总数」，`planned_chapters` **不进分母**。

- 分母：`track_level_chapters tlc INNER JOIN chapters c ON c.id = tlc.chapter_id AND c.status='published'`
- 分子：`progress_events` 中 `anon_id = <会话 sub>` AND `item_type='chapter'` AND `status='done'` AND `item_id = CAST(c.id AS TEXT)`
- 分母为 0 → `percent=0`、`state='planned'`，前端画空心环而非满环。

**两个必须注意的坑**：

1. `progress_events.anon_id` 是历史命名，实际存的是**登录会话 `c.auth.sub`**（见 `progress.repo.ts` 注释），不是匿名 UUID。
2. `item_id` 是 **TEXT**、`chapters.id` 是 **INTEGER**，比较必须显式 `CAST(c.id AS TEXT)`，否则 SQLite 类型亲和性给出静默错误结果。

**未登录**：`c.auth` 为空时跳过进度查询，`done` 一律 0、`percent` 0，`total` 照常返回。

## 8. 图标方案（P0，不可协商）

**本项目图标方案 = `lucide-react@1.28.0`，经 `web/src/components/Icon.tsx` 的 REGISTRY 语义名收口。**
已由 ADR-002 锁定；全仓实测只有 `Icon.tsx` 一处 `import ... from 'lucide-react'`，emoji 扫描为空，当前合规。

`tracks.icon` / `career_paths.icon` 存**语义名字符串**（如 `sql`/`plc`/`network`），**不存 emoji、不存组件名、不存 URL**。取值必须是 `IconName` 里已注册的键；缺图标就先在 REGISTRY 加一行，**绝不引入第二套图标库**。

本次需新增 13 个语义键（对应 lucide 组件均已在 1.28.0 中实测存在）：
`erp`→Building2 · `mes`→Factory · `plc`→Cpu · `embedded`→CircuitBoard · `network`→Network · `linux`→Terminal · `barcode`→ScanBarcode · `career-mes-impl`→HardHat · `career-erp-consultant`→Briefcase · `career-mes-dev`→CodeXml · `career-scada`→Activity · `career-digital-owner`→UserCog · `stage`→Target。
SQL 路线直接复用**已存在**的 `sql`→Database。

`importance`（core/important/optional）**不给图标**，用文字胶囊 + 颜色区分，避免图标通胀。配色禁用紫→粉渐变，沿用 `design-system` 既有 token。

## 9. 风险

| 风险 | 影响 | 处置 |
|------|------|------|
| seed 的 `chapter_ids` 引用不存在的章节 | 该章不显示 | 软引用兜底；seed 后跑一致性校验（SQL 见 migration 文件末尾） |
| `DbSession` 硬上限 40 语句/请求，超限抛 5002 | 图接口写成 N+1 直接 500 | 图接口固定 ≤5 条语句，严禁按阶段循环查库 |
| 路线图允许匿名，与其余只读接口 `guardAll` 强制登录不一致 | 策略割裂 | 见 API 文档 §0.2，需产品确认；改回强制登录前端无需改动 |
| `progress_events` 无 `deleted_at`，章节删除后旧事件残留 | 分子可能大于分母 | 分子走 `INNER JOIN chapters`，天然过滤 |
