# 工艺路线搭建器 + Obsidian 导入 — 架构技术方案 v1

> 阶段：Phase 1 并行调研产出（调研 + 设计，**不含实现代码**）
> 作者：高见远（首席架构师）· 日期：2026-08-01
> 适用范围：P0『工艺路线搭建器』、P1『Obsidian 导入』
> 上游依据：`ManufacturingOS-产品说明与路线图.md` §2 P0/P1、`docs/SPEC-MVP-v1.md`
> 代码基线（实测审计，非推测）：`worker/src/router.ts`(19 路由) · `worker/src/core/{cache,response,pipeline}.ts` · `worker/src/data/db.ts` · `worker/src/migrations/schema.sql` · `web/src/App.tsx` · `web/src/components/Icon.tsx` · `design-system/design-tokens.css`

---

## 0. 结论先行（TL;DR）

| # | 决策点 | 结论 | ADR |
|---|--------|------|-----|
| 1 | 仿真渲染方案 | **原生 Canvas 2D + DOM 叠加，零新增运行时依赖**。不引 Konva / React Flow / zustand | ADR-006 |
| 2 | 状态管理 | 高频仿真状态放 **React 之外的可变引擎实例**，≤4Hz 节流推快照给 React。换状态库解决不了这个问题 | ADR-006 |
| 3 | v1 是否落库 | **教学素材落库（只读+L2缓存）；学员画布不落库（内存+localStorage）；仅"提交运行结果"写 1 行 `progress_events`** | ADR-007 |
| 4 | 表命名 | 全部加 `sim_` 前缀。`work_orders` / `bom` 已被 sql.js 沙箱样例库占用（`web/src/features/sql-sandbox/dataset.sql:47,80`），同名不同结构会造成教学混淆 | ADR-007 |
| 5 | 仿真在哪端跑 | **全部在前端**。Workers 免费版 10ms CPU/invocation，逐 tick 仿真跑不动；后端只下发素材、只收结果摘要 | ADR-008 |
| 6 | 异常注入 | **复用现有 `fault_scenarios` 表，零 DDL 变更**，新增 `variant='sim'`，`solution_json` 约定 `{inject, expect}`；多解容错用现成的 `block_solutions` | ADR-008 |
| 7 | 懒加载 | `React.lazy` + Suspense 落在 `AppShell` 内 / `Routes` 外；**必须配 chunk-load ErrorBoundary**；hover 预热 | ADR-009 |
| 8 | 路由库 | **不迁 TanStack Router**。懒加载是 React 的能力不是路由库的；用 30 行常量表拿 80% 类型安全，零迁移成本 | ADR-010 |
| 9 | Obsidian 解析 | **前端解析 + 后端幂等写入**。dry-run 预览必须在前端；256KB body 上限决定了原始文件不能上传 | ADR-011 |
| 10 | frontmatter 解析器 | **手写受限解析器 + 快速失败**，不引 gray-matter(10KB gz, Node 取向)。有强制 dry-run 兜底，解析不了就报错而非静默猜 | ADR-011 |

**唯一硬阻断项**：`chapters` 表缺 `source_path` 列与幂等唯一索引，Obsidian 重复导入会产生重复章节。必须先做 DDL 增量（§6.6）。

---

## 1. 平台硬约束（所有决策的边界条件）

这些数字不是估计，是官方文档实测值与代码实测值，后续所有取舍都由它们推导。

| 约束 | 数值 | 来源 |
|------|------|------|
| D1 Rows read | **5,000,000 / 天** | [Workers Pricing · D1](https://developers.cloudflare.com/workers/about/pricing) |
| D1 Rows written | **100,000 / 天** | 同上 |
| D1 存储 | 5 GB 总量 / 单库上限 10 GB | 同上 + [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq) |
| D1 并发 | **单库单线程，逐条处理查询**；队列满返回 overloaded | [D1 FAQ · Concurrency](https://developers.cloudflare.com/d1/reference/faq) |
| Workers 请求 | **100,000 / 天** | Workers Pricing |
| Workers CPU | **10 ms / 次调用**（免费版） | Workers Pricing |
| 单请求 SQL 语句 | **≤ 40 条**（代码护栏，超限抛 5002） | `worker/src/data/db.ts:11` `MAX_STMT_PER_REQUEST` |
| 写请求 body | **≤ 256 KB**（超限抛 1002） | `worker/src/middleware/validate.ts:12` |
| `showDirectoryPicker()` | **Limited availability，非 Baseline**，Firefox / Safari 不支持 | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) |
| `input[webkitdirectory]` | 非标准属性，但主流浏览器均已实现；`File.webkitRelativePath` 给出相对路径 | [MDN input/file](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file) |

> 说明：专家包内置的 `references/architecture/mvp-stack.md` 等知识库文件在本机未随包分发（已核查 `~/.workbuddy` 下无 `references/architecture`），本方案改以「官方文档联网核实 + 现有代码实测审计」双基线成文。所有外部数字均带可点击出处。

---

## 2. 前端仿真方案对比矩阵

### 2.1 候选与评分

评分：5 = 最优，1 = 最差。权重按 MVP 决策矩阵（学习成本/生态/部署成本高权重，扩展性低权重）。

| 维度 | 权重 | A. 原生 Canvas 2D + 自管状态 | B. 原生 Canvas + zustand | C. Konva / react-konva | D. React Flow (@xyflow) | E. 纯 SVG + React |
|------|:----:|:---:|:---:|:---:|:---:|:---:|
| 懒加载 chunk 体积（gz） | 高 | **5**（~0 KB 新增） | 4（+1.2 KB） | 2（+55 KB） | 2（+50 KB，含自带 CSS） | **5**（0 KB） |
| 60fps 动画能力（工单沿线流动） | 高 | **5** | **5** | 4（场景图重绘开销） | 1（DOM 节点动画，需自己加一层） | 1（数十节点后 reflow 明显） |
| 命中测试成本（≤100 节点） | 中 | **5**（AABB 逆序 O(n) 足够） | **5** | 4（自带事件系统，但要托管整棵树） | **5**（DOM 原生事件） | **5** |
| design-token 一致性 | 高 | 4（需 `getComputedStyle` 读 token，见 §2.4） | 4 | 3（同样要读 token） | **1**（自带样式表含硬编码色值，覆盖成本高，直接顶撞 P0） | **5**（CSS 原生） |
| 无障碍（键盘/读屏） | 中 | 3（需自建 A11y 镜像层，见 §2.3） | 3 | 2（canvas 接管后 a11y 归零） | 4（DOM 天然可聚焦） | **5** |
| 学习成本 / 团队熟悉度 | 高 | 4（Canvas 2D 是基础 API，无黑盒） | 4 | 2（场景图心智模型） | 3（受控/非受控双模式坑多） | **5** |
| 与产品 spec 一致性 | 高 | **5**（spec 明确"原生 Canvas API"） | **5** | 1（违背） | 1（违背） | 2（偏离） |
| 维护成本 / 供应链风险 | 中 | **5**（零依赖） | 4 | 3 | 3 | **5** |
| **加权判定** | | **选中** | 次选 | 落选 | **否决** | 落选 |

### 2.2 推荐结论

**选 A：原生 Canvas 2D API 绘制 + DOM/React 承载交互控件 + 零新增运行时依赖。**

关于「是否借一个极轻量状态管理库（只借状态、不借绘制）」的取舍，我的判断是**不借，而且换库解决不了真正的问题**：

> 仿真的状态是**每 16ms 变化一次**的。如果这份状态住在 React 里（无论是 `useState`、zustand 还是 jotai），每帧都会触发订阅者 re-render。zustand 能做的是"只让订阅了变化切片的组件重渲染"——但在这里，**订阅者就是画布本身**，切片粒度优化不掉任何东西。
>
> 正确解法不在状态库这一层：把高频可变状态放进一个 **React 之外的普通对象实例**（`SimEngine`），rAF 循环直接读它、直接画 canvas，完全绕过 React 调和；只把**低频快照**（运行状态、当前 tick、告警列表、完工数）以 ≤4Hz 节流 `setState` 推给 React 渲染 DOM 面板。
>
> 这样处理之后，React 侧剩下的共享状态只有寥寥几项低频量，`useReducer` + `Context` 绰绰有余。**引入 zustand 的增量价值为零，却增加一个供应链依赖。**

唯一"看起来需要库"的功能是**撤销/重做**——实际是一个 30 行的定长环形缓冲（存 `RouteGraph` 的结构化克隆快照，上限 50 步），不构成引库理由。

### 2.3 拖拽 / 连线 / 键盘可达如何用原生 Canvas + DOM 叠加实现

**DOM 结构（三层叠加）**

```
<section class="sim-stage">                       position: relative
  ├─ <canvas class="sim-layer-bg">                静态层：网格 · 工序块 · 连线（脏标记重绘）
  ├─ <canvas class="sim-layer-fx">                动态层：工单胶囊 · 高亮 · 告警脉冲（每帧重绘）
  ├─ <div  class="sim-overlay">                   DOM 叠加：选中块的浮动属性气泡 / 端口 tooltip
  └─ <ul   class="sim-a11y-mirror" >              无障碍镜像（视觉隐藏，非 display:none）
        <li><button aria-describedby=…>OP-20 冲压 · 状态 运行中</button></li>
</section>
```

两张 canvas 的意义：拓扑（块+连线）在一次仿真运行中通常**完全不变**，没有理由每帧重画。实测量级下（≤12 工序、≤10 工单）单层也能跑满 60fps，但分层让"加倍工序数"这件事不需要重新做性能工作。

**① 拖拽 — 用 Pointer Events，不用 HTML5 Drag and Drop**

HTML5 DnD 在这个场景是错的：移动端不触发、拖影不可控、`dragover` 里拿不到可靠的 canvas 局部坐标、无法做落点吸附预览。

改用 `pointerdown` / `pointermove` / `pointerup` + `setPointerCapture`：

- **工具箱 → 画布**：工具箱项是真实 `<button>`（可聚焦、有 lucide 图标）。`pointerdown` 后引擎进入 `DRAG_NEW` 态，`pointermove` 时在 **fx 层**绘制半透明幽灵块 + 8px 网格吸附线（8px = `--space-2`，与 DOM 侧间距同源）。`pointerup` 落在画布内 → `dispatch({type:'ADD_OP', opCode, x, y})`。
- **画布内移动**：`pointerdown` 先做命中测试；命中块 → `DRAG_MOVE` 态，跟随光标改 `x/y`，同样吸附网格。
- **命中测试**：维护 `nodes: {id,x,y,w,h}[]`，**逆序遍历**（后绘制的在视觉上层，应优先命中）做 AABB 判断。节点数 ≤100 时 O(n) 完全够，**不需要四叉树**——这是典型的过度设计陷阱，明确禁止。
- **坐标换算**：`const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left - panX) / zoom;` 一次性收进 `toWorld(e)` 工具函数，绝不散落。

**② 连线 — 端口 + 三次贝塞尔 + DAG 环检测**

- 每个工序块右侧有输出端口、左侧有输入端口，绘制为半径 6 的圆；**命中半径放大到 12**（Fitts 定律 + 触摸友好），视觉与命中区解耦。
- 从输出端口 `pointerdown` → 拖出临时曲线到光标（画在 fx 层）→ 在目标输入端口 `pointerup` 成型。
- 曲线用 `ctx.bezierCurveTo`，控制点水平外推 `cx = Math.max(40, Math.abs(dx) * 0.5)`，得到流程图标准 S 形。
- **成线前跑 DFS 环检测**：工艺路线是 DAG，成环则拒绝，并在 DOM 错误面板给出明确文案（不是 canvas 里画个红叉了事——错误信息必须可被读屏获取）。
- 首期教学上只要求线性单入单出路线，但**数据结构按 DAG 存**（`edges: {from,to}[]`），为后续并行工序 / 合流工序留口，不需要改模型。

**③ 动画 — 固定步长逻辑 + 可变步长渲染**

单一 `requestAnimationFrame` 循环，accumulator 模式：

```
每帧：
  dt = min(now - last, 100ms)            // 卡顿钳位，防"死亡螺旋"
  acc += dt * speed                       // speed ∈ {0, 1, 2, 4}
  while (acc >= TICK_MS) {                // TICK_MS = 100ms = 1 仿真分钟
      state = reduce(state, TICK)         // 纯函数，见 §4
      acc -= TICK_MS
  }
  alpha = acc / TICK_MS                   // 渲染插值系数 ∈ [0,1)
  drawFx(state, alpha)
```

这样倍速切换只改 `speed` 系数，**动画不会因帧率抖动而错乱**；暂停 = `speed=0`；单步 = 手动执行一次 `reduce`。

工单沿连线流动：记录 `edgeProgress ∈ [0,1]`，用**与绘制同一条**三次贝塞尔的参数方程 `B(t)` 求位置，绘制工单胶囊。渲染与逻辑共用同一条曲线定义，杜绝"动画轨迹和连线对不上"。

**DPR 与 resize**：`canvas.width = cssW * devicePixelRatio; ctx.scale(dpr, dpr)`，`ResizeObserver` 监听容器变化时重设——漏掉这步在高分屏上就是一片糊。

**降级动效**：`prefers-reduced-motion: reduce` 时关闭插值，工单直接瞬移到下一工序并配状态文本变化。`design-tokens.css` 已有全局 reduced-motion 兜底，canvas 侧需自行 `matchMedia` 判断（CSS 管不到 canvas 内部）。

### 2.4 P0 合规：Canvas 里怎么做到"零硬编码颜色"和"图标只走 lucide"

这是本方案里最容易被实现阶段破掉的两条铁律，必须在 Spec 层写死。

**颜色**：`ctx.fillStyle` 不吃 CSS 变量。唯一正解是**启动时读一次 token 快照**：

```
palette = {
  running: read('--status-running'),   // 已存在，= --success
  idle:    read('--status-idle'),      // 已存在，= --meta
  stopped: read('--status-stopped'),   // 已存在，= --warn
  fault:   read('--status-fault'),     // 已存在，= --danger
  surface: read('--surface'), border: read('--border'),
  accent:  read('--accent'), fg: read('--fg'), fg2: read('--fg-2'),
}
// read(n) = getComputedStyle(document.documentElement).getPropertyValue(n).trim()
```

主题切换 / `prefers-color-scheme` 变化时重读并置全量脏标记重绘。
**验收规则：`web/src/features/simulator/**` 下 grep 不到任何 `#rgb` / `rgb(` / `hsl(` 字面量。**
`design-tokens.css:260-263` 已经定义好 `--status-running/idle/stopped/fault` 四个状态色，正是为设备状态准备的——直接用，不新造。

**图标**：canvas 内**不画图标**。工序块用「形状编码 + 文字标签」表达语义：

| 工序类型 | canvas 形状 | DOM 侧图标（Icon.tsx 语义名） |
|---|---|---|
| 加工 | 圆角矩形 | `process` (Milestone) |
| 质检 | 菱形 | `quality` (ShieldCheck) |
| 物料投入 | 平行四边形 | `material` (Package) |
| 入库 | 桶形 | `warehouse` (Warehouse) |
| 工单 | 胶囊 | `work-order` (ClipboardList) |

图标只出现在 DOM 层（工具箱按钮、属性面板、错误列表、运行控制条），全部经 `Icon.tsx` 语义名调用。**边界干净：canvas 不碰图标，就不存在把 SVG 光栅化进 canvas 的合规灰区。** 现有 `Icon.tsx` REGISTRY 已含 `routing/process/quality/material/warehouse/work-order/equipment/run/reset` 等全部所需语义名，**本次无需新增图标，零 lucide 版本变更风险**。

（若后续确实要在 canvas 内显示图标，走"构建期预烘焙成 ImageBitmap"路线，仍从 lucide 取源、仍不引第二个图标库——记在 ADR-006 Consequences，不在 v1 范围。）

---

## 3. 数据模型（D1 增量）

### 3.1 v1 落库范围决策

**结论：三分法。**

| 数据 | 归属 | 理由 |
|------|------|------|
| **教学素材**（场景/工序库/BOM/工单模板/参考路线/故障脚本） | **落 D1，只读，走 L2 缓存** | 共享、低频、需版本化与后台可编辑；与 topics/chapters 同等待遇 |
| **学员画布状态**（拖出来的块、连线、参数） | **不落库**：引擎内存 + `localStorage` 草稿 | 见下方额度核算 |
| **仿真运行结果** | **落库，但只在点「提交」时写 1 行 `progress_events`** | 复用现有表与链路，零新写入路径 |
| 学员作品（作品集） | v1.1，Feature Flag 后置 | P1 需求，显式「保存作品」触发，每人配额 20 份 |

**额度核算（为什么画布不能自动保存）**

一次 10 分钟的搭建过程，拖拽 / 连线 / 改参数合计约 200 次状态变更。若做自动保存：

- **Workers 请求**：200 次/人 × 100 人/天 = **20,000 请求/天**，占免费额度 100,000 的 20%——单看可接受。
- **D1 写入**：每次 upsert 1 行画布 + 索引更新至少 1 行 = 400 行/人，×100 人 = **40,000 行/天**，占 100,000 写额度的 40%。而 `progress_events` + `stats_daily` 还要吃同一份额度。
- **真正的杀手**：D1 **单库单线程**。自动保存的写请求会和只读内容链路排在**同一个 Durable Object 队列**里。队列满即返回 overloaded——也就是说，一个学员疯狂拖拽，会拖慢所有人读章节。

结论明确：**画布状态是本地草稿，不是服务端资源。** 用 `localStorage`，key 为 `sim:draft:v1:<scenarioSlug>`，带 schema 版本号便于失效。这不是"降级方案"，这是正确的边界划分——学员的中间态本来就没有共享价值。

**落库素材的读额度**：一个场景整包约 60 行（1 场景 + 12 工序 + 20 BOM + 5 工单 + 15 路线边 + 5 故障）。命中 L2 缓存后 **0 行读**；未命中 60 行读。即便 1000 次冷读/天也只有 60,000 行，占 5,000,000 的 1.2%。**完全安全。**

### 3.2 表命名：为什么加 `sim_` 前缀

`web/src/features/sql-sandbox/dataset.sql` 已经在浏览器 sql.js 沙箱里定义了 `products` / `materials` / `bom` / `equipment` / `work_orders` / `production_records` / `quality_checks`（第 18–126 行）。虽然那是浏览器内库、D1 里同名不会技术冲突，但：

> 学员会在同一个平台里，一边在 SQL 工作台 `SELECT * FROM work_orders`，一边在文档里读到"D1 的 `work_orders` 表"——**两者字段完全不同**。这是纯粹自找的认知污染，也是文档维护地雷。

所以：D1 侧统一 `sim_` 前缀，语义上明确"这是仿真教学夹具，不是业务表"。同时，仿真场景的字段命名**刻意向 sql.js 样例库靠拢**（`code` / `qty_plan` / `state` 等），让学员在两个模块间迁移概念时零摩擦。

### 3.3 增量 SQL

完整可执行文件见 `docs/architecture/schema-increment-simulator.sql`（设计稿，**未**放入 `worker/src/migrations/`，待 Spec 评审通过后由后端 owner 落位）。核心结构：

```sql
-- ① 仿真场景（一个场景 = 一套示例工厂）
CREATE TABLE IF NOT EXISTS sim_scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  topic_id    INTEGER REFERENCES topics(id),
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  industry    TEXT    NOT NULL DEFAULT 'discrete',  -- discrete | process
  config_json TEXT    NOT NULL DEFAULT '{}',        -- 画布尺寸/网格/倍速档/评分权重
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'draft',     -- 安全默认：不自动发布
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_scn_list  ON sim_scenarios(status, sort);
CREATE INDEX IF NOT EXISTS idx_sim_scn_topic ON sim_scenarios(topic_id, status);

-- ② 工序库（工具箱里可拖的积木）
CREATE TABLE IF NOT EXISTS sim_operations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id   INTEGER NOT NULL REFERENCES sim_scenarios(id),
  code          TEXT    NOT NULL,               -- OP-10 / OP-20…
  name          TEXT    NOT NULL,
  kind          TEXT    NOT NULL DEFAULT 'process', -- process|qc|material|warehouse
  std_minutes   INTEGER NOT NULL DEFAULT 10,    -- 标准工时（仿真分钟）
  capacity      INTEGER NOT NULL DEFAULT 1,     -- 并行工位数
  yield_rate    INTEGER NOT NULL DEFAULT 10000, -- 良率，万分比（整数避浮点漂移）
  on_fail       TEXT    NOT NULL DEFAULT 'rework', -- rework|scrap|hold
  input_json    TEXT    NOT NULL DEFAULT '[]',  -- [{materialCode, qtyPer}]
  sort          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scenario_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sim_op_scn ON sim_operations(scenario_id, sort);

-- ③ 参考工艺路线（标准答案 / 教学范例；学员搭的不进这张表）
CREATE TABLE IF NOT EXISTS sim_process_routes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES sim_scenarios(id),
  code         TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  product_code TEXT    NOT NULL DEFAULT '',
  graph_json   TEXT    NOT NULL DEFAULT '{"nodes":[],"edges":[]}',  -- DAG
  is_reference INTEGER NOT NULL DEFAULT 1,      -- 1=参考答案（不下发给学员端）
  sort         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scenario_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sim_route_scn ON sim_process_routes(scenario_id, sort);

-- ④ 工单模板
CREATE TABLE IF NOT EXISTS sim_work_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id  INTEGER NOT NULL REFERENCES sim_scenarios(id),
  wo_no        TEXT    NOT NULL,
  product_code TEXT    NOT NULL,
  qty_plan     INTEGER NOT NULL DEFAULT 1,
  release_tick INTEGER NOT NULL DEFAULT 0,      -- 第几 tick 下达
  priority     INTEGER NOT NULL DEFAULT 0,
  sort         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (scenario_id, wo_no)
);
CREATE INDEX IF NOT EXISTS idx_sim_wo_scn ON sim_work_orders(scenario_id, release_tick);

-- ⑤ BOM（单层；多层用 parent_code 自关联表达，仿真只递归 1 层）
CREATE TABLE IF NOT EXISTS sim_bom_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id   INTEGER NOT NULL REFERENCES sim_scenarios(id),
  parent_code   TEXT    NOT NULL,               -- 成品/半成品编码
  material_code TEXT    NOT NULL,
  material_name TEXT    NOT NULL DEFAULT '',
  qty_per       INTEGER NOT NULL DEFAULT 1,     -- 单位用量 ×1000（整数，避浮点）
  loss_rate     INTEGER NOT NULL DEFAULT 0,     -- 损耗率，万分比
  init_stock    INTEGER NOT NULL DEFAULT 0,     -- 场景初始库存（缺料演示的关键变量）
  UNIQUE (scenario_id, parent_code, material_code)
);
CREATE INDEX IF NOT EXISTS idx_sim_bom_scn ON sim_bom_items(scenario_id, parent_code);
```

**索引策略说明**（遵循「MVP 不过早优化」）：
- 每张表只建 **列表查询主路径**索引 + **业务唯一约束**，不建投机性复合索引。
- 所有 `UNIQUE (scenario_id, code)` 既是业务幂等键，也是导入/后台编辑的天然冲突检测——同时省掉一个查重查询。
- 全部查询都以 `scenario_id` 为前导列，因为**没有任何一个业务查询是跨场景的**。

**浮点规避**：`yield_rate` / `loss_rate` 用万分比整数，`qty_per` ×1000。SQLite 的 REAL 在跨设备重放仿真时会产生位级差异，导致同一操作序列在不同机器上算出不同结果——教学场景里这是"我明明照做了为什么结果不一样"的经典投诉源。**整数定点是刚性要求，不是洁癖。**

### 3.4 不新建的表（明确边界）

| 想加的表 | 判定 | 替代方案 |
|---|---|---|
| `sim_canvas_state` 画布自动保存 | **否决** | localStorage 草稿（§3.1） |
| `sim_runs` 运行流水 | **否决** | 复用 `progress_events`，`item_type='sim_run'` |
| `sim_faults` 故障脚本 | **否决** | 复用 `fault_scenarios`，`variant='sim'`（§4.4） |
| `sim_fault_solutions` | **否决** | 复用 `block_solutions`（设计意图就是"积木容错规则"） |
| `sim_materials` 物料主数据 | **否决** | 内联进 `sim_bom_items.material_name/init_stock`，首期无独立物料生命周期 |

净新增 **5 张表**，零现有表结构变更（Obsidian 那边的 `chapters` DDL 增量属另一模块，见 §6.6）。

---

## 4. 仿真引擎分层与状态机

### 4.1 分层架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│ L5  React UI（DOM）                                                        │
│     Toolbox · Inspector · RunBar · ErrorPanel · A11yMirror · ResultSheet   │
│     依赖：Icon.tsx(lucide) · design-tokens · StateBlock(空/错/载兜底)       │
└──────────────┬───────────────────────────────────────▲────────────────────┘
               │ dispatch(Intent)                      │ Snapshot @ ≤4Hz（节流）
               │ ADD_OP/LINK/UNLINK/SET_PARAM/RUN/…    │ {tick,status,alarms[],kpi}
┌──────────────▼───────────────────────────────────────┴────────────────────┐
│ L3  Runtime（副作用宿主 · React 之外的可变实例 SimEngine）                  │
│     rAF loop · fixed-step accumulator · speed{0,1,2,4} · pause/step/reset  │
│     undo/redo 环形缓冲(50) · localStorage 草稿持久化(防抖 1s)               │
└──────────────┬──────────────────────────────────┬─────────────────────────┘
               │ reduce(state, TICK) → state',ev[]│ state' + alpha
┌──────────────▼──────────────────┐   ┌───────────▼─────────────────────────┐
│ L2  Reducer / 状态机（纯函数）    │   │ L4  Renderer（Canvas 2D）            │
│   · 工单状态机（§4.2）            │   │   bg-canvas 脏标记：网格/块/连线      │
│   · 资源状态机（§4.3）            │   │   fx-canvas 每帧：工单/高亮/告警脉冲  │
│   · 物料台账（发料/回冲/缺料）     │   │   palette ← getComputedStyle(token)  │
│   · 异常注入器（§4.4）            │   │   DPR 缩放 · ResizeObserver          │
│   零 DOM / 零 React / 零随机源     │   │   reduced-motion → 关插值            │
│   ⇒ 100% 可用 Node 跑单元测试      │   └─────────────────────────────────────┘
└──────────────┬──────────────────┘
               │ 读
┌──────────────▼────────────────────────────────────────────────────────────┐
│ L1  Model（不可变数据结构）                                                 │
│     RouteGraph{nodes,edges} · Operation · WorkOrder · BomItem · Ledger     │
└──────────────┬────────────────────────────────────────────────────────────┘
               │ 载入（一次）
┌──────────────▼────────────────────────────────────────────────────────────┐
│ L0  Scenario Data                                                          │
│     GET /api/v1/sim/scenarios/:slug   （L2 Cache，键含 content_version）    │
│     GET /api/v1/sim/scenarios/:slug/faults （只下发 inject，不下发 expect）  │
└───────────────────────────────────────────────────────────────────────────┘
```

**分层铁律（写进 Spec 验收）**

1. **L2 必须是纯函数**：`reduce(state, event) → {state, emitted[]}`。禁止 `Date.now()`、禁止 `Math.random()`（随机源改为**种子化 PRNG**，种子存进 state），禁止任何 DOM/React import。这条保证仿真**可重放、可单测、跨设备结果一致**。
2. **L4 只读不写**：渲染层永远不修改 state，只读快照 + alpha 插值。
3. **L5 不直接调 L2**：UI 只发 Intent 给 L3，L3 决定何时推进 L2。避免 React 事件里直接跑仿真逻辑。
4. **文件规模**：按 `code-organization` 规范，单文件 ≤300 行。预估落位：
   `features/simulator/model/*.ts`(5×~80) · `engine/reduce.ts`(~280) · `engine/faults.ts`(~120) · `engine/ledger.ts`(~150) · `runtime/SimEngine.ts`(~220) · `render/{stage,nodes,edges,wo,palette}.ts`(5×~120) · `ui/*.tsx`(6×~150)。**没有任何一个文件接近 300 行**，无需拆包妥协。

### 4.2 工单状态机（核心）

```
                        ┌──────────┐
                        │ CREATED  │
                        └────┬─────┘
                 release_tick到达 │
                        ┌────▼─────┐
                        │ RELEASED │
                        └────┬─────┘
                进入首工序队列 │
    ┌───────────────────┌────▼─────┐  料不足   ┌────────────────────┐
    │                   │  QUEUED  ├──────────►│ BLOCKED_MATERIAL   │
    │                   │(工序前排队)│◄──────────┤  告警 E-MAT-SHORT   │
    │                   └────┬─────┘   补料到位 └────────────────────┘
    │        占用工位(capacity)│
    │              ┌─────────▼────────┐  设备故障  ┌────────────────────┐
    │              │   IN_PROCESS     ├───────────►│ BLOCKED_EQUIPMENT  │
    │              │ (std_minutes 计时)│◄───────────┤  告警 E-EQP-DOWN    │
    │              └───┬──────────┬───┘   修复完成  └────────────────────┘
    │        质检通过    │          │ 质检不合格
    │                   │     ┌────▼──────┐  on_fail=scrap   ┌───────────┐
    │                   │     │ QC_FAILED ├─────────────────►│ SCRAPPED  │终
    │                   │     │告警E-QC-NG│  on_fail=hold    ├───────────┤
    │                   │     └────┬──────┘─────────────────►│   HELD    │
    │                   │          │ on_fail=rework          └─────┬─────┘
    └───────────────────┴──────────┘                     人工放行   │
              （回本工序 QUEUED，rework_count+1，超 3 次强制 SCRAPPED）│
                        ┌──────────────┐                            │
                        │OPERATION_DONE│◄───────────────────────────┘
                        └─┬──────────┬─┘
                  有下工序  │          │ 无下工序
                   ┌──────▼─────┐  ┌──▼─────────┐
                   │ IN_TRANSIT │  │ COMPLETED  │终
                   └──────┬─────┘  └────────────┘
                          └────► QUEUED(next op)

任意非终态 ──用户 RESET──► （状态机整体重置，非工单级转移）
```

**关键不变量（invariant，单测断言项）**

- `Σ(COMPLETED + SCRAPPED + 在制) == Σ(工单计划数)` —— 工单守恒，任何时刻成立。
- `Σ(已发料) - Σ(已消耗) - Σ(在制占用) == 当前库存` —— 物料守恒。
- 任一工序 `IN_PROCESS` 工单数 `≤ capacity`。
- `rework_count ≤ 3`（防返工死循环，这是真实 MES 里也存在的兜底规则，顺带是个教学点）。

### 4.3 资源（工序）状态机

```
        有排队 & 料齐 & 有空位
IDLE ─────────────────────────► BUSY ──全部完工──► IDLE
  │                              │
  │ 有排队 但缺料                  │ 故障注入 / 手动停机
  ▼                              ▼
STARVED ───补料───► BUSY        DOWN ───修复(repair_ticks)───► IDLE
```

**状态 → design-token 直连映射（零新增 token）**

| 资源状态 | token | 语义 |
|---|---|---|
| `BUSY` | `--status-running` (= `--success`) | 运行中 |
| `IDLE` | `--status-idle` (= `--meta`) | 空闲 |
| `STARVED` | `--status-stopped` (= `--warn`) | 待料停机 |
| `DOWN` | `--status-fault` (= `--danger`) | 故障 |

`design-tokens.css:260-263` 已备好这四个。**缺料 / 质检不合格的"即时标红"，走 `--status-fault` / `--danger` 系（`--danger-soft` 做块底、`--danger-border` 做描边、`--danger` 做文字与脉冲），全链路零硬编码色值。**

### 4.4 异常注入：复用 `fault_scenarios` / `block_solutions`（零 DDL 变更）

现有表结构完全够用，只需约定 `variant` 值与 `solution_json` schema：

- `fault_scenarios.variant = 'sim'`（现有值 `factory` / `blocks` 不受影响）
- `fault_scenarios.prompt` = 题面（"这条路线跑起来会卡在哪？为什么？"）
- `fault_scenarios.solution_json` = `{ scenarioSlug, inject[], expect{} }`

```jsonc
{
  "scenarioSlug": "discrete-basic",
  // ── inject：下发给前端，驱动异常发生 ──
  "inject": [
    { "at": { "type": "tick", "value": 30 },
      "fault": { "kind": "material_shortage", "materialCode": "M-1002", "setStock": 0 } },
    { "at": { "type": "operation_enter", "opCode": "OP-40", "nth": 2 },
      "fault": { "kind": "qc_fail", "rate": 10000, "reason": "尺寸超差" } },
    { "at": { "type": "tick", "value": 80 },
      "fault": { "kind": "equipment_down", "opCode": "OP-20", "repairTicks": 25 } }
  ],
  // ── expect：服务端保留，API 永不下发（同 sql_exercises.answer_sql 的 R6 处置） ──
  "expect": {
    "mustBlockAt": ["OP-20"],
    "mustRaiseCodes": ["E-MAT-SHORT", "E-QC-NG"],
    "maxCompleted": 0
  }
}
```

`inject.at.type` 三种触发器：`tick`（时间点）/ `operation_enter`（第 n 个工单进入某工序）/ `wo_state`（工单进入某状态）。三种覆盖了缺料、质检不合格、设备故障三类教学场景，**不做通用规则引擎**——那是典型的过度设计。

`block_solutions(scenario_id, solution_id, rule_json)` 承载**多解容错**：同一个"OP-20 缺料卡死"，学员可以①补料 ②改路线绕过 ③加缓冲区，三种都算解决。每种一行 `rule_json`，判定时任一命中即通过。这正是该表原始设计意图（注释写的就是"积木容错规则"），**无缝复用，一行 DDL 不用改**。

### 4.5 前端 / 后端职责边界

| 职责 | 端 | 依据 |
|------|----|------|
| 场景素材下发 | **后端** | 只读共享、需版本化；L2 缓存后 0 次 D1 读 |
| 故障 `inject` 下发 | **后端** | 同上 |
| 故障 `expect`（答案） | **后端保留，永不下发** | 对齐 `sql_exercises.answer_sql` 的 R6 防泄露处置（`content.service.ts` DTO 白名单模式） |
| **仿真 tick 推进** | **前端** | Workers 免费版 **10 ms CPU/次调用**；一次 500 tick 的仿真远超预算，且会把 D1 单线程队列拖垮 |
| 异常触发与标红可视化 | **前端** | 需 60fps 即时反馈，任何网络往返都不可接受 |
| "学员是否解决了故障"判定 | **前端算，后端只收摘要** | 与已落地的 ADR-005（SQL 判题走客户端 hash 比对）保持同构，架构一致性 |
| 结果落库 | **后端** | 走现有 `progress_events` + `stats_daily` 链路 |

**关于"前端判题能否被绕过"**：能。这是学习平台不是考试系统，采用**诚实客户端 + 结果摘要**模型，与 ADR-005 已确立的立场一致。后端只做**合理性校验**（`scenarioSlug` 存在、`ticks > 0`、`elapsedMs ≥ ticks × 最小可能耗时`、`anon_id` 限流），**不做服务端重放**。要做防作弊就得把仿真搬到后端——那会直接撞穿 10ms CPU 预算，代价与收益完全不成比例。**此事已决，实现阶段不再讨论。**

---

## 5. 路由级懒加载方案

### 5.1 问题与目标

仿真引擎（引擎 + 渲染 + UI + 场景夹具）预估 gzip 后 60–90 KB，加上已在首屏被静态引入的 `sql.js`（1.13.0，wasm loader + glue，本身就是大头），当前 `App.tsx` 把 **12 个页面全部静态 import**，所有代码都进 entry chunk。

**可测目标**（不是"感觉快"）：
- G1：首屏 entry chunk（gzip）在本次改动后**不增加超过 5 KB**。
- G2：访问 `/` 时，network 面板中**不出现** `sim-*.js` 与 `sqljs-*.js`。
- G3：`/simulator` 首次进入到画布可交互 ≤ 1.5 s（Fast 3G 节流下 ≤ 4 s）。
- 证据：`vite build` 输出的 chunk 体积表，改动前后各存一份，进 PR 描述。

### 5.2 具体落点

**新增路由**

| 路径 | 页面 | 懒加载 |
|---|---|---|
| `/simulator` | `SimulatorHomePage`（场景卡片列表） | 是（轻，但与画布同域，一起拆） |
| `/simulator/:scenarioSlug` | `SimulatorPage`（画布主体） | **是（重点）** |

**顺带拆掉的既有重页面**（同一次改动完成，避免二次返工）：`SqlSpacePage`、`ExercisePage`（拖 sql.js）、`AdminPage`（后台，普通学员永不访问）、`QuizPage`。
**保持静态**：`HomePage`、`CoursesPage`、`CourseDetailPage`、`ChapterPage`、`LoginPage`、`NotFoundPage`、`LearningPathsPage` —— 这些是首屏主链路，拆了反而多一次往返。

**Suspense 落点（关键，容易做错）**

```
<CrumbProvider>
  <AppShell>                       ← 侧栏/顶栏保持静态，切页时不闪
    <RouteErrorBoundary>           ← 【必须】捕获 chunk 加载失败
      <Suspense fallback={<StateBlock kind="loading" />}>   ← 只覆盖内容区
        <Routes> … </Routes>
      </Suspense>
    </RouteErrorBoundary>
  </AppShell>
</CrumbProvider>
```

- **不要**把 `Suspense` 放在 `AppShell` 外层——那样每次懒加载都会把整个骨架（含侧边栏）替换成 loading，视觉抖动严重。
- **不要**给每个 `<Route>` 各包一个 `Suspense`——重复代码，且 fallback 不统一。
- `fallback` 复用现有 `StateBlock` 的 loading 态，与全站空/错/载兜底同一套视觉。

**`RouteErrorBoundary` 是必需项，不是加分项**

`React.lazy` 的 chunk 请求会失败——用户网络抖动、或者你刚部署完新版本导致旧 hash 的 chunk 404（这是 SPA 的经典生产事故）。没有 ErrorBoundary 就是**整页白屏**。当前代码库中未见任何 ErrorBoundary，属现存缺口。

行为要求：
- 捕获到 `ChunkLoadError` / 动态 import 失败 → 渲染 `StateBlock kind="error"` + 「重新加载」按钮（`Icon name="reset"`）。
- 按钮行为：先 `location.reload()`（拉取新版 `index.html` 与新 hash）。
- 兜底文案带 traceId 位（与 `ApiError` 报障口径一致）。

**预加载（prefetch）**

把 lazy factory 提成具名常量，在用户"表现出意图"时预热：

```
const loadSimulator = () => import('./pages/SimulatorPage');
const SimulatorPage = lazy(loadSimulator);
// 场景卡片：onPointerEnter / onFocus 时调用 loadSimulator()
```

`React.lazy` 内部对同一 factory 做了去重，重复调用无副作用。鼠标从卡片移到点击平均有 200–400ms，足够把 chunk 拉完，主观上"秒开"。**注意也要绑 `onFocus`**，否则键盘用户拿不到这个优化。

**Vite 分包**

默认动态 import 就会自动切 chunk，**大部分情况不需要 `manualChunks`**。但这里有两个需要显式隔离的点，否则 Rollup 的公共块提升会把它们拽回 entry：

- `sql.js` 及其 wasm glue → 独立 `sqljs` chunk。
- `features/simulator/**` → 独立 `sim` chunk（引擎与渲染层被两个页面共享，容易被提升）。

用函数式 `build.rollupOptions.output.manualChunks(id)` 按路径归组即可，**不要**用对象式写法（对象式在依赖变动时容易产生循环 chunk 引用）。

### 5.3 关于 TanStack Router

路线图 §3.1 记录了"spec 写 TanStack Router，现状 react-router-dom 7"这个待拍板项。**我的裁决：v1 不迁移。**

- 懒加载是 **React 的能力**（`React.lazy` / `Suspense`），不是路由库的能力。换库对本次目标零增益。
- TanStack Router 的核心价值是**类型安全的路径与参数**。同样的收益，用一个 30 行的路径常量表 + 类型化 builder 就能拿到 80%：

  ```
  export const R = {
    simulator: () => '/simulator',
    simulatorScenario: (slug: string) => `/simulator/${encodeURIComponent(slug)}`,
  } as const;
  ```

  全站 `<Link to={R.simulatorScenario(s.slug)}>`，改路径只改一处，拼错编译期就红。**零迁移成本，零新依赖。**
- 迁移代价：12 个路由文件重写 + codegen 接入 CI + 团队学习成本，在 MVP 阶段是明确的负收益。
- 保留退路：若 P2 出现深度嵌套路由 + 复杂 search params 校验需求，届时再评估——**不是不能迁，是现在迁不划算**。

---

## 6. 新增 API 端点清单

### 6.1 总览

全部沿用统一响应包络 `{ code, data, msg, traceId }`（`worker/src/core/response.ts`），路径全部带 `/api/v1` 前缀，中间件走 `router.ts` 既有默认管线。

| # | Method | Path | 认证 | 管线 | 缓存 | 限流 |
|---|--------|------|------|------|------|------|
| 1 | GET | `/api/v1/sim/scenarios` | 公开 | default | **L2 300s**，键 `cv{n}:sim/scenarios` | 无 |
| 2 | GET | `/api/v1/sim/scenarios/:slug` | 公开 | default | **L2 300s**，键 `cv{n}:sim/scenario/{slug}` | 无 |
| 3 | GET | `/api/v1/sim/scenarios/:slug/faults` | 公开 | default | **L2 300s**，键 `cv{n}:sim/faults/{slug}` | 无 |
| 4 | POST | `/api/v1/sim/runs` | 匿名(anon_id) | default + `ratelimit` | no-store | **20 桶 / 0.1 refill**（≈6 次/分） |
| 5 | GET | `/api/v1/sim/runs` | 匿名(anon_id) | default | no-store | 无 |
| 6 | GET | `/api/v1/admin/sim/scenarios` | admin | admin | no-store | 无 |
| 7 | POST | `/api/v1/admin/sim/scenarios` | admin | admin | no-store | 无 |
| 8 | GET | `/api/v1/admin/sim/scenarios/:id` | admin | admin | no-store | 无 |
| 9 | PUT | `/api/v1/admin/sim/scenarios/:id` | admin | admin | no-store | 无 |
| 10 | DELETE | `/api/v1/admin/sim/scenarios/:id` | admin | admin | no-store | 无 |
| 11 | POST | `/api/v1/admin/sim/scenarios/:id/publish` | admin | admin | **bump content_version** | 无 |
| 12 | POST | `/api/v1/admin/import/obsidian/preview` | admin | admin + `ratelimit` | no-store | 10 桶 / 0.05 |
| 13 | POST | `/api/v1/admin/import/obsidian/commit` | admin | admin + `ratelimit` | no-store | **60 桶 / 0.5**（分片高频） |
| 14 | POST | `/api/v1/admin/import/obsidian/finalize` | admin | admin | **bump content_version** | 3 桶 / 0.02 |

完整 request/response JSON Schema 见 sidecar：**`docs/api/openapi-simulator.yaml`**（OpenAPI 3.0.3，可直接并入 `docs/api/openapi.yaml`）。

### 6.2 关键设计说明

**① 场景详情"一次拿全"**
`GET /sim/scenarios/:slug` 一次返回 `scenario + operations[] + bomItems[] + workOrders[] + referenceRouteMeta`。
SQL 语句数：1(scenario) + 1(ops) + 1(bom) + 1(wo) + 1(route meta) = **5 条**，远低于 `DbSession` 的 40 条护栏。避免前端 5 次往返吃 Workers 请求额度。
命中 L2 缓存后 **0 条 SQL、0 行读**——与 `content.service.ts` 的 `getTopicSvc` 完全同构。

**② 参考答案不出网**
`sim_process_routes.is_reference = 1` 的记录，DTO 里**只下发 `{code, name, nodeCount}` 元信息，不下发 `graph_json`**。
`fault_scenarios.solution_json` 只下发 `inject`，**`expect` 字段在服务端剥离**。
两者都严格遵循 `content.service.ts` 已确立的**显式字段白名单构造**模式——禁止 `SELECT *` 后直接 `JSON.stringify`。这条在 CR 时必须逐字段核对。

**③ `POST /sim/runs` 的限流参数怎么定的**
一次有意义的仿真最快也要十几秒（学员要看动画）。桶容量 20 允许"反复试错"的突发（这正是产品要鼓励的行为），稳态 `0.1/s = 6 次/分钟` 足以挡住脚本刷量。
key 用 `sim:run:{anonId}`，走现有 `ratelimit()` 工厂，不新写限流逻辑。

**④ `POST /sim/runs` 的写入量**
只写 `progress_events` 1 行（`INSERT OR IGNORE`，`event_id` 由 `anon_id/sim_run/scenarioSlug/自然日` 组合，天然幂等）+ `stats_daily` UPSERT 1 行 = **2 行写/次**。
即便 100 人 × 20 次/天 = 2,000 次 = **4,000 行写**，占 100,000 日额度的 **4%**。安全。

**⑤ 新增错误码（沿用 `errors.ts` 分区）**

| code | HTTP | publicMsg | 触发 |
|---|---|---|---|
| 4003 | 404 | 场景不存在或尚未发布 | slug 无匹配 / status=draft |
| 4004 | 400 | 工艺路线校验未通过 | 成环 / 断链 / 空路线 / 孤立节点 |
| 4005 | 400 | 导入文件解析失败 | frontmatter 非法、必填字段缺失 |
| 4006 | 400 | 导入批次不存在或已过期 | importId 未知 / 超 30 分钟 |

沿用 `AppError` 体系，`publicMsg` 固定文案，原始错误只进结构化日志——**绝不把 D1 原始报错回传前端**（会泄露表名列名）。

**⑥ CORS / 静态资源**
`index.ts` 已对非 `/api/` 前缀走 `env.ASSETS.fetch`，`not_found_handling = "single-page-application"` 已配置。新增的 `/simulator/*` 深链会自动回退 `index.html`，**wrangler.toml 无需改动**。

---

## 7. Obsidian 导入方案

### 7.1 前端解析 vs 后端解析：推荐**前端解析 + 后端幂等写入**

| 维度 | 前端解析（推荐） | 后端解析 |
|---|---|---|
| CPU 预算 | 浏览器，无限制 | **Workers 10ms/次**，解析 200 篇 YAML 必超预算 |
| 传输体积 | 只传结构化 JSON，可分片 | 需上传原始文件，**单请求 body 上限 256KB**，一个 vault 轻松超 |
| dry-run 预览 | **天然即时**，用户写库前就能看到 diff | 需多一次往返 + staging 存储 |
| 隐私 | vault 里的无关笔记**根本不出网**（白名单过滤后才传） | 全量文件上云 |
| 判定 | **选中** | 落选 |

后端只负责三件事：**幂等 upsert · 服务端二次校验 · 事务边界**。这是正确的职责划分——解析是纯计算（放算力充裕的一端），写入是共享状态变更（必须放服务端）。

### 7.2 文件选择：主路径与增强路径

- **主路径（必须实现）**：`<input type="file" webkitdirectory multiple accept=".md">`
  非标准属性但主流浏览器均已实现，`File.webkitRelativePath` 给出 vault 内相对路径，用来还原目录结构。
- **增强路径（可选，仅 Chromium）**：`showDirectoryPicker()`
  MDN 明确标注 **"Limited availability，不是 Baseline，在部分最广泛使用的浏览器中不工作"**，Firefox / Safari 不支持。
  因此**只能做渐进增强**（保存 `FileSystemDirectoryHandle` 到 IndexedDB，实现"一键重新同步"），**绝不能作为主路径**。特性检测：`if ('showDirectoryPicker' in window)`。

### 7.3 frontmatter 字段映射表

| frontmatter key | 目标字段 | 规则 / 缺省 |
|---|---|---|
| `mes-type` | 路由判定 | `topic` \| `chapter`。缺省推断：`<dir>/_index.md` 或 `<dir>/<同名>.md` → topic，其余 → chapter |
| `title` | `topics.title` / `chapters.title` | 缺省取正文首个 H1；再缺省取文件名（去 `.md`） |
| `slug` | `topics.slug` | 缺省 = title kebab 化；**中文标题**无法 kebab → 回退 `t-{sha1(path).slice(0,8)}`，并在 dry-run 报告中**高亮提示手工指定** |
| `description` / `summary` | `topics.description` | 取先出现者，截断 200 字 |
| `modules` | `topics.modules` (JSON) | 白名单过滤 `theory\|sql\|quiz\|sim`，非白名单值丢弃并计入报告 |
| `topic` | `chapters.topic_id` | 值为 topic 的 **slug**；two-pass 解析成 id；解析不到 → 该文件报错（4005），不静默跳过 |
| `order` / `sort` | `sort` | 整数。缺省用文件名数字前缀（`01-xxx.md` → 10）；再缺省按字母序 `index × 10` |
| `status` / `publish` | `status` | `publish: false` → `draft`；**缺省一律 `draft`** |
| `tags` | `tags` + `topic_tags` | 字符串数组，逐个 upsert 到现有 `tags` 表 |
| `updated` | `updated_at` | 缺省用 `File.lastModified` |
| `aliases` / `cssclasses` / Obsidian 内建键 | — | 忽略（不报错，计入"已忽略字段"统计） |
| 正文（剥离 frontmatter 后） | `chapters.md_text` | 见 §7.5 语法转换 |

**安全默认：导入永远不自动发布。** 所有新建内容 `status='draft'`，需在后台显式发布。这条防的是"手滑把私人笔记同步上线"——在个人 vault 场景下这是极高概率事件。

### 7.4 frontmatter 解析器选型

| 方案 | 体积(gz) | 判定 |
|---|---|---|
| `gray-matter` | ~10 KB，依赖 `js-yaml`，Node 取向（用 `Buffer`），带 TOML/CoffeeScript 等无用格式 | 落选 |
| `gray-matter-es` | ESM/浏览器兼容，零运行时依赖（内联 `@std/yaml`） | 次选（若下方风险不可接受，切它） |
| **手写受限解析器** | **~0 KB** | **选中** |

手写解析器只支持 Obsidian frontmatter 的实际子集：`--- ... ---` 分隔、`key: 标量`、`key: [a, b]` 行内数组、`key:\n  - a\n  - b` 块数组、布尔 / 整数 / 引号字符串。约 90 行。

**风险控制（这是选它的前提）**：遇到不支持的 YAML 构造（嵌套 map、多行标量 `|` / `>`、锚点 `&`/`*`）**立即抛错并在 dry-run 报告中逐文件列出**，绝不"尽力猜测"后静默写入错误数据。因为导入流程**强制经过 dry-run 预览**，解析失败会在写库前被人眼看到——这个安全网让"受限解析器"从赌博变成可控取舍。

若实施阶段发现真实 vault 中不支持构造占比 > 5%，**直接切 `gray-matter-es`，不要在手写解析器上加功能**——这是给实现团队的明确逃生门（写进 ADR-011）。

### 7.5 Obsidian 特有语法转换（最容易漏，漏了就是满屏坏链）

| 语法 | 处置 |
|---|---|
| `[[Wiki Link]]` / `[[Link\|别名]]` | 转成 `[别名](#/wiki/<target-slug>)`。**不在导入时解析成真实 id**——改用 `markdown.ts` 增加一条渲染期 renderer rule，把 `#/wiki/<slug>` 解析成实际路由。这样重命名/重排序不会烂链。**运行时解析优于导入时固化。** |
| `![[image.png]]` 附件嵌入 | 首期**不支持二进制资源**（D1 不适合存图，R2 未启用）。替换为一个 `--warn` 系提示占位块，并在 dry-run 报告"已跳过的附件"里逐个列出。**绝不静默丢弃**——静默丢内容是最坏的导入行为。 |
| Callout `> [!note]` | markdown-it 默认渲染成普通引用块，v1 可接受。P1 加 renderer rule 映射成 design-token 卡片。 |
| `%%comment%%` | **剥离**。Obsidian 注释语义上就是"不发布的内容"。 |
| Dataview / Templater 代码块 | 原样保留为代码块，**不执行、不求值**。 |
| `#标签` 行内 | 保留原文（不转链接），仅 frontmatter 的 `tags` 进 `tags` 表。避免正文里的 `#` 标题被误判。 |

**安全**：`md_text` 全程按不可信输入处理。现有 `web/src/lib/markdown.ts` 已做 `markdown-it{html:false}` + DOMPurify 双保险。**导入不得以任何理由放宽该白名单。**

### 7.6 写入接口：三阶段，复用 `import_chunks`

**不复用** `POST /api/v1/admin/chapters`（一篇一请求）：200 篇 = 200 请求，吃额度且无事务性、无原子回滚。

**复用现有 `import_chunks` 两阶段机制并扩展为三阶段：**

```
① POST /admin/import/obsidian/preview
   body: { files: [{ path, frontmatter, bodyBytes, bodyHash }] }   ← 只传元数据，不传正文
   ↓ 服务端比对 (topics.slug / chapters.source_path) 现状
   resp: { importId, summary:{create,update,skip,error}, items:[{path, action, reason, targetId}] }
   ★ 不写任何库

② POST /admin/import/obsidian/commit   （分片，可并发上限 1）
   body: { importId, chunkIndex, items:[{ path, kind, fields…, md }] }
   约束：每片 ≤ 15 篇 且 ≤ 200 KB
   ↓ 服务端 db.batch() 单批提交 + 记 import_chunks
   resp: { ok, chunkIndex, rows }

③ POST /admin/import/obsidian/finalize
   body: { importId, expectedChunks }
   ↓ 校验分片齐全 → bump platform_config.content_version → 汇总
   resp: { ok, chunks, topics, chapters, contentVersion }
```

**为什么每片硬上限 15 篇**：`DbSession.MAX_STMT_PER_REQUEST = 40`。每篇最多 2 条语句（upsert 主表 + upsert tag 关联），15 × 2 = 30，留 10 条余量给 `import_chunks` 记录与前置查询。**20 篇会正好顶到 40 触发 5002，必须留余量。**

**为什么 `content_version` 只在 finalize 时 bump**：若每片都 bump，导入过程中 L2 缓存会反复换键失效，学员会看到"一半新一半旧"的内容。**一次性换键，导入过程对读者完全透明。** 这是复用现有 `contentCacheKey(path, cv)` 机制的正确姿势。

**D1 写额度核算**：200 篇 × (1 主表行 + 1 索引行) ≈ **400 行写**。免费额度 100,000/天 → **可全量导入 250 次/天**。完全够，且这是极端上限（真实使用是增量导入几篇）。

### 7.7 幂等性：`chapters` 表 DDL 增量（**唯一硬阻断项**）

当前 `chapters` 表没有任何可用于"同一个 md 文件"的稳定标识。**重复导入会产生重复章节。** 必须先做增量：

```sql
ALTER TABLE topics   ADD COLUMN source_path TEXT NOT NULL DEFAULT '';
ALTER TABLE chapters ADD COLUMN source_path TEXT NOT NULL DEFAULT '';

-- 部分唯一索引：只约束"来自导入"的记录，手工创建的（source_path='') 不受影响
CREATE UNIQUE INDEX IF NOT EXISTS uq_chapters_source
  ON chapters(topic_id, source_path) WHERE source_path <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_source
  ON topics(source_path) WHERE source_path <> '';
```

D1 基于 SQLite，**支持带 `WHERE` 的部分唯一索引**——这正好解决"导入内容要唯一、手工内容不受限"的双重需求，比加一个 `source` 枚举列再做应用层校验干净得多。

`ALTER TABLE ADD COLUMN` 带 `DEFAULT` 在 SQLite 中是 O(1) 元数据操作，不重写表，对现有数据零风险。

**幂等键**：topic 用 `source_path`（回退 `slug`）；chapter 用 `(topic_id, source_path)`。upsert 语义：`INSERT … ON CONFLICT(...) DO UPDATE SET …`。

---

## 8. 目录结构与文件组织约束

```
web/src/features/simulator/          ← 全部懒加载，不被首屏 import
├── model/            # L1 纯数据类型 + 构造/校验（无逻辑副作用）
│   ├── route-graph.ts        # RouteGraph, addNode, link, detectCycle
│   ├── operation.ts  operation 类型与工厂
│   ├── work-order.ts bom.ts  ledger.ts
├── engine/           # L2 纯函数状态机（零 DOM / 零 React / 零 Date.now / 零 Math.random）
│   ├── reduce.ts             # reduce(state, event) → {state, emitted[]}
│   ├── wo-machine.ts         # 工单状态转移表
│   ├── resource-machine.ts   # 工序资源状态转移
│   ├── faults.ts             # inject 触发器求值
│   ├── ledger.ts             # 物料发料/回冲/缺料判定
│   └── prng.ts               # 种子化 PRNG（保证可重放）
├── runtime/          # L3 副作用宿主
│   ├── SimEngine.ts          # rAF loop / accumulator / speed / undo-redo
│   └── draft-storage.ts      # localStorage 草稿（防抖 1s）
├── render/           # L4 Canvas 绘制（只读 state）
│   ├── palette.ts            # ★ 唯一读 design-token 的地方，其余文件禁止出现色值
│   ├── stage.ts  nodes.ts  edges.ts  work-orders.ts  overlay.ts
├── ui/               # L5 React DOM
│   ├── Toolbox.tsx  Inspector.tsx  RunBar.tsx
│   ├── AlarmPanel.tsx  A11yMirror.tsx  ResultSheet.tsx
├── api.ts            # 场景数据拉取（走 web/src/api/client.ts）
└── types.ts

web/src/features/obsidian-import/
├── parse/
│   ├── frontmatter.ts        # 受限 YAML 解析器（快速失败）
│   ├── wikilink.ts           # [[…]] → #/wiki/<slug>
│   └── classify.ts           # topic/chapter 判定 + 缺省推断
├── plan.ts                   # 生成 dry-run 计划（纯函数，可单测）
├── ui/ImportWizard.tsx  DiffTable.tsx  ErrorList.tsx
└── api.ts                    # preview / commit 分片 / finalize

worker/src/modules/simulator/     sim.routes.ts  sim.service.ts
worker/src/modules/obsidian/      obsidian.routes.ts  obsidian.service.ts
worker/src/data/repositories/     sim.repo.ts  obsidian.repo.ts
```

**硬规则（CR 驳回项）**
1. 单文件 **≤ 300 行**。
2. **依赖方向单向**：`ui → runtime → engine → model`。`engine/**` 与 `model/**` **禁止** import React / DOM / canvas / `../ui`。用 ESLint `no-restricted-imports` 固化，不靠人工纪律。
3. `render/palette.ts` 是**唯一**读 design-token 的文件；`features/simulator/**` 其余文件 grep 不到色值字面量。
4. 页面**不直接** import lucide，一律走 `components/Icon.tsx` 语义名。
5. 后端按资源分包，路由只做参数解析 + 调 service，service 不碰 `Request`/`Response`——与现有 `content` / `admin` 模块保持同构。

---

## 9. P0 铁律合规自检

| 铁律 | 落实点 | 验收命令 |
|------|--------|----------|
| 禁 emoji 当功能图标 | canvas 用形状编码，DOM 用 `Icon.tsx` 语义名；本方案**零新增 lucide 图标**（所需 9 个语义名 REGISTRY 中已全有） | `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src` 必须无匹配 |
| 锁定单一 SVG 图标库 | 沿用 ADR-002 的 `lucide-react@1.28.0`，不加第二个库 | `grep -rn "react-icons\|@tabler/icons\|heroicons" web/` 必须无匹配 |
| 禁紫→粉渐变 | 全部配色取自既有 token（`--accent` 蓝系 / `--success` / `--warn` / `--danger`），无渐变方案 | `grep -rn "linear-gradient\|radial-gradient" web/src/features/` 人工核验 |
| 禁硬编码颜色 | canvas 侧 `palette.ts` 单点读 token；CSS 侧全 `var(--token)` | `grep -rnE "#[0-9a-fA-F]{3,8}\b\|rgba?\(\|hsla?\(" web/src/features/` 必须无匹配 |
| 禁 AI 模板味文案 | 错误码 `publicMsg` 沿用现有 `errors.ts` 固定文案风格（"缺料停机：M-1002 库存为 0，OP-20 已阻塞 12 分钟"，不写"哎呀出错了~"） | 文案评审 |

---

## 10. 风险与缓解

| # | 风险 | 概率 | 影响 | 缓解 |
|---|------|:----:|:----:|------|
| R1 | 受限 frontmatter 解析器在真实 vault 中覆盖不足 | 中 | 中 | 强制 dry-run + 快速失败；覆盖率 <95% 则切 `gray-matter-es`（逃生门已写进 ADR-011） |
| R2 | 仿真 chunk 超预算（>120 KB gz），懒加载后首次进入仍慢 | 中 | 中 | 场景夹具数据走 API 不进 bundle；hover 预热；G3 指标进 CI 门禁 |
| R3 | canvas 交互在触摸设备上手感差（拖拽与页面滚动冲突） | 中 | 中 | canvas 容器 `touch-action: none`；端口命中半径 12px；提供"点击选中→点击目标"的非拖拽备选路径 |
| R4 | 部署换 hash 导致老页面 lazy chunk 404 白屏 | **高** | **高** | `RouteErrorBoundary` 为必需项（§5.2），非可选 |
| R5 | 学员在 canvas 上完全无法用键盘操作（a11y 归零） | 中 | 中 | `A11yMirror` 视觉隐藏列表 + 方向键移动，为必需项非加分项 |
| R6 | 参考答案 / `expect` 经 API 泄露 | 低 | **高** | DTO 显式白名单构造（沿用 `content.service.ts` 模式）；CR 逐字段核对；`grep -n "SELECT \*" worker/src/modules/simulator/` 必须无匹配 |
| R7 | Obsidian 导入把私人笔记同步上线 | 中 | **高** | 缺省 `status='draft'`，永不自动发布；dry-run 列出全部待写文件 |
| R8 | 浮点导致跨设备仿真结果不一致 | 中 | 中 | 全整数定点（万分比/×1000）+ 种子化 PRNG（§3.3 / §4.1） |

---

## 11. ADR 列表

| 编号 | 标题 | 状态 |
|------|------|------|
| ADR-006 | 工艺路线搭建器采用原生 Canvas 2D + DOM 叠加，零新增运行时依赖 | Proposed |
| ADR-007 | 仿真 v1 数据落库边界：素材落库、画布不落库、结果走 progress_events | Proposed |
| ADR-008 | 仿真引擎全部运行在前端；异常注入复用 fault_scenarios / block_solutions | Proposed |
| ADR-009 | 路由级懒加载：React.lazy + Suspense + 强制 chunk-load ErrorBoundary | Proposed |
| ADR-010 | 不迁移 TanStack Router，保留 react-router-dom 7 + 类型化路径常量表 | Proposed |
| ADR-011 | Obsidian 导入：前端解析 + 后端幂等三阶段写入；手写受限 frontmatter 解析器 | Proposed |

（已有 ADR-001 ~ ADR-005 不受影响；ADR-002 图标铁律、ADR-005 客户端判题立场在本方案中被继承与延伸。）

---

## 12. 交付物清单

| 文件 | 说明 |
|------|------|
| `docs/architecture/tech-spec-simulator-v1.md` | 本文档 |
| `docs/architecture/schema-increment-simulator.sql` | D1 增量 SQL（设计稿，评审后落 `worker/src/migrations/`） |
| `docs/api/openapi-simulator.yaml` | OpenAPI 3.0.3 契约 sidecar（14 端点） |
| `docs/decisions/ADR-006` ~ `ADR-011` | 六条架构决策记录 |

## 13. Phase 2 放行前置条件

1. `openapi-simulator.yaml` 经 Team Lead 评审并并入 `docs/api/openapi.yaml`（**无 openapi 不放行**）。
2. `chapters` / `topics` 的 `source_path` DDL 增量已确认（唯一硬阻断项）。
3. 设计师产出画布交互稿（工序块视觉规格 / 状态色应用 / 错误呈现），确认全部走既有 token。
4. PM 确认首期通用离散制造示例数据的具体内容（工序清单 / BOM / 工单）。
</content>
</invoke>
