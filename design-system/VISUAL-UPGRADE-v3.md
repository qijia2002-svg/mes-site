# MES 实训平台 · 视觉升级 v3（增量修订）

> 上游契约：`DESIGN.md`（Master） · `design-system/design-tokens.css` v2.0 · `design-system/pages/routing-builder.md`
> 本文是**增量修订**，不重写 token 体系。分层（A1-identity / A1-structure / A2 / B-slot / C-extension）保持不变。
> 诊断依据：线上 `https://shuojia.qzz.io` 生产构建 `assets/index-CN-mNrEe.css`（145,906 B）实测 + WCAG 相对亮度计算。
> 寄存器 Register：`product` · 平台：`web` · 三轴刻度：Variance 4 / Motion 3 / Density 6（**不变**）

---

## 0. 一句话结论

问题不在"蓝色不好看"，在于**三层表面挤在 1.05:1 的明度带里导致画面没有厚度**，加上**43 处 `--accent` 引用把强调色稀释成了背景纹理**。
v3 的核心动作是：**压深页面底 + 修正倒置的明度阶梯 + 主按钮转墨色 + 强调色配额从 43 处砍到个位数**。主色色号只是顺带修正。

---

## 1. 诊断清单（逐页面 / 逐元素）

### 1.1 全站级（根因，影响所有页面）

#### D-01 · 明度阶梯倒置 —— 这是"发白发平"的技术根因 🔴 P0

实测 v2 四个表面的 WCAG 相对亮度：

| Token | 值 | 相对亮度 L | 相对 `--bg` 对比度 |
|---|---|---|---|
| `--surface` | `#ffffff` | 100.00% | 1.055 : 1 |
| `--bg` | `#f7f9fb` | 94.46% | — |
| `--surface-2` | `#f1f5f9` | 90.84% | 1.038 : 1 |
| `--surface-3` | `#e7edf3` | 84.55% | 1.118 : 1 |

两个致命问题：

1. **`--surface-2` 比 `--bg` 暗**（90.84% < 94.46%）。而 `--surface-2` 的语义是"卡片内嵌区 / 表头"——**内嵌区比页面底还暗，等于往下凹**；同时 `.card` 用 `#ffffff` 往上凸。同一屏里凹凸混用，且两者都挂着同一个 `--elev-card` 阴影，大脑收到互相矛盾的深度信号，最终读成"脏"和"平"。
2. **`bg → surface` 只有 1.055:1（5.5% 亮度差）**，卡片边界几乎完全依赖 1px 边框，一旦边框也弱（见 D-03），卡片就"融"进背景。

**可指认位置**：首页 `.stat`（`background: var(--surface-2)`，三个统计块）与 `.card`（`background: var(--card-bg)` = `#fff`，六张课程卡）在同一屏上下相邻——**统计块凹、课程卡凸，视觉上像两套不相干的组件**。

#### D-02 · `--accent` 泛滥，强调色降级为纹理 🔴 P0

生产 CSS 中 `var(--accent*)` 引用统计：

```
27 × var(--accent)        8 × var(--accent-soft)     4 × var(--accent-border)
 2 × var(--accent-hover)  1 × var(--accent-on)       1 × var(--accent-active)
                                                     ── 合计 43 处
```

Master §2 自订纪律是「每屏 `--accent` 可见使用 ≤2 处」。**首页实际渲染出的蓝色元素**：

| # | 元素 | 用法 |
|---|---|---|
| 1 | `.brand-glyph` | 侧栏 logo 图标 |
| 2 | `.nav-item.is-active` | `--accent-soft` 底 + 2px `--accent` 左指示条 |
| 3 | `.btn-primary`（打开 SQL 工作台） | accent 实底 |
| 4 | `.dash-ring-fill` | 120px 环形进度 accent 描边 |
| 5 | `.dash-hero-chapter` | accent 文字 |
| 6 | `.dash-eta-glyph` | accent 图标 |
| 7 | `.dash-cta` | 第二个 accent 实底按钮 |
| 8–10 | `.dash-path-glyph` ×N | 每张路径卡一个 accent 图标 |
| 11–13 | `.dash-path-pct` ×N | 每张路径卡一个 20px accent 数字 |
| 14–16 | `.progress-fill` ×N | 每条进度条 accent 填充 |
| 17 | `.dash-path.is-active` | `--accent-border` + `--accent-soft` 外环 |
| 18 | `.dash-topic.is-active` | `--accent-soft` 底 |
| 19–36 | **`.tag` ×18** | 6 张课程卡 × ~3 个模块标签，**每个都是 accent 文字 + accent-soft 底 + accent-border 描边三件套** |
| 37 | `.text-link` / `.panel-action` | accent 文字 |

**首屏可见蓝色元素 ≈ 37 处，超标 18 倍。** `.tag` 单项就贡献 18 处，是最大污染源。

结论：**当强调色出现 37 次，它就不再是强调色。** 满屏均匀分布的中等饱和蓝 + 白底 = Bootstrap admin 模板的观感，这正是用户说的"低级"。

#### D-03 · 幽灵卡片：1px 边框 + 阴影同时存在 🟠 P1

```css
.card  { border:1px solid var(--card-border); box-shadow:var(--elev-card) }
.panel { border:1px solid var(--card-border); box-shadow:var(--elev-card) }
.stat  { border:1px solid var(--border-soft); box-shadow:var(--elev-card) }
```

三个问题叠加：
1. **违反 Master 自订 denylist 第 9 条**（`1px solid` + `box-shadow blur ≥ 16px` 不得共存）。v2 注释写着"Hairline First：默认无阴影"，但实际给**每一个**容器都加了 `--elev-card`——纪律写了没执行。
2. **阴影无层级**：`.card` `.panel` `.stat` 用同一个 `--elev-card`。当所有东西浮在同一高度，等于没有高度。
3. **`.stat` 的边框比填充还浅**：`background:#f1f5f9` + `border:1px solid #edf1f5`。边框亮度（92.8%）高于填充（90.8%），**这条边框在视觉上是"发光"的，不是"勾勒"的**，等于没有边框。

#### D-04 · 主色 `#2563eb` 与品牌墨色不同源 🟠 P1

用户诊断成立，但真正的技术理由比"Tailwind 默认"更硬：

| Token | 值 | HSL 色相 |
|---|---|---|
| `--brand-ink` | `#0f1b26` | **≈ 206°** |
| `--accent` | `#2563eb` | **221°** |

品牌墨色是 206° 的冷钢蓝，强调色却是 221° 的偏 indigo 蓝，**相差 15°，两者放在一起是"两种蓝"而不是"一个色系"**。这是配色不成体系的可测量证据，比"它是 Tailwind blue-600"更值得改。

#### D-05 · 玻璃顶栏是纯开销 🟡 P2

```css
.topbar { background:var(--glass-bg); backdrop-filter:blur(12px) saturate(160%) }
```
`--glass-bg` = `surface 80%` ≈ `rgba(255,255,255,.8)`，下方滚动内容是 `#f7f9fb` 近白 —— **blur 没有内容可模糊，saturate(160%) 在近白像素上无效果**。付出了合成层与移动端 GPU 开销，换到 0 视觉收益。（新 bg 压深后此项会自动改善，见 §5。）

#### D-06 · 死 token：`--text-4xl` 定义但全站零引用 🟡 P2

```css
--text-4xl: 2.375rem;  /* 38px 仅首页首屏，全站唯一一处 */
```
首页 `<h1 class="page-title">` 实际吃的是 `--text-3xl`（30px），响应式下再降到 `--text-2xl`（24px）。**声明的"首屏唯一一处"从未落地。**

#### D-07 · `--progress-track` token 被绕过 🟡 P2

```css
.progress-track { background: var(--border) }   /* 应为 var(--progress-track) */
```
C-extension 层定义了 `--progress-track: var(--surface-3)`，组件却直接读 `--border`。token 与实现脱钩。

---

### 1.2 逐页面

#### 首页 HomePage
- **D-08 · 全屏无视觉锚点**。从上到下：白顶栏 → 白侧栏 → 30px 深色标题 → 白色 dash 面板 → 浅灰 stat 块 → 白色课程卡。**最深的一块面积不超过 200×40px（h1 文字）**，其余全在 84%–100% 亮度带内。画面没有重心，眼睛不知道该落在哪。这是"高级感"缺失最直接的来源。
- **D-09 · `.card-title` 15px vs `.card-desc` 13px，卡内层级只差 2px**。且 `.card-title` 用的是 `--text-base`——**与页面正文同号**。卡片标题不像标题，像加粗了的正文。
- **D-10 · `.dash-hero` 是首屏第一个内容块，却和普通卡片长得一模一样**（同 `--elev-card`、同 `--card-border`、同白底）。它承载"今天学到哪了"这个首页最重要的信息，视觉权重却和第六张课程卡相同。

#### 课程列表 CoursesPage
- **D-11 · 18 个蓝色 tag 形成"蓝色麻疹"**（承 D-02）。`.card-grid` 是 `minmax(260px,1fr)` 自动填充，宽屏下一行 4–5 张卡，满屏均匀分布的蓝色小方块，噪音压过了课程标题本身。
- **D-12 · 卡片高度不齐但无节奏**。`.card` 用 `height:100%` 拉齐，但 `.card-desc` 长度不一 + `.tag-row` 换行行数不一，导致内容在卡内垂直分布随机。缺一条 `.tag-row { margin-top:auto }` 把标签压到卡底对齐。

#### 章节详情 ChapterPage
- **D-13 · `.prose` 正文色是 `--fg-2`（`#33475b`）而非 `--fg`**。17px 长文用次级色，读起来"发灰没精神"。次级色应该留给辅助说明，正文就该用主文本色。
- **D-14 · `--prose-code-inline-fg: #1e40af`（蓝）+ `--surface-2` 底 + `--border` 描边**，又是三件套。理论章节里行内代码密度很高（表名、字段名、SQL 关键字），一段话里五六个蓝色小块，把阅读节奏切碎了。

#### SQL 实训 SqlSpacePage
- **D-15 · 唯一做对的地方，但它是孤岛**。`--code-bg:#0f1b26` 深色面板质感明显好于其余页面——**这恰好证明了 §1.1-D-08 的判断：这套设计缺的就是深色块**。问题是全站只有这一处有，导致 SQL 页和其他页像两个产品。
- **D-16 · 语法色 `--syn-func:#c4b5fd` 是紫色**。虽然 Master 已注明"仅语法着色，非主视觉渐变"属豁免，但在 P0-2 语境下这是唯一一处紫色，建议顺手中性化，消除解释成本。

---

## 2. 对标选型与理由

### 主对标：**Linear（浅色模式）**

选它不是因为"Linear 好看"，是因为**它解决的正是我们坏掉的那个问题**：如何在一个几乎全中性、色彩带宽极窄的画面里，让层级依然清晰可见。

| 维度 | Linear 的做法 | 我们能直接搬的 |
|---|---|---|
| 表面层级 | 明确的、单调递增的亮度台阶，每级 ~6% | **修正倒置阶梯，等距台阶**（§3.2） |
| 强调色配额 | 全屏几乎不出现，只在选中态/焦点态闪现 | **43 处 → 个位数**（§3.5） |
| 分层手段 | 1px hairline 为主，阴影仅用于真正浮起的层 | **`--elev-card` 归零**（§5） |
| 主操作按钮 | 中性深色实底，不是品牌色 | **`--btn-primary-bg` 转墨色**（§3.4） |

### 次对标（各取一项，不整体模仿）

| 对标 | 只取这一样 | 理由 |
|---|---|---|
| **Vercel** | 「浅色页面里嵌深色区块作视觉锚点」 | 直接解 D-08。我们已经有 `--brand-ink`，成本极低 |
| **Stripe Dashboard** | 数据区排版：tabular mono 数字 + 小号大写标签 + 强字重对比 | 解 D-09。我们已有 `--font-mono` 和 `.caps`，是用得不够 |
| **Grafana** | 状态色纪律（颜色只编码状态，不编码类别） | 已写进 routing-builder §68，v3 要把它执行到 `.tag` 上 |

### 明确不取

- **Retool** —— 它恰恰是"蓝色泛滥的 admin 感"的标本，是我们要逃离的方向，不是要去的方向。
- **Dribbble 概念稿 / 渐变玻璃流派** —— 违反 P0-2，且工业软件用户对装饰性视觉的信任度是负的。
- **深色模式化** —— 本项目是浅色 product 寄存器，深色是 SQL 面板的**专属身份**（Master §1）。全站转深会稀释那处身份。routing-builder §92 已有同样判断，v3 保持一致。

### 「高级」在本产品语境下的操作性定义

不是"更漂亮"，是这四条可验证的性质：

1. **有厚度** —— 表面层级单调、可数、每级可见（≥6% 亮度差）
2. **有重心** —— 每屏至少一处高对比深色块，眼睛有落点
3. **有克制** —— 强调色是稀缺资源，出现即有意义（≤3 处/屏）
4. **有精密感** —— 数字等宽对齐、边框 1px 不虚、字重层级明确

---

## 3. Token 变更表

> 所有对比度为 WCAG 2.1 相对亮度实测值（sRGB，计算脚本见附录 A）。
> **落地层级标注**：`[A]` = 仅改 `design-tokens.css`；`[B]` = 另需 `styles.css` 单行属性替换（不改 JSX / 不改组件结构）。

### 3.1 A1-identity · 品牌身份

| Token | v2 旧值 | v3 新值 | 对 `--bg` | 对 `--surface` | 变更理由 | 落地 |
|---|---|---|---|---|---|---|
| `--accent` | `#2563eb` | **`#0a61b8`** | 5.42:1 ✅ | 6.15:1 ✅ | 色相 221°→**210°**，与 `--brand-ink` 206° 同源（D-04）；亮度 15.3%→12.1%，从"网页蓝"沉为"仪表蓝"；对白底对比度 5.17→**6.15** 顺带提升可读性 | [A] |
| `--brand-ink` | `#0f1b26` | 不变 | — | 17.43:1 | 已是正确的冷调墨色，v3 反而要**扩大它的使用面积** | — |
| `--accent-on` | `#ffffff` | 不变 | — | — | 白字对新 accent 6.15:1 ✅ | — |

### 3.2 A1 · 中性色阶（核心修订 —— 重建明度阶梯）

| Token | v2 旧值 | v3 新值 | v2 亮度 | v3 亮度 | 变更理由 | 落地 |
|---|---|---|---|---|---|---|
| `--bg` | `#f7f9fb` | **`#edf1f5`** | 94.46% | **87.51%** | 页面底压深 7%，`bg→surface` 对比从 **1.055 → 1.135**（+115%），白卡片真正浮起来（D-01） | [A] |
| `--surface` | `#ffffff` | 不变 | 100% | 100% | 阶梯顶端，保持 | — |
| `--surface-2` | `#f1f5f9` | **`#f6f8fa`** | 90.84% | **93.63%** | **修正倒置**：从"比 bg 暗 3.6%"改为"比 bg 亮 6.1%"，内嵌区终于在 bg 之上、surface 之下（D-01） | [A] |
| `--surface-3` | `#e7edf3` | **`#e3e9f0`** | 84.55% | **80.90%** | 定位收窄为**全系唯一允许下沉的面**（进度槽 / 按下态 / 选中底） | [A] |

**修订后阶梯（单调性 ✅ PASS，台阶等距）**

```
surface-3  #e3e9f0   L 80.90%  ┐ 1.077  ← 唯一下沉面
bg         #edf1f5   L 87.51%  ┤ 1.066  ← 页面底（基准）
surface-2  #f6f8fa   L 93.63%  ┤ 1.065  ← 内嵌区 / 表头
surface    #ffffff   L 100.0%  ┘        ← 卡片（顶端）
```

三级台阶 1.077 / 1.066 / 1.065 —— **误差 <1.2%，肉眼等距**。v2 的台阶是 1.118 / ~1.04 / 1.096 且方向错乱。

### 3.3 A1 · 文本与边框

| Token | v2 旧值 | v3 新值 | 对新 `--bg` | 变更理由 | 落地 |
|---|---|---|---|---|---|
| `--fg` | `#0f1b26` | 不变 | 15.35:1 ✅ | — | — |
| `--fg-2` | `#33475b` | 不变 | 8.44:1 ✅ | — | — |
| `--muted` | `#5a6e80` | **`#4e6376`** | **5.49:1** ✅ | bg 压深后需重新拉开与 `--meta` 的距离，两者亮度差恢复到 **3.79%**（可辨阈值 2%） | [A] |
| `--meta` | `#6b8093` | **`#5c6f85`** | **4.55:1** ✅ | ⚠️ **v2 旧值对新 bg 仅 3.60:1，不达 AA**。即使不改 bg，`#6b8093` 对旧 bg 也只有 4.09:1——**v2 这里本来就是不合规的** | [A] |
| `--border` | `#dde5ec` | **`#d3dce5`** | 1.222 | 取消卡片阴影后 hairline 成为**唯一**分层手段，必须加强；对 surface 从 1.24 → **1.387** | [A] |
| `--border-soft` | `#edf1f5` | **`#e4eaf0`** | 1.068 | ⚠️ v2 旧值与 v3 新 `--bg` **完全撞色**（都是 `#edf1f5`），必须让开 | [A] |
| `--border-strong` | `#c3d0da` | **`#b3c2ce`** | 1.605 | 同步加强，维持三级边框的等比关系 | [A] |

### 3.4 A2 · 派生与语义

| Token | v2 旧值 | v3 新值 | 校验 | 变更理由 | 落地 |
|---|---|---|---|---|---|
| `--accent-hover` | `#1d4ed8` | **`#08508f`** | 白字 8.22:1 ✅ | 跟随新 accent 同色相加深 | [A] |
| `--accent-active` | `#1e40af` | **`#063f73`** | 白字 10.68:1 ✅ | 同上 | [A] |
| `--accent-soft` | `#eef4ff` | **`#e8f0fa`** | accent 文字 5.35:1 ✅ | 去掉 v2 的偏紫倾向（`#eef4ff` 蓝相偏 225°），对齐 210° | [A] |
| `--accent-border` | `#c7d9ff` | **`#b8d2ec`** | vs surface 1.56 | 同上，并加强可见度 | [A] |
| `--success` / `--warn` / `--danger` | 不变 | 不变 | — | 语义色与 MES 设备状态绑定，**不在本次范围**（避免扩大改动面） | — |

### 3.5 A2 · 层级（核心修订 —— 真正落实 Hairline First）

| Token | v2 旧值 | v3 新值 | 变更理由 | 落地 |
|---|---|---|---|---|
| `--elev-card` | `0 1px 2px rgba(...,.04), 0 1px 3px rgba(...,.06)` | **`0 0 0 0 transparent`** | **单点最高杠杆改动**。消除幽灵卡片（D-03），把分层责任交还给已加强的 hairline + 已修复的明度阶梯。改一个 token，`.card` `.panel` `.stat` 三处同时生效。<br>⚠️ **必须写 `0 0 0 0 transparent` 而不是 `none`** —— 见下方陷阱说明 | [A] |

> #### ⚠️ 陷阱：`--elev-card: none` 会静默破坏 `.dash-path.is-active`
>
> 生产 CSS 中存在一处**复合 box-shadow 列表**引用了该 token：
> ```css
> .dash-path.is-active { box-shadow: 0 0 0 1px var(--accent-soft), var(--elev-card) }
> ```
> 若 `--elev-card: none`，计算值变成 `0 0 0 1px var(--accent-soft), none` —— **`none` 在多值列表中是非法语法，浏览器会丢弃整条声明**，导致"当前学习路径"卡片的高亮外环**完全消失**，且不报错、不易察觉。
>
> 用 `0 0 0 0 transparent` 则在列表中合法、渲染为零、视觉等价于无阴影。已扫描确认：全站 `--elev-card` 共 5 处引用，4 处单值、1 处复合（即上述），此写法对 5 处全部安全。
| `--elev-card-hover` | `0 6px 16px -4px .12, 0 2px 6px -2px .06` | **`0 4px 12px -2px rgba(15,27,38,.10), 0 1px 3px rgba(15,27,38,.06)`** | 常态无阴影后，hover 阴影不需要那么重才能形成对比；收 33% | [A] |
| `--elev-dropdown` / `--elev-modal` | 不变 | 不变 | 真正浮起的层，保留 | — |
| `--glass-bg` | `surface 80%` | **`surface 92%`** | 顶栏近乎实色，只保留极轻的透色（D-05） | [A] |
| `--glass-blur` | `12px` | **`8px`** | 降低合成层开销 | [A] |

### 3.6 B-slot · 组件插槽（核心修订 —— 主按钮转墨）

| Token | v2 旧值 | v3 新值 | 变更理由 | 落地 |
|---|---|---|---|---|
| `--btn-primary-bg` | `var(--accent)` | **`var(--ink-solid)`** | **第二高杠杆改动**。主按钮转墨色（Vercel / Linear 做法）：① 立刻在近白页面上制造深色锚点（解 D-08）；② 一次性释放最大的 accent 配额（解 D-02）；③ **只改一个 B-slot，全站所有 `.btn-primary` 同时生效，零组件改动** | [A] |
| `--btn-primary-bg-hover` | `var(--accent-hover)` | **`var(--ink-solid-hover)`** | 同上 | [A] |
| `--btn-primary-bg-active` | `var(--accent-active)` | **`var(--ink-solid-active)`** | 同上 | [A] |
| `--card-title-size` | *（不存在）* | **`var(--text-lg)`** | 卡片标题 15px → **18px**，与 13px 描述拉开层级（解 D-09） | [B] |

> **`--btn-primary` 转墨后 accent 去哪了？** → accent 收敛为**唯一的"状态与链接"语义色**：选中态、焦点环、运行中、链接、进度填充。这正是 routing-builder 9 态矩阵对 accent 的用法，**v3 让全站语义与搭建器语义统一了**。

---

## 4. 新增 Token

> 每一组都说明"为什么现有 token 覆盖不了"。

### 4.1 墨色实底组（解 D-08 / 支撑 §3.6）

```css
/* 为什么不能直接用 --brand-ink？
   --brand-ink 是 A1-identity 的"身份色"，同时被 --fg 和 --code-bg 引用。
   主按钮需要独立的 hover/active 派生，直接复用会让"文字色"和"按钮底色"耦合，
   以后想单独调按钮深浅就必须动身份色。故新开一组 A2 派生。 */
--ink-solid:        var(--brand-ink);   /* #0f1b26  白字 17.43:1 ✅ */
--ink-solid-hover:  #1d2c3a;            /* 白字 14.25:1 ✅ */
--ink-solid-active: #080f16;            /* 白字 19.26:1 ✅ */
```

### 4.2 深色锚点区组（解 D-08 / D-15）

```css
/* 为什么不能复用 --code-* ？
   --code-* 是 C-extension 层、SQL 沙箱专属，语义是"这是代码"。
   深色锚点区（首页 dash-hero）语义是"这是本页重心"，不是代码。
   两者色值可以同源，但语义必须分开，否则以后调 SQL 面板会误伤首页。 */
--surface-ink:    var(--brand-ink);  /* #0f1b26 深色区块底 */
--fg-on-ink:      #f2f6f9;           /* 16.04:1 ✅ 主文字 */
--fg-2-on-ink:    #b6c6d4;           /*  9.97:1 ✅ 次级文字 */
--meta-on-ink:    #8199ac;           /*  5.88:1 ✅ 元信息 */
--border-on-ink:  #24374a;           /*  1.43   深色区内部分隔线 */
--accent-on-ink:  #63b3ed;           /*  7.64:1 ✅ 深底上的强调（浅色 accent） */
```

### 4.3 中性标签组（解 D-02 最大污染源 / D-11）

```css
/* 为什么不能直接改 .tag 的 var(--accent) 为 var(--muted)？
   可以，但那样 .tag 就没有自己的语义插槽了。B-slot 层的职责就是
   "组件只读这一层"——tag 作为高频组件应当有独立插槽，
   以后要做"高亮 tag"变体时才有地方挂。 */
--tag-bg:     var(--surface-2);   /* #f6f8fa */
--tag-fg:     var(--muted);       /* #4e6376  对 tag-bg 5.85:1 ✅ */
--tag-border: var(--border);      /* #d3dce5  对 tag-bg 1.303 */
```

**单此一项：首页蓝色元素从 37 处降到 19 处。**

### 4.4 删除的 Token

| Token | 处置 | 理由 |
|---|---|---|
| `--text-4xl` | **删除** | 全站零引用的死 token（D-06）。且**不建议补用**——把首页 h1 放大到 38px 正是 P0-5 禁止的"大标题落地页套路"。首屏重心改由 §4.2 深色锚点承担，这是更符合 product 寄存器的解法 | [A] |

---

## 5. 分层策略修订

### 5.1 Hairline First —— 继续作基线，但这次要真的执行

v2 的问题不是策略错，是**策略写了没执行**：注释写着"默认无阴影"，实际给每个容器都挂了 `--elev-card`。

**v3 三级层级，边界清晰：**

| 层级 | 表达手段 | 适用 | Token |
|---|---|---|---|
| **L0 · 平面** | 1px hairline + 明度阶梯，**零阴影** | 内容卡片 `.card` / 面板 `.panel` / 统计块 `.stat` | `--elev-card: 0 0 0 0 transparent` |
| **L1 · 响应** | 轻阴影 + 边框加强 + `translateY(-1px)` | hover 态、可拖拽元素拾起前 | `--elev-card-hover` |
| **L2 · 浮层** | 中阴影，**无边框**（浮层靠阴影，不靠线） | 下拉 / Popover / Toast | `--elev-dropdown` |
| **L3 · 模态** | 重阴影 + 遮罩 | Modal / 拖起中的卡片 | `--elev-modal` |

**铁律：L0 和 L1 之间的差异必须靠"从无到有"，不是"从轻到重"。** 这是取消 `--elev-card` 的全部意义——常态无阴影，hover 才有，交互反馈的信噪比才拉得开。

### 5.2 阴影使用纪律

- ✅ 阴影只表达**"这一层真的浮在上面"**（浮层 / 模态 / 拖起 / hover）
- ❌ 禁止用阴影表达"这是一张卡片"——那是 hairline 的工作
- ❌ 禁止 `border` 与 `box-shadow` 在**常态**共存（denylist #9）。hover 态允许，因为那时阴影是交互反馈不是分层手段
- ✅ 例外：`--elev-ring`（`0 0 0 1px`）是**边框的等价物**不是阴影，可与 hairline 互斥使用

### 5.3 玻璃使用纪律

- ✅ **仅顶栏 `.topbar` 一处**，全站唯一豁免（Master 已有此条，保留）
- v3 调整：`--glass-bg` 80% → **92%**，`--glass-blur` 12px → **8px**，`saturate(160%)` → **`saturate(120%)`** `[B]`
- 理由：新 `--bg` `#edf1f5` 压深后，滚动内容与顶栏终于有了亮度差，blur **这次真的有东西可模糊**了；但也因此不再需要靠高 saturate 硬撑质感
- ❌ 内容区、卡片、模态**一律禁止**毛玻璃（P0-2 三件套红线）

---

## 6. 字体节奏修订

> 结论：**字号阶梯本身是好的，问题在"用得太挤"**。v3 不动阶梯定义（除删死 token），只修正使用规则。

### 6.1 需要改的（3 项）

| 项 | v2 现状 | v3 | 理由 | 落地 |
|---|---|---|---|---|
| **卡片标题** | `.card-title: var(--text-base)` = 15px | **`var(--card-title-size)`** = `--text-lg` = 18px | 与 13px 描述只差 2px，且与页面正文同号——**标题不像标题**（D-09）。18/13 = 1.38 比值才形成层级 | [B] |
| **长文正文色** | `.prose { color: var(--fg-2) }` | **`color: var(--fg)`** | 17px 理论长文用次级色读起来发灰（D-13）。次级色留给辅助说明，正文用主色 | [B] |
| **`--text-4xl`** | 定义 38px，零引用 | **删除** | 死 token（D-06）；且不补用（P0-5） | [A] |

### 6.2 保持不变的（已经对了，不要动）

- **字号阶梯** 12/13/15/17/18/20/24/30 —— 步进 ≈1.2，product 寄存器固定 rem 不用 fluid clamp。**正确**
- **字重三级** 400/510/590 + CJK 映射 500/600 —— 罕见地考虑了 CJK 无 510/590 字面的问题。**这是 v2 做得最好的一处**
- **字距规则** caps `0.08em` / title `-0.011em` / display `-0.021em` —— 符合规范（ALL CAPS ≥0.06em）。**正确**
- **行高** 1.2 / 1.35 / 1.55 / 1.75 四级。**正确**
- **`--prose-measure: 68ch`** 落在 45–75ch。**正确**

### 6.3 新增使用纪律（不新增 token，只加规则）

1. **所有数字必须 `font-variant-numeric: tabular-nums` + `--font-mono`**
   已在 `.stat-value` `.dash-path-pct` `.dash-eta strong` 做到，但 `.dash-ring-value` 用了硬编码 `font-size:22px` —— 应改为 `var(--text-xl)`（20px）。数字等宽对齐是"精密感"的最低成本来源（Stripe 对标项）。`[B]`
2. **`.caps` 类当前只定义未推广**。区块小标题（`.section-title` 上方）应引入 `.caps` 作为 eyebrow —— ⚠️ **但每页最多一处**，否则触发 denylist #6「每节都有小型大写追踪标签」。
3. **字重对比要用足**：`--weight-read 400` 与 `--weight-announce-cjk 600` 之间差 200，v2 大量使用 `--weight-emph-cjk 500` 做小标题，**500 和 400 的差异在 15px CJK 上几乎不可见**。规则：**≥18px 用 600，<18px 要么 400 要么 600，不用 500**。（500 保留给 Latin 数字场景，Archivo 的 510 字面是真实存在的。）

---

## 7. 逐页面改造清单（按影响面排序）

### P1 · 全站外壳 AppShell —— 影响 100% 页面

| 改什么 | 改成什么 | 预期效果 | 落地 |
|---|---|---|---|
| 页面底色 | `--bg: #edf1f5` | 所有白卡片立刻浮起来，全站获得厚度 | [A] |
| 所有卡片阴影 | `--elev-card: 0 0 0 0 transparent` | 消除幽灵卡片，画面变"干净利落"而非"糊" | [A] |
| 所有主按钮 | `--btn-primary-bg: var(--ink-solid)` | 每页至少一个深色锚点 | [A] |
| `.sidebar` 底色 | 保持 `--surface` 白 | 与新 bg 形成 1.135 对比，侧栏边界自然浮现（v2 是 1.055 几乎看不见） | — |
| `.topbar` | glass 92% / blur 8px / saturate 120% | 去掉无效开销 | [A]+[B] |
| `.nav-item.is-active` | 保持 `--accent-soft` 底 + 2px accent 条 | **这是 accent 的正当用法（状态），保留** | — |

### P2 · 全站卡片与标签 —— 影响首页 / 课程 / 路径 / 后台

| 改什么 | 改成什么 | 预期效果 | 落地 |
|---|---|---|---|
| `.tag` 三件套 | `--tag-bg` / `--tag-fg` / `--tag-border` 中性组 | **首页蓝色元素 37 → 19 处**，课程列表"蓝色麻疹"消失 | [B] ×3 行 |
| `.card-title` | 15px → 18px | 卡内层级建立 | [B] |
| `.stat` 底色/边框 | `background: var(--surface-2)`（现在真的比 bg 亮了）+ `border: 1px solid var(--border)`（不再用 border-soft） | 统计块从"凹陷发光边"变成正常凸起卡片，与课程卡视觉统一 | [B] |
| `.tag-row` | 加 `margin-top: auto` | 标签压到卡底对齐，卡片网格产生横向节奏（D-12） | [B] |

### P3 · 首页 HomePage —— 视觉锚点

| 改什么 | 改成什么 | 预期效果 | 落地 |
|---|---|---|---|
| **`.panel.dash-hero`**（⚠️ 必须双类选择器，见下） | 深色锚点区：`background: var(--surface-ink)`；`border-color: var(--border-on-ink)`；内部文字 `--fg-on-ink` / `--fg-2-on-ink` / `--meta-on-ink`；`.dash-hero-chapter` 与 `.dash-ring-fill` 改 `--accent-on-ink`；`.dash-ring-track` 改 `--border-on-ink` | **本次升级视觉冲击最大的一处**。首屏立刻有重心；120px 环形进度在深底上从"装饰"变成"仪表"；与 SQL 面板形成呼应，深色不再是孤岛（解 D-08 + D-15） | [B] |
| `.dash-cta` | 深色区内的按钮改用**浅色实底**（`--surface` 底 + `--fg` 字） | 深底上的反色按钮，比 accent 按钮更高级且对比更高 | [B] |
| `.dash-path-pct` | `--accent` → `--fg`，仅**当前进行中**那张保留 accent | 3 个蓝数字降到 1 个，且"哪个在进行"反而更清楚 | [B] |
| `.dash-path-glyph` | `--accent` → `--muted` | 图标光学补偿规则（token 注释已写，此处没执行） | [B] |

> #### ⚠️ 陷阱：`.dash-hero` 单类选择器改不动背景
>
> JSX 实际写法是 `<div className="panel dash-hero">`（`ProgressDashboard.tsx:222`），而构建产物中 **`.dash-hero`（偏移 113847）排在 `.panel`（偏移 131037）之前**。两者特异性同为 `0-1-0`，后者胜出 —— 直接给 `.dash-hero` 写 `background` 会被 `.panel { background: var(--card-bg) }` 覆盖，**改了看不出任何变化**。
>
> 必须用 **`.panel.dash-hero`**（特异性 `0-2-0`）。同理需一并覆盖 `.panel` 的 `border-color`，否则深色块上会留一圈浅色边。
> 已扫描确认：全站 `panel` 组合类只有 `panel dash-hero` 这一处，无其他连带影响。

### P4 · 课程列表 CoursesPage
- 继承 P2 全部改动，无页面级专属改动。**这是 token 化做得好的证据**——一个高频页面零专属改动。

### P5 · 章节详情 ChapterPage
| 改什么 | 改成什么 | 预期效果 | 落地 |
|---|---|---|---|
| `.prose` 正文色 | `--fg-2` → `--fg` | 长文不再发灰（D-13） | [B] |
| `--prose-code-inline-fg` | `#1e40af` → `var(--fg)`；`--prose-code-inline-bg` → `var(--surface-2)`；去掉 `border` | 行内代码从"蓝色小方块"变成"底色微差的等宽文字"，阅读节奏不再被切碎（D-14）。**代码=深色**的规则由块级 `<pre>` 独家承担，语义更干净 | [A]+[B] |
| `.prose h2` 上边距 | 保持 `--prose-h2-mt: 40px` | 已经对了 | — |

### P6 · SQL 实训 SqlSpacePage
| 改什么 | 改成什么 | 预期效果 | 落地 |
|---|---|---|---|
| `--syn-func` | `#c4b5fd`（紫） → `#93c5fd`（浅蓝） | 消除全站唯一紫色，免除 P0-2 解释成本（D-16） | [A] |
| 其余 `--code-*` | **不动** | 全站质感最好的一块，不要动它 | — |

### P7 · 其余页面（Exercise / Quiz / LearningPaths / Admin / Login / NotFound）
- 全部继承 P1+P2，**零页面级改动**。

### P8 · 工艺路线搭建器 RoutingBuilder（未开发，前置约束）
见 §9.6 兼容性验证。**结论：v3 与 9 态矩阵完全兼容，无需修改 routing-builder.md。**

---

## 8. Do / Don't 对照（本次升级专属）

| # | ❌ Don't | ✅ Do |
|---|---|---|
| 1 | 给 `.card` 同时加 `border` 和 `box-shadow` | 常态只用 1px hairline；阴影留给 hover / 浮层 |
| 2 | 让 `--surface-2` 比 `--bg` 暗 | 严守单调阶梯 `surface-3 < bg < surface-2 < surface` |
| 3 | 用 `--accent` 给标签、图标、装饰性数字上色 | accent 只编码**状态与链接**：选中 / 焦点 / 运行中 / 进度 / 超链接 |
| 4 | 主按钮用品牌蓝实底 | 主按钮用 `--ink-solid` 墨色实底，兼作页面视觉锚点 |
| 5 | 靠放大标题字号制造首屏重心 | 靠深色区块制造重心（P0-5：不做落地页大标题套路） |
| 6 | 一个页面出现 3 处以上 `--accent-soft` 底 | 每屏 accent 相关元素 ≤3 处（含 soft / border / 实底） |
| 7 | 卡片标题用 `--text-base`（与正文同号） | 卡片标题 `--text-lg` 18px，与 13px 描述形成 1.38 比值 |
| 8 | 用 `--weight-emph-cjk`(500) 做 15px CJK 小标题 | <18px 要么 400 要么 600；500 只给 Latin/数字 |
| 9 | 在内容区使用毛玻璃 | 玻璃仅 `.topbar` 一处，且 ≥92% 不透明 |
| 10 | 数字用比例字体 | 所有数字 `--font-mono` + `tabular-nums` |
| 11 | 给 `.stat` 用比填充更浅的边框 | 边框亮度必须**低于**填充，否则是发光不是勾勒 |
| 12 | 为了"更高级"整站转深色 | 深色是 SQL 面板 + 首页锚点的**专属身份**，浅色仍是主寄存器 |

---

## 9. P0 自检表

### 9.1 P0-1 · 禁止 emoji 作功能图标 ✅ PASS
- v3 **未引入任何新图标**。全部图标继续走 `lucide-react@1.28.0` → `web/src/components/Icon.tsx` 语义名。
- 尺寸纪律不变：`--icon-sm:16px` / `--icon-md:20px` / `--icon-lg:24px`。
- v3 新增的 `--accent-on-ink` / `--meta-on-ink` 是**给现有图标在深底上重新上色**，不改图标来源。
- 本文档正文使用的 ✅❌⚠️🔴🟠🟡 仅为**文档标记**，不进入产品 UI，不落 token，不落代码。

### 9.2 P0-2 · 禁止紫粉渐变 / Indigo→Pink / 三件套 ✅ PASS
- v3 **零渐变**。全部改动是实色 token 替换，`design-tokens.css` 中不含任何 `linear-gradient` / `radial-gradient`。
- 主色从 `#2563eb`（221°，偏 indigo）**远离** indigo 至 `#0a61b8`（210°），**降低**而非提高红线风险。
- `--accent-soft` 从 `#eef4ff`（225° 偏紫相）改为 `#e8f0fa`（210°），**主动消除**了 v2 残留的紫倾向。
- 唯一紫色 `--syn-func: #c4b5fd` → `#93c5fd`，**全站紫色归零**。
- 三件套（发光边框 + 毛玻璃 + 渐变）：渐变 0；毛玻璃收紧至顶栏单点且 ≥92% 不透明；发光边框——**v3 恰恰是在消除它**（`--elev-card` 归零）。

### 9.3 P0-3 · 禁止空洞文案 / 硬编码色值 ✅ PASS
- **文案**：v3 不新增任何 UI 文案。现有文案（"今天先把一章理论读完，再把对应的 SQL 写一遍"）具体、有动作、无套话，**不在改造范围**。
- **硬编码色值**：生产 CSS 实测扫描——36 个 hex 值，**每个恰好出现 1 次**，即全部只存在于 `:root` token 定义处，组件 CSS 零裸 hex。**v2 这条纪律执行得很干净，v3 继续保持**：所有新增 token 的裸值只写在 `design-tokens.css` 的 `:root` 内。

### 9.4 P0-4 · 禁止弹跳缓动 ✅ PASS
- v3 **不新增任何缓动函数**。继续使用 `--ease-out: cubic-bezier(0.22,1,0.36,1)`（ease-out-quint，单调递增无过冲）与 `--ease-standard: cubic-bezier(0.2,0,0,1)`。
- 两者第二控制点 y 值分别为 1 和 0，**均不为负、不超过 1**，数学上不可能产生回弹。
- 禁止值 `cubic-bezier(0.68,-0.55,0.265,1.55)` 在 v2/v3 token 与生产 CSS 中均**零出现**（已扫描确认）。

### 9.5 P0-5 · 禁止千篇一律 Hero ✅ PASS
- v3 **主动拒绝**了放大首屏标题的方案：§4.4 明确**删除** `--text-4xl`，理由即"38px 大标题是落地页套路"。
- 首屏重心改由 **`.dash-hero` 深色锚点**承担 —— 而 `.dash-hero` 展示的是**真实产品数据**（当前学习进度环、当前章节名、预计剩余时间、学习路径完成度），不是口号 + 抽象图形。
- 首屏结构保持 `页面标题 → 真实进度仪表 → 今日数据 → 课程网格`，**无 "Welcome to"、无居中 CTA、无抽象 3D 图形**。

### 9.6 附加自检 · 与 routing-builder 9 态矩阵兼容性 ✅ PASS

> 这是用户点名的硬约束，单独验证。

**结论：v3 无需改动 `routing-builder.md` 任何一行。** 9 态矩阵引用的全部是 token 名而非色值，v3 只改值不改名。

| 状态 | 矩阵引用 | v3 后实际值 | 可分性校验 |
|---|---|---|---|
| 常态 | 1px `--card-border` / `--surface` / `--elev-card` | `#d3dce5` / `#fff` / **零阴影** | vs surface **1.387**（v2 为 1.24，**更清晰**） |
| 悬停 | 1px `--card-border-hover` / `--elev-card-hover` | `#b3c2ce` / 轻阴影 | 常态↔悬停 **1.31:1**；且常态无阴影→悬停有阴影，**信噪比反而提升** |
| 聚焦 | `--focus-ring` | 2px `--bg` + 2px `#0a61b8` | accent vs 新 bg **5.42:1** ✅（非文本需 ≥3.0） |
| 选中 | 2px `--accent` / `--surface` | `#0a61b8` / `#fff` | vs surface **6.15:1**（v2 为 5.17，**更醒目**） |
| 拖起 | `--elev-modal` / `scale(1.02)` | 不变 | 常态阴影归零后，拖起的 `--elev-modal` **对比更强烈** |
| 原位占位 | 1px dashed `--border-strong` / `--surface-2` | `#b3c2ce` / `#f6f8fa` | ⚠️ **注意**：`--surface-2` 现在**比 `--surface` 暗**（93.63% vs 100%），占位框仍呈下沉感 ✅ 符合语义 |
| 不可连接 | 1px `--border-soft` | `#e4eaf0` | 常态↔不可连接 **1.14:1** ——弱化可感知 ✅（矩阵要求"降低描边对比"而非红色） |
| 运行中 | 2px `--accent` / `--accent-soft` | `#0a61b8` / `#e8f0fa` | **选中↔运行中可分性**：两者描边同为 2px accent，靠底色区分——`#e8f0fa` vs `#fff` = **1.149:1**，与 v2 的 `#eef4ff`（1.10:1）相比**更易分辨** ✅ |
| 已完成 | 1px `--success-border` / `--surface` | `#b0dcc0` / `#fff` | 未改动 |
| 异常 | 2px `--danger-border` / `--danger-soft` | `#eeb4b4` / `#fdeaea` | 未改动 |

**画布网格**：矩阵 §4.2 要求"拖拽时网格点由 `--border-soft` 提升为 `--border`"。
v3 后两者对比从 v2 的 (1.06 → 1.24) 变为 **(1.068 → 1.222)**，提升幅度基本持平，**该交互反馈强度不受影响** ✅

**⚠️ 一项遗留风险（advisory，非 v3 引入）**：
「已完成」`--success-border #b0dcc0` 与「异常」`--danger-border #eeb4b4` 的**亮度对比仅 1.08:1**——两者靠色相（绿 vs 红）区分，对红绿色盲用户不可分。
矩阵目前靠**两条冗余通道**兜底（描边 1px vs 2px、底色 白 vs `--danger-soft`），勉强达标。
**建议**（不阻塞 v3）：搭建器开发时给两态各加一枚 lucide 图标（`check-circle` / `alert-triangle`），补第三条通道。此项属 routing-builder 实现期事项，已记录备查。

---

## 附录 A · 变更汇总（可直接落 `design-tokens.css`）

```css
:root {
  /* ── A1-identity ───────────────────────────────────────── */
  --accent: #0a61b8;                    /* was #2563eb */

  /* ── A1-structure ──────────────────────────────────────── */
  /* --text-4xl: 已删除（死 token） */

  /* ── A1 中性色阶（重建明度阶梯） ─────────────────────────── */
  --bg: #edf1f5;                        /* was #f7f9fb */
  --surface-2: #f6f8fa;                 /* was #f1f5f9 —— 修正倒置 */
  --surface-3: #e3e9f0;                 /* was #e7edf3 */
  --muted: #4e6376;                     /* was #5a6e80 */
  --meta: #5c6f85;                      /* was #6b8093 —— v2 不达 AA */
  --border: #d3dce5;                    /* was #dde5ec */
  --border-soft: #e4eaf0;               /* was #edf1f5 —— 与新 bg 撞色 */
  --border-strong: #b3c2ce;             /* was #c3d0da */

  /* ── A2 派生 ───────────────────────────────────────────── */
  --accent-hover: #08508f;              /* was #1d4ed8 */
  --accent-active: #063f73;             /* was #1e40af */
  --accent-soft: #e8f0fa;               /* was #eef4ff */
  --accent-border: #b8d2ec;             /* was #c7d9ff */

  /* ── A2 新增：墨色实底 ──────────────────────────────────── */
  --ink-solid: var(--brand-ink);
  --ink-solid-hover: #1d2c3a;
  --ink-solid-active: #080f16;

  /* ── A2 层级（真正落实 Hairline First） ──────────────────── */
  /* ⚠️ 必须是 0 0 0 0 transparent，不能写 none —— none 在复合 box-shadow
     列表中非法，会使 .dash-path.is-active 整条声明失效（详见 §3.5 陷阱） */
  --elev-card: 0 0 0 0 transparent;     /* was 双层柔阴影 */
  --elev-card-hover: 0 4px 12px -2px rgba(15, 27, 38, 0.1),
                     0 1px 3px rgba(15, 27, 38, 0.06);
  --glass-bg: color-mix(in srgb, var(--surface) 92%, transparent);
  --glass-blur: 8px;

  /* ── B-slot：主按钮转墨 ─────────────────────────────────── */
  --btn-primary-bg: var(--ink-solid);
  --btn-primary-bg-hover: var(--ink-solid-hover);
  --btn-primary-bg-active: var(--ink-solid-active);

  /* ── B-slot 新增：中性标签 ──────────────────────────────── */
  --tag-bg: var(--surface-2);
  --tag-fg: var(--muted);
  --tag-border: var(--border);

  /* ── B-slot 新增：卡片标题字号 ──────────────────────────── */
  --card-title-size: var(--text-lg);

  /* ── C-extension 新增：深色锚点区 ───────────────────────── */
  --surface-ink: var(--brand-ink);
  --fg-on-ink: #f2f6f9;
  --fg-2-on-ink: #b6c6d4;
  --meta-on-ink: #8199ac;
  --border-on-ink: #24374a;
  --accent-on-ink: #63b3ed;

  /* ── C-extension 修订 ──────────────────────────────────── */
  --syn-func: #93c5fd;                  /* was #c4b5fd（全站唯一紫色） */
  --prose-code-inline-fg: var(--fg);    /* was #1e40af */
}
```

### `styles.css` 配套单行替换清单（[B] 项，共 14 行，零组件结构改动）

| # | 选择器 | 属性 | 改为 |
|---|---|---|---|
| 1 | `.tag` | `color` | `var(--tag-fg)` |
| 2 | `.tag` | `background` | `var(--tag-bg)` |
| 3 | `.tag` | `border-color` | `var(--tag-border)` |
| 4 | `.card-title` | `font-size` | `var(--card-title-size)` |
| 5 | `.stat` | `border` | `1px solid var(--border)` |
| 6 | `.tag-row` | *新增* | `margin-top: auto` |
| 7 | `.prose` | `color` | `var(--fg)` |
| 8 | `.topbar` | `saturate(160%)` | `saturate(120%)` ×2（含 `-webkit-`） |
| 9 | **`.panel.dash-hero`** ⚠️双类 | `background` / `border-color` | `var(--surface-ink)` / `var(--border-on-ink)` |
| 10 | `.dash-hero-lead` | `color` | `var(--fg-on-ink)` |
| 11 | `.dash-ring-track` | `stroke` | `var(--border-on-ink)` |
| 12 | `.dash-ring-fill` | `stroke` | `var(--accent-on-ink)` |
| 13 | `.dash-path-glyph` | `color` | `var(--muted)` |
| 14 | `.progress-track` | `background` | `var(--progress-track)` （修 D-07 token 绕过） |

### 对比度计算脚本

```python
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def L(hexstr):
    h = hexstr.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def cr(a, b):
    la, lb = L(a), L(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
```

---

## 附录 B · 落地顺序建议

| 批次 | 内容 | 文件 | 风险 | 可验证效果 |
|---|---|---|---|---|
| **B1** | §3.2 中性色阶 4 值 + §3.3 边框 3 值 + `--elev-card` 归零 | `design-tokens.css` 单文件 | 极低（纯改值） | **改完立刻能看出画面有厚度了**。建议先只做这一批并截图对比 |
| **B2** | §3.1 主色 + §3.4 accent 派生 | `design-tokens.css` 单文件 | 极低 | 蓝色变沉，与墨色同源 |
| **B3** | §3.6 主按钮转墨 + §4.1 ink-solid 组 | `design-tokens.css` 单文件 | 低 | 每页出现深色锚点 |
| **B4** | 中性标签 + 卡片标题 + stat 边框（[B] #1–6） | `styles.css` 6 行 | 低 | 蓝色麻疹消失，卡内层级建立 |
| **B5** | 首页深色锚点区（[B] #9–13） | `styles.css` 5 行 | 中（需视觉复核） | 首屏重心确立，**本次升级观感提升最大的一步** |
| **B6** | prose / syn-func / progress-track 收尾（[B] #7,14 + C-extension） | 两文件 | 极低 | 长文可读性、全站紫色归零 |

**B1 是整个升级的地基，且单独就能产生可感知的提升。建议先落 B1 截图确认方向，再继续。**

---

*文档版本：v3.0 · 作者：颜好看（UI/UX 设计师）· 基线：design-tokens.css v2.0*
*诊断样本：https://shuojia.qzz.io 生产构建 `index-CN-mNrEe.css`（145,906 B）*
