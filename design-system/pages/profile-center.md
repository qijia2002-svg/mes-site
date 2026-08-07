# 个人中心（Profile / 账户枢纽）设计规格 · v1

> 来源：用户需求「设计一个全新的个人中心，既美观又易用，符合用户习惯」
> 寄存器 Register：**product** · 平台：**web**（桌面优先，响应式下探至平板/手机）
> 三轴刻度：**Variance 4 / Motion 3 / Density 6**（与全站一致，不另起炉灶）
> 依赖：`design-system/design-tokens.css`（v3.0）· `design-system/icon-map.md` · `components/AppShell.tsx`
> 对接现有页：`web/src/pages/ProfilePage.tsx`（将被本规格的重构稿替换）

---

## 0. 设计判据（为什么这么设计）

个人中心是学员进入平台后的「账户与学习全景」枢纽，本质是一块**工具型面板**，不是营销页、也不是消费级学习 App。

**用户习惯锚点**（熟悉感来自这里，而非花哨视觉）：
- **熟悉其形**：Linear / GitHub / Supabase 的账户页——第一眼看到「我是谁 + 我学到哪了 + 下一步去哪」，而不是标语或欢迎语。
- **熟悉其交互**：续学卡、进度条、贡献热力图、账户设置 Tab——全是已被验证的惯例，零学习成本。
- **反对清单（贴合 DESIGN.md 反目标）**：无成就徽章雨、无卡通吉祥物、无进度庆祝动画。「等级」只作低调进度指示，**不做勋章墙**；连续学习用 GitHub 式热力图而非烟花动效。

**唯一允许的视觉重心**：身份卡里的头像 + 关键指标，靠 `--ink-solid` 墨色块面与 `--accent` 进度填充制造锚点，不靠放大标题（首屏重心纪律见 DESIGN.md §2）。

---

## 1. 信息架构（IA）

路由：`/profile`（已在 AppShell 内，经顶栏头像 / 侧栏底部用户卡 / 移动端 tabbar「我的」进入——**不新增主导航项**，保持现有壳子结构）。

```
个人中心（页面标题 + 副标题 + 编辑资料 secondary）
│
├─ A. 身份卡 IdentityCard（满宽，Hairline Card）
│     ├─ 头像（96px 圆，accent 实底 + 首字）
│     ├─ 姓名 + 角色/阶段 chip + 一句话状态
│     └─ 4 项关键指标条（学习章节 · SQL 通过 · 连续学习 · 在学课程）
│
├─ B. 主区（两栏：主 1fr / 侧 340px；≤1024 塌单栏）
│   ├─ 主列
│   │   ├─ B1 继续学习 ContinueList（2–3 张续学卡）
│   │   ├─ B2 我的课程 MyCourses（列表 + 进度条 + 状态动作）
│   │   ├─ B3 技能掌握 SkillMastery（模块维度进度条，阈值着色）
│   │   ├─ B4 账户设置 Settings（Tab：资料 / 学习目标 / 通知）
│   │   └─ B5 作品集 PortfolioBoard（列表 + 分类筛选 + 内联增删改 + 空态四件套）
│   └─ 侧栏 Rail
│       ├─ R1 学习目标 & 连续学习（每日目标 + 贡献热力图 + 连续天数）
│       ├─ R2 账号（个人资料 / 通知偏好 / 安全 / 退出登录）
│       └─ R3 作品集预览（数量 + 最近 2 条 + 锚点 B5）
```

**布局容器**：内容区沿用 `--container-app: 1280px` 上限（原 ProfilePage 的 `maxWidth:760` 是旧约束，应放宽到约 `1120px` 内容上限，让两栏成立）。

---

## 2. 组件规范（全部复用既有 token 与类，零新色相、零新间距值）

### A. 身份卡 IdentityCard
- 容器：`.panel`（= `--surface` + 1px `--border` + `--radius-md` 12px + padding 24px，Hairline First 默认无阴影）。
- 头像：`96px` 圆，`background: var(--accent)`、`color: #fff`、首字 32px/700；hover 无变化（非交互元素，点击进设置）。右下角可叠 20px 编辑角标（`--surface` 圆 + `--border` + `Pencil` 16，可选）。
- 姓名：`--text-2xl`(24px)/700/`--fg`；角色 chip：`.tag`（`--surface-2` 底 + `--muted` 字 + `--radius-pill`）。
- 状态行：`--text-sm`/`--muted`，如「MES 实施方向 · 已学习 42 天」。
- 指标条：4 格，flex 等分，`1px --border-soft` 竖向分隔；每格 = 数值（`--text-xl`/700/`--fg` + tabular-nums）+ 标签（`--text-xs`/`--meta`）；图标 16px 用 `--muted`。

### B1. 续学卡 ContinueCard（grid 2 列，gap 16）
- 每卡：课程名（`--text-lg`/590）+ 下一章（`--text-sm`/`--muted`，`FileText` 16）+ 进度条（4px，`--progress-track`/`--progress-fill`）+ 「继续」`btn-primary`(ink) 或「复习」`btn-secondary`。
- hover：卡片 `border-color → --border-strong`（Hairline First，可叠加 `--elev-card-hover` 极轻阴影，不喧宾夺主）。

### B2. 我的课程 MyCourses（列表）
- 每行：`icon`(20, MES 领域概念如 `Boxes`/`Factory`/`Workflow`，`--muted`) + 标题（`--text-base`/600/`--fg`，`Link`）+ `done/total · pct%`（`--text-xs`/`--meta`）+ 进度条（4px，阈值色：done=`--success`/doing=`--warn`/todo=`--border`）+ 动作 `Link`（`btn-primary`/`btn-secondary`/`btn-ghost`）。
- 行分隔 `1px --border-soft`；hover 整行 `--surface-2`。

### B3. 技能掌握 SkillMastery（阈值着色进度条）
- 复用现有 `SkillBar` 思路，阈值色语义化：`pct≥80 → --success`（达标）/ `40–79 → --accent`（进行中）/ `1–39 → --warn`（偏弱）/ `0 → --meta`（未开始）。**全为数据语义色，不计入「每屏 ≤2 处强调色」chrome 配额**。
- 列布局：`repeat(auto-fit, minmax(220px,1fr))`，gap 16。

### B4. 账户设置 Settings（Tab 容器）
- Tab 条：`.caps` 风格标签 + 当前项 `2px --accent` 下指示条（无新色相）。三 Tab：
  - **资料**：昵称（`input text`）、角色/方向（`select`）。
  - **学习目标**：每日目标（章/天，`input number`，1–20）、学习提醒时间（`input time`）。
  - **通知**：学习提醒开关（`switch`，语义 `--accent` 开态）、社区/产品动态开关。
- 字段一律**可见 `<label>`**（`profileStore` 已要求，`LoginPage`/`AdminPage` 的 placeholder 当 label 违规不得复刻）。
- 保存：`btn-primary`(ink)「保存设置」+ 成功/失败反馈（成功 2s 自动消失的 `CircleCheck` 行内提示；失败明确告知「浏览器存储不可用」——沿用 `setProfile` 的 `{ok}` 契约）。

### R1. 学习目标 & 连续学习（HeatmapCard）
- 每日目标数值 + 单位；连续天数（`Flame` 16 + 数字）。
- **贡献热力图**：GitHub 式 52 周 × 7 行，单元 `10px` 方 + `3px` gap；空=`--surface-3`，活跃=`--accent`，高强度=`--accent-active`。图例「少 → 多」。这是贴合「用户习惯」的关键熟悉图案，克制不张扬。
- 注：当前 `progressQ.data.events` 无日期粒度，落地前需后端补「每日学习事件」或本地计算 streak（沿用现有 `streak` 算法）。

### R2. 账号（ListRow 组）
- 每行：`icon`(20) + 标题（`--text-base`/`--fg`）+ `ChevronRight`(16,`--meta`)；hover 整行 `--surface-2`。含：个人资料（锚到 B4）、通知偏好（锚到 B4 通知 Tab）、安全（占位/后续）、退出登录（`LogOut` + `--danger` 文字，secondary 触感）。

### R3. 作品集预览（PortfolioPreview，侧栏）
- 轻量入口：显示数量（如「2 篇」）+ 最近 2 条（标题 + 分类 tag + 日期）；底部「查看全部 →」锚点到 B5。
- 不在侧栏放置添加表单（避免 Rail 过载），增删改全部收口到 B5 独立整页。

### B5. 作品集 PortfolioBoard（独立整页板块，与我的课程同级）
- **形态**：列表行（复用「我的课程」列表语言），每条 = 分类色点（accent）+ 标题（`--text-base`/600/`--fg`）+ 分类 tag（`--accent-soft` 底 + `--accent` 字）+ 日期（`--text-xs`/`--meta`）+ 备注（`--text-sm`/`--muted`，`-webkit-line-clamp:2`）。
- **分类筛选**：顶部胶囊 `pf-filter`（全部 / 需求文档 / 实施笔记 / 方案 / 其他），当前项 `--accent-soft` 底 + `--accent` 字 + `--accent-border`；分类只有 4 种固定值，筛选比搜索更贴合。
- **添加 / 编辑**：点「+ 添加作品」`btn-primary`(ink) 展开内联表单（标题 / 分类 `select` / 日期 `input[type=date]` / 备注 `textarea`），带可见 `<label>`；编辑复用同一表单并回填，提交后滚动到该板块。
- **删除**：每条 `pf-del`（`--danger` 文字按钮，非红色块），`confirm` 二次确认；删除后同步 R3 预览数量与最近 2 条。
- **存储契约**：沿用 `addPortfolioItem` / `removePortfolioItem` 的 `{ok}` 返回；写入失败（隐私模式 / 存储禁用）显示 `hint-err`「浏览器存储不可用，无法保存」。
- **Empty 态四件套**（必有）：`Inbox` 48px 插图位 + 标题「还没有作品」+ 文案（会有什么 / 为何重要 / 如何开始）+ CTA「+ 添加作品」`btn-primary`(ink)。筛选导致某分类为空时显示「该分类下暂无作品」次级空态。

---

## 3. 状态覆盖（每个数据组件必交付 5 态）

| 组件 | Loading | Empty | Error | Populated | Edge |
|---|---|---|---|---|---|
| 身份卡 / 指标 | Skeleton（圆 + 条） | —（登录即有默认） | API 失败：卡片内 `CircleX` + 重试 | 正常 | 昵称超长 `-webkit-line-clamp:1` |
| 我的课程 | 行 Skeleton | 「还没有选课，去课程中心开始」+ CTA | 分类 + 重试 | 列表 | >200 行分页/虚拟滚动 |
| 续学 | 卡 Skeleton | 「暂无进行中的课程」+ 去课程 | 同上 | 2–3 卡 | — |
| 作品集(B5) | 列表 Skeleton | **四件套** + CTA | 存储禁用：`hint-err` 明确报错 | 列表 + 分类筛选 | 备注超长 clamp:2；分类空态次级提示 |

---

## 4. 响应式（断点 sm640 / md768 / lg1024 / xl1280，mobile-first）

| 宽度 | 导航 | 主布局 | 个人中心 |
|---|---|---|---|
| ≥1280 | Sidebar 240 展开 | 两栏 主1fr/侧340 | 完整两栏 |
| 1024–1280 | Sidebar 240 | 两栏 主1fr/侧300 | 两栏收紧 |
| 768–1024 | Sidebar 塌缩 56 图标条 | 单栏 | Rail 内容下沉到主列底部 |
| <768 | 汉堡 + 抽屉；tabbar「我的」 | 单栏 | 全部单栏堆叠，热力图横向滚动 |

触屏 `@media (pointer: coarse)`：按钮/列表行命中区 ≥44×44，间距 ≥8px。

---

## 5. 无障碍基线

- 对比度：正文 ≥4.5:1、UI ≥3:1（`--muted` 5.0:1、`--accent` 对白 5.36:1 已预验；`--meta` 仅限 12–13px 非关键信息）。
- 焦点：全站 `:focus-visible` 显式 `--focus-ring`，禁裸 `outline:none`。
- 状态不单靠颜色：进度条旁配 `done/total` 文字；热力图配连续天数数字；课程状态动作文字化（开始/继续/复习）。
- `prefers-reduced-motion: reduce`：关闭 tab 切换过渡、热力图入场、skeleton 微光。
- 表单：每个字段可见 label + `aria-describedby` 指向错误文案；switch 用 `role="switch"` + `aria-checked`。
- 跳转：`skip-link` 到 `#main`（AppShell 已有）。

---

## 6. 每屏强调色纪律（DESIGN.md §2 硬规则）

- **主按钮 = `--btn-primary-bg: var(--ink-solid)`（墨色 #2d3a33）**，制造深色锚点，不占 accent 配额。
- `--accent`（森绿）仅用于：① 进度填充 / 热力图活跃格 / 阶段指示（**数据语义，不作 chrome 配额**）② 当前导航项 / 链接 / 设置 Tab 下指示条。
- 标题一律 `--fg`，**不用强调色**。Badge/Tag 用 `-soft`/`--surface-2` 底 + 深字，不算配额。
- 一屏内 accent「可见 chrome」控制在 ≤2 处（典型：设置 Tab 当前指示 + 一个链接），其余靠墨色按钮与数据色承载。

---

## 7. 开发者落地（Handoff）

- **不新建 token**：所有值从 `design-tokens.css` v3 派生（颜色、间距、圆角、字阶、动效）。新增任何色值先进 token 再用。
- **复用既有类**：`.panel` / `.btn`(`.btn-primary`=ink / `.btn-secondary` / `.btn-ghost` / `.btn-danger`) / `.input` / `.field` / `.tag` / `.nav-item` / `.caps`。`ProfilePage.tsx` 现有逻辑（`computeLevel` / `SkillBar` / `streak` 算法 / `profileStore` / `portfolioStore`）**全部可复用**，仅重写 JSX 结构与布局为两栏 + Tab。
- **图标**：lucide-react@1.28.0 锁定，`16/20/24`、`strokeWidth=2`、`currentColor`；16px 与文字并排时用 `--muted`。新增图标从 `icon-map.md` 取（用户=`CircleUser`、设置=`Settings2`、退出=`LogOut`、火焰=`Flame`、目标=`Target`、数据库=`Database` 等），**绝不 emoji / 第二图标库**。
- **数据契约**：`api.progress` / `api.topics` / `api.chapters` 已就绪；热力图需 `events` 带日期维度（落地前补）。
- **动效**：tab 切换 ≤220ms `ease-out`（Motion 3，无 bounce / 无入场编排）；hover 150ms。
- **推荐实现顺序**：先身份卡 + 我的课程（最高杠杆、复用最多）→ 续学 + 技能掌握 → 设置 Tab → Rail（热力图 + 账号 + 作品集）。

---

## 8. 变更记录

| 日期 | 变更 | 原因 | 影响 |
|---|---|---|---|
| 2026-08-05 | v1.0 初版：两栏个人中心规格，对齐 v3 token 与 App Shell | 旧 ProfilePage 单栏 760px、未用容器宽度、未贴合 v3 主按钮转墨色 | `/profile` 重构 |
| 2026-08-05 | v1.1 R3 降级预览卡 + 新增 B5 独立作品集整页（列表/分类筛选/内联增删改/空态四件套） | 用户确认「升级为独立整页」；侧栏避免过载，增删改收口到 B5 | `/profile` 重构 |
