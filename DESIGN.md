# MES 实训平台 DESIGN.md

> 生成日期：2026-07-31 | 设计师：颜好看 | 阶段：Phase 1 设计调研
> 寄存器 Register：**product** | 平台 Platform：**web**（桌面优先，响应式下探至平板）
> 三轴刻度：**Variance 4 / Motion 3 / Density 6**
> Token 源文件：`design-system/design-tokens.css` · `design-system/design-tokens.json`

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

**主题关键词**：冷静 · 精准 · 车间秩序 · 可操作

**氛围描述**
浅色冷调工作台，信息密度偏高，界面像一台调好的工控终端而不是一个课程官网。深色只出现在一个地方——SQL 编辑器面板，让"动手写"这件事在视觉上从"读"里被切出来。学员打开页面第一眼看到的是自己的进度和下一步动作，不是标语。

**对标锚点（三个，各取一件事）**
| 锚点 | 取什么 |
|---|---|
| **Linear** | 层级与克制的动效：150ms 状态切换、无入场编排、键盘可达 |
| **Supabase Studio** | 浅色应用里嵌深色 SQL 工作区的分栏形态（本项目核心页直接对标它） |
| **Stripe Docs** | 左目录 + 正文 + 右侧演示的三栏教学结构，理论与练习并置 |

**寄存器判据**：主表面是工具（沙箱 / 列表 / 后台 / 表单），标杆是**赢得熟悉感**——一个用惯 Linear、Notion、Supabase 的人坐下来应当立刻会用，而不是在每个奇怪组件上停顿。首页是唯一带轻度 brand 成分的表面，但它是工作台不是落地页。

**反目标**：不做课程营销站，不做消费级学习 App（无成就徽章雨、无卡通吉祥物、无进度庆祝动画）。

---

## 2. Color Palette & Roles（色彩与角色）

配色策略：**Restrained**。中性色 85% / 强调色 ≤8% / 语义色 ≤5% / 效果色 <1%。

### A1-identity
| Token | 值 | 角色 |
|---|---|---|
| `--bg` | `#F7F9FB` | 页面底，冷白 |
| `--surface` | `#FFFFFF` | 卡片 / 面板 |
| `--surface-2` | `#F1F5F9` | 表头 / 内嵌区 / hover 底 |
| `--surface-3` | `#E7EDF3` | 选中底 / 进度槽 |
| `--fg` | `#0F1B26` | 主文本（深钢蓝黑，非纯黑） |
| `--muted` | `#5A6E80` | 说明文字，对 `--bg` **5.0:1** |
| `--border` | `#DDE5EC` | 卡片 / 输入框边框 |
| `--accent` | `#0E7490` | **唯一强调色**（工程青） |

`--accent` 对白 **5.36:1**，白字压其上同样 5.36:1 —— 既能当正文链接色，也能当按钮底色，不需要两套。

**选色理由**：避开 Tailwind 默认 Indigo `#6366F1`（业界公认 AI 第一 tell）与全部紫/粉。工程青取自 HMI 仪表盘的数据色，落在制造业语境里。中性色带微量青相 chroma（不是纯灰），与 accent 形成潜意识凝聚。

### A2-semantic（对齐 MES 设备语义）
| Token | 值 | 语义 |
|---|---|---|
| `--success` | `#15803D` | 设备运行 / 判题通过 |
| `--warn` | `#B45309` | 停机预警 / 待下达 |
| `--danger` | `#B91C1C` | 故障 / SQL 报错 |
| `--info` | = `--accent` | 提示 |

每个语义色配 `-soft`（底）与 `-border`（描边）两个派生，禁止用 alpha 透明度凑（alpha 是设计气味）。

### B-slot 别名
`--fg-2 #33475B`（正文段落）· `--meta #6B8093`（时间戳/计数，仅 12–13px 非关键信息）· `--border-soft #EDF1F5`（表格行分隔）· `--border-strong #C3D0DA`（输入框描边/拖拽条）

### C-extension（MES 专属）
- **SQL 编辑器深色面板**：`--code-bg #0F1B26`（与 `--brand-ink` 同值，墨色即面板）+ 6 个语法着色 token
- **设备/工单状态点**：`--status-running / idle / stopped / fault`，与通用语义色解耦以便单独调
- **学习进度**：`--progress-track / fill / fill-done`

### 每屏 ≤2 处强调色规则
一屏内 `--accent` 只允许出现在两处可见位置。典型分配：
- 沙箱页 = 「运行」按钮 + 侧栏当前题目指示条
- 列表页 = 主 CTA + 当前导航项
标题一律用 `--fg`，**不用强调色**。Badge/Tag 用 `-soft` 底 + 深字，不算强调色配额。

---

## 3. Typography（排版）

### 字体选择过程（留痕，防止回退到反射默认）
品牌口音三词（物理对象向）：**设备铭牌 · 工单打印纸 · 车间白板**。
直觉候选 Inter / IBM Plex Sans / Space Grotesk → 全部命中反射拒绝清单，弃。
最终从目录里挑出 **Archivo**：19 世纪美式 grotesque 谱系，专为标题与小字双端高性能设计，数字方正、字腔紧，读起来像设备铭牌上蚀刻的字，不像 SaaS 官网。variable 版带 `wdth` 62–125 轴，表格表头可压到 90% 塞更多列——这是 Density 6 需要的能力。

### 字体栈
```css
--font-display: 'Archivo Variable','Archivo','Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif;
--font-body:    同上;                          /* product 寄存器：一族够用，不硬凑配对 */
--font-mono:    'JetBrains Mono Variable','JetBrains Mono','SFMono-Regular',Consolas,Menlo,monospace;
```
Latin/数字走 Archivo，CJK 自然回落 Noto Sans SC。**Mono 不计入配对数**，用于 SQL 编辑器、结果表数字列、工单号/设备号。全站 **2 族**，不超。

**装载方式（关键工程约束）**：自托管 `@fontsource-variable/archivo` + `@fontsource-variable/jetbrains-mono` + `@fontsource/noto-sans-sc`，**禁止 Google Fonts CDN**（国内首屏不可控）。Noto Sans SC 只装 400/500/600 三档并依赖其 unicode-range 分片，否则 1MB+。全部 `font-display: swap`。

### 字号阶梯（固定 rem，步进 ≈1.2）
| Token | px | 用途 |
|---|---|---|
| `--text-xs` | 12 | 徽章 / 全大写标签 |
| `--text-sm` | 13 | 表格单元 / 辅助说明 |
| `--text-base` | **15** | UI 正文（工具型密度，对齐 Linear） |
| `--text-prose` | **17** | 理论章节长文，**仅 `.prose` 内** |
| `--text-lg` | 18 | 卡片标题 |
| `--text-xl` | 20 | 区块标题 |
| `--text-2xl` | 24 | 页面标题 |
| `--text-3xl` | 30 | 工作台主标题 |
| `--text-4xl` | 38 | 仅首页首屏，全站唯一一处 |

两档正文是刻意的：UI chrome 15px 保密度，阅读型正文 17px 保长时间可读。不要归一。

### 字重 / 行高 / 字距
- 字重三级 400 / 510 / 590；CJK 无 510·590 字面，映射为 500 · 600。
- 行高：标题 1.2 / 小标题 1.35 / UI 正文 1.55 / 理论正文 1.75。
- 字距：全大写标签 **0.08em**（硬性 ≥0.06em）；正文 0；≥24px 标题 −0.011em；38px 首屏 −0.021em。
- 表格与所有数字：`font-variant-numeric: tabular-nums`，列对齐不跳。

---

## 4. Components（组件规范）

统一图标库：**lucide-react**，尺寸 16 / 20 / 24，`strokeWidth={1.75}`，颜色一律 `currentColor`。全站零 emoji。

### 按钮（高 32px 桌面 / 44px 触屏，圆角 `--radius-sm` 6px）
| 变体 | default | hover | active | focus-visible | disabled | loading |
|---|---|---|---|---|---|---|
| Primary | `--accent` / 白字 | `--accent-hover` | `--accent-active` | `--focus-ring` | opacity .45 + `not-allowed` | 左侧 16px spinner，文案换「运行中…」，**同时 disable 防双提交** |
| Secondary | `--surface` + 1px `--border-strong` | 底 `--surface-2` | 底 `--surface-3` | 同上 | 同上 | 同上 |
| Ghost | 透明 / `--muted` | 底 `--surface-2` | 底 `--surface-3` | 同上 | 同上 | 同上 |
| Danger | `--danger` / 白字 | 加深 8% | 加深 14% | 同上 | 同上 | 同上 |

文案用「动词 + 宾语」：`运行查询` / `重置样例数据` / `保存主题`，不用 `确定` / `OK`。

### 输入框
default 1px `--border-strong` → hover `--meta` → focus `--accent` + `--focus-ring` → error `--danger` + 字段下方 13px 红字（错误就近，不只在顶部）。
**必须有可见 `<label>`**，placeholder 只做示例，绝不当唯一标签（当前 AdminPage / LoginPage 违反此条）。

### 卡片
`--surface` + 1px `--border` + `--radius-md` 8px + padding 20px，**默认无阴影**（Hairline First）。hover 只改 `border-color → --border-strong`。
禁止彩色左边框（`border-left: 3px solid accent`）——那是 AI 卡片签名。
禁止 1px border 与 blur ≥16px 阴影同时出现（幽灵卡片）。
卡片不嵌卡片。

### 导航（App Shell）
- **左 Sidebar 240px**：分组导航，当前项 = `--surface-3` 底 + 2px `--accent` 左指示条 +`--fg` 文字。左指示条是**导航唯一允许的色条**。
- **顶 Topbar 52px**：面包屑（左）+ 全局搜索（中）+ API 健康态 + 用户区（右）。
- <1024px：Sidebar 塌缩为 56px 图标条；<768px：改抽屉，Topbar 加汉堡按钮。

### 数据表格（结果集 / 主题列表）
表头 `--surface-2` + 13px 510 字重 + sticky；行分隔 1px `--border-soft`；hover 整行 `--surface-2`；选中 `--accent-soft`。数字右对齐 + mono + tabular-nums。**>200 行必须虚拟滚动或分页**。

### 其余
Badge（`-soft` 底 + 深字 + `--radius-xs` 3px + 12px caps）· 状态点（8px 圆点 + 文字，**不靠颜色单独传意**）· Toast（右上，`--elev-dropdown`，3s 自动消失，error 不自动消失）· Modal（`--radius-lg` 12px + `--elev-modal` + Esc 关闭 + 焦点陷阱）· Skeleton（`--surface-2` 底，1.4s 微光扫过）。

---

## 5. Layout & Spacing（布局与间距）

**结构变更（Phase 2 最大杠杆）**：从当前「顶部 7 项平铺导航 + 居中 960px 单栏」改为 **左 Sidebar + 顶 Topbar + 内容区**。这一条改完，全站一眼从"课程 demo"变成"工具"。

- 间距：4px 网格，仅 `4/8/12/16/20/24/32/40/48/64`。禁止 5/7/13/15/22/30。
- 节奏：紧组 8–12px（同组兄弟）+ 大分离 32–48px（区块）。
- 圆角：`3 / 6 / 8 / 12 / pill`。**卡片上限 8px，全站不出现 ≥16px 圆角**（避开过度圆滑 AI tell）。
- 容器：应用页 `--container-app` 1280px；理论正文 `--container-prose` 720px（行宽 45–75ch）。
- 栅格：桌面 12 列 / gap 24px；平板 8 列 / gap 16px；手机 4 列 / gap 12px。
- 节区纵距：桌面 48 / 平板 32 / 手机 24（应用不是落地页，不用 80）。
- **Variance 4** 说明：主结构用可预测网格；只在首页工作台允许一处不对称——「继续学习」大卡（2fr）+ 右侧统计条（1fr），其余保持规整。

禁止：什么都包卡片；到处 icon+标题+文字的等尺寸重复网格；每个 section 顶上挂一个 `ABOUT` / `PROCESS` 式全大写标签；`01 · / 02 ·` 编号 section。

---

## 6. Depth & Elevation（深度与层级）

**The Hairline First Rule** —— 默认无阴影，层级靠 1px 边框 + 底色差表达。

| 层级 | 值 | 用在哪 |
|---|---|---|
| `--elev-flat` | `none` | 卡片、面板、表格（**绝大多数元素**） |
| `--elev-ring` | `0 0 0 1px var(--border)` | 需要脱离底色的内嵌块 |
| `--elev-dropdown` | 见 token | 下拉、Popover、Toast |
| `--elev-modal` | 见 token | 模态框、抽屉 |

z-index：base 0 / sticky 100 / dropdown 1000 / modal 1200 / toast 1300。
毛玻璃：当前 `.topbar` 的 `backdrop-filter: blur(12px)` **保留**（内容会滚到其下，有功能目的），除此之外全站禁用装饰性 blur/glass。

---

## 7. Do's & Don'ts（设计守则）

**Do —— 必须遵守**
1. 所有色值走 `var(--token)`，新颜色先进 `design-tokens.css` 再用。
2. 图标一律 lucide-react，16/20/24 三档，`strokeWidth 1.75`，`currentColor`。
3. 每屏 `--accent` 可见使用 ≤2 处；标题用 `--fg`。
4. 每个数据组件交付 5 态：Loading / Empty / Error / Populated / Edge。
5. Empty 态四件套：会有什么 · 为何重要 · 如何开始 · 一个具体 CTA。
6. 错误文案三段式：发生了什么 + 为什么 + 怎么修（附重试按钮）。
7. 数字用 mono + `tabular-nums`；表格列宽稳定不跳。
8. 键盘优先：沙箱 `Ctrl/Cmd+Enter` 运行、`Esc` 关模态、Tab 顺序符合视觉顺序。

**Don't —— 违反即退回**
1. emoji 当功能图标（现存违规：`SqlSandbox.tsx:192` 用 U+26D4 禁止符当错误图标）。
2. 紫→粉渐变、Indigo→Pink 任意渐变、发光边框 + 毛玻璃三件套。
3. 组件内硬编码 hex（现存违规：`styles.css` 15 处）。
4. 把数据库主键暴露给用户当输入（现存违规：`QuizPage` 的「主题 ID」number input）。
5. placeholder 当唯一 label（现存违规：AdminPage / LoginPage）。
6. 卡片彩色左边框、卡片圆角 ≥16px、卡片嵌卡片。
7. 虚构指标（"10,000+ 学员"）、空洞文案（"欢迎使用" / "开启你的学习之旅"）。
8. ERP/制造业语境用花哨视觉——信息密度与操作效率优先于装饰（`references/industries/enterprise.md` 明列反模式）。
9. bounce / elastic 缓动；>500ms 动效；每个 section 都 fade-on-scroll。
10. 面向学员的文案里出现"零成本 Cloudflare 边缘""sql.js WASM"这类实现细节（现存违规：HomePage 副标题、SqlSpacePage 说明）——那是给开发者看的，不是给 MES 实施运维人员看的。

---

## 8. Responsive & Accessibility（响应式与无障碍）

**断点**：sm 640 / md 768 / lg 1024 / xl 1280，mobile-first 用 `min-width` 叠加。

| 宽度 | 导航 | 主布局 | SQL 沙箱 |
|---|---|---|---|
| ≥1280 | Sidebar 240px 展开 | 三栏（题面 / 编辑器 / 结果） | 左右分栏，可拖拽 |
| 1024–1280 | Sidebar 240px | 两栏 | 上下分栏 |
| 768–1024 | Sidebar 塌缩 56px 图标条 | 单栏 | 上下分栏，结果区可折叠 |
| <768 | 汉堡 + 抽屉 | 单栏 | 编辑器 / 结果 Tab 切换 |

**无障碍基线（Phase 3 后由 audit 命令专项验收，设计期不做完整扫描）**
- 对比度：正文 ≥4.5:1 / UI 组件 ≥3:1。`--muted` 5.0:1、`--accent` 5.36:1 已预验；`--meta` 约 3.4:1，**仅限 12–13px 非关键信息**，不得承载正文。
- 触摸目标：`@media (pointer: coarse)` 下最小 44×44px，间距 ≥8px。
- 焦点：全站 `:focus-visible` 显式 `--focus-ring`，禁止裸 `outline: none`。
- 状态不单靠颜色：设备状态 = 色点 + 文字；判题结果 = 图标 + 文字。
- `prefers-reduced-motion: reduce` 已在 `design-tokens.css` 全局兜底。
- 表单每个字段有可见 label + `aria-describedby` 指向错误文案。

**5 态覆盖（每个数据组件必交付）**
| 态 | 要求 |
|---|---|
| Loading | Skeleton（列表/卡片）或按钮内 spinner，禁止整页白屏 |
| Empty | 四件套文案 + CTA，产品特定不通用（不写"暂无数据"了事） |
| Error | 分类 + 原因 + 重试按钮；SQL 报错保留原始引擎信息可折叠 |
| Populated | 正常展示 |
| Edge | 超长标题 `-webkit-line-clamp: 2`；结果集 >200 行分页；超宽列横向滚动 + 首列 sticky；`min-width: 0` 让 flex 子项可缩 |

---

## 9. Agent Implementation Guide（实现指南）

### 交付物与引用方式
```
design-system/
├── design-tokens.css     # 前端在 main.tsx 首行 import，先于 styles.css
└── design-tokens.json    # 需要 JS 取值时 import tokens from '...'
```
项目**未上 Tailwind**（当前是原生 CSS）。建议 Phase 2 保持原生 CSS + token，不引 Tailwind——避免为一个 MVP 增加构建面。若架构师决定引入，`design-tokens.json` 可直接映射到 `theme.extend`。

### Phase 2/3 落地顺序（按"用户看得见变化"排序）
1. **App Shell**（Sidebar + Topbar + 面包屑 + 404）—— 一改全站变样，最高杠杆。
2. **SQL 练习工作台** `/sql-space` —— 三栏 + CodeMirror 6 替换裸 textarea（语法高亮/行号）+ 结果分页 + 历史。产品核心差异点。
3. **首页工作台** `/` —— 不做营销 Hero，做「继续学习 + 进度 + 快速入口」。
4. **课程列表 + 课程详情** `/courses` `/courses/:id` —— 详情页当前完全不存在，是最大功能缺口（`chapters` / `chapter` 接口已就绪但零对接）。
5. **学习路径** `/learning-paths` —— 阶梯式路径可视化（教育行业关键效果）。
次要：题库并入课程详情；登录 / 后台只做到"不违反红线"即可。

### 已知坑（实现时必读）
- `SqlSandbox.tsx:192` 的 U+26D4 emoji 必须换成 `<AlertTriangle size={16} />`。
- `client.ts` 的 `parse()` 抛的是原生 `Error`，定义好的 `ApiError` 与 `traceId` 全丢；HTTP 非 2xx 时 `res.json()` 会先抛解析异常。UI 想展示"错误 + traceId 可复制"必须先修这里。
- sql.js 走 `cdnjs.cloudflare.com` 单点，国内可能加载失败且当前**无重试**。Error 态要给「重试加载」按钮，不能只显示一行红字。
- `styles.css` 的 `--radius: 14px` 单值与新阶梯冲突，重构时整体替换而非叠加。
- Archivo 与 Noto Sans SC 的 x-height 若视觉不齐，用 `size-adjust` 在 `@font-face` 微调，不要靠改字号打补丁。

### 阻塞 Phase 2 的非设计问题
`worker/src/migrations/schema.sql` **只插了 platform_config 两行，无任何内容种子**，本地也无 D1 库文件。因此 `/topics`、`/learning-paths`、`/sql-exercises` 全部返回 `[]`，7 个页面 100% 渲染空态。
**用户"看不到变化"的根因是没有内容，不是没有样式。** 需在 UI 重构之前或并行补 `seed.sql`：≥6 主题、每主题 2–3 章节 Markdown 正文、≥8 道 SQL 实训题、2 条学习路径。内容用真实 MES 域知识（工单 / BOM / 派工 / 报工 / 追溯 / 设备点检），禁止 Lorem。

---

### 变更记录
| 日期 | 变更 | 原因 | 影响范围 |
|---|---|---|---|
| 2026-07-31 | v1.0 初版：锁定 product 寄存器、工程青 `#0E7490` 单强调色、Archivo + Noto Sans SC + JetBrains Mono、lucide-react 图标 | Phase 1 设计调研结论 | 全站 |
