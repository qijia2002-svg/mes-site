-- ============================================================
-- 节点种子：mrp（generic-factory）
-- 规格：1 章节 + 3 测验 + 1 SQL + 1 微练习（ADR-021 不写生活比喻）
-- 章节 9107 | 测验 9207,9227,9228 | SQL 9307 | 微练习 9404
-- 本文件幂等：重跑先 DELETE 自身 ID 再 INSERT，仅动本节点内容。
-- ============================================================
PRAGMA foreign_keys = OFF;

-- 重跑安全：只删本文件管理的 ID，不动其它节点资源
DELETE FROM chapters WHERE id = 9107;
DELETE FROM questions WHERE id IN (9207, 9227, 9228);
DELETE FROM sql_exercises WHERE id = 9307;
DELETE FROM micro_practices WHERE id = 9404;
DELETE FROM node_resources WHERE node_id = (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp') AND ref_id IN (9107, 9207, 9227, 9228, 9307, 9404) AND res_type IN ('chapter','quiz','sql','micro');

-- 章节 9107
INSERT INTO chapters (id, topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (
  9107, 9001, 'MRP 运算：毛需求怎么变成净需求', 7, 'published', '# MRP 运算：毛需求怎么变成净需求

## MRP 在工厂里的位置

MRP（Material Requirements Planning）处于**计划层**，它的输入是已评审的销售订单，输出是各物料的净需求量——这个输出会直接流入采购节点，成为采购申请的依据。

## MRP 三步走

第一步：筛订单（review_status = ''approved''）→ 第二步：BOM展开 → 第三步：减库存

## 数据怎么走

以本系统 dataset 为例，今天是 **2026-08-08**，计划员要跑一轮 MRP：

**按产品汇总（只算 approved 订单）：**
- 减速机：100 + 120 + 70 = **290 台**
- 伺服电机：60 + 40 + 100 = **200 台**
- PLC 控制器：**80 台**
- 变频器：50 + 30 = **80 台**

**BOM 展开成毛需求（含损耗）：**

| 产品 | 物料 | 计算过程 | 毛需求 |
|---|---|---|---|
| 减速机 290 台 | 铸铁箱体 | 290 × 1 × 1.02 | **296 件** |
| 减速机 290 台 | 轴承 | 290 × 4 × 1.01 | **1172 套** |
| 伺服电机 200 台 | 定子组件 | 200 × 1 × 1.03 | **206 件** |
| 伺服电机 200 台 | 轴承 | 200 × 2 × 1.01 | **404 套** |
| PLC 控制器 80 台 | 控制主板 | 80 × 1 × 1.02 | **82 块** |
| PLC 控制器 80 台 | 接线端子 | 80 × 12 × 1.05 | **1008 个** |
| 变频器 80 台 | 控制主板 | 80 × 1 × 1.02 | **82 块** |
| 变频器 80 台 | 接线端子 | 80 × 8 × 1.04 | **666 个** |

**净需求（减库存）：**

| 物料 | 毛需求 | 库存 | 净需求 | 说明 |
|---|---|---|---|---|
| 铸铁箱体 | 296 件 | 320 件 | **-24** | 过剩，可不动 |
| 轴承（减速机 1172 + 伺服电机 404） | 1576 套 | 1480 套 | **+96** | ⚠️ 库存不足，还缺 96 套 |
| 定子组件 | 206 件 | 210 件 | **-4** | 略过剩 |
| 控制主板 | 82+82=164 块 | 96 块 | **+68** | ⚠️ 库存不足，还缺 68 块 |
| 接线端子 | 1008+666=1674 个 | 5400 个 | **-3726** | 过剩 |

> **注意**：共用料要先跨产品汇总再减库存。轴承单看减速机是 1172 套、库存 1480 套，像是够的；
> 把伺服电机的 404 套加进来才是 1576 套，实际缺 96 套。分产品各减一次库存，缺口就被算没了。

> **注意**：定子组件虽然在途（PO-3、PO-7 预期到货），但 MRP 只算现货库存，在途不计入。
> 所以这一轮真正要补货的是轴承（+96）和控制主板（+68）——这就是 MRP 与采购节点要联动的原因。

## 关键卡点

1. **净需求 = 毛需求 - 库存**：在途量（采购在途/生产在制）不计入减项
2. **损耗率进 BOM**：SQL 里用 `CAST(qty_per * (1 + loss_rate) AS INTEGER)` 一次性算进去
3. **已评审才纳入**：rejected / pending 订单不参与计算

[[sql:9307|算出各物料净需求与库存缺口]]', 1, strftime('%s','now'));

-- 测验 9207,9227,9228（9207=线上已有，保留；后两道新增）
INSERT INTO questions (id, chapter_id, type, stem, options, answer, explanation, sort, created_at) VALUES
  (9207, 9107, 'single', '## 自测：轴承的库存够不够支撑所有已评审订单？

以下是今日（2026-08-08）MRP 运算的部分结果：

| 用途 | 轴承净需求（套） |
|---|---|
| 减速机 290 台 × 4 套/台 × 1.01 | 1172 |
| 伺服电机 200 台 × 2 套/台 × 1.01 | 404 |
| **合计毛需求** | **1576** |
| 当前库存 | 1480 |

已知轴承当前库存为 **1480 套**，请问：库存是否足够支撑所有已评审订单的需求？', '["A. 够用，库存还有剩余","B. 不够用，出现缺口约 96 套","C. 刚好用完，一套不剩","D. 需要进一步查看 BOM 才能判断"]', '1', '轴承的毛需求 = 减速机用 + 伺服电机用 = 290 × 4 × 1.01 + 200 × 2 × 1.01 = 1172 + 404 = **1576 套**。轴承库存 = 1480 套。净需求 = 1576 - 1480 = **96 套**（缺口）。答案 **B**：不够用，还缺约 96 套轴承。轴承在采购节点 PO-2 里预期到货 2000 套，正是用来填补这个缺口的。', 1, strftime('%s','now')),
  (9227, 9107, 'single', 'MRP 计算物料净需求，必须依赖哪类基础数据？', '["设备保养状态","BOM（物料清单）+ 库存 + 在制","客户名称列表","历史发货记录"]', '1', '净需求 = 总需求(BOM×产量) − 库存 − 在制 − 已订未到。BOM 是把产品拆成物料的关键。', 2, strftime('%s','now')),
  (9228, 9107, 'single', '某物料经 MRP 算出的净需求为负数，说明什么？', '["系统算错了","已有库存+在制约覆盖需求，无需采购","要超量采购备货","该物料已停产"]', '1', '负净需求=现有存量已满足总需求，不必补货（安全库存另行考虑）。不是错误。', 3, strftime('%s','now'));

-- SQL 练习 9307（复用线上真实哈希，未重新计算）
INSERT INTO sql_exercises (id, topic_id, title, prompt, dataset_json, answer_sql, answer_hash, schema_hint, sort, created_at) VALUES (
  9307, 9001, '算出各物料的净需求与库存缺口', '今天是 **2026-08-08**，计划员要跑一轮 MRP。

你的任务：把所有已评审通过（`review_status = ''approved''`）的订单按产品汇总，用 BOM 展开成各物料的毛需求，**跨产品汇总到物料**之后再减库存，得出净需求。

**净需求解读：**
- 净需求 **< 0**（负数）→ 库存够用，不用补货
- 净需求 **> 0**（正数）→ 库存不足，缺口要靠采购补

## 输出要求

输出列（顺序照写）：
1. **物料名称**
2. **毛需求**（含损耗，四舍五入取整）
3. **当前库存**
4. **净需求**（= 毛需求 - 库存）

排序：**净需求降序**（最缺的排最前面）。

## 提示

- 损耗率直接乘进 BOM：`qty_per * (1 + loss_rate)`
- 取整用 `CAST(ROUND(...) AS INTEGER)`，与 pick_lists 的口径一致
- **关键**：轴承被减速机和伺服电机共用，接线端子被 PLC 和变频器共用。
  共用料必须先跨产品把毛需求加起来，再减库存——分产品各减一次库存，会把缺口算没了
- `approved` 以外的订单（pending / rejected）不参与计算', '{}', 'WITH approved AS (
  SELECT product_id, SUM(qty) AS total_qty
    FROM sales_orders
   WHERE review_status = ''approved''
   GROUP BY product_id
)
SELECT m.name AS material,
       SUM(CAST(ROUND(a.total_qty * b.qty_per * (1 + b.loss_rate)) AS INTEGER)) AS gross_need,
       m.stock_qty AS stock,
       SUM(CAST(ROUND(a.total_qty * b.qty_per * (1 + b.loss_rate)) AS INTEGER)) - m.stock_qty AS net_need
  FROM approved a
  JOIN bom b ON b.product_id = a.product_id
  JOIN materials m ON m.material_id = b.material_id
 GROUP BY m.material_id, m.name, m.stock_qty
 ORDER BY net_need DESC;', '1ebab73b4c23e6ae17c5e7a5c809da0bf3329494bf51ced1c2e7fa626b98c195', 'products(product_id, code, name, spec, unit)
materials(material_id, code, name, unit, stock_qty)
bom(bom_id, product_id, material_id, qty_per, loss_rate)
sales_orders(so_id, so_no, customer_id, product_id, qty, order_date, due_date, review_status, plan_status)', 9, strftime('%s','now'));

-- 微练习 9404（node_id 关联节点，无 chapter_id）
INSERT INTO micro_practices (id, node_id, kind, prompt, payload, answer, feedback_ok, feedback_bad, sort) VALUES (
  9404, (SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'pick', 'MRP 跑完，控制主板的净需求是 +68 块（毛需求 164 块，库存只有 96 块）。净需求为正意味着什么？计划员下一步该做什么？', '{"options":[{"id":"A","text":"直接去仓库调拨，不用下采购单"},{"id":"B","text":"生成采购申请，向供应商下达采购单"},{"id":"C","text":"等供应商主动联系补货"},{"id":"D","text":"把净需求清零，避免触发采购"}]}', '["B"]', '对。净需求为正 = 现货不够，差的那部分要靠采购补。MRP 的输出就是采购节点的输入，两个环节是这样咬合上的。', '提示：净需求为正说明库存不够——不够的部分靠什么补上？采购（purchase）是 MRP 的下游，MRP 算出来的净需求就是采购申请的依据。', 1);

-- node_resources 挂载（本节点 6 条：章节/3测验/SQL/微练习）
INSERT INTO node_resources (node_id, res_type, ref_id, title, sort) VALUES
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'chapter', 9107, 'MRP 运算：毛需求怎么变成净需求', 1),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'quiz', 9207, '## 自测：轴承的库存够不够支撑所有已评审订单？  以下是今日（2026-0', 2),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'quiz', 9227, 'MRP 计算物料净需求，必须依赖哪类基础数据？', 3),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'quiz', 9228, '某物料经 MRP 算出的净需求为负数，说明什么？', 4),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'sql', 9307, '算出各物料的净需求与库存缺口', 5),
  ((SELECT n.id FROM flow_nodes n JOIN flowcharts f ON f.id = n.flow_id WHERE f.slug = 'generic-factory' AND n.node_key = 'mrp'), 'micro', 9404, 'MRP 跑完，控制主板的净需求是 +68 块（毛需求 164 块，库存只有 ', 6);

PRAGMA foreign_keys = ON;