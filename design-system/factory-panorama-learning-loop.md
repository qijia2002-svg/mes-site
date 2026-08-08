# 工厂全景 × 学习闭环 设计方案（v12 方向）

> ⚠ **SUPERSEDED（2026-08-08）** — 本文已被 `design-system/factory-panorama-architecture.md` 取代。
> 取代原因：本文假设「每道 SQL 题带自己的 dataset」，而代码核实发现 `sql_exercises.dataset_json`
> 在前端是**死字段**（沙箱恒用静态 `dataset.sql`），按本文实现会静默打破判题哈希契约。
> 仅作历史草案保留，**不要按本文实施**。

> 目标：让「工厂全景」从一张导航图，变成**每个流程节点都能进去「看知识 + 动手练」的学习主轴**。
> 把工厂全景、工厂沙盒、知识体系、SQL 四块，用「节点级资源」连成闭环。
> 设计原则（沿用项目 P0）：图标全走 `Icon.tsx` 注册表、零硬编码色、无 emoji、无紫粉渐变。

---

## 1. 核心思路：每个流程节点 = 一个「学习站」

工厂全景是领域导航的 **spine**。每个节点不是终点，而是一个可以进去「看 + 练」的学习站：

```
看知识(章节)  →  动手练(仿真沙盒 / SQL / 测验)  →  标记完成  →  系统推荐下一站
```

- 主语 = 工厂，谓语 = MES/ERP/WMS/QMS（横切系统），宾语 = 实战（quiz/sql/sim）。
- 沿用现有 `nextKey`（下一个未学节点）作为主轴顺序；节点内按「先看后练」推荐动作。

## 2. 已具备的骨架（不用改表，省大事）

| 层 | 现状 | 是否可用 |
|----|------|----------|
| 数据模型 | `node_resources(node_id, res_type, ref_id, title, sort)`，注释明确 `res_type: chapter\|quiz\|sql\|sim` | ✅ 已建 |
| 后端读取 | `GET /api/v1/flowchart/:slug` 已把 `node_resources` 映射进 `resources[]`（`flowchart.repo.ts` + `flowchart.routes.ts`） | ✅ 已通 |
| 前端类型 | `NodeResourceDTO { id, nodeId, type, refId, title }` 已定义 | ✅ 已通 |

**三个缺口**：
1. **数据空**：`seed-flowchart-generic.sql` 一行 `node_resources` 都没插 → 接口永远返回 `resources: []`。
2. **前端不消费**：`FactoryFlow.tsx` 只用了 `nodes/edges`，面板一律渲染硬编码 `DRILLS`（3 个通用链接，每个节点都一样）。
3. **目标页不支持带 id 深链** + **沙盒没有场景 key**。

## 3. 四大连接点设计

### 3.1 知识体系（看）
- `node_resource: type=chapter, ref_id=chapters.id` → 打开该节点专属章节。
- 面板顶部仍展示节点的 `description`（一句话锚点），下面放「查看完整知识 → 章节」。
- 现有 `chapters` 按 `topic` 组织，把相关章节 ref 到节点即可，**无需新建内容**。

### 3.2 SQL（练）
- `node_resource: type=sql, ref_id=sql_exercises.id` → 深链到 `/sql-space/:sqlId`（`ExercisePage` 已支持按 id 打开）。
- 关键钩子：**「这个环节在数据库里长什么样 → 写 SQL 查它」**。节点=采购 → SQL 查采购单/供应商；节点=质检 → SQL 查不合格品。让 SQL 与节点业务强绑定，而不是通用题库。
- 现存 `sql_exercises` 只挂 `topic_id`，先用 topic 下某题映射；理想是补「节点级 SQL」用 `ref_id` 精确指向某题。

### 3.3 工厂沙盒（练·看它怎么转）—— 最重的一块
- 现状：`SimProject` 无稳定 key，`/simulator` 不读任何参数；`fault_scenarios` 表有 `variant` 字段但 sim 代码未接。
- 设计：
  1. 给场景一个稳定 key：复用 `fault_scenarios` 加 `slug`（或新增 `sim_scenarios`），`variant='sim'`，`blueprint_json` 存 `SimProject`（nodes/edges）。
  2. `/simulator` 支持 `?scenario=slug` 加载该蓝图；节点 `res_type='sim', ref_id=scenario.id`。
  3. 沙盒里搭的是「这个节点的工艺路线」（如节点=车间执行 → 一条产线蓝图），点运行看工单怎么流转、瓶颈在哪。
- 实现借鉴：`simReducer.ts` 的 `SimProject` / `seedExampleFactory()` 可改造成「按蓝图初始化」。

### 3.4 测验（练·即时检验）
- `node_resource: type=quiz, ref_id=questions.id` → 深链到具体题目（新增 `/quiz/:questionId` 或 `ChapterPage?q=id`）。
- 答完即校验，标记该节点「测验完成」。

## 4. 前端渲染（替代 DRILLS）

`FactoryFlow` 拿到 `resources` 后按 `nodeId` 分组。选中节点的内联面板改为：

- 节点一句话知识（`description`）
- 「涉及系统」标签（MES/ERP/WMS/QMS）
- **按类型分组的学习动作**（替代千篇一律的 3 个通用链接），每个动作带完成态 ✓：
  - 知识 → 打开章节
  - 仿真 → 打开场景
  - SQL → 打开练习
  - 测验 → 打开题目
- 进度升级：不仅在 `localStorage` 记「走过」，还记每个节点各资源类型完成情况 → 卡片显示「已学知识 / 已做仿真 …」小标。

## 5. 实施分期（建议）

- **P1 骨架打通（最快见效）**：① 给 `node_resources` 写 seed，把节点映射到**已有**的 `chapters` / `sql_exercises` / `questions`；② 前端消费 `resources` 替代 `DRILLS`；③ 加 quiz/sql 深链路由。沙盒先不挂 `sim` 类型（或暂跳通用 `/simulator`）。
- **P2 沙盒场景化**：补 sim 场景 key + `/simulator?scenario=` 加载 + `node_resources` 的 `sim` seed。
- **P3 节点级精修内容**：补「节点专属 SQL / 仿真蓝图 / 测验」，让每个站都真正讲清这个环节。

## 6. 需你拍板的点

1. **内容来源**：先复用现有 chapters/sql/questions 映射（快，半天级），还是先补节点级专属内容（慢但准）？
2. **沙盒节奏**：P2 是否现在就做，还是先 P1 跑通「知识 + SQL + 测验」三件套？
3. **进度粒度**：只记「节点走过」，还是做到「节点内各资源类型分别完成」？
4. **范围**：先做 `generic-factory` 这一条主数据流（12 节点）跑通闭环，还是同时扩多条流程图？
