# 「学习」页导航级重构 · 设计方向与 Token 草案

> 设计师：颜好看 | 对齐：EnginePage / ProfilePage / AppShell / ProgressDashboard / RoadmapPage / TrackDetailPage + design-tokens.css(v3) + icon-map + REGISTRY
> 寄存器：product（设计服务产品，基调克制、功能优先，非营销花活）
> 三轴刻度：Variance 4 / Motion 3 / Density 6（沿用 v3，不上调）
> P0 校验：✅ 零 emoji（锁定态改用 `lock` 图标）· ✅ 无紫粉渐变 · ✅ 全走 Design Token · ✅ 主轴展示真实 nextCourse 内容（非模板 Hero）· ✅ 无弹跳缓动

---

## 0. 对齐结论与现有 P0 违规（必读，先修）

读码发现 3 处当前违规 / 隐患，应在本次重构顺手修掉，否则新设计仍会带病：

| # | 位置 | 问题 | P0 影响 | 修复（设计侧指定） |
|---|------|------|---------|-------------------|
| P0-1a | `EnginePage.tsx:230 / 256 / 342` | 锁定态用 `🔒` emoji（`需先完成…🔒` / `🔒 未解锁` / 锁定操作按钮 `🔒`） | **违反 P0-1**（emoji 作功能图标） | 全量替换为 `<Icon name="lock" size={16} />`，配色 `--muted`；REGISTRY 补 `lock: Lock`（见 §9） |
| P0-1b | `Icon.tsx` REGISTRY | 无 `lock` 语义名，缺图标会退化成 `paths` 或 null | 锁定态无处取图标 | 新增 `lock: Lock`（lucide-react@1.28.0 有 `Lock`） |
| P0-3a | `design-tokens.json` | 仍是 v1 值（accent `#0E7490` 青、bg `#F7F9FB` 冷），与 `design-tokens.css` v3（accent `#547C70` 森绿、bg `#F3F3E9` 暖米）**不一致** | 机器可读 token 与真源打架，前端 `import` JSON 会拿到错色 | 以 CSS v3 为准，回写 JSON（accent `#547C70` 等）。新 token 同时落 CSS + JSON |
| 轻微 | `ProfilePage.tsx:162` 头像文字 `color:'#fff'` | 硬编码（属 #fff 例外，但应走 `--accent-on`） | 非阻断 | 改 `var(--accent-on)` |
| 轻微 | `EnginePage.tsx:204` 状态标签 `background: statusColor()+'20'` | 动态拼 hex+alpha，非 token | 非阻断 | 改用既有 `--success-soft/--warn-soft/--accent-soft` 等语义底色（与 `HomeLearningPaths` 一致写法） |

---

## 1. 导航级重构总览

### 1.1 外层导航收敛（AppShell 改动方向，仅给视觉约束，不写代码）
- **侧栏**：保留 `首页(/)` 与 `学习(/engine)` 两个一级入口；删除「成长」分组里的 `职业路径(/roadmap)` 独立项（301 重定向到 `/engine?tab=career`）。
- **工具分组**（SQL 沙盒 / 工厂仿真 / 英文词典）保持不动。
- **移动端 TabBar**：`首页 / 学习 / SQL / 工厂 / 我的` 不变；「学习」即新的主着陆默认进 `/engine`（默认 `tab=overview`）。
- 首页降级为轻量欢迎页：保留 `GreetingBar` 问候 + 一个精简进度概览（复用统一 `ProgressRing`），移除 `ProgressDashboard` 深色驾驶舱大块（该进度能力整体迁进「学习」四视图，见 §7）。

### 1.2 四视图结构（同一份进度的四个切面）
`/engine` 顶部一根**分段控制器**切四个视图，`tab` 走 URL query（`?tab=overview|courses|paths|career`），刷新/分享可还原（与现有 `RoadmapPage` 的 `?role=` 一致）。

| 视图 | tab | 实质内容 | 复用来源 |
|------|-----|---------|----------|
| 概览 | `overview` | **nextCourse 主轴卡 + 完成度环 + 路径总览 + 关键统计** | 新合成（取 EnginePage 主轴卡 + 路径总览） |
| 课程 | `courses` | 课程体系：阶段视图 + 6 态课程列表 | EnginePage「阶段视图」+「课程进度」+ CoursesPage |
| 路径 | `paths` | 学习路径：路径选择器 + 阶段卡片 + 切换预览 | EnginePage「路径选择器」+ 阶段/切换 |
| 职业 | `career` | 岗位能力路径图（矩阵/阶梯）+ 路线详情 | **复用 RoadmapPage + TrackDetailPage 作为子视图** |

> 关键纪律：**nextCourse 主轴仅出现在「概览」顶部**，课程/路径/职业三视图不重复放置，避免主轴被稀释（与需求一致）。

---

## 2. 分段控制器（四视图切换）视觉规范

四视图 = 一个 `role="tablist"` 分段控制器。禁用弹跳缓动；选中态不烧 accent 配额（用「白药丸浮于灰轨道」的克制表达，与 Linear/Notion 一致）。

### 2.1 轨道（Track）
- 容器：`--seg-track-bg: var(--surface-2)`（微米色轨道）+ `1px solid var(--seg-track-border: var(--border))` + `border-radius: var(--seg-track-radius: var(--radius-pill))`。
- 内边距：`--seg-pad-y: var(--space-1)`（4px）上下，`--seg-pad-x: var(--space-2)`（8px）左右。
- 段间距：`--seg-gap: 2px`。

### 2.2 段（Segment / tab）
- 每项是 `<button role="tab">`，高：`--seg-h: 40px`（桌面）；移动端 `min-height: 44px`（触摸兜底）。
- 内边距：`--seg-item-pad-x: var(--space-3)`（12px），`--seg-item-pad-y: var(--space-2)`（8px）。
- 圆角：`--seg-item-radius: var(--radius-pill)`。
- 字体：`--seg-font: var(--text-sm)`（13px）· 字重 `--seg-weight: var(--weight-emph)`（510）· 字距 0（中文不加 track）。
- 图标：每项下挂一个 16px 语义图标（`overview→stage` / `courses→book-open` / `paths→route` / `career→briefcase`），未选中用 `--seg-icon: var(--muted)`（光学补偿：16px 与 13px 文字并排用 muted），选中用 `--seg-icon-active: var(--fg-2)`。
- **未选中态**：`background: transparent`；文字 `--seg-fg: var(--muted)`。
- **选中态**：`background: var(--seg-bg-active: var(--surface))`（白药丸）+ `box-shadow: var(--seg-indicator-shadow: var(--elev-ring))`（0 0 0 1px border，Hairline First 不靠阴影）+ 文字 `--seg-fg-active: var(--fg)` + 字重 `--seg-weight-active: var(--weight-announce-cjk)`（600）。

### 2.3 指示器（Indicator）与动效
- 实现建议：选中段 painted 白药丸，**做 150ms 颜色+阴影过渡**即可，不强制滑动条；若做滑动指示条，`transform`/`background-position` 用 **`--seg-transition: var(--motion-fast) var(--ease-standard)`**（即 150ms · cubic-bezier(0.2,0,0,1)）。
- **🚫 绝对禁止**：`cubic-bezier(0.68,-0.55,0.265,1.55)`、任何 elastic/overshoot、弹簧物理；过渡时长不超过 `--motion-base`(220ms)。
- `prefers-reduced-motion` 下过渡坍缩为 0（继承全局 `@media` 规则）。
- 键盘：`←/→` 在 tablist 内移动焦点，`Enter/Space` 激活；`:focus-visible` 套 `--focus-ring`。每个 tab 带 `aria-selected` 与对应 `role="tabpanel"` 的 `aria-labelledby`。

### 2.4 尺寸总览
```
轨道高度 ≈ 48px（40 内容 + 8 内边距）
单段最小点击区 44×44（移动端）
四段总宽自适应，容器 max-width: var(--container-app) 内左对齐
```

---

## 3. nextCourse 主轴区（仅「概览」顶部）

真实产品内容即主轴（满足 P0-4：不整口号 Hero），结构沿用现有 EnginePage「完成度 + 下一门课」双栏卡，但**仅挂在 overview**。

### 3.1 卡片结构（两栏）
```
┌─────────────────────────────────────────────────────────────┐
│  [完成度 ProgressRing]     下一步（eyebrow caps）            │
│   {pathName}               {courseName}  [status tag]        │
│   继承{n}·新学{n}·{total}门   {doing→ 百分比+进度条}           │
│                             {locked→ 需先完成：A → B（lock 图标）}│
│                             [主按钮 CTA]  [次按钮（inherit 时跳过）]│
└─────────────────────────────────────────────────────────────┘
```
- 左栏：统一 `ProgressRing`（见 §7），中心显示 `{completion}%`，下方 `{pathName}` + 继承/新学/总门计数（`--meta`）。
- 右栏：主轴信息。

### 3.2 信息层级（右栏）
1. **Eyebrow**（最上）：全大写小标签 `下一步` / 上下文态 `继续学习` / `开始学习` / `继承课程`（复用现有 statusLabel 逻辑），`--caps` 样式（`--tracking-caps` + `--meta` + `--text-xs`）。
2. **课程名**：`--axis-course-size: var(--text-lg)`（18px）· `--weight-announce-cjk`(600) · `--axis-course-fg: var(--fg)`。
3. **状态标签**：复用现有 6 态（`completed/inherited/skipped/doing/locked/pending`）→ 映射到 `.pill-ok/.pill-warn` 或中性 `.tag`，**不新增配色**。
4. **进度**：`doing` 时显示百分比 `--axis-pct-fg: var(--accent)`（等宽 `--font-mono`）+ `ProgressBar`（`--progress-h-md` 6px）；`locked` 时显示前置依赖文本 + `lock` 图标（**禁 emoji**）。
5. **CTA**（底部一行）：
   - 主按钮：`btn btn-primary`（ink-solid 墨色底，v3 主按钮规范），文案 `继续学习/开始学习/开始重学`，内挂 `run`(16) 图标 → 链 `/courses/{courseId}`。
   - 次按钮（仅 `inherited`）：`btn btn-secondary` `跳过`（内挂 `hide` 图标）。
   - `locked`：不渲染按钮，改渲染依赖说明（纯文本 + lock 图标），避免假可点。

### 3.3 设计意图
- 主轴 = 「你现在唯一该做的那件事」，与 Duolingo「下一课」锚点同源：降低认知负荷、制造习惯闭环。
- 完成度环提供「全局进度」上下文，但不抢主轴（环用中性色，仅弧线 fill 用 `--accent`，计为 1 处系统级 accent）。

---

## 4. 四视图布局草图

### 4.1 概览（overview）
- **顶部**：§3 主轴卡（唯一 nextCourse 出现处）。
- **路径总览**：沿用现有「所有学习路径」卡片网格（minmax 280px 自适应），每张卡显示 pathName + completion% + `ProgressBar` + 继承/新学/总门；激活路径卡用 `border-color: var(--accent-border)` 高亮（不整卡染 accent）。
- **关键统计条**（可选，替代原侧栏/首页统计）：一行 4 个紧凑指标（已学章节 / SQL 通过 / 连续学习天 / 课程数），复用 `ProfilePage` 的 4 统计排布，但搬到 overview 顶部右侧或主轴卡下方。数据全部来自统一 store（§7）。
- 空状态：无进行中课程 → 主轴卡显示「选择一条学习路径开始」+ 路径总览引导卡（复用 `EmptyState`）。

### 4.2 课程（courses）
- 顶部：当前激活路径名 + 路径切换提示（轻量，不再用大按钮组；可复用「路径选择器」的紧凑 chip 版）。
- 主体：沿用 EnginePage「阶段视图」（阶段卡片 + 解锁/锁定态）+「课程进度」面板（6 态课程行：序号/状态图标/名称/状态 pill/进度条/操作）。
- 复用既有 `StatusBlock`/`progress-track` 组件，零新代码。
- 每门课程行底部新增 **「通往：{岗位}」反向链接**（见 §6），形成闭环。

### 4.3 路径（paths）
- 顶部：路径选择器（现有 `btn-sm` 切换，激活态 `btn-primary`）+ 「课程体系 / 学习路径」文字链（保留，但指向本页其他 tab 而非独立路由）。
- 主体：阶段卡片网格（解锁亮度正常、未解锁 `opacity:0.5` + `border: var(--border-soft)`）+ 路径切换预览 alert（继承收益）。
- 继承横幅（`alert-ok`）保留。

### 4.4 职业（career）
- **直接复用** `RoadmapPage` 组件树：`RoleSelector`（`?role=`）+ `RoadmapMatrix`/`RoadmapStair` + `CareerAside`。
- 以「子视图」形态嵌在 `/engine?tab=career` 的 tabpanel 内（不新建路由，301 旧 `/roadmap` 重定向到此）。
- `TrackDetailPage`（`/tracks/:slug`）仍独立路由（从节点点进路线详情），但其内增加「去学习这一级」反向链接（§6）。
- 职业视图的 accent 配额：进度环 `done` 弧（系统级 1 处）+ 「去学习」链接（1 处），共 ≤2。

---

## 5. 职业视图 career→topic 反向链接与学习闭环

目标：让用户「为职业而学」——职业节点能一键跳去实际课程，学完课程又能看到它通往哪些岗位。

### 5.1 career → topic（职业节点 / 路线详情 → 课程）
- **矩阵节点**（RoadmapNode）：非 `planned` 节点当前链 `/tracks/:slug#level-l{n}`。新增**次级「去学习」affordance**：节点右下角一个 `book-open`(16, `--muted`) 图标按钮，文案 `去学习`，深链到对应课程 `/courses/{topicId}`（topicId 由数据层在节点上提供 `node.topicId` / `node.learnUrl`）。
- **路线详情**（TrackDetailPage・TrackLevelSection）：每个等级区末尾加 `去学习 / 复习` 文字链（`run` 或 `rotate-ccw` 图标 + `--loop-link-fg: var(--accent)` 文本），指向该等级所含章节对应的 `/courses/{topicId}`。
- 视觉：次级链接用 accent 文本（职业视图 1 处 accent），与节点主链接（track 详情）区分层级——主链去「路线详情」，次链去「直接学」。

### 5.2 topic → career（课程 / 路径 → 岗位，闭环回收）
- **课程行 / 路径卡**：底部加一行「通往：{岗位列表}」，`briefcase`(16, `--muted`) + 岗位名 `text-link`（accent，1 处），点回 `/engine?tab=career&role={slug}`。
- 数据来源：课程/阶段 → 关联岗位映射（架构侧提供 `topic.careerSlugs`）；缺失时该行不渲染（不占位）。

### 5.3 闭环表达（图标语义，全走 REGISTRY）
- 职业→课程：`book-open` / `run`（去学）
- 课程→职业：`briefcase` / `target`（通往岗位）
- 双向关系可用 `git-branch`(trace) 作「能力溯源」角标，暗示双向打通，但**仅作装饰性小角标，不烧 accent**（用 `--meta`）。

---

## 6. 统一进度展示组件规范（三份实现 → 一份数据源）

### 6.1 数据源收敛（设计契约，非实现）
三处进度（首页 `.dash` 深色环、侧栏 `SidebarProgress`、个人中心浅色卡）当前各自用 `api.progress()`+`api.topics()`+`api.chapters()` 重算。重构后：
- 抽一个**统一进度 hook/store**（如 `useProgress()`），归一化 React Query 缓存，输出 `{ doneChapters, totalChapters, pct, byPath, byTopic, streak, level }`。
- 四视图 + 侧栏 + 个人中心都只消费这**一份**派生值；任何切面改了进度，全站即时一致。
- 设计不规定 store 写法，但规定：**所有进度可视化必须走下方两个组件，禁止再手写 `.dash-ring`/`.sidebar-progress-fill`/`.progress-fill`/`.dash-goal-fill`/`SkillBar` 内联条**。

### 6.2 ProgressRing（环形，用于概览主轴 / 路径总览 / 职业 summary）
- 几何：沿用现有 `viewBox 0 0 120 120`、`r=52`、`rotate(-90)` 起跑（12 点方向），与 `ProgressDashboard.ProgressRing` 一致。
- Token：
  ```
  --progress-ring-size: 120px;                 /* 显示尺寸（主轴可放 96-120）*/
  --progress-ring-thickness: 10;               /* viewBox 单位描边宽 */
  --progress-ring-track: var(--progress-track);
  --progress-ring-fill: var(--progress-fill);          /* doing / 进行中 */
  --progress-ring-fill-done: var(--progress-fill-done);/* 完成 */
  --progress-ring-value-fg: var(--fg);
  --progress-ring-value-size: var(--text-2xl); /* 24px 居中数字 */
  --progress-ring-value-font: var(--font-mono);
  --progress-ring-caption-fg: var(--meta);
  --progress-ring-caption-size: var(--text-xs);
  ```
- 中心显示 `{pct}%`（等宽）+ 下方 caption（如「总进度」）。
- a11y：`role="img"` + `aria-label="{label} {pct}%"`，轨道/弧用 `circle` 不依赖颜色单通道（数字+caption 提供文本等价）。

### 6.3 ProgressBar（线性，用于课程行 / 阶段卡 / 统计）
- 复用现有 `.progress-track`/`.progress-fill` 语义，补高度 token：
  ```
  --progress-track: var(--surface-3);          /* 已存在 C-extension */
  --progress-fill: var(--accent);              /* 进行中 */
  --progress-fill-done: var(--success);        /* 完成 */
  --progress-h-sm: 4px;                        /* 行内紧凑 */
  --progress-h-md: 6px;                        /* 卡片/区块 */
  --progress-radius: var(--radius-pill);
  ```
- 进度条须带 `role="progressbar"` + `aria-valuenow/min/max`（现有 EnginePage 已做，保留）。

### 6.4 收敛后的视觉一致性
- 环与条共用 `--accent`(进行中) / `--success`(完成) 双语义色，全站同一套进度语言。
- 侧栏 `SidebarProgress` 改为调用统一 hook + `ProgressBar`（删掉独立 `api.progress` 计算）；个人中心 `SkillBar` 内联条改用 `ProgressBar`（`--progress-h-sm`）。

---

## 7. 配色 / 字体 / 对标品牌（延续 v3，严禁紫粉渐变）

### 7.1 配色（以 design-tokens.css v3 为准，非 JSON）
- 强调色 `--accent: #547C70`（低饱和森绿）· `--accent-on: #fff` · `--accent-hover/active` 派生。
- 墨色锚点 `--brand-ink / --ink-solid: #2d3a33`（主按钮底、分段控制器选中靠白药丸而非墨色）。
- 底 `--bg: #F3F3E9`（暖米）· 卡 `--surface: #fff` · 内嵌 `--surface-2: #F7F7EF` · 槽 `--surface-3: #EAEAE0`。
- 语义 `--success #15803d` / `--warn #b45309` / `--danger #b91c1c`。
- **零紫粉渐变**；accent 每屏可见块面 ≤2（进度环 fill 计 1 系统级，链接/CTA 文本计 ≤1）。

### 7.2 字体
- 标题/正文：`'Archivo Variable', 'Noto Sans SC Variable', …`（Latin 走 Archivo，CJK 回落 Noto Sans SC）。
- 等宽/数字：`'JetBrains Mono Variable'`（进度百分比、计数、工单号统一 tabular-nums）。
- 字重三级：read 400 / emph 510(CJK 500) / announce 590(CJK 600)。
- 分段控制器 13px·510；主轴课程名 18px·600；eyebrow 全大写 12px·`--tracking-caps`。

### 7.3 对标品牌（product 寄存器）
- **Linear**：克制分段控制、安静的选中态、零装饰阴影。
- **Notion**：视图切换器（view switcher）的信息密度与平滑动效（非弹跳）。
- **Duolingo**：下一课锚点 + 渐进披露（当前高亮、未来置灰）+ 进度环 closure 动机。
- **Coursera「My Learning」**：In Progress / Completed 等分段 Tab 的课程管理范式。

---

## 8. 响应式与无障碍要点
- 分段控制器：`<1024px` 四段可横向滚动或换行；移动端段高 `min-height:44px`、`font-size` 维持 13px。
- 主轴卡：`<768px` 双栏塌为单栏（环在上、主轴信息在下），CTA 全宽。
- 职业矩阵：`<768px` 走 `RoadmapStair`（纵向阶梯，SVG 连线不挂载，沿用现有 `useIsNarrow`）。
- 触摸目标：所有 tab / CTA / 反向链接 ≥44×44。
- 焦点：`focus-visible` 全组件套 `--focus-ring`；tablist 键盘可达。
- `prefers-reduced-motion`：过渡坍缩（全局规则已覆盖）。
- 对比度：正文 `--fg #222` on `--bg #F3F3E9` 远超 4.5:1；muted 仅用于辅助文字。

---

## 9. design-tokens 草案（新增变量名 + 取值，均引用既有原语）

> 落到 `design-tokens.css`（`:root` 内 B-slot / C-extension 段）并同步回 `design-tokens.json`。

### 9.1 分段控制器（B-slot 组件插槽）
```css
--seg-track-bg: var(--surface-2);
--seg-track-border: var(--border);
--seg-track-radius: var(--radius-pill);
--seg-pad-y: var(--space-1);     /* 4px */
--seg-pad-x: var(--space-2);     /* 8px */
--seg-gap: 2px;
--seg-h: 40px;
--seg-item-pad-x: var(--space-3);/* 12px */
--seg-item-pad-y: var(--space-2);/* 8px */
--seg-item-radius: var(--radius-pill);
--seg-font: var(--text-sm);      /* 13px */
--seg-weight: var(--weight-emph);            /* 510 */
--seg-weight-active: var(--weight-announce-cjk); /* 600 */
--seg-fg: var(--muted);
--seg-fg-active: var(--fg);
--seg-bg-active: var(--surface);
--seg-indicator-shadow: var(--elev-ring);    /* 0 0 0 1px border */
--seg-icon: var(--muted);
--seg-icon-active: var(--fg-2);
--seg-transition: var(--motion-fast) var(--ease-standard); /* 150ms · cubic-bezier(0.2,0,0,1) */
```

### 9.2 nextCourse 主轴（B-slot）
```css
--axis-gap: var(--space-6);
--axis-eyebrow-fg: var(--meta);
--axis-course-fg: var(--fg);
--axis-course-size: var(--text-lg);          /* 18px */
--axis-pct-fg: var(--accent);                /* 系统级 1 处 accent */
--axis-pct-font: var(--font-mono);
```

### 9.3 统一进度（C-extension，学习专属）
```css
/* 环形 */
--progress-ring-size: 120px;
--progress-ring-thickness: 10;
--progress-ring-track: var(--progress-track);
--progress-ring-fill: var(--progress-fill);
--progress-ring-fill-done: var(--progress-fill-done);
--progress-ring-value-fg: var(--fg);
--progress-ring-value-size: var(--text-2xl);
--progress-ring-value-font: var(--font-mono);
--progress-ring-caption-fg: var(--meta);
--progress-ring-caption-size: var(--text-xs);
/* 线性（track/fill/done 已存在于 C-extension，仅补高度） */
--progress-h-sm: 4px;
--progress-h-md: 6px;
--progress-radius: var(--radius-pill);
```

### 9.4 职业↔课程 反向链接（B-slot）
```css
--loop-link-fg: var(--accent);     /* 职业视图 1 处 accent */
--loop-link-icon: var(--muted);
```

### 9.5 图标 REGISTRY 增补（非 token，但 P0 必需）
```ts
// Icon.tsx REGISTRY 新增一行：
lock: Lock,   // lucide-react@1.28.0 原生 Lock；锁定态替代 🔒 emoji
```
（现有 REGISTRY 已 import 列表需加入 `Lock`；其余锁定态全部改用 `name="lock"`。）

---

## 10. 落地检查清单（给前端 / 架构）
- [ ] `design-tokens.json` 回写为 v3 真值（accent `#547C70` 等），与 CSS 一致。
- [ ] 新增 §9.1–9.4 token 到 CSS `:root` 与 JSON。
- [ ] `Icon.tsx` 补 `lock: Lock`，全站 `🔒` 清零。
- [ ] 分段控制器组件：4 tab + `?tab=` 路由 + 键盘 + a11y + 150ms 非弹跳动效。
- [ ] nextCourse 主轴卡仅在 `overview` 渲染。
- [ ] 抽 `useProgress()` 统一 store，三处进度实现改为消费它。
- [ ] 职业视图以子视图嵌 `/engine?tab=career`；`/roadmap` 301 → 该 URL。
- [ ] 职业节点 / 路线详情加「去学习」；课程 / 路径卡加「通往岗位」反向链接。
- [ ] 严禁紫粉渐变、严禁 emoji、严禁硬编码色值、严禁弹跳缓动。

---

## 11. 四视图设计提示词（Phase 2 · 直接落地版）

> 给前端 / 架构的逐视图实现提示。所有视觉值一律走 §9 token（CSS `:root` 与 `design-tokens.json` 已落位且 v3 对齐）。图标名全部走 `Icon.tsx` REGISTRY（lucide-react@1.28.0，stroke 2，16/20/24px），**禁止 emoji**。
> 图标增补（架构侧 P0 必需）：REGISTRY 须覆盖 `lock / rotate-ccw / target / git-branch`（lucide 均原生存在）；全站 `🔒` emoji 清零。

### 11.1 分段控制器（四视图切换）
- **位置**：`EngineLayout` 顶部，`--container-app` 内左对齐；与下方内容间距 `--space-6`(24px)。
- **语义**：`role="tablist" aria-label="学习视图"`（与内层 `RoleSelector` 的 `aria-label="岗位"` 区分，双层 tablist 合法）。
- **a11y / 键盘**：复用 `RoleSelector` 的 WAI-ARIA Tabs 骨架——roving tabindex（选中 `tabindex=0`、其余 `-1`）、`←/→/Home/End` 移动、`Enter/Space` 激活、选中段 `aria-selected="true"`、对应 `tabpanel` 设 `aria-labelledby`。
- **四段定义**：
  | tab 值 | 图标(name / 尺寸) | 文案 |
  |--------|-------------------|------|
  | overview | `stage`(=Target) 16 | 概览 |
  | courses | `courses`(=BookOpen) 16 | 课程 |
  | paths | `paths`(=Route) 16 | 路径 |
  | career | `briefcase` 16 | 职业 |
- **视觉（§9.1 token）**：
  - 轨道：`background var(--seg-track-bg)` + `border 1px var(--seg-track-border)` + `border-radius var(--seg-track-radius)`；`padding var(--seg-pad-y) var(--seg-pad-x)`；段间距 `var(--seg-gap)`。
  - 段按钮：`height var(--seg-h)`(40px)；`padding var(--seg-item-pad-y) var(--seg-item-pad-x)`；`border-radius var(--seg-item-radius)`；字号 `var(--seg-font)`(13px)；字重 `var(--seg-weight)`(510)；16px 图标与文字并排。
  - 未选中：`background transparent`；`color var(--seg-fg)`(=muted #606864)；图标 `color var(--seg-icon)`(=muted，光学补偿)。
  - 选中：`background var(--seg-bg-active)`(=surface #fff 白药丸)；`box-shadow var(--seg-indicator-shadow)`(=elev-ring，0 0 0 1px border，Hairline First 不添阴影)；`color var(--seg-fg-active)`(=fg #222)；字重 `var(--seg-weight-active)`(600)；图标 `color var(--seg-icon-active)`(=fg-2 #3d4540)。
  - 动效：选中态仅 150ms 颜色+阴影过渡 `var(--seg-transition)`(=motion-fast·ease-standard = 150ms cubic-bezier(0.2,0,0,1))；**禁止滑动弹性**；`prefers-reduced-motion` 坍缩为 0。
  - 焦点：`:focus-visible` 套 `var(--focus-ring)`。
- **响应式**：`<1024px` 四段可横向滚动（`overflow-x:auto`，隐藏滚动条）或换行；移动端段 `min-height 44px`（触摸兜底），字号维持 13px。
- **URL 驱动**：tab 值写 `?tab=overview|courses|paths|career`，刷新/分享可还原；默认 `overview`。

### 11.2 nextCourse 主轴卡（仅「概览」顶部）
- **结构**：两栏（grid/flex，`gap var(--axis-gap)`=24px）。左栏 `ProgressRing`，右栏主轴信息。卡片套标准 `--card-*`（bg `var(--card-bg)`、border `1px var(--card-border)`、radius `var(--card-radius)`=12px、padding `var(--card-padding)`=20px）。
- **左栏 ProgressRing（§9.3）**：
  - 组件：统一 `ProgressRing`（`viewBox 0 0 120 120`、`r=52`、`rotate(-90)` 起跑）。显示尺寸 `var(--progress-ring-size)`=120px（概览可用 96–120px）。
  - 轨道圆：`stroke var(--progress-ring-track)`(=surface-3 #EAEAE0)；`stroke-width var(--progress-ring-thickness)`=10。
  - 进度弧：doing 态 `stroke var(--progress-ring-fill)`(=accent #547C70)；done 态 `stroke var(--progress-ring-fill-done)`(=success #15803d)。弧 fill 计 1 处系统级 accent。
  - 中心数字：`{completion}%`，`font-family var(--progress-ring-value-font)`(=font-mono)，`font-size var(--progress-ring-value-size)`(=text-2xl 24px)，`color var(--progress-ring-value-fg)`(=fg #222)。
  - 下方 caption：如「总进度」，`font-size var(--progress-ring-caption-size)`(=text-xs 12px)，`color var(--progress-ring-caption-fg)`(=meta #8a928d)。
  - a11y：`role="img"` + `aria-label="{pathName} 总进度 {completion}%"`；数字+caption 提供文本等价，不依赖颜色单通道。
- **右栏信息层级（自上而下）**：
  1. Eyebrow：全大写小标签（下一步 / 继续学习 / 开始学习 / 继承课程，复用现有 statusLabel 逻辑）。样式 = `.caps`（`text-transform:uppercase` + `letter-spacing var(--tracking-caps)`(0.08em) + `font-size var(--text-xs)`(12px) + `color var(--axis-eyebrow-fg)`(=meta #8a928d) + `font-weight var(--weight-emph)`(510)）。
  2. 课程名：`font-size var(--axis-course-size)`(=text-lg 18px)，`font-weight var(--weight-announce-cjk)`(600)，`color var(--axis-course-fg)`(=fg #222)，`line-height var(--leading-snug)`。
  3. 状态标签：复用现有 6 态（completed/inherited/skipped/doing/locked/pending）→ 映射到 `.pill-ok`/`.pill-warn` 或中性 `.tag`，**不新增配色**。
  4. 进度行：
     - doing：右侧显示百分比 `font-family var(--axis-pct-font)`(=font-mono) `color var(--axis-pct-fg)`(=accent #547C70) + `ProgressBar`（`track var(--progress-track)`、`fill var(--progress-fill)`(accent)、`height var(--progress-h-md)`=6px、`radius var(--progress-radius)`=pill）。
     - locked：显示前置依赖文本（如「需先完成：A → B」）+ `Icon name="lock" size={16} color var(--muted)`(#606864)。**禁 emoji**。
  5. CTA 行（底部，`gap var(--space-3)`=12px）：
     - 主按钮：`class="btn btn-primary"`（v3 墨色底 `var(--btn-primary-bg)`=ink-solid #2d3a33，fg `var(--btn-primary-fg)`=#fff），文案 继续学习/开始学习/开始重学，内挂 `Icon name="run" size={16} color var(--btn-primary-fg)`；链 `/courses/{courseId}`。
     - 次按钮（仅 inherited 态）：`class="btn btn-secondary"`，文案 跳过，内挂 `Icon name="hide" size={16}`。
     - locked 态：不渲染按钮，改渲染依赖说明（纯文本 + lock 图标），避免假可点。
- **空状态**（无进行中课程）：主轴卡显示「选择一条学习路径开始」+ 引导文案；路径总览区显示引导卡（`EmptyState` 组件，含「浏览路径」CTA）。
- **响应式**：`<768px` 双栏塌为单栏（环在上、主轴信息在下），CTA 全宽（`min-height 44px`）。

### 11.3 概览视图 OverviewView
- **布局**：纵向流，`--container-app` 内，section 间距 `var(--section-y-desktop)`=48px（移动 28px）。
- **区块顺序**：
  1. nextCourse 主轴卡（唯一 nextCourse 出现处，见 11.2）。
  2. 路径总览：沿用现有「所有学习路径」卡片网格（`grid auto-fill minmax(280px,1fr)`）。每张卡：pathName（text-lg 600）+ completion%（font-mono accent）+ `ProgressBar`（`h-sm` 4px）+ 继承/新学/总门计数（meta）。激活路径卡高亮：`border-color var(--accent-border)`，不整卡染 accent。
  3. 关键统计条（可选）：一行 4 个紧凑指标（已学章节 / SQL 通过 / 连续学习天 / 课程数），数据来自统一 `useProgress()` store；每指标 = 数字(font-mono, text-2xl) + 标签(text-xs meta caps)。复用 ProfilePage 4 统计排布，搬到主轴卡下方右侧或独立一行。
- **空状态**：无进行中课程 → 主轴卡空态（见 11.2）+ 路径总览引导卡。
- **accent 配额**：进度环 fill(1) + 路径激活高亮 border(非块面，不算) + 统计条若有 accent 文本(≤1)。总 ≤2。

### 11.4 课程视图 CoursesView
- **布局**：顶部路径切换条 + 主体阶段视图 + 课程进度面板。
- **顶部**：当前激活路径名（text-xl 600）+ 轻量路径切换（紧凑 chip 版「路径选择器」，激活 chip = `btn-primary`）。不再用大按钮组。
- **主体**：
  - 阶段视图：阶段卡片网格（沿用 EnginePage 阶段视图）。阶段卡片：标题 + 解锁/锁定态。未解锁阶段 `opacity 0.5` + `border var(--border-soft)`；解锁阶段正常亮度。
  - 课程进度面板：6 态课程行（沿用 `StatusBlock` / `progress` 语义，零新组件）。每行：序号(text-xs meta) / 状态图标(`Icon` 16，按态选色：doing→accent、done→success、locked→lock+muted、pending→meta) / 课程名(text-base) / 状态 pill / `ProgressBar`(`h-sm` 4px，doing=accent、done=success) / 操作按钮(btn-sm)。
  - 每行底部新增「通往：{岗位}」反向链接：`Icon name="briefcase" size={16} color var(--loop-link-icon)`(=muted) + 岗位名 text-link `color var(--loop-link-fg)`(=accent)，链 `/engine?tab=career&role={slug}`。数据缺（`topic.careerSlugs` 空）时整行不渲染。
- **空状态**：路径下无课程 → 课程列表区 `EmptyState`（「该路径课程筹备中」+ 返回路径选择）。
- **accent 配额**：进度条 fill(系统级) + 反向链接文本(1) + 激活 chip(非块面)。≤2。

### 11.5 路径视图 PathsView
- **布局**：顶部路径选择器 + 主体阶段卡片网格 + 继承横幅。
- **顶部**：路径选择器（btn-sm 切换，激活态 `btn-primary`）+ 「课程体系 / 学习路径」文字链（指向本页其他 tab，不跳独立路由）。
- **主体**：阶段卡片网格（`minmax(240px,1fr)`）。解锁亮度正常；未解锁 `opacity 0.5` + `border var(--border-soft)`。阶段卡内：阶段名(text-lg) + 课程数(meta) + 完成进度 `ProgressBar`(`h-md` 6px)。
- **继承横幅**：`alert-ok` 组件（`background var(--success-soft)`、`border 1px var(--success-border)`、fg `var(--fg)`），文案「继承收益：已完成 X 门可直通」。
- **空状态**：无激活路径 → 引导选择路径（`EmptyState` + 路径选择器高亮）。
- **accent 配额**：进度条 fill + 激活选择器(非块面)。≤2。

### 11.6 职业视图 CareerView
- **形态**：直接复用 `RoadmapPage` 组件树（`RoleSelector` + `RoadmapMatrix`/`RoadmapStair` + `CareerAside`）作为 `/engine?tab=career` 的 tabpanel 内嵌子视图。不新建路由；旧 `/roadmap` 301 → `/engine?tab=career`。`RoadmapPage` 需加 `embedded` prop 跳过自身 `<h1>`（避免标题嵌套/套娃）。
- **内层 `RoleSelector`**：`role="tablist" aria-label="岗位"`（与外层「学习视图」tablist 区分，双 tablist 合法）。`?role=` 驱动选中岗位。
- **职业→课程 反向链接（学习闭环）**：
  - 矩阵节点（`RoadmapNode`）：非 `planned` 节点右下角加 `Icon name="book-open" size={16} color var(--loop-link-icon)`(=muted) 图标按钮，文案「去学习」，链 `/courses/{topicId}`（topicId 来自 `node.topicId` / `node.learnUrl`）。
  - 路线详情（`TrackDetailPage` 每等级区末尾）：加「去学习 / 复习」文字链，`Icon name="run"` 或 `name="rotate-ccw" size={16}` + `color var(--loop-link-fg)`(=accent) 文本，链 `/courses/{topicId}`。
  - 视觉：次链用 accent 文本（职业视图 1 处 accent），与节点主链（track 详情）区分层级。
- **accent 配额**：进度环 done 弧(系统级 1) + 「去学习」链接(1) = ≤2。
- **a11y**：节点「去学习」图标按钮带 `aria-label`（如「去学习：{topicName}」）；矩阵 `<768px` 走 `RoadmapStair` 纵向阶梯，SVG 连线不挂载（沿用 `useIsNarrow`）。

### 11.7 闭环与图标语义总表（全走 REGISTRY，禁 emoji）
- 职业→课程：`book-open` / `run`（去学）
- 课程→职业：`briefcase` / `target`（通往岗位）
- 双向关系可用 `git-branch` 作「能力溯源」角标（暗示双向打通），**仅装饰性小角标，不烧 accent**（用 `--meta`）。
- 锁定态：`lock`（替代 `🔒` emoji，P0-1）。
