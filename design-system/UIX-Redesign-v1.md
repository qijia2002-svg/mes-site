# UIX-Redesign-v1 — MES 实训平台整体 UI/UX 重新设计（doc-only）

> 文档类型：整体 UI 框架 / UX 重新设计（非代码实现）
> 状态：草案 v1，待用户确认后供 Phase 3 消费
> 约束：本文件为**唯一交付物**；不修改任何现有源码、`design-system/design-tokens.css`、`design-system/design-tokens.json`
> 真源纪律：依据 `design-system/design-tokens.css` v3.0（OD-014：CSS 为唯一真源，不回写 JSON）；图标依据 `web/src/components/Icon.tsx` 的 REGISTRY（ADR-002）

---

## 0. 设计目标与红线

### 0.1 用户要什么
「高级现代化、互动感强」针对的是**本产品语境**，不是通用 SaaS 模板：
- 受众：制造业数字化 / 单片机方向的**成人实训学员**（B2B 企业内训 + 个人进阶），工具型、密度偏高、长时间阅读与练习。
- 现有资产：`design-tokens.css` v3.0 已是一套成熟、克制、森系绿的学术型视觉语言（Hairline First、Motion3 功能性动效、组件零裸 hex）。**重新设计 ≠ 推翻**，而是在其上把"互动感"从"克制"升级为"克制但响应密集"，同时根除 P0 债。

### 0.2 五条 P0 绝对红线（任何落地代码不得违反）
1. **禁 emoji 作功能图标** → 一律走锁定 SVG 库（lucide-react REGISTRY via `Icon.tsx`）。
2. **禁紫粉渐变**（Indigo→Pink 三位一体 AI 模板套路）。
3. **禁硬编码色值**（唯一例外 `#fff`/`#000`；组件一律 `var(--token)`）。
4. **禁弹跳 / 弹性缓动** `cubic-bezier(0.68,-0.55,0.265,1.55)`。
5. **禁千篇一律 Hero**（首屏展示真实产品内容，不放大字标语）。

### 0.3 已知 P0 债（本 redesign 必须根除）
`web/src/pages/EnginePage.tsx` 三处把 🔒 当功能图标（违规）：
- `:224` `{🔒 需先完成：{missingPrerequisites…}}`
- `:250` `{!s.unlocked && ' · 🔒 未解锁'}`
- `:336` `<span className="btn btn-sm">🔒</span>`

替换方案见 §D.3 与 §F。

---

## A. 设计原则

界定本产品语境下的"高级现代化 + 强互动感"：

| 原则 | 含义 | 反模式 |
|---|---|---|
| **Calm-but-responsive（静而敏）** | 默认态安静、留白充足；但任何可操作元素在 hover / focus / active 必须有**即时、低位移**的反馈。高级感来自"稳"，互动感来自"应"。 | 满屏浮动、发光描边、常驻动效 |
| **Feedback-dense（反馈密集）** | 进度、解锁、判题、仿真状态等Training 关键信号，用**颜色 + 图标 + 微动**三重编码，不靠弹窗打断。 | 成功只弹 toast；状态只在列表里一行小字 |
| **Spatial-continuity（空间连续）** | 路由切换、视图展开、抽屉滑出保持**来源与目标的空间关系**，用 View Transitions 做"形变"而非"闪切"。 | 每次跳转整页白屏重排 |
| **Editorial-density（编辑级密度）** | 工具型产品，信息密度高但分层清晰：A1 身份色只用于锚点，B-slot 灰阶承载正文。 | 装饰性大色块挤压内容 |
| **Honest-motion（诚实动效）** | 动效只表达"发生了什么状态变化"，不表演。所有时长取自 Motion3 token，禁止 bounce。 | 卡片入场弹跳、无限循环装饰动画 |

品牌基调维持 **森绿学术**：`--accent #547C70` 低饱和森绿作唯一品牌锚点，`--bg #F3F3E9` 暖米底，`--ink #2d3a33` 深墨绿文字。高级感来自**精确的层次与间距**，而非色彩堆砌。

---

## B. 升级版 Token 体系（在 v3.0 之上扩展，不推翻）

> 表达形式：以下均为**建议新增的 CSS 变量片段**，应合入 `design-tokens.css` 的对应分层；不在此文件回写 JSON（OD-014）。

### B.1 交互态 Token（新增，落在 A1-structure / B-slot）
```css
:root {
  /* 交互态——统一所有可操作元素的反馈语言 */
  --state-hover-bg: color-mix(in srgb, var(--accent) 8%, var(--surface));
  --state-active-bg: color-mix(in srgb, var(--accent) 14%, var(--surface));
  --state-focus-ring: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
  --state-disabled-opacity: 0.45;
  --state-loading-opacity: 0.65;

  /* 深度阶梯（z-index 单一来源，避免散落） */
  --z-base: 1;
  --z-sticky: 100;
  --z-drawer: 800;
  --z-modal: 900;
  --z-toast: 1000;
}
```
> 说明：`color-mix` 在 Workers 边缘无碍（纯前端 CSS，现代浏览器 2023+ 全支持）；若需兼容更老内核，回退为预计算 rgba。优先用 color-mix 以保持"零裸 hex"纪律。

### B.2 动效 Token 确认与补充（落在现有 Motion3）
现有 `--motion-instant80 / --motion-fast150 / --motion-base220 / --motion-slow320` 与 `--ease-out / --ease-standard` 已足够。补充**两个语义别名**降低误用：
```css
:root {
  --ease-enter: var(--ease-out);          /* 入场/展开 */
  --ease-settle: var(--ease-standard);    /* 状态归位 */
  --dur-micro: var(--motion-fast150);     /* 微交互 */
  --dur-state: var(--motion-base220);     /* 状态变更 */
}
```

### B.3 强调色用法精炼（不新增色，重定纪律）
- `--accent` 只用于：主按钮、激活导航项左条、进度填充、聚焦环、关键 CTA。
- 首屏"蓝色元素密度"已由 v3 从 37→19；本 redesign 进一步要求：**非交互元素不得着 accent**，确保 accent 永远"有动作含义"。

---

## C. 动效与互动语言（核心章）

### C.1 约束论证（为什么是纯 CSS，不引重型库）
| 约束 | 数值 | 对动效路线的影响 |
|---|---|---|
| Cloudflare 免费套餐 | 静态资源 ≤ 2 万文件 | lucide 具名导入已靠 tree-shaking 控制；**再引 framer-motion/gsap 会显著增加 chunk 与运行时代价**，且在 SPA 路由切换场景下收益有限 → 否决 |
| 包体预算 | 首屏 JS 严格控制 | 动效逻辑用**原生 CSS + 极少量 IntersectionObserver（~20 行）** 实现，零额外依赖 |
| 边缘架构 | Workers + D1（无 Node 服务端渲染） | 动效全在客户端，CSS 是最稳、最轻、最不易 break 的选择 |
| 可维护性 | 单一 stroke / 单一缓动体系 | 动效也统一走 token，禁止散落 `transition: .3s ease` |

**结论：纯 CSS 驱动动效 + 一个轻量 `useInView` hook（IntersectionObserver）**。不破坏现有零动效库现状，只在 `@keyframes` 与 `transition` 上做加法。

### C.2 微交互（micro-interaction）
所有可操作元素统一反馈，时长取自 `--dur-micro`：
```css
/* 按钮： hover 微抬 + active 微沉，禁用 translateY 弹跳 */
.btn { transition: background-color var(--dur-micro) var(--ease-settle),
                    transform var(--dur-micro) var(--ease-settle),
                    box-shadow var(--dur-micro) var(--ease-settle); }
.btn:hover  { background: var(--state-hover-bg); }
.btn:active { transform: translateY(1px); background: var(--state-active-bg); }
.btn:focus-visible { outline: none; box-shadow: var(--state-focus-ring); }

/* 导航项：激活左条 2px 形变展开，而非突变 */
.nav-item::before { content:""; position:absolute; left:0; top:8px; bottom:8px;
  width:2px; background:var(--accent); transform:scaleY(0); transform-origin:center;
  transition: transform var(--dur-micro) var(--ease-enter); }
.nav-item.is-active::before { transform:scaleY(1); }

/* 图标按钮：hover 旋转/缩放一律 ≤4°，用 --ease-settle，禁 bounce */
.icon-btn { transition: background-color var(--dur-micro) var(--ease-settle),
                       transform var(--dur-micro) var(--ease-settle); }
.icon-btn:hover { background: var(--state-hover-bg); }
```

### C.3 页面 / 视图转场（View Transitions API）
`react-router-dom ^7.18.2` 支持 `unstable_viewTransition` / `useViewTransitionState`，可在路由切换时调用浏览器原生 `document.startViewTransition`，由 CSS `::view-transition-*` 伪元素接管跨页形变——**零 JS 动画库**。
```css
/* 默认：内容淡入 + 轻微上移（用 --ease-enter，非 bounce） */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--motion-base220);
  animation-timing-function: var(--ease-enter);
}
/* 路由切换时主内容区域共享元素形变（概览→课程列表的卡片可命名 view-transition-name 做连续位移） */
.content { view-transition-name: main-content; }
```
> 降级：不支持 View Transitions 的浏览器（Safari < 18）自动回退为无动画路由切换，不报错。

### C.4 滚动揭示与入场（IntersectionObserver + CSS）
新增一个 ~20 行的 `useInView` hook（放 `web/src/hooks/`），配合现有 `@keyframes pageEnter / cardEnter`：
```css
.reveal { opacity:0; transform: translateY(8px);
  transition: opacity var(--motion-slow320) var(--ease-enter),
              transform var(--motion-slow320) var(--ease-enter); }
.reveal.in-view { opacity:1; transform:none; }
```
> 位移仅 8px、时长 320ms、缓动 --ease-enter —— 克制不浮夸。列表项用 `transition-delay` 阶梯（每项为 index*40ms，上限 6 项）做"依次入场"，不引 stagger 库。

### C.5 状态变更动画（在现有 @keyframes 上扩展）
现有 `sheetDrop / kpiFadeUp / growArc / simPulse / faultPulse / edgeFlow / propsSlideUp / pageEnter / cardEnter` 已覆盖大部分。本 redesign 补充用途约定：
- **进度填充**：`growArc`-style 宽度过渡（`transition: width var(--motion-base220) var(--ease-settle)`），用于 `SidebarProgress` 与阶段卡进度条。
- **KPI 数字滚动**：`kpiFadeUp` 配合 JS 数值插值（~15 行 `useCountUp`，仍零依赖），仅用于概览 KPI 卡，不滥用。
- **仿真状态脉冲**：`simPulse / faultPulse` 已表达运行/故障；保持，禁无限循环装饰（脉冲需在有状态变化时触发，空闲静止）。

### C.6 加载 / 骨架态
- 统一 `SpinnerIcon`（`LoaderCircle` + `spin`），`reduced-motion` 下停转。
- 列表/卡片首次加载用 **shimmer 骨架**（CSS `linear-gradient` 位移 + `--motion-slow320`），替代空白或整页 loading。

### C.7 reduced-motion（无障碍，必做）
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```
> 所有动效默认尊重该媒体查询；弹跳/弹性在任何分支都禁用（红线 4）。

---

## D. 组件库规范

### D.1 AppShell / 侧栏（依据现行 `web/src/components/AppShell.tsx`）
- 当前侧栏有「首页(dashboard→/)」与「学习中心(courses→/engine)」并存——**导航收敛由并行 Spec-NavRefactor 处理**，本 redesign 仅要求：激活项用 §C.2 左条形变；折叠/展开按钮 hover 态统一；用户卡与 `SidebarProgress` 的进度填充接 §C.5 过渡。
- 移动端 TabBar 5 槽（首页/学习/SQL/工厂/我的）保持；tab 激活用 icon 颜色 + 顶部 2px 条形变，不放大。

### D.2 卡片 / 面板（EnginePage 阶段卡、课程列表行）
- 卡片 hover：`--state-hover-bg` + 极轻 `box-shadow`（v3 Hairline First：阴影只给 hover/浮层）。
- 锁定态（opacity 0.45）保持不变，但**锁定标识改用图标**（见 D.3），不用 emoji。

### D.3 图标替换映射（根除 🔒 债，全部走 REGISTRY）
| 原 emoji | 位置 | 替换 | 语义名 | 是否已注册 |
|---|---|---|---|---|
| 🔒 | `EnginePage.tsx:224` 缺 prerequisites 提示 | `<Icon name="lock" size={16} />` + 文字 | `lock` | **需架构师新增**（lucide `Lock` 未 import） |
| 🔒 | `EnginePage.tsx:250` 阶段卡"未解锁" | `<Icon name="lock" size={16} />` | `lock` | 同上 |
| 🔒 | `EnginePage.tsx:336` 课程行操作位禁用态 | `<Icon name="lock" size={16} />`（替换整颗 🔒 span） | `lock` | 同上 |

> **架构师依赖（已校正）**：REGISTRY 当前已含 `target`(Target)、`reset`(RotateCcw)、`trace`(GitBranch) —— 即早前提到的 target / git-branch / rotate-ccw 实际已覆盖。本次 redesign **唯一需新增注册的图标是 `lock`**：在 `Icon.tsx` 具名导入 `Lock` 并在 REGISTRY 加 `lock: Lock`。不引第二个图标库，不 emoji 兜底（icon-map.md §缺图标处理流程）。

### D.4 按钮 / 标签 / 表格 / 弹层（sheet）
- 按钮：统一 §C.2 反馈；Primary 用 `--ink-solid`（v3 已转墨色主按钮，制造深色锚点）。
- 标签 `.tag`：沿用 v3 中性标签组，不滥用 accent。
- 表格/列表行：hover 行 `--state-hover-bg`；展开行用 `propsSlideUp` 风格高度过渡。
- 弹层（sheet/dialog）：进入用 `sheetDrop`（已有），退出对称；遮罩 `drawer-scrim` 沿用。

### D.5 反 AI 模板味规则
- 不用 "Welcome / 立即体验 / Sign up today" 等空洞文案；首屏直接展示 nextCourse / 进度 / 推荐路径（真实内容）。
- 不用紫粉渐变发光卡片；不用毛玻璃 + 发光边框组合。
- 不用 emoji 作图标（红线 1）。

---

## E. 页面级 UX 模式

四视图组合（概览 / 课程 / 路径 / 职业）以 `nextCourse` 为主轴，进度数据统一 `useProgress`（并行 Spec-NavRefactor 收口）：

| 视图 | 互动重点 | 动效落点 |
|---|---|---|
| 概览（/engine?tab=overview） | nextCourse 主轴 CTA；KPI 卡数字滚动；路径进度环 | §C.5 KPI + 进度 |
| 课程（/courses） | 列表行 hover/锁定态图标；章节完成勾选反馈 | §C.2 + D.3 |
| 路径（/learning-paths） | 阶段卡展开/收起；解锁态形变 | §C.4 reveal + §C.5 |
| 职业（/engine?tab=career，复用 RoadmapPage） | 路线图节点激活脉冲 | `simPulse` 风格 |

- **导航连续性**：路由切换走 §C.3 View Transitions；侧栏激活左条走 §C.2。
- **空 / 错 / 加载态**：空态用 `Inbox`/`SearchX` 48px 插图位（icon-map §2）；错误用 `CircleX`+`--danger`；加载用 shimmer（§C.6）。
- **nextCourse 主轴**：状态分支（`doing/pending/inherited/locked/completed`）各自 CTA；`locked` 分支用 `lock` 图标替代 🔒（D.3）。

---

## F. Before-After 差距分析

| 维度 | 现状 | 提案（本 redesign） | 引用 |
|---|---|---|---|
| 功能图标 | `EnginePage.tsx:224/250/336` 用 🔒 emoji | 三处统一 `<Icon name="lock">` | §D.3 / §0.3 |
| 动效库 | 零库，仅少量 @keyframes，互动克制 | 纯 CSS + `useInView`/`useCountUp`（零依赖）扩展微交互/转场/揭示 | §C |
| 路由转场 | 客户端 `<Navigate>` 闪切 | View Transitions API 形变，零库 | §C.3 |
| 交互态 | 散落 `:hover` 无统一 token | `--state-*` token 统一反馈语言 | §B.1 |
| 深度/z | 散落数值 | `--z-*` 单一来源 | §B.1 |
| 首屏 | 已有概览，但无 KPI 动效 | KPI 数字滚动 + 进度环过渡 | §C.5 / §E |
| 无障碍 | 部分动效未收敛 reduced-motion | 全局 `@media reduced-motion` 兜底 | §C.7 |
| 深度矛盾 | v3 已修（surface 阶梯倒置） | 保持，不回退 | design-tokens.css 注释 |
| 设计真源 | CSS v3 唯一真源（OD-014） | 保持；提案 token 以 CSS 片段表达，不回写 JSON | §B / OD-014 |

---

## G. 落地约束与节奏

### G.1 doc-only 声明
本文件**只描述设计**，不修改任何文件。Phase 3 实现时由前端工程师（贾思敏）按本章节消费。

### G.2 Phase 3 将消费什么
- §B.1 / §B.2 新增 token → 合入 `design-tokens.css`（架构师协同，仍守 OD-014 不回写 JSON）。
- §C 全部动效 → 新增 `web/src/hooks/useInView.ts`、`useCountUp.ts`（极轻量），CSS 落 `design-tokens.css` 或组件样式。
- §D.3 `lock` 图标 → 架构师在 `Icon.tsx` 注册后，前端替换三处 🔒。
- §E 四视图互动 → 结合并行导航重构落地。

### G.3 对架构师的依赖（已校正）
- **唯一新增图标：`lock`**（lucide `Lock` 具名导入 + REGISTRY 登记）。
- `target` / `reset`(RotateCcw) / `trace`(GitBranch) 已存在，无需新增。
- 导航收敛（/roadmap → /engine?tab=career 等）由 Spec-NavRefactor 处理，本 redesign 不重复定义路由。

### G.4 包体预算护栏
- 不引入 framer-motion / gsap / anime.js 等任何 JS 动效库。
- 新增 hook 总行数预算 ≤ 60 行（含 `useInView` + `useCountUp`）。
- 动效 CSS 增量 ≤ 80 行；lucide 维持具名导入 tree-shaking（新增 `Lock` 仅 +1 图标）。
- 每次动效 PR 必须过 `npm run build` + 包体大小对比，超出预算打回。

### G.5 验收（QA 门禁要点）
- P0 扫描：全仓无 emoji 功能图标、无紫粉渐变、无裸 hex（#fff/#000 除外）、无 bounce 缓动。
- 动效在 `prefers-reduced-motion` 下全部静默。
- 路由切换在支持浏览器有形变、在不支持浏览器不报错。
- KPI 数字滚动不引发布局抖动（预留定宽）。

---

> 文档结束。待用户确认后，作为 Phase 3 前端实现的 UX 契约。
