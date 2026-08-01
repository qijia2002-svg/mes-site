# ADR-007: 仿真 v1 数据落库边界 — 素材落库、画布不落库、结果走 progress_events

## Status

Proposed (2026-08-01) · 决策人：高见远 · 约束级别：P0

## Background

工艺路线搭建器涉及三类数据：教学素材（场景/工序/BOM/工单/参考路线/故障脚本）、学员画布状态（拖出来的块与连线）、仿真运行结果。

Cloudflare D1 免费版硬约束（实测核实）：**100,000 行写/天**、**单库单线程逐条处理查询**（队列满返回 overloaded）、5,000,000 行读/天、5GB 存储。**任何需要"每个学员每次操作都写库"的设计，都会撞穿写额度，并把只读内容链路拖进同一个单线程队列。**

## Decision

**三分法：**

| 数据 | 归属 | 理由 |
|------|------|------|
| 教学素材 | **落 D1，只读，走 L2 缓存** | 共享、低频、需版本化与后台可编辑；与 topics/chapters 同等待遇 |
| 学员画布状态 | **不落库**：引擎内存 + `localStorage` 草稿 | 中间态无共享价值；自动保存会吃 40% 写额度并制造单线程争用 |
| 仿真运行结果 | **落库，但仅"提交"时写 1 行 `progress_events`** | 复用现有表与链路，零新写入路径 |
| 学员作品集 | v1.1，Feature Flag 后置 | 显式"保存作品"触发，每人配额 20 份 |

新表全部加 `sim_` 前缀（`sim_scenarios`/`sim_operations`/`sim_process_routes`/`sim_work_orders`/`sim_bom_items`）。`work_orders`/`bom` 已被 `web/src/features/sql-sandbox/dataset.sql` 的 sql.js 样例库占用，同名不同结构会造成教学认知污染。

**额度核算**（一次 10 分钟搭建 ≈ 200 次状态变更）：
- 画布自动保存：200 次/人 × 100 人 = 20,000 请求/天（20% 请求额度）+ 40,000 行写/天（40% 写额度）+ 单线程队列争用 → **否决**。
- 落库素材：一个场景整包 ≈ 60 行，命中 L2 后 0 行读；1000 次冷读/天 = 60,000 行 = 读额度 1.2% → **安全**。
- `POST /sim/runs`：2 行写/次（progress_events + stats_daily），100 人 × 20 次 = 4,000 行 = 写额度 4% → **安全**。

**明确否决新建的表**：`sim_canvas_state`（→localStorage）、`sim_runs`（→progress_events）、`sim_faults`（→fault_scenarios）、`sim_fault_solutions`（→block_solutions）、`sim_materials`（→内联进 `sim_bom_items`）。净新增 5 张表，零现有表结构变更。

## Consequences

**正面**
- 写额度与单线程队列完全安全，学员操作不会拖慢他人读章节。
- 教学素材与现有内容同套缓存/版本化机制，运维心智统一。

**负面**
- 学员未"提交"的画布只存本地，换设备/清缓存即丢失（产品设计上可接受，属草稿性质）。
- 浮点比率一律整数定点（万分比/`qty_per`×1000），增加 schema 与渲染层的换算代码（刚性要求，非洁癖）。

## Related ADRs

- ADR-003（sql.js 自托管）——`work_orders`/`bom` 已被浏览器沙箱样例库占用，是 `sim_` 前缀的直接动因。
- ADR-008（仿真全前端运行）——画布不落库与"仿真前端跑"同源。
- ADR-011（Obsidian 导入）——`chapters.source_path` DDL 增量为另一模块，与本 ADR 的 5 张新表独立。

## Verification

```bash
# 不应存在被否决的表
grep -rn "sim_canvas_state\|sim_runs\b\|sim_faults\|sim_fault_solutions\|sim_materials" \
  worker/src/migrations/   # 必须无匹配
# 新表均带 sim_ 前缀
grep -rn "CREATE TABLE" docs/architecture/schema-increment-simulator.sql | grep -v "sim_"  # 除 PART C 的 ALTER 外无匹配
```
