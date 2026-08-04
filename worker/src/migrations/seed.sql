-- 自动生成：MES 实训平台种子数据（不含 certifications，MVP 明确不做）
-- 执行：wrangler d1 execute mes-learning --remote --file=./src/migrations/seed.sql
PRAGMA foreign_keys = ON;

-- topics
INSERT INTO topics (id, slug, title, description, modules, sort, status, prerequisites, difficulty, estimated_hours, created_at, updated_at) VALUES (1, 'work-order', '工单管理与生产执行', '【能力目标】学员能够在MES系统中独立完成工单创建、状态流转、现场数据核查与异常定位。
【受众】MES实施工程师、车间班组长、运维人员
【前置】SQL查询基础（课程6）
【评估】SQL实战题2道 + 模块考试12题
【课时】6小时（理论2h + SQL实操3h + 考试1h）', '["theory","sql","quiz"]', 1, 'published', '[6]', 'intermediate', 6, strftime('%s','now'), strftime('%s','now'));
INSERT INTO topics (id, slug, title, description, modules, sort, status, prerequisites, difficulty, estimated_hours, created_at, updated_at) VALUES (2, 'bom-material', 'BOM 与物料管理', '【能力目标】给定一张工单及其BOM结构，学员能计算物料需求量与损耗率，并解释齐套性检查结果。
【受众】MES实施工程师、物料计划员
【前置】工单管理与生产执行（课程1）
【评估】SQL实战题 + 数据分析练习
【课时】5小时（理论2h + SQL实操2h + 案例分析1h）', '["theory","sql","quiz"]', 2, 'published', '[1]', 'intermediate', 5, strftime('%s','now'), strftime('%s','now'));
INSERT INTO topics (id, slug, title, description, modules, sort, status, prerequisites, difficulty, estimated_hours, created_at, updated_at) VALUES (3, 'production-report', '报工与完工入库', '【能力目标】学员能根据生产记录还原产量、合格率、工时数据，并诊断"数量对不上"、"工单关不掉"两类现场问题。
【受众】MES实施工程师、质量工程师
【前置】工单管理与生产执行（课程1）
【评估】SQL实战题2道 + 场景诊断题
【课时】4小时（理论1.5h + SQL实操2h + 诊断0.5h）', '["theory","sql","quiz"]', 3, 'published', '[1]', 'intermediate', 4, strftime('%s','now'), strftime('%s','now'));

-- chapters
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (1, 1, '工单的生命周期与状态流转', 1, 'published', '# 工单的生命周期与状态流转

工单（Work Order，现场常简称 WO）是 MES 里最核心的业务单据。它把 ERP 里「计划要生产什么」这句话，落成车间里「谁、在哪台设备上、什么时候、生产多少」这件事。几乎所有现场问题的排查，最后都会回到某一张工单上。

## 工单从哪里来

典型的来源有三条：

1. **ERP 计划下发**：ERP 跑完 MRP 运算，生成生产计划，通过接口把工单推给 MES。这是大多数中大型工厂的主路径。
2. **MES 内部排产**：MES 自带排产模块，按设备产能和交期自动拆单。
3. **人工补单**：现场临时插单、返工单，由计划员在 MES 里手工新建。

实施时要特别留意第三条。人工补单往往没有 ERP 的单号规则约束，是后期对账对不上的高发区。

## 五个标准状态

工单状态机是 MES 的骨架，不同厂商叫法略有差异，但语义基本一致：

| 状态 | 含义 | 现场动作 |
|---|---|---|
| `created` | 已创建 | 计划员刚建单，尚未下发到车间 |
| `released` | 已下达 | 已下发到车间，可以领料、可以开工 |
| `running` | 生产中 | 已有第一次报工，工单进入在制状态 |
| `finished` | 已完工 | 产出数量达标，停止报工 |
| `closed` | 已关闭 | 完成结算与入库，财务口径锁定 |

## 状态流转的三条铁律

**第一，状态只能单向前进。** 不允许从 `running` 退回 `released`。现场要撤销，走的是「作废重开」而不是「状态回退」。这条规则保护了报工数据的一致性——如果允许回退，已经产生的报工记录会变成孤儿数据。

**第二，`finished` 与 `closed` 必须分开。** 很多新人会问：完工了直接关掉不就行了？不行。完工是**生产口径**，代表车间干完了；关闭是**财务口径**，代表成本已归集、库存已入账。两者之间往往隔着几天的对账期。把两个状态合并，是后期成本核算算不准的典型根因。

**第三，只有 `released` 之后才允许领料和报工。** 这是权限校验的关键卡点。如果发现现场能对一张 `created` 状态的工单报工，那一定是状态校验被绕过了，属于严重缺陷。

## 排查时先看什么

接到「这张工单不对」的报障，先查三个字段：`state`（当前状态）、`plan_qty`（计划数量）、`done_qty`（已完成数量）。这三者的组合能立刻暴露问题类型：

- `state = ''running''` 但 `done_qty = 0`：状态被误置，或报工接口失败
- `done_qty > plan_qty`：超产未管控，需检查报工时的数量校验
- `state = ''finished''` 但 `done_qty < plan_qty`：欠产完工，通常是人工强制完工，需要确认是否走了审批
', 1, strftime('%s','now'));
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (2, 1, '工单主表结构与高频查询', 2, 'published', '# 工单主表结构与高频查询

上一章讲了工单的状态语义，这一章落到表结构上。看懂字段，才能写出能定位问题的 SQL。

## 工单主表的最小字段集

不同 MES 产品的工单表宽度差异很大，少的十几列，多的上百列。但下面这组字段是必然存在的核心：

| 字段 | 类型 | 说明 |
|---|---|---|
| `wo_id` | INTEGER | 主键，系统内部标识 |
| `wo_no` | TEXT | 工单号，业务唯一，对外沟通用这个 |
| `product_id` | INTEGER | 产品外键，指向物料主数据 |
| `plan_qty` | INTEGER | 计划数量 |
| `done_qty` | INTEGER | 已完成数量，由报工累加 |
| `due_date` | TEXT | 交期 |
| `state` | TEXT | 状态，见上一章 |
| `workshop` | TEXT | 归属车间 |

注意 `wo_id` 和 `wo_no` 的区别。写 SQL 关联时用 `wo_id`，和车间、客户沟通时用 `wo_no`。新人常犯的错是拿 `wo_id` 去问车间主任，对方完全听不懂。

## 为什么 done_qty 是冗余字段

严格说，`done_qty` 可以从报工表实时汇总出来，存在主表里属于冗余设计。但几乎所有 MES 都会存这个字段，原因是**性能**：工单列表是使用频率最高的页面，如果每次都去关联汇总千万级的报工表，页面会慢到不可用。

代价是**数据可能不一致**。当报工写入成功、但主表回写失败时，`done_qty` 就会小于报工汇总值。这是运维阶段最常见的一类数据问题，排查方法是把两边对一遍：

```sql
SELECT w.wo_no, w.done_qty, SUM(r.qty_ok) AS real_qty
FROM work_orders w
JOIN production_reports r ON r.wo_id = w.wo_id
GROUP BY w.wo_no, w.done_qty
HAVING w.done_qty <> SUM(r.qty_ok);
```

查出来有行，就说明存在回写丢失。

## 三条现场高频查询

**查延期工单**。交期已过且尚未完工，这是计划员每天早会必看的：

```sql
SELECT wo_no, plan_qty, done_qty, due_date
FROM work_orders
WHERE due_date < ''2026-07-31''
  AND state NOT IN (''finished'', ''closed'')
ORDER BY due_date;
```

这里用 `NOT IN (''finished'',''closed'')` 而不是 `state = ''running''`，因为已下达但还没开工的单子同样会延期，不能漏。

**按车间统计在制负荷**。判断哪个车间压了太多活：

```sql
SELECT workshop, COUNT(*) AS wo_count, SUM(plan_qty) AS total_plan
FROM work_orders
WHERE state = ''running''
GROUP BY workshop
ORDER BY workshop;
```

**查超产工单**。已完成数超过计划数，通常意味着报工管控失效：

```sql
SELECT wo_no, plan_qty, done_qty
FROM work_orders
WHERE done_qty > plan_qty;
```

## 一个容易踩的坑

`due_date` 如果存成 TEXT，务必确认格式统一为 `YYYY-MM-DD`。一旦库里混进 `2026/7/5` 这种格式，字符串比较会给出完全错误的结果，而且不报错——这类问题最难发现。实施阶段就要在接口层把日期格式卡死。
', 1, strftime('%s','now'));
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (3, 2, 'BOM 结构与用量计算', 1, 'published', '# BOM 结构与用量计算

BOM（Bill of Materials，物料清单）回答一个问题：造一件成品，要消耗哪些东西、各消耗多少。工单告诉你「做什么」，BOM 告诉你「用什么做」。

## BOM 是一张自关联表

BOM 的本质是父子关系：一个父件由若干子件构成，而子件本身又可能有自己的 BOM。所以它通常设计成自关联结构：

| 字段 | 说明 |
|---|---|
| `bom_id` | 主键 |
| `parent_id` | 父件物料 id |
| `child_id` | 子件物料 id |
| `qty_per` | 单位用量，即造 1 个父件需要几个子件 |
| `loss_rate` | 损耗率，如 0.02 表示预计损耗 2% |

关键点：`parent_id` 和 `child_id` **都指向同一张物料主表**。成品、半成品、原材料在系统里都是「物料」，只是所处层级不同。理解这一点，才能看懂多层 BOM。

## 单层 BOM 与多层 BOM

**单层 BOM** 只看一级展开：查成品 A 直接由哪些件构成，不再往下钻。这是最常用的查询，一个 JOIN 就能完成：

```sql
SELECT c.product_code, c.name, b.qty_per
FROM bom b
JOIN products c ON c.product_id = b.child_id
WHERE b.parent_id = 1
ORDER BY c.product_code;
```

**多层 BOM** 要一直展开到最底层的原材料。SQLite 里用递归 CTE（`WITH RECURSIVE`）实现。多层展开的计算复杂度高，很多 MES 会做成夜间批量任务，把结果打平存进一张「BOM 展开表」，供白天快速查询。

## 损耗率必须参与计算

新人最容易漏掉的就是损耗率。实际需求量的公式是：

```
需求量 = 计划数量 × 单位用量 × (1 + 损耗率)
```

举个例子：工单计划生产 100 台，某个零件单位用量 2 个，损耗率 5%，那么实际需要备料 `100 × 2 × 1.05 = 210` 个，而不是 200 个。

如果备料按 200 算，产线做到最后必然缺料停线。这类停线事故在 MES 上线初期非常常见，根因往往就是需求计算漏了损耗率。

## 生效日期：BOM 是有版本的

真实的 BOM 表通常还有 `effective_date` 和 `expire_date` 两个字段。产品改版时，旧 BOM 失效、新 BOM 生效，但历史工单必须仍按当时的 BOM 结算。

这意味着查 BOM 时几乎总要带上日期条件：

```sql
WHERE b.parent_id = ?
  AND b.effective_date <= ?
  AND (b.expire_date IS NULL OR b.expire_date > ?)
```

漏掉这个条件，会一次性查出同一个子件的多个版本，导致用量翻倍。这是 BOM 相关问题里排查难度最高的一类，因为它只在改版之后才暴露。
', 1, strftime('%s','now'));
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (4, 2, '物料需求与齐套检查', 2, 'published', '# 物料需求与齐套检查

上一章算出了「要用多少料」，这一章解决「料够不够」。齐套检查是工单能否下达的前置条件，也是运维阶段被问得最多的功能。

## 什么叫齐套

齐套（Kitting）指一张工单所需的全部物料都已备齐。只要有一项缺料，整张工单就是不齐套的——因为缺任何一个零件，产线都装不出成品。

所以齐套判断的逻辑是「**一票否决**」：

```
齐套 = 所有子件都满足 (可用库存 >= 需求量)
```

用 SQL 表达时，通常反过来写：只要能查出至少一条缺料记录，这张工单就不齐套。这比正向判断简单得多。

## 可用库存不等于账面库存

这是实施阶段必须和客户对齐的概念。账面上有 1000 个，不代表你能用 1000 个：

| 口径 | 含义 |
|---|---|
| 账面库存 | 仓库系统里的总数 |
| 已分配量 | 已被其他工单预占，但还没实际领走 |
| 在检量 | 到货了但质检未放行，不可使用 |
| **可用库存** | 账面库存 − 已分配量 − 在检量 |

齐套检查必须用**可用库存**。如果用账面库存，会出现「系统说齐套、现场领不到料」的情况。这是 MES 上线后车间最容易失去信任的场景之一，务必在需求阶段就确认清楚。

## 缺料清单怎么查

把 BOM 需求和库存对齐，用 LEFT JOIN 保证「库存表里根本没有这个料」的情况也能被查出来：

```sql
SELECT c.product_code,
       ROUND(w.plan_qty * b.qty_per * (1 + b.loss_rate), 2) AS need_qty,
       COALESCE(s.available_qty, 0) AS avail_qty
FROM work_orders w
JOIN bom b ON b.parent_id = w.product_id
JOIN products c ON c.product_id = b.child_id
LEFT JOIN stock s ON s.product_id = b.child_id
WHERE w.wo_id = 1
  AND COALESCE(s.available_qty, 0) < w.plan_qty * b.qty_per * (1 + b.loss_rate);
```

两个细节值得注意。第一，必须用 `LEFT JOIN` 而不是 `JOIN`——新导入的物料可能压根没有库存记录，用内连接会把这种最严重的缺料直接漏掉。第二，`COALESCE(s.available_qty, 0)` 把 NULL 转成 0，否则 NULL 参与比较的结果永远是「未知」，条件不成立，同样会漏。

**NULL 导致的漏查，是 SQL 排障里最隐蔽的一类错误**，因为它不报错、结果看起来也正常，只是少了几行。

## 齐套率怎么统计

管理层通常关心的不是单张工单，而是整体齐套率：

```
齐套率 = 齐套工单数 / 应齐套工单总数 × 100%
```

统计时要限定范围，一般取「未来 7 天内计划开工」的工单。把已完工的历史单子算进去，指标会被稀释得毫无意义。
', 1, strftime('%s','now'));
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (5, 3, '报工数据模型与合格率', 1, 'published', '# 报工数据模型与合格率

报工（Production Report）是车间向系统汇报「我做了多少」的动作。它是 MES 里数据量最大的表，也是产量、合格率、工时这些核心指标的唯一数据来源。

## 报工表的字段设计

| 字段 | 说明 |
|---|---|
| `report_id` | 主键 |
| `wo_id` | 所属工单 |
| `operator` | 报工人 |
| `qty_ok` | 合格数量 |
| `qty_ng` | 不良数量 |
| `report_time` | 报工时间 |

最关键的设计决策是：**合格数与不良数分两列存，而不是存一个总数加一个合格率**。

原因有两个。一是精度，合格率是算出来的，存百分比会丢失原始数据，事后无法还原。二是可加性，两个批次的合格率不能直接平均，但合格数和不良数可以直接相加。存明细数量，任何维度的汇总都能算；只存比率，什么都算不准。

## 报工是流水，不是状态

一张工单会有多条报工记录。早班报一次，中班报一次，返工再补一次。所以报工表是**只增不改的流水表**。

发现报错了怎么办？不是去 UPDATE 原记录，而是**追加一条负数冲销记录**，再录入正确的。这样做的好处是保留完整审计轨迹——什么时候错的、谁改的、改成了什么，全部有据可查。直接改原记录，等于销毁证据，质量追溯时会彻底断链。

实施时如果发现客户要求「报工可以直接修改」，一定要把追溯风险讲清楚。

## 合格率怎么算

```
合格率 = 合格数 / (合格数 + 不良数) × 100%
```

写成 SQL：

```sql
SELECT w.wo_no,
       SUM(r.qty_ok) AS ok_qty,
       SUM(r.qty_ng) AS ng_qty,
       ROUND(SUM(r.qty_ok) * 100.0 / SUM(r.qty_ok + r.qty_ng), 2) AS ok_rate
FROM work_orders w
JOIN production_reports r ON r.wo_id = w.wo_id
GROUP BY w.wo_no
ORDER BY w.wo_no;
```

这里有两个必须注意的写法。

**第一，乘 100.0 而不是 100。** 整数除整数在多数数据库里会做整数除法，`8 / 10` 会得到 0 而不是 0.8。乘一个带小数的 100.0 可以强制转成浮点运算。这是新人写统计 SQL 最常见的错误。

**第二，分母可能为零。** 如果某工单只有一条 `qty_ok = 0` 且 `qty_ng = 0` 的记录，会触发除零。生产环境的写法应该加保护：

```sql
CASE WHEN SUM(r.qty_ok + r.qty_ng) = 0 THEN NULL
     ELSE ROUND(SUM(r.qty_ok) * 100.0 / SUM(r.qty_ok + r.qty_ng), 2)
END
```

## 用 HAVING 筛出问题工单

找出不良率超标的工单，条件作用在聚合结果上，必须用 `HAVING` 而不是 `WHERE`：

```sql
SELECT w.wo_no,
       ROUND(SUM(r.qty_ng) * 100.0 / SUM(r.qty_ok + r.qty_ng), 2) AS ng_rate
FROM work_orders w
JOIN production_reports r ON r.wo_id = w.wo_id
GROUP BY w.wo_no
HAVING SUM(r.qty_ng) * 100.0 / SUM(r.qty_ok + r.qty_ng) > 5
ORDER BY ng_rate DESC;
```

记住这条规则：**WHERE 过滤行，HAVING 过滤组**。写反了会直接报错。
', 1, strftime('%s','now'));
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (6, 3, '完工入库与工单关闭', 2, 'published', '# 完工入库与工单关闭

报工记录了「做了多少」，完工入库解决「东西去哪了」，工单关闭则给整张单子画上句号。这一段流程横跨生产、仓储、财务三个部门，是 MES 集成问题最集中的地方。

## 完工入库的三个动作

一次完工入库，系统内部实际发生了三件事：

1. **生成入库单**：把合格品从「在制品」转为「成品库存」
2. **回写工单完成数**：更新 `work_orders.done_qty`
3. **推送 ERP**：同步库存变动，供财务做成本归集

这三步必须保证一致性。如果第 1 步成功、第 3 步失败，就会出现 MES 有库存、ERP 没有的经典对账差异。所以接口设计上通常会引入**重试 + 幂等**机制：每次推送带唯一业务号，ERP 侧按业务号去重，失败可以安全重发。

幂等这个点务必在实施阶段确认。如果 ERP 侧不做去重，一次网络超时导致的重发，就会造成库存翻倍。

## 关闭前的三道校验

工单能否关闭，通常要过三关：

| 校验 | 说明 | 不通过怎么办 |
|---|---|---|
| 数量校验 | 入库数是否达到计划数 | 欠产需走审批强制完工 |
| 领料校验 | 是否有已领未退的余料 | 走退料流程或计入损耗 |
| 质检校验 | 是否有未判定的待检批次 | 等质检放行 |

第二关最容易被忽略。多领的料如果不退回、也不计入成本，会同时造成两个后果：库存账实不符，以及该工单的成本被低估。运维阶段发现「成本算不准」，很大概率要从这里查起。

## 数量对不上时怎么排查

这是运维阶段的高频报障。按下面的顺序逐层往下走，基本能定位：

**第一步，比对主表与流水。** 主表 `done_qty` 和报工汇总是否一致：

```sql
SELECT w.wo_no, w.done_qty, SUM(r.qty_ok) AS report_qty
FROM work_orders w
JOIN production_reports r ON r.wo_id = w.wo_id
GROUP BY w.wo_no, w.done_qty
HAVING w.done_qty <> SUM(r.qty_ok);
```

不一致，说明回写环节丢数据。

**第二步，比对报工与入库。** 报工合格数和实际入库数是否一致。不一致，说明入库单生成失败，或者中间有质检拦截。

**第三步，比对入库与 ERP。** 两边库存是否一致。不一致，说明接口推送失败或重复。

三步走下来，问题一定落在某一层的边界上。**排查的关键是分段比对，而不是一上来就猜**。

## 反关闭要谨慎

工单关闭后如果发现错了，能不能反关闭？技术上可以，但要极其谨慎。因为关闭动作往往已经触发了财务凭证，反关闭意味着要冲销凭证。

实务上的通行做法是：**当月可反关闭，跨月一律不允许**，只能通过新建调整单来修正。这条规则要在需求阶段就和财务确认，写进方案里，避免上线后扯皮。
', 1, strftime('%s','now'));

-- questions
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (1, 'single', '工单状态从 released 变为 running 的触发条件是什么？', '["计划员点击下达按钮","车间产生第一次报工","仓库完成物料发放","质检部门放行首件"]', '1', 'released 表示已下达到车间，running 表示工单已进入在制状态。触发点是车间产生第一次报工，说明实际生产已经开始。下达动作对应的是 created 到 released 的流转。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (1, 'judge', '工单已完工（finished）后即可直接视为已关闭（closed），两个状态可以合并处理。', '["正确","错误"]', '1', '错误。finished 是生产口径，表示车间已完成生产；closed 是财务口径，表示成本已归集、库存已入账，两者之间通常隔着对账期。合并这两个状态是后期成本核算算不准的典型根因。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (2, 'single', '查询延期未完工的工单时，状态条件写成 state = ''running'' 会导致什么问题？', '["会把已完工工单误算为延期","会漏掉已下达但尚未开工的延期工单","会导致查询无法使用索引","不会有任何问题，写法正确"]', '1', '已下达（released）但还没开工的工单同样会延期。只查 running 会把这批单子漏掉。正确写法是 state NOT IN (''finished'',''closed'')，把所有未终结状态都覆盖进来。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (2, 'multi', '工单主表中冗余存储 done_qty 字段，可能带来哪些影响？（多选）', '["提升工单列表页的查询性能","报工回写失败时会与报工流水不一致","使工单表无法建立主键","需要额外的对账机制来发现数据偏差"]', '0,1,3', '冗余 done_qty 的目的是避免每次都关联汇总海量报工表，确实能提升列表页性能；代价是回写失败时会与流水不一致，因此需要定期对账发现偏差。冗余字段与能否建立主键没有任何关系。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (3, 'single', '工单计划生产 100 台，某零件单位用量为 2，损耗率为 5%，实际需求量应为多少？', '["200","205","210","300"]', '2', '需求量 = 计划数量 × 单位用量 × (1 + 损耗率) = 100 × 2 × 1.05 = 210。漏算损耗率按 200 备料，产线做到最后会缺料停线，这是 MES 上线初期的常见事故。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (3, 'judge', 'BOM 表中的 parent_id 和 child_id 指向同一张物料主表。', '["正确","错误"]', '0', '正确。成品、半成品、原材料在系统中都是「物料」，只是所处层级不同，因此 BOM 是一张自关联表，父件与子件都指向物料主表。理解这一点才能看懂多层 BOM 展开。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (4, 'single', '齐套检查时使用账面库存而非可用库存，最可能导致什么后果？', '["查询速度明显变慢","系统判定齐套但现场领不到料","工单无法正常下达","BOM 层级展开出错"]', '1', '账面库存中包含已被其他工单预占的已分配量和质检未放行的在检量，这两部分实际不可使用。用账面库存判断会高估可用量，出现系统说齐套、现场领不到料的情况。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (4, 'single', '缺料查询中，为什么必须用 LEFT JOIN 关联库存表而不能用 JOIN？', '["LEFT JOIN 的执行效率更高","JOIN 会导致结果集出现重复行","库存表中不存在记录的物料属于最严重缺料，用 JOIN 会被漏掉","JOIN 不支持与 COALESCE 函数配合使用"]', '2', '新导入的物料可能在库存表中完全没有记录，这恰恰是最严重的缺料情况。内连接会直接丢弃这些行，导致最该被发现的问题反而查不出来。同理还需用 COALESCE 把 NULL 转为 0。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (5, 'single', '报工表为什么要分别存储 qty_ok 和 qty_ng，而不是存总数加合格率？', '["为了减少表的存储空间","因为数量可以跨批次相加，而比率不能直接平均","因为数据库不支持存储小数类型","为了让报工界面显示更方便"]', '1', '合格数与不良数具有可加性，任意维度的汇总都能重新计算；而两个批次的合格率不能直接平均。只存比率会丢失原始数据，事后无法还原，任何统计口径都算不准。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (5, 'single', 'SQL 中计算合格率写成 SUM(qty_ok) * 100 / SUM(qty_ok + qty_ng)，可能出现什么问题？', '["整数除法会截断小数，结果严重失真","会因为语法错误而无法执行","聚合函数不能出现在除法运算中","必须改用 HAVING 子句才能计算"]', '0', '整数除以整数会执行整数除法，小数部分被直接截断。应写成乘以 100.0 强制转为浮点运算。此外生产环境还需用 CASE WHEN 处理分母为零的情况。', 2, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (6, 'single', '报工数据录入错误后，正确的处理方式是什么？', '["直接 UPDATE 原报工记录为正确值","删除错误记录后重新录入","追加一条负数冲销记录，再录入正确数据","联系数据库管理员手工修改"]', '2', '报工表是只增不改的流水表。追加负数冲销记录可以保留完整审计轨迹，满足质量追溯要求。直接修改或删除会销毁证据，导致追溯链断裂。', 1, strftime('%s','now'));
INSERT INTO questions (chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES (6, 'multi', '工单完工入库后与 ERP 库存对不上，排查时应依次比对哪些环节？（多选）', '["工单主表 done_qty 与报工流水汇总","报工合格数与实际入库数","入库数与 ERP 接收数","工单号与产品编码的命名规则"]', '0,1,2', '数量类问题应分段比对，逐层定位边界：先看主表与流水是否一致（回写是否丢数据），再看报工与入库（入库单是否生成失败或被质检拦截），最后看入库与 ERP（接口是否推送失败或重复）。命名规则与数量差异无关。', 2, strftime('%s','now'));

-- sql_exercises
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (1, '查出所有延期未完工的工单', '车间早会需要一份延期工单清单。请查出交期早于 2026-08-15、且尚未完工（state 不是 ''finished''）的全部工单，返回工单号（wo_no）、计划数量（qty_plan）、已完成数量（qty_done）、交期（due_date）四列，按交期升序排列。注意：已下达（released）但尚未开工的工单同样会延期，不能用 state = ''running'' 过滤，否则会漏单。', '{"buildSql":"CREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),(2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),(3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),(4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),(5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),(6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');"}', 'SELECT wo_no, qty_plan, qty_done, due_date FROM work_orders WHERE due_date < ''2026-08-15'' AND state NOT IN (''finished'') ORDER BY due_date;', '8faa48044d169731dcca1241e2e20fa97dbb9bb7f082967d57693905e40430c4', 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
-- state 取值：created / released / running / finished / closed', 1, strftime('%s','now'));
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (1, '按车间统计在制工单负荷', '生产经理想知道各车间目前压了多少活。请统计每个车间处于生产中（running）状态的工单数量与计划总量，返回车间名称（workshop）、工单数（列名 wo_count）、计划总量（列名 total_plan）三列，按车间名称升序排列。', '{"buildSql":"CREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),(2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),(3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),(4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),(5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),(6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');"}', 'SELECT workshop, COUNT(*) AS wo_count, SUM(qty_plan) AS total_plan FROM work_orders WHERE state = ''running'' GROUP BY workshop ORDER BY workshop;', '1a2401e5644e820fc7ea9cc755137ce561b74b1c17ecaa328f2ba54614c1e9ac', 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
-- state 取值：created / released / running / finished / closed', 2, strftime('%s','now'));
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (2, '查询成品的一级用料清单', '工艺员需要核对减速机（product_id = 1）的用料。请查出该成品的一级 BOM 展开结果，返回子件物料编码（materials.code）、子件名称（materials.name）、单位用量（qty_per）三列，按物料编码升序排列。注意：本数据集 BOM 是「成品→物料」单层结构，bom.material_id 关联 materials.material_id，不是自关联。', '{"buildSql":"CREATE TABLE products (product_id INTEGER PRIMARY KEY, code TEXT, name TEXT, spec TEXT, unit TEXT);\nINSERT INTO products VALUES (1,''P-1001'',''减速机'',''XJ-200'',''台''),(2,''P-1002'',''伺服电机'',''SM-80'',''台''),(3,''P-1003'',''PLC控制器'',''FX-3U'',''个''),(4,''P-1004'',''变频器'',''VF-15K'',''台'');\nCREATE TABLE materials (material_id INTEGER PRIMARY KEY, code TEXT, name TEXT, unit TEXT, stock_qty INTEGER);\nINSERT INTO materials VALUES (1,''M-2001'',''铸铁箱体'',''件'',320),(2,''M-2002'',''轴承'',''套'',1480),(3,''M-2003'',''定子组件'',''件'',210),(4,''M-2004'',''控制主板'',''块'',96),(5,''M-2005'',''接线端子'',''个'',5400);\nCREATE TABLE bom (bom_id INTEGER PRIMARY KEY, product_id INTEGER, material_id INTEGER, qty_per INTEGER, loss_rate REAL);\nINSERT INTO bom VALUES (1,1,1,1,0.02),(2,1,2,4,0.01),(3,2,3,1,0.03),(4,2,2,2,0.01),(5,3,4,1,0.02),(6,3,5,12,0.05),(7,4,4,1,0.02),(8,4,5,8,0.04);"}', 'SELECT m.code, m.name, b.qty_per FROM bom b JOIN materials m ON m.material_id = b.material_id WHERE b.product_id = 1 ORDER BY m.code;', 'b3322dcc44d96ab3813ed576cd8fccdcef062f66d918ac2e12b6769d5ce1b250', 'products(product_id, code, name, spec, unit)
materials(material_id, code, name, unit, stock_qty)
bom(bom_id, product_id, material_id, qty_per, loss_rate)', 1, strftime('%s','now'));
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (2, '计算工单的物料需求量（含损耗）', '计划员要为工单 WO-20260801-01（wo_id = 1）备料。请计算该工单每个一级子件的实际需求量，公式为「计划数量 × 单位用量 × (1 + 损耗率)」，结果保留两位小数。返回子件物料编码（materials.code）与需求量（列名 need_qty）两列，按物料编码升序排列。切勿漏算损耗率。', '{"buildSql":"CREATE TABLE products (product_id INTEGER PRIMARY KEY, code TEXT, name TEXT, spec TEXT, unit TEXT);\nINSERT INTO products VALUES (1,''P-1001'',''减速机'',''XJ-200'',''台''),(2,''P-1002'',''伺服电机'',''SM-80'',''台''),(3,''P-1003'',''PLC控制器'',''FX-3U'',''个''),(4,''P-1004'',''变频器'',''VF-15K'',''台'');\nCREATE TABLE materials (material_id INTEGER PRIMARY KEY, code TEXT, name TEXT, unit TEXT, stock_qty INTEGER);\nINSERT INTO materials VALUES (1,''M-2001'',''铸铁箱体'',''件'',320),(2,''M-2002'',''轴承'',''套'',1480),(3,''M-2003'',''定子组件'',''件'',210),(4,''M-2004'',''控制主板'',''块'',96),(5,''M-2005'',''接线端子'',''个'',5400);\nCREATE TABLE bom (bom_id INTEGER PRIMARY KEY, product_id INTEGER, material_id INTEGER, qty_per INTEGER, loss_rate REAL);\nINSERT INTO bom VALUES (1,1,1,1,0.02),(2,1,2,4,0.01),(3,2,3,1,0.03),(4,2,2,2,0.01),(5,3,4,1,0.02),(6,3,5,12,0.05),(7,4,4,1,0.02),(8,4,5,8,0.04);\nCREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),(2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),(3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),(4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),(5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),(6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');"}', 'SELECT m.code, ROUND(w.qty_plan * b.qty_per * (1 + b.loss_rate), 2) AS need_qty FROM work_orders w JOIN bom b ON b.product_id = w.product_id JOIN materials m ON m.material_id = b.material_id WHERE w.wo_id = 1 ORDER BY m.code;', 'd49254ffe607f6ed90675a8edaa7b97c9e0f22ebe7a594b3609344c6ec4434c8', 'products(product_id, code, name, spec, unit)
materials(material_id, code, name, unit, stock_qty)
work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
bom(bom_id, product_id, material_id, qty_per, loss_rate)
-- 提示：用 ROUND(表达式, 2) 保留两位小数', 2, strftime('%s','now'));
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (3, '统计各工单的报工合格率', '质量部需要一份工单合格率报表。请按工单汇总报工数据，返回工单号（wo_no）、合格总数（列名 ok_qty）、不良总数（列名 ng_qty）、合格率百分比（列名 ok_rate，保留两位小数）四列，按工单号升序排列。注意整数除法陷阱，合格率需为小数形式的百分比（乘 100.0）。', '{"buildSql":"CREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),(2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),(3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),(4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),(5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),(6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\nCREATE TABLE production_records (rec_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_ok INTEGER, qty_ng INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES (1,1,1,''陆明辉'',40,2,''2026-08-04 09:20:00''),(2,1,4,''陆明辉'',35,0,''2026-08-04 15:40:00''),(3,2,3,''甘若彤'',25,3,''2026-08-05 10:05:00''),(4,2,3,''甘若彤'',20,1,''2026-08-05 16:30:00''),(5,4,1,''邱敬川'',70,5,''2026-08-06 08:50:00''),(6,4,4,''邱敬川'',45,0,''2026-08-06 14:10:00''),(7,5,4,''陆明辉'',80,1,''2026-08-07 11:25:00''),(8,3,1,''甘若彤'',60,4,''2026-08-07 17:05:00'');"}', 'SELECT w.wo_no, SUM(r.qty_ok) AS ok_qty, SUM(r.qty_ng) AS ng_qty, ROUND(SUM(r.qty_ok) * 100.0 / SUM(r.qty_ok + r.qty_ng), 2) AS ok_rate FROM work_orders w JOIN production_records r ON r.wo_id = w.wo_id GROUP BY w.wo_no ORDER BY w.wo_no;', '898f101d1a6fe7faeb25aba168bc74589b97ea9e2f19194c373df2317064051f', 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)
-- 合格率 = 合格数 / (合格数 + 不良数) × 100，注意用 100.0 避免整数除法', 1, strftime('%s','now'));
INSERT INTO sql_exercises (topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (3, '筛出不良率超标的工单', '质量部设定不良率红线为 5%。请找出不良率严格大于 5% 的工单，返回工单号（wo_no）与不良率百分比（列名 ng_rate，保留两位小数）两列，按不良率从高到低排列。提示：过滤条件作用在聚合结果上，必须用 HAVING 而非 WHERE。', '{"buildSql":"CREATE TABLE work_orders (wo_id INTEGER PRIMARY KEY, wo_no TEXT, product_id INTEGER, qty_plan INTEGER, qty_done INTEGER, due_date TEXT, state TEXT, workshop TEXT);\nINSERT INTO work_orders VALUES (1,''WO-20260801-01'',1,120,0,''2026-08-10'',''released'',''一号车间''),(2,''WO-20260801-02'',2,60,40,''2026-08-12'',''running'',''二号车间''),(3,''WO-20260802-01'',1,200,0,''2026-08-15'',''released'',''一号车间''),(4,''WO-20260802-02'',3,150,90,''2026-08-09'',''running'',''三号车间''),(5,''WO-20260803-01'',4,80,80,''2026-08-20'',''finished'',''一号车间''),(6,''WO-20260803-02'',2,40,0,''2026-08-18'',''released'',''二号车间'');\nCREATE TABLE production_records (rec_id INTEGER PRIMARY KEY, wo_id INTEGER, equip_id INTEGER, operator TEXT, qty_ok INTEGER, qty_ng INTEGER, report_time TEXT);\nINSERT INTO production_records VALUES (1,1,1,''陆明辉'',40,2,''2026-08-04 09:20:00''),(2,1,4,''陆明辉'',35,0,''2026-08-04 15:40:00''),(3,2,3,''甘若彤'',25,3,''2026-08-05 10:05:00''),(4,2,3,''甘若彤'',20,1,''2026-08-05 16:30:00''),(5,4,1,''邱敬川'',70,5,''2026-08-06 08:50:00''),(6,4,4,''邱敬川'',45,0,''2026-08-06 14:10:00''),(7,5,4,''陆明辉'',80,1,''2026-08-07 11:25:00''),(8,3,1,''甘若彤'',60,4,''2026-08-07 17:05:00'');"}', 'SELECT w.wo_no, ROUND(SUM(r.qty_ng) * 100.0 / SUM(r.qty_ok + r.qty_ng), 2) AS ng_rate FROM work_orders w JOIN production_records r ON r.wo_id = w.wo_id GROUP BY w.wo_no HAVING SUM(r.qty_ng) * 100.0 / SUM(r.qty_ok + r.qty_ng) > 5 ORDER BY ng_rate DESC;', '75e7cb7e808f69a162a9749d8794b2d9e76ec1f5f75d5a5442e515f3e8be46df', 'work_orders(wo_id, wo_no, product_id, qty_plan, qty_done, due_date, state, workshop)
production_records(rec_id, wo_id, equip_id, operator, qty_ok, qty_ng, report_time)
-- 不良率 = 不良数 / (合格数 + 不良数) × 100
-- 提示：WHERE 过滤行，HAVING 过滤组', 2, strftime('%s','now'));

-- learning_paths
INSERT INTO learning_paths (slug, title, description, topic_ids, stages, stage_unlock_type, sort, status, created_at) VALUES ('mes-implementation-newbie', 'MES 实施新人入门', '面向刚入职的 MES 实施工程师，按工单、物料、报工三大核心域依次推进，学完可独立看懂现场业务单据并完成基础数据核查。', '[6,4,1,2,3,5]', '[{"name":"阶段一 基础入门","courses":[6,4]},{"name":"阶段二 核心实战","courses":[1,2]},{"name":"阶段三 综合应用","courses":[3,5]}]', 'all_prev', 1, 'published', strftime('%s','now'));
INSERT INTO learning_paths (slug, title, description, topic_ids, stages, stage_unlock_type, sort, status, created_at) VALUES ('onsite-sql-troubleshoot', '现场 SQL 排查专项', '面向运维岗，聚焦数量对不上、合格率异常这类高频报障，训练用 SQL 分段比对定位问题边界（含 BOM 用料核对）的能力。', '[6,1,2,3]', '[{"name":"阶段一 SQL基础","courses":[6]},{"name":"阶段二 业务排查","courses":[1,2,3]}]', 'all_prev', 2, 'published', strftime('%s','now'));
INSERT INTO learning_paths (slug, title, description, topic_ids, stages, stage_unlock_type, sort, status, created_at) VALUES ('mes-erp-overview', 'MES+ERP 全景通识', '先建立 ERP 经营全局视角，再深入 MES 车间执行层，形成"上接计划、下接设备"的完整知识链。适合转行新人或跨部门协作人员。', '[4,5]', '[{"name":"阶段一 企业经营","courses":[4]},{"name":"阶段二 车间执行","courses":[5]}]', 'all_prev', 3, 'published', strftime('%s','now'));
INSERT INTO learning_paths (slug, title, description, topic_ids, stages, stage_unlock_type, sort, status, created_at) VALUES ('sql-practical', 'SQL 从基础到实战', '从零学 SQL 查询语法，用 MES 工单报工资数据练手，最后到综合实战场景。纯动手路径，每门课都带 SQL 练习。', '[6,1,3]', '[{"name":"阶段一 SQL语法","courses":[6]},{"name":"阶段二 MES实战","courses":[1,3]}]', 'all_prev', 4, 'published', strftime('%s','now'));
INSERT INTO learning_paths (slug, title, description, topic_ids, stages, stage_unlock_type, sort, status, created_at) VALUES ('smart-manufacturing', '智能制造基础', 'PLC 工业控制入门 → ERP 企业资源规划，从设备层到管理层打通智能制造认知链路。', '[7,4]', '[{"name":"阶段一 设备层","courses":[7]},{"name":"阶段二 管理层","courses":[4]}]', 'all_prev', 5, 'published', strftime('%s','now'));

