# 改造计划说明：参照「造物学堂 FabuLearn」原型改造 MES 实训平台

> 参照物：`C:/Users/Q0605/WorkBuddy/2026-08-11-17-26-09/index.html`（造物学堂 FabuLearn 工厂认知学习系统原型，单文件 941 行）
> 改造对象：`E:/mes-learning-platform`（npm workspaces monorepo，`web` Vite/React/TS + `worker` Cloudflare/D1，部署 `shuojia.qzz.io`）
> 定位差异：**原型 = 零基础科普向 / 明亮亲和插画风 / 多页学习平台**；**本平台 = MES 实操训练 / 森林绿 v3 设计系统 / lucide 图标库 / SQL 沙箱 + 工单 + BOM + 路由 + 质量追溯**
> 结论先行：**只借架构与信息组织，不借视觉风格与语气**。原型大量用了 emoji、渐变、硬编码多色、AI 模板味 Hero —— 这些与本项目 P0 绝对规则直接冲突，一律不采纳。

---

## 0. 判断原则（为什么这么分）

本项目有两条不可动摇的硬约束，原型恰好都踩了：

1. **图标铁律（ADR-002 / AC-08）**：全站只用 `lucide-react@1.28.0`，通过 `web/src/components/Icon.tsx` 语义名单一出口；**禁 emoji 当功能图标，禁引第二个图标库**。原型用 🏭🧠📋⚙️📦🔌🚚✅👆🗺️🔗🧩💬 作图标/插画 → 直接违反。
2. **视觉铁律（design-tokens.css v3）**：组件 CSS 一律 `var(--token)`、零裸 hex；`--accent:#547C70`（森绿）`--bg:#F3F3E9`（暖米）`--brand-ink:#2d3a33`；第 233 行明文 `/* 禁止 bounce / elastic 缓动 */`；动效只走 `--motion-*` + `--ease-standard`；`prefers-reduced-motion` 已有兜底（第 440 行）。原型用蓝橙暖色系 `#2563EB/#FF8A5B`、五系统独立新色、`linear-gradient(135deg,...)`、hover `translateY(-4px)` 上浮 → 全部违反。

**分类口径**：
- **不能采纳**：违反以上任一铁律，或把"科普插画"定位替代"实操训练"定位。
- **可采纳/借鉴**：内容架构、信息组织、交互模式层面的好东西，但必须经"设计转译"（emoji→Icon.tsx 语义名、硬编码色→token、渐变→纯色、弹跳→标准缓动）才能进来。
- **可合并**：能直接落点到本平台**已存在**的模块（工厂流程图、6 站主线、角色视图、quiz），不需要新建平行页面。

---

## 1. 不能采纳（Reject）— 违反 P0 + 违背定位

| # | 原型做法 | 冲突点 | 本项目正确做法 |
|---|---------|--------|---------------|
| R1 | emoji 作功能图标/插画（🏭🧠📋⚙️📦🔌🚚✅👆🗺️🔗🧩💬） | 违反 ADR-002/AC-08 | 全部走 `Icon.tsx` 语义名（MES 域已备 `workshop/factory/bom/material/equipment/routing/quality/trace/warehouse/oee` 等） |
| R2 | 蓝橙暖色系（`#2563EB` 亲和蓝 / `#FF8A5B` 暖橙）替换主色 | 推翻 v3 视觉升级（`--accent:#547C70` 森绿 / `--bg:#F3F3E9` 暖米） | 维持森绿 v3 token，不引入第二主色 |
| R3 | 任意渐变（`linear-gradient(135deg, 蓝, 橙)`，Hero 背景、系统色顶条） | 违反 P0 禁渐变 | 纯色块面 + `--surface` / `--accent-soft` 分层，零 `gradient` |
| R4 | AI 模板味 Hero（lightbulb 式大插画 + 渐变 + "让工厂认知变简单"式 slogan 套路） | P0-5：重心不许靠放大标题/插画制造 | 重心由深色锚点区（`--ink-solid` 主按钮）承担，去插画化 |
| R5 | 硬编码多 hex 配色（原型 `:root` 一堆 `#xxx`） | 违反 token 铁律（组件零裸 hex） | 一切颜色 `var(--token)`，新色值只进 `design-tokens.css` 定义处 |
| R6 | 弹跳/上浮缓动（hover `transform:translateY(-4px)`） | 违反"禁止 bounce/elastic"，位移幅度过大 | hover 位移 ≤2px + `--motion-fast 150ms` + `--ease-standard`；reveal 位移 ≤8px / 220ms 封顶（token 第 655 行已定） |
| R7 | 整体"科普插画"定位替代"实操训练" | 稀释专业感，与本平台 MES 实操目标不符 | 只借架构不借语气；内容保持工单/BOM/路由/追溯的实操深度 |

> R1–R6 是**硬红线**，任何改造 PR 都必须过这三关：零 emoji、零渐变、零裸 hex、零弹跳。R7 是**定位红线**，决定"借多少"。

---

## 2. 可采纳 / 可借鉴（Adopt）— 内容架构层，需经设计转译

| # | 原型亮点 | 转译后成本 | 落地建议 |
|---|---------|-----------|---------|
| A1 | **五大系统全景图谱**（ERP-MRP-MES-PLC-WMS 关系网 + 点击节点切换右侧详情） | 低：Icon.tsx 已有 `erp: Building2 / mes: Blocks / plc: Cpu / embedded: CircuitBoard / network: Network` | 转译为"工厂全景 / 系统关系"模块：节点用语义 Icon，详情面板走 `--surface`/`--ml-*` token，无渐变无 emoji |
| A2 | **三流可视化**（信息流 / 物料流 / 控制流） | 低：用语义线条 + 颜色 token 区分 | 并入现有 `FactoryFlow.tsx` 节点连线，三流用 `success / accent / 中性` 三档（token 第 593 行已定"只用既有三档"），不靠五系统独立新色 |
| A3 | **三阶段学习路径递进模型**（入门 → 进阶 → 面试准备） | 中：需与 6 站主线协调 | 与已上线 6 站主线（`tour/plan/procure/produce/quality/ship`）互补：6 站是"制造全流程实操"，三阶段是"能力成长"，作为 P2 学习路径的第二维度或 `LearningPathsPage` 组织框架 |
| A4 | **分岗面试题库**（MES 工程师 / ERP 顾问 / 自动化工程师 + 对比 / 案例 tab） | 低：Icon.tsx 已有 `role-mes-impl/role-erp-consultant/role-mes-dev/role-scada` | 直接对接 **P3 角色视图** + 现有 quiz 体系；tab 切换模式复用 `.qa-tabs/.qa-panel` |
| A5 | **无障碍加固项**（prefers-reduced-motion、移动端防溢出、--muted WCAG AA） | 极低：本平台已含大部分 | 查漏补缺：核对原型更细的 reduced-motion 处理是否已在 token 第 440 行覆盖；`styles.css` 已有 `overflow-x:hidden + max-width:100% + img/svg/table 限宽` |
| A6 | **IntersectionObserver 滚动淡入** | 低：受 token 约束 | 可采纳，但须走 `--motion-base 220ms` + `--ease-standard` + opacity 位移 ≤8px（第 655 行），`prefers-reduced-motion` 下关闭 |

---

## 3. 可合并（Merge）— 落点 existing 模块，不新建平行页

| # | 原型板块 | 合并目标（本平台已存在） | 具体落点 |
|---|---------|------------------------|---------|
| M1 | 系统图谱 | 工厂流程图节点详情 | `web/src/features/factory/FactoryFlow.tsx` + `FactoryExtras.tsx`；节点图标已在 `Icon.tsx` 注册（`shopping-cart/clipboard-check/calendar/calculator/truck/git-branch/package/send/factory` 等） |
| M2 | 五系统色 | 节点 / 资源类型标识 | **不引入新色**；用 `--accent` 单一强调 + 语义 Icon 区分系统；多类区分时复用 `success/accent/中性` 三档（第 593 行） |
| M3 | 三阶段路径 | P2 learning_tracks / LearningPathsPage | 6 站主线已上线（`flow_stages` + `node_explainers` + `micro_practices`）；三阶段作为关卡递进补充维度接入 |
| M4 | 分岗题库 | P3 角色视图 + quiz | `role-*` 语义名就绪；对比/案例 tab 复用现有 quiz 交互；可加 MES 实操对比题（"工单下达 vs 排产""BOM 与工艺路线区别"） |
| M5 | 面试题库结构 | MES 实操题组织 | 分岗 / 对比 / 案例 三 tab → 复用 `.qa-tabs/.qa-panel` 模式，内容换成工单、BOM、路由、质量追溯实操题 |

---

## 4. 改造路线图（分阶段，本次不写代码）

> 全程守 P0：零 emoji、零渐变、零裸 hex、零弹跳；所有图标走 `Icon.tsx`。
> P2 当前为**暂停**状态（用户在 A/B/C/D 四方向中选"先暂停"），改造启动前需先确认 P2 范围，避免模块重叠。

- **阶段 0 — 计划评审 + 前置整理**
  - 本计划确认；同步确认 P2 方向（A 验收打磨 / B 多轨模块 / C 升级主导航 / D 先出验收报告）。
  - 旁挂的 **AI 护栏改动**（`ai.routes.ts` / `ai-guard.ts` / `ai.judge.ts` / `shadow-test.mjs`）**尚未提交** —— 改造前先把这个分支整理/提交，避免冲突。
- **阶段 1 — 信息架构迁移（结构/交互优先，视觉守 P0）**
  - M1：系统图谱 → `FactoryFlow` 节点详情面板（点击切换、右侧详情）。
  - A1/A2：五大系统关系 + 三流，用语义 Icon + token 色，纯色无渐变。
- **阶段 2 — 学习路径维度接入**
  - M3/A3：三阶段递进模型并入 P2（或 `LearningPathsPage`）。
- **阶段 3 — 分岗题库接入**
  - M4/M5/A4：分岗 / 对比 / 案例 tab 对接 P3 角色视图 + quiz。
- **阶段 4 — 无障碍查漏补缺**
  - A5/A6：reduced-motion 覆盖核对、移动端防溢出复核、滚动淡入受 token 约束落地。

---

## 5. 风险提示

1. **定位冲突（最高风险）**：科普向 vs 实操训练。照搬语气/插画会稀释专业感 → 铁律：**只借架构不借语气**，所有文案保持工单/BOM/路由/追溯的实操深度。
2. **技术形态不同**：原型是单文件零依赖 HTML，本平台是 React monorepo + D1。迁移必须**组件化**，不能把 HTML 整段复制粘贴；交互逻辑（节点点击、tab、reveal）要改写为 React 组件 + 既有 state 模式。
3. **分支冲突**：AI 护栏改动未提交，改造前须先整理/提交，否则易冲突。
4. **P2 重叠**：6 站主线已上线，三阶段路径（A3）若并入 P2 需先定 P2 方向，避免重复建设。
5. **设计转译成本被低估**：原型 7 大板块里 R1–R6 几乎每屏都有，转译工作量不小，但这是硬红线，不做不行。

---

## 6. 一句话总结

> **采纳"系统图谱 + 三流 + 三阶段路径 + 分岗题库 + 无障碍加固"的信息架构；合并到工厂流程图 / 6 站主线 / P3 角色视图；拒绝 emoji、蓝橙暖色、任意渐变、AI 模板味 Hero、硬编码多色、弹跳上浮与科普插画定位。** 改造启动前先收尾 AI 护栏分支、并确认 P2 范围。
