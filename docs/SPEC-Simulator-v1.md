# Spec — 工艺路线搭建器 · 知识体系重构 · 视觉升级 v3

> 生成日期：2026-08-02
> 基于：`PRD-RouteBuilder-v1.md` + `tech-spec-simulator-v1.md` + `routing-builder.md` / `obsidian-import.md` + `PRD-KnowledgeRestructure-v1.md` + `VISUAL-UPGRADE-v3.md`
> 状态：**已确认**（用户 2026-08-02 回执「确认，开始推进 Spec 阶段，以上补充约束全部纳入规范文档」）
> 性质：**团队内部契约**。Spec 一旦锁定，开发以本文件为唯一依据；不在此列的功能一律不做。

---

## 1. 产品定义

- **一句话描述**：一个拒绝纯文字阅读的 MES 学习平台——用户拖拽搭建工艺路线、运行仿真、被业务规则当场拦下并读懂为什么。
- **目标用户**：从设备/信息化岗转 MES 实施工程师的求职者（首位用户：有奥来 KBO 漏电断路器产线信息化专员经历，用过 ERP 做数据采集与生产大屏）。
- **核心问题**：MES 概念（工单/BOM/齐套/报工/质检/返工）看文档记不住，因为没有任何一处能动手验证「我理解得对不对」。
- **本期核心命题**（用户原话）：**动手搭建 → 可视化运行 → 即时反馈 → 理解业务**。

---

## 2. MVP 范围（锁定）

三条工作流**真并行**，改动文件不重叠。

### 2.1 A 线 · 工艺路线搭建器（战略投入，不参与 RICE 排序）

| 优先级 | 编号 | 功能 | 验收标准摘要 | RICE |
|---|---|---|---|---|
| P0 | F6 | 通用离散示例数据集 | 五工序 + 3 物料 + 1 张 1000 件工单，数据落 D1 | 12.00 |
| P0 | F1 | 工序块面板（数据驱动） | 块类型由后端下发，前端零硬编码工序名 | 12.00 |
| P0 | F2 | 画布拖拽与连线 | 拖块入画布、连线成链、R6 成环校验在松手前拒绝 | 9.00 |
| P0 | F3 | 工序属性面板 | 工序名/标准工时/质检开关；首道工序含 BOM 槽位 | 8.00 |
| P0 | F5 | 异常注入与业务解释 | 缺料/质检不合格触发时工序块标红 + 业务解释卡 | 8.00 |
| P0 | F4 | 运行仿真与流转动画 | 工单卡片逐工序推进，单步/连续/暂停/重置 | 6.75 |
| P0 | F8 | 方案保存与重置 | localStorage 保存 + 重置为关卡初始态 | 6.00 |
| P0 | F7 | 引导式关卡 L1-L6 | 六关对应六铁律，通关判定写入进度 | 4.80 |
| P0 | **F13** | **双入口：自由模式 / 闯关模式** | **用户补充约束。新手走闯关，老手直接进沙盒** | — |

> **F7 不接受降级。** RICE 4.80 系统性低估防御性差异化——砍掉它产品退化成「又一个流程图工具」，正好掉进 Scratch 被批评的坑（无结构化路径，自学者无从下手）。用户已认可此判断。

### 2.2 B 线 · 知识体系重构

| 优先级 | 编号 | 功能 | 验收标准摘要 | RICE |
|---|---|---|---|---|
| P0 | B1 | 结构重构：500+502 合并、下线、进度迁移、301 | 迁移后去重进度总数 ≥ 迁移前 | **15.00** |
| P0 | B1.5 | 模块/路线分区：`kind` 字段 + 首页两区渲染 | 用户看到「3 知识模块 + 4 目标路线」而非「6 条看不出区别的路径」 | 8.00 |
| P1 | B3 | 脑库新增 17 章灌入（ERP 9 + MES 4 + SQL 4） | 依赖 B2 | 6.00 |
| P1 | B4 | 搭建器 ↔ 章节互链 | 依赖 B1 章节 id 稳定 | 5.60 |
| P1 | B2 | Markdown 仅导入（F9-F12） | 依赖 `source_path` DDL | 1.60 |

> **B1 性价比是搭建器的 6 倍**，没有理由排在其后。B1 与 A 线真并行：B1 动 DB 与内容，A 线动关卡交互，唯一交点 B4 在第 3 周。

### 2.3 C 线 · 视觉升级 v3

| 优先级 | 编号 | 功能 | 验收标准摘要 |
|---|---|---|---|
| P0 | V3 | design-tokens v3 增量修订 | 明度阶梯单调递增、主按钮转墨、Hairline First 真落地 |
| P0 | V3-P1 | AppShell 改造（影响 100% 页面） | 顶栏玻璃收敛、深色锚点 |
| P0 | V3-P2 | 全站卡片与标签 | 消除幽灵卡片、中性标签替换蓝标签 |
| P0 | V3-P3~P7 | 逐页面改造 | 按 `VISUAL-UPGRADE-v3.md` §7 清单 |

> **V3 必须先于搭建器页面开发完成**，否则新页面沿用旧观感，等于白改。

---

## 3. 明确不做（Out-of-Scope — 锁定）

| 不做 | 原因 | 何时考虑 |
|---|---|---|
| 设备 / 人员 / 排产建模 | **一旦松口，仿真引擎复杂度不是线性增长而是数量级增长**（PM 特别标注的评审要点） | v2.0 |
| 多工厂模型切换 | MVP 阶段单场景已足够教完六条铁律 | v2.0 |
| Obsidian 双向同步 / 导出 | 用户明确「只有导入就可以了」 | 不计划 |
| 学员画布 D1 云端同步 | v1 只 localStorage，见 OD-001 | 有 ≥3 用户反馈跨设备丢失 |
| 作品集 / 社交分享 | 与「学会 MES」无关 | 不计划 |
| 后端跑仿真 | Workers 免费版 10ms CPU/调用，逐 tick 跑不动（ADR-008） | 换付费版才重新评估 |
| 引入 React Flow / Konva / zustand | ADR-006 零新增运行时依赖 | 不计划 |
| 迁移 TanStack Router | ADR-010，懒加载是 React 的能力不是路由库的 | 不计划 |
| 深色模式 | 现有 token 无深色变量，本次不扩大范围 | v2.0 |
| PLC / PowerBI / AI 空目录建入口 | 空壳页只能写「敬请期待」，必违 P0-3 | 内容写满后 |
| 新增语义色 `--success/--warn/--danger` 改动 | 与 MES 设备状态绑定，避免扩大改动面 | 不计划 |

---

## 4. 技术架构（锁定 — 版本已实测锚定）

版本取自 `node_modules/*/package.json` 实际安装值，非 `package.json` 的 `^` 范围。

| 层 | 技术 | 实际版本 | 锁定原因 |
|---|---|---|---|
| 前端框架 | React | **19.2.8** | 现有基线 |
| 路由 | react-router-dom | **7.18.2** | ADR-010 不迁移 |
| 构建 | Vite | **6.4.3** | 现有基线 |
| 语言 | TypeScript | **5.9.3** | 现有基线 |
| 数据获取 | @tanstack/react-query | **5.101.4** | 现有基线 |
| 图标 | lucide-react | **1.28.0** | ADR-002 单一图标库锁定 |
| SQL 沙箱 | sql.js | **1.13.0** | 现有基线，注意表名冲突 |
| 部署 | wrangler | **4.117.0** | Workers + Static Assets |
| 数据库 | Cloudflare D1 | `mes-learning` | 现有基线 |
| 样式 | 原生 CSS + design-tokens | — | 无 CSS-in-JS，无 Tailwind |
| **画布** | **原生 Canvas 2D + DOM 叠加** | **零新增依赖** | **ADR-006** |
| 状态 | React 之外的可变引擎实例，≤4Hz 节流推快照 | 零新增依赖 | ADR-006 |

**新增运行时依赖数量：0。** 这是硬指标，Phase 3 门禁会检查 `package.json` diff。

### 4.1 仿真引擎解耦约束（用户补充约束，强制）

> 引擎与 React **严格解耦**，纯数据驱动，**不依赖任何 React Hook**，未来方便迁移与单元测试。

具体落地要求：

| 要求 | 判定标准 |
|---|---|
| 引擎目录 `web/src/features/route-builder/engine/` 内**零 React import** | `grep -r "from 'react'" engine/` 必须为空 |
| 引擎入口是 class 或工厂函数，构造只吃纯数据 | 不接受传入 setState / ref / context |
| 引擎对外只有两个出口：`subscribe(cb)` 推快照、`dispatch(action)` 收指令 | React 侧只做订阅与渲染 |
| 引擎必须能在 Node 环境下被单测直接实例化并跑完整 tick 序列 | 测试文件不 import 任何 DOM / React |
| 快照推送 ≤ 4Hz 节流 | 引擎内部 tick 频率与推送频率解耦 |

### 4.2 仿真数据 JSON 导出/导入预留（用户补充约束）

> 所有仿真数据可导出/导入 JSON，未来做云端同步**只新增上传下载接口，不重构沙盒数据结构**。

- 引擎快照必须是**纯可序列化对象**（无 Map / Set / 函数 / 循环引用），`JSON.parse(JSON.stringify(snapshot))` 必须完全等价
- localStorage 存的就是这个 JSON 的字符串形式，未来云端同步直接搬运同一结构
- 快照顶层带 `schemaVersion` 字段，为将来结构演进留迁移口

---

## 5. API 端点清单（锁定）

契约见 `docs/api/openapi-simulator.yaml`，评审后并入 `docs/api/openapi.yaml`。

### 5.1 学员侧（4 个）

| Method | Path | 功能 | 认证 |
|---|---|---|---|
| GET | `/api/v1/sim/scenarios` | 场景列表 | 匿名 |
| GET | `/api/v1/sim/scenarios/{slug}` | 场景详情（工序库 + 参考路线 + 工单 + BOM） | 匿名 |
| GET | `/api/v1/sim/scenarios/{slug}/faults` | 该场景的异常注入配置 | 匿名 |
| POST | `/api/v1/sim/runs` | 提交运行结果摘要（写 1 行 `progress_events`） | 匿名 |

### 5.2 管理侧 · 场景 CRUD（3 个）

| Method | Path | 功能 | 认证 |
|---|---|---|---|
| GET/POST | `/api/v1/admin/sim/scenarios` | 列表 / 新建 | 管理员 |
| GET/PUT/DELETE | `/api/v1/admin/sim/scenarios/{id}` | 详情 / 更新 / 删除 | 管理员 |
| POST | `/api/v1/admin/sim/scenarios/{id}/publish` | 发布 | 管理员 |

### 5.3 管理侧 · Markdown 导入三阶段（3 个）

| Method | Path | 功能 | 认证 |
|---|---|---|---|
| POST | `/api/v1/admin/import/obsidian/preview` | dry-run 预览（前端已解析，传结构化 JSON） | 管理员 |
| POST | `/api/v1/admin/import/obsidian/commit` | 幂等写入 | 管理员 |
| POST | `/api/v1/admin/import/obsidian/finalize` | 收尾与结果报告 | 管理员 |

**响应信封不变**：`{code, data, msg, traceId}`，`unwrap()` 返回 `body.data`。

---

## 6. 数据库表清单（锁定 — 三方 DDL 合并）

> ⚠️ 本次 DDL 增量有**三个来源**，必须合并进单个迁移文件 `worker/src/migrations/002-simulator.sql`，一次执行。

### 6.1 来源 A · 架构师 · 5 张仿真素材表（新建）

| 表名 | 核心字段 | 索引 |
|---|---|---|
| `sim_scenarios` | id, slug, title, topic_id, status, sort | `(status,sort)` `(topic_id,status)` |
| `sim_operations` | id, scenario_id, code, name, std_time, need_qc, sort | `(scenario_id,sort)` |
| `sim_process_routes` | id, scenario_id, seq, operation_id, sort | `(scenario_id,sort)` |
| `sim_work_orders` | id, scenario_id, wo_no, qty, release_tick | `(scenario_id,release_tick)` |
| `sim_bom_items` | id, scenario_id, parent_code, item_code, qty_per, on_hand | `(scenario_id)` |

### 6.2 来源 B · PM · 知识重构字段（增列）

| 表 | 新增列 | 类型 | 用途 |
|---|---|---|---|
| `learning_paths` | `kind` | TEXT NULL | `'module'` 常青知识 / `'route'` 目标导向 |
| `learning_paths` | `archived_at` | TEXT NULL | 下线 502 用软删除，不物理删 |
| `chapters` | `practice_link` | TEXT NULL | 章节 → 搭建器关卡的深链（B4） |

### 6.3 来源 C · 架构师 · Obsidian 幂等（硬阻断项，增列 + 唯一索引）

| 表 | 新增 | 说明 |
|---|---|---|
| `chapters` | `source_path` TEXT NULL | Markdown 源文件相对路径 |
| `topics` | `source_path` TEXT NULL | 同上 |
| `chapters` | `UNIQUE(source_path)` 部分索引（`WHERE source_path IS NOT NULL`） | **唯一硬阻断项**：不加则重复导入产生重复章节 |

### 6.4 复用（零 DDL）

| 表 | 复用方式 |
|---|---|
| `fault_scenarios` | 新增 `variant='sim'` 区分 SQL 实训 / Canvas 仿真；`solution_json` 约定 `{inject, expect}` |
| `block_solutions` | 多解容错，原样复用 |
| `progress_events` | 仿真运行结果摘要写 1 行；知识重构进度迁移也走这张表 |

### 6.5 强制数据规范（用户补充约束）

| 规范 | 理由 | 违反后果 |
|---|---|---|
| 仿真表名一律 `sim_` 前缀 | `work_orders` / `bom` 已被 sql.js 沙箱样例库占用（`web/src/features/sql-sandbox/dataset.sql:47,80`） | 同名不同结构造成教学混淆 |
| 全部业务比率用**整数定点**（万分比 / ×1000），**禁 REAL** | 浮点跨浏览器重放产生位级差异 | 学员会问「我照做了为什么结果不一样」 |
| `status` 缺省 `'draft'` | 导入与新建永不自动发布 | 半成品内容泄漏到线上 |
| 索引只建列表查询主路径 + 业务唯一约束 | 不建投机性复合索引 | D1 单库单线程，冗余索引拖慢写入 |
| 所有仿真查询以 `scenario_id` 为前导列 | 无任何跨场景查询 | — |

---

## 7. 页面清单（锁定）

| 页面 | 路由 | 状态 | 核心组件 | 对应 API | V3 改造 |
|---|---|---|---|---|---|
| 首页 | `/` | 改 | ProgressDashboard + **模块/路线两区** | 现有 4 个 | P3 视觉锚点 |
| 课程列表 | `/courses` | 改 | CourseCard | `/topics` | P4 |
| 课程详情 | `/courses/:id` | 改 | — | `/topics/:id/chapters` | P4 |
| 章节详情 | `/chapters/:id` | 改 | **+ 搭建器入口（常驻）** | `/chapters/:id` | P5 |
| 学习路径 | `/paths` | 改 | **按 kind 分两区** | `/learning-paths` | P7 |
| SQL 实训 | `/sql` | 改 | sql.js 沙箱 | — | P6 |
| 练习 / 测验 | `/exercises` `/quiz` | 改 | — | 现有 | P7 |
| 后台 | `/admin` | 改 | **+ 导入面板（B2）** | `/admin/import/*` | P7 |
| **工艺路线搭建器** | **`/simulator`** | **新建** | Canvas 画布 + 块面板 + 属性面板 + 控制条 | `/sim/*` | P8 前置约束 |
| 登录 / 404 | `/login` `/*` | 改 | — | — | P7 |

**`/simulator` 必须路由级懒加载**：`React.lazy` + Suspense 落在 `AppShell` 内 / `Routes` 外，**必须配 chunk-load ErrorBoundary**，支持 hover 预热（ADR-009）。

---

## 8. 设计 Token（锁定 — v3）

完整变更表见 `design-system/VISUAL-UPGRADE-v3.md` §3。此处只锁关键值。

### 8.1 核心变更

| Token | v2 | **v3** | 理由 |
|---|---|---|---|
| `--accent` | `#2563eb` | **`#0a61b8`** | 色相 221°→210°，与 `--brand-ink` 206° 同源；对白底 5.17→**6.15:1** |
| `--bg` | `#f7f9fb` | **`#edf1f5`** | 页面底压深，`bg→surface` 对比 1.055→**1.135** |
| `--surface-2` | `#f1f5f9` | **`#f6f8fa`** | **修正明度倒置**——v2 它竟比 `--bg` 暗，深度信号自相矛盾 |
| `--surface-3` | `#e7edf3` | **`#e3e9f0`** | 收窄为全系唯一允许下沉的面 |
| `--muted` | `#5a6e80` | **`#4e6376`** | 与 `--meta` 拉开亮度差至 3.79%（可辨阈值 2%） |
| `--meta` | `#6b8093` | **`#5c6f85`** | v2 旧值对 bg 仅 4.09:1，**本来就不合规**；新值 4.55:1 |
| `--border` | `#dde5ec` | **`#d3dce5`** | 取消卡片阴影后 hairline 成唯一分层手段 |
| `--border-soft` | `#edf1f5` | **`#e4eaf0`** | v2 与新 `--bg` **完全撞色** |
| `--elev-card` | 双层柔阴影 | **`0 0 0 0 transparent`** | 消除幽灵卡片，Hairline First 真落地 |
| `--btn-primary-bg` | `var(--accent)` | **`var(--ink-solid)`** | 主按钮转墨，制造深色锚点 + 释放 accent 配额 |
| `--glass-bg` | `surface 80%` | **`surface 92%`** | 顶栏近乎实色 |
| `--glass-blur` | `12px` | **`8px`** | 降合成层开销 |

**修订后明度阶梯（单调递增，台阶 1.077 / 1.066 / 1.065，误差 <1.2% 肉眼等距）**：

```
surface-3  #e3e9f0  L 80.90%   ← 唯一下沉面
bg         #edf1f5  L 87.51%   ← 页面底（基准）
surface-2  #f6f8fa  L 93.63%   ← 内嵌区 / 表头
surface    #ffffff  L 100.0%   ← 卡片（顶端）
```

### 8.2 ⚠️ 两个必须遵守的实现陷阱

1. **`--elev-card` 必须写 `0 0 0 0 transparent`，不能写 `none`。**
   生产 CSS 存在复合列表 `.dash-path.is-active { box-shadow: 0 0 0 1px var(--accent-soft), var(--elev-card) }`。`none` 在多值列表中是**非法语法，浏览器丢弃整条声明**，导致高亮外环消失且**不报错**。
2. **`.dash-hero` 必须用双类 `.panel.dash-hero`。**
   构建产物中 `.panel` 排在其后，同特异性会覆盖。

### 8.3 不变项

- 字体三件套：Archivo Variable + Noto Sans SC Variable + JetBrains Mono Variable（全自托管，ADR-004）
- 图标：lucide-react 单一库，语义名调用，尺寸 16/20/24px（ADR-002）
- 圆角阶梯：`xs:3 / sm:6 / md:12 / lg:16 / pill:9999`
- 语义色 `--success` `--warn` `--danger` 不动
- 分层原则：Hairline First 继续作基线

### 8.4 Icon.tsx 需补 11 个语义名（OD-005）

`pause` / `stop` / `step` / `undo` / `redo` / `zoom-in` / `zoom-out` / `fit-view` / `grip` / `folder` / `empty-search`

Phase 3 前端开工前一次性补齐并更新 `IconName` 联合类型。

### 8.5 搭建器兼容性

设计师已验证：`routing-builder.md` 的 9 态拖拽反馈矩阵引用的全是 token **名**，v3 只改值不改名，**一行都不用改**。「选中↔运行中」「常态↔悬停」的可分性较 v2 均有提升。

> **Advisory（非 v3 引入，实现期处理）**：已完成/异常两态描边亮度差仅 1.08:1，对红绿色盲不可分，实现时须补图标通道。

---

## 9. 验收标准（EARS 格式，锁定）

### 9.1 A 线 · 画布与搭建

| ID | 验收标准 |
|---|---|
| AC-A01 | 系统必须在搭建器左侧展示工序块面板，块类型列表由后端配置下发，前端不得硬编码工序名称。 |
| AC-A02 | When 用户从块面板拖动工序块并在画布释放，系统必须在释放位置创建实例，并使其立即可选中、可再拖拽。 |
| AC-A03 | When 用户从一个工序块输出点拖向另一块输入点，系统必须建立有向连线。 |
| AC-A04 | If 用户尝试建立的连线会导致路线成环，系统必须**在鼠标释放前**拒绝，并以非阻断提示说明「工艺路线不能回到已经过的工序」。 |
| AC-A05 | If 用户尝试将连线接入已被占用的输入点，系统必须拒绝并说明当前工艺路线为单链结构。 |
| AC-A06 | When 用户选中工序块，系统必须展示属性面板（工序名/标准工时/质检开关）；Where 该块为首道工序，还必须含 BOM 配置区。 |
| AC-A07 | When 用户修改任一工序属性，系统必须即时更新画布可视状态，不得要求手动保存后才生效。 |
| AC-A08 | While 画布存在未接入主链路的游离块，系统必须以弱提示（非红色报错）标注，且不得因此阻止运行。 |

### 9.2 A 线 · 仿真与反馈

| ID | 验收标准 |
|---|---|
| AC-B01 | When 用户点击运行，系统必须让工单卡片沿路线逐工序推进，且工序块实时显示在制数量与产出计数。 |
| AC-B02 | While 仿真运行中，系统必须支持单步、连续、暂停、重置四种控制。 |
| AC-B03 | If 首道工序物料不齐套，系统必须冻结工单、将该工序块标红，并弹出业务解释卡说明「是什么规则 / 现实中为什么这样 / 怎么解决」。 |
| AC-B04 | If 质检工序判定不合格，系统必须阻断下游流转并给出业务解释卡。 |
| AC-B05 | 系统必须保证同一初始条件下，任意浏览器、任意次数运行产生**完全相同**的仿真结果（整数定点保障）。 |
| AC-B06 | 引擎快照必须满足 `JSON.parse(JSON.stringify(s))` 完全等价，且顶层含 `schemaVersion`。 |

### 9.3 A 线 · 关卡与双入口

| ID | 验收标准 |
|---|---|
| AC-C01 | 系统必须提供**自由模式**与**闯关模式**两个入口；自由模式直接进空白沙盒，闯关模式进 L1。 |
| AC-C02 | 系统必须提供 L1-L6 六个关卡，每关有目标描述与通关判定，且六关与六条业务铁律一一对应。 |
| AC-C03 | When 用户通关，系统必须写入进度（1 行 `progress_events`）。 |
| AC-C04 | 系统必须支持将画布重置为当前关卡初始状态。 |

### 9.4 B 线 · 知识重构

| ID | 验收标准 |
|---|---|
| AC-D01 | 合并 ch31-42 进 ch7-18 后，系统必须校验 ch7-18 字符数**均不小于**合并前 500 侧原文；If 校验失败，必须中止并回滚。 |
| AC-D02 | 进度迁移后，系统必须校验去重进度总数 **≥** 迁移前；If 失败，必须回滚至备份快照。 |
| AC-D03 | 系统必须为下线的 path 502 与 ch31-42 配置 301 重定向，旧链接不得出现 404。 |
| AC-D04 | 重构后首页必须按 `kind` 分「知识模块」「学习路线」两区渲染。 |
| AC-D05 | 系统**不得**为 PLC / PowerBI / AI 建立可点击入口。 |
| AC-D06 | 下线操作必须为软删除（`archived_at`），不得物理删除任何行。 |

### 9.5 B 线 · Markdown 仅导入

| ID | 验收标准 |
|---|---|
| AC-E01 | 系统必须支持选单个 `.md` 文件或整个文件夹递归扫描，且必须跳过 `.obsidian/`、隐藏目录、`node_modules`。 |
| AC-E02 | 系统必须在写库前展示 dry-run 预览（新建 N / 更新 X / 跳过 Y），用户确认是**唯一写库闸门**。 |
| AC-E03 | If 同一 `source_path` 已存在，系统必须走更新而非新建（幂等）。 |
| AC-E04 | 系统必须逐文件报告成功/跳过/失败及原因，失败项可单独重试。 |
| AC-E05 | 系统**不得**提供任何导出或双向同步能力。 |

### 9.6 C 线 · 视觉升级

| ID | 验收标准 |
|---|---|
| AC-F01 | 修订后明度阶梯必须单调递增：`surface-3 < bg < surface-2 < surface`。 |
| AC-F02 | 全部文本 token 对 `--bg` 对比度必须 ≥ 4.5:1（WCAG AA）。 |
| AC-F03 | `--elev-card` 必须为 `0 0 0 0 transparent`，且 `.dash-path.is-active` 高亮外环视觉不得消失。 |
| AC-F04 | 全站 CSS 不得出现裸 hex（`#fff`/`#000` 仅允许出现在 token 定义处）。 |
| AC-F05 | 全站不得出现 emoji 作功能图标（正则扫描 `.tsx/.jsx/.vue/.html/.css`）。 |
| AC-F06 | 全站不得出现 Indigo→Pink 渐变或弹跳缓动 `cubic-bezier(0.68,-0.55,0.265,1.55)`。 |

### 9.7 通用 · 移动端（用户补充约束）

| ID | 验收标准 |
|---|---|
| AC-G01 | Where 视口 `<768px`，画布必须**自动降级为纵向步骤列表**，不得强行缩放。 |
| AC-G02 | Where 视口 `<768px`，系统必须提供「**强制画布模式**」开关，供大屏手机用户手动切回画布。 |
| AC-G03 | 画布拖拽必须支持**触摸长按拖动**，长按阈值与视觉反馈须明确。 |
| AC-G04 | Where 用户系统开启 `prefers-reduced-motion`，运行动画必须降级为瞬时跳转（非简单关闭，否则用户看不出发生了什么）。 |

---

## 10. 边界与约束（锁定）

### 10.1 示例基线数据（用户补充约束，直接锁定）

| 项 | 值 |
|---|---|
| 标准 Demo 工艺 | **下料 → 机加工 → 焊接 → 质检 → 装配** |
| 物料 | **3 类** |
| 工单 | **1 张，数量 1000 件** |
| 后续替换 | 奥来 KBO 断路器真实工艺数据，首期优先跑通交互闭环 |

> 具体数值表（各工序标准工时、3 类物料编码与单位用量、初始库存）由 PM 在开发前补出 `docs/sim-seed-generic-discrete.json`（OD-003）。

### 10.2 时间尺度

- 1 tick ≙ 1 标准工时单位
- 1x 速度下 1 tick = **1500ms**（900ms 位移 + 600ms 驻留）
- 提供 2x / 4x 倍速，避免长工时工序让用户干等

### 10.3 性能

| 指标 | 目标 |
|---|---|
| 引擎快照推送频率 | ≤ 4 Hz |
| 画布渲染 | 60fps @ ≤20 工序块 |
| `/simulator` chunk 体积 | ≤ 150KB gzip |
| 首屏不受影响 | 懒加载，主 bundle 零增长 |

### 10.4 平台硬约束（不可突破）

| 约束 | 数值 |
|---|---|
| D1 Rows read / written | 5,000,000 / 100,000 每天 |
| Workers 请求 | 100,000 / 天 |
| Workers CPU | **10 ms / 次调用** |
| 单请求 SQL 语句 | ≤ 40 条（`db.ts:11`） |
| 写请求 body | ≤ 256 KB（`validate.ts:12`） |

### 10.5 其他

- 不支持 IE
- 匿名用户通过 `anon_id` 追踪进度，本期不做账号体系

---

## 11. 内嵌已知坑

| 坑 | 技术栈指纹 | 根因 | 修法 |
|---|---|---|---|
| `Icon name="play"` 类型报错 | lucide-react@1.28.0 + Icon.tsx | REGISTRY 把 Play 注册成语义名 `run`，不是 `play` | 用 `name="run"`；新增图标必须同步更新 `IconName` 联合类型 |
| `vite build` 写 `worker/public` 报 EPERM | vite@6.4.3 + Windows | 字体 `.woff2` 被文件锁/AV 占用，每次锁的文件还不一样 | `vite build --outDir web/.staging` 后原子 `mv`，不要直接覆盖 |
| `npm run deploy` 触发上述 EPERM | 根 script | 它会先 rebuild web | 直接 `wrangler deploy --config wrangler.toml` |
| `rm -rf` 相对路径被安全包装器拒绝 | Windows 环境 | 相对路径会被拦 | 一律用绝对路径 |
| `--elev-card: none` 静默破坏高亮环 | 复合 box-shadow 列表 | `none` 在多值列表中非法，浏览器丢弃整条声明 | 写 `0 0 0 0 transparent` |
| `.dash-hero` 被 `.panel` 覆盖 | 构建产物 CSS 顺序 | `.panel` 排在其后，同特异性覆盖 | 用双类 `.panel.dash-hero` |
| `work_orders` / `bom` 表名冲突 | sql.js 沙箱 dataset.sql:47,80 | 同名不同结构 | 仿真表一律 `sim_` 前缀 |
| npm workspace 二进制在根目录 | 根 package.json workspaces | vite/tsc/wrangler 提升到根 `node_modules/.bin` | 不要在 `web/` 下单独 `npm install` |

---

## 12. 端到端验证步骤

```bash
# 0. DDL 增量（三方合并后的单一迁移文件）
cd E:/mes-learning-platform/worker
wrangler d1 execute mes-learning --local  --file=./src/migrations/002-simulator.sql
wrangler d1 execute mes-learning --remote --file=./src/migrations/002-simulator.sql
# 断言：sim_ 5 张表存在；chapters/topics 有 source_path；chapters 唯一索引生效

# 1. 类型检查（必须 EXIT 0）
cd E:/mes-learning-platform
node_modules/.bin/tsc -p web/tsconfig.json --noEmit

# 2. 引擎解耦硬校验（必须无输出）
grep -r "from 'react'" web/src/features/route-builder/engine/ && echo "FAIL: 引擎污染" || echo "PASS"

# 3. 零新增依赖校验
git diff --stat package.json web/package.json worker/package.json
# 断言：dependencies 无新增条目

# 4. P0 铁律扫描（必须无输出）
grep -rPn "[\x{1F300}-\x{1F9FF}\x{2600}-\x{27BF}]" web/src --include=*.tsx --include=*.css
grep -rn "cubic-bezier(0.68" web/src
grep -rEn "#[0-9a-fA-F]{6}" web/src --include=*.css | grep -v design-tokens

# 5. 构建（走 staging 避 EPERM）
node_modules/.bin/vite build --config web/vite.config.ts --outDir .staging
mv worker/public worker/public.bak && mv web/.staging worker/public

# 6. 部署
node_modules/.bin/wrangler deploy --config wrangler.toml

# 7. 核心成功流
curl -s "https://shuojia.qzz.io/api/v1/sim/scenarios" | head -c 300
# 断言：返回场景列表，含通用离散示例

curl -s "https://shuojia.qzz.io/api/v1/learning-paths" | grep -o '"kind":"[a-z]*"' | sort -u
# 断言：出现 "module" 与 "route" 两种

curl -s -o /dev/null -w "%{http_code}" "https://shuojia.qzz.io/simulator"
# 断言：200

# 8. 关键错误流
curl -s "https://shuojia.qzz.io/api/v1/sim/scenarios/not-exist"
# 断言：返回 404 + 错误信息，非 500

curl -s -o /dev/null -w "%{http_code}" "https://shuojia.qzz.io/paths/rm-502"
# 断言：301（不得 404）

# 9. 视觉回归
# 人工：对照 VISUAL-UPGRADE-v3.md §7 逐页面清单，确认 .dash-path.is-active 高亮环仍在
```

---

## 13. 执行顺序（B1 不可颠倒）

```
第 1 周   ├── B1  结构重构（数据层）  ─┐  真并行
          └── A0  搭建器开发（交互层） │  B1 动 DB 与内容
          └── V3  视觉升级（样式层）   │  A0 动关卡逻辑
                                      │  V3 动 tokens
第 2 周   ├── B1.5 模块/路线分区       │
          └── A0  搭建器继续          ─┘
第 3 周   ├── B4  搭建器 ↔ 章节互链     ← 汇合点：依赖 B1 章节 id 稳定
          └── B2  导入功能（需求已由 B1 校准）
第 4 周   └── B3  脑库 17 章灌入        ← 依赖 B2
```

**B1 内部执行顺序（强校验闸门，不可颠倒）**

```
1. 全量备份 progress_events → progress_events_bak_kr1
2. 合并 ch31-42 正文进 ch7-18（并集拼接）
3. 校验：ch7-18 字符数均不小于合并前 500 侧原文    ← 失败即中止
4. 执行进度迁移 UPDATE（chapter_id −24，范围 31~42）
5. 冲突合并（同 id 取状态最高 / 时间最早）
6. 校验：迁移后去重进度总数 ≥ 迁移前              ← 失败即回滚
7. 归档 ch31-42、topic 5008-5011、path 502（软删除）
8. 重命名 path 500/501/503 与 topic
9. 配置 301 重定向
10. 冒烟：4 条路线导航、进度显示、旧链接跳转
```

**回滚点**：第 3 步与第 6 步为强校验闸门，任一失败立即回滚至第 1 步快照。第 7 步之前所有操作可逆。

---

## 14. 风险登记（纳入开发门禁）

| 风险 | 处理 | 门禁位置 |
|---|---|---|
| `chapters.source_path` 缺失导致重复导入 | 模块 B2 延后至第 3 周；DDL 随 002 迁移一次落地 | B2 开工前 |
| accent 色值 / 图标语义缺失（OD-004 / OD-005） | 上线前修复 | Phase 4 QA 门禁 |
| 遗留临时脚本 `_val*.txt` `_apitest.mjs` `_fix.mjs` `_wf.txt` | 开发阶段保留不影响主线，上线前统一清理 | Phase 4 交付前 |
| 已完成/异常两态描边对红绿色盲不可分（1.08:1） | 实现期补图标通道 | A 线 F5 验收 |
| 引擎被 React 污染 | `grep -r "from 'react'" engine/` 必须为空 | Phase 3 自检 |

---

## 15. 边界约定（用户确认）

后续只有两类情况中断开发向用户确认：

1. 技术方案出现**无法解决**的阻塞
2. QA 测出 **P0 级缺陷**，需要调整产品规则

其余迭代、细节优化，由三位专家自行闭环，无需反复确认。

---

## 16. 变更记录

| 日期 | 变更 | 原因 | 影响范围 |
|---|---|---|---|
| 2026-08-02 | 创建 Spec v1 | 用户确认 Phase 1 三文档 | 全量 |
| 2026-08-02 | 纳入用户 3 条补充约束（数据规范 / 移动端 / 示例基线） | 用户回执明确要求写入规范文档 | §6.5 §9.7 §10.1 |
| 2026-08-02 | 新增 F13 双入口（自由模式 / 闯关模式） | 用户补充 | §2.1 §9.3 |
| 2026-08-02 | 新增 §4.1 引擎解耦约束、§4.2 JSON 导出预留 | 用户补充 | §4 §12 |
| 2026-08-02 | 纳入 C 线视觉升级 v3 | 用户新需求「颜色UI太低级」 | §2.3 §8 |
| 2026-08-02 | 纳入 B 线知识体系重构 | 用户新需求「按脑库来，现在内容重复」 | §2.2 §6.2 §9.4 |
