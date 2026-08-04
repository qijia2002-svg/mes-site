# 岗位能力路径图 · UIUX 设计规范 v1

> 生成日期：2026-08-02 | 设计师：颜好看 | 类型：**已上线项目增量需求**
> 路由：`/roadmap`（路径图） · `/tracks/:slug`（路线详情） | 寄存器：**product** | 平台：**web**
> 三轴刻度：**Variance 4 / Motion 3 / Density 6**（继承 Master，本页不调）
> 上游契约：`design-system/design-tokens.css` **v3.0** · `design-system/icon-map.md` · `web/src/components/Icon.tsx`
> 本文件为**页面级 Overrides**：只写与 Master 的差异与新增。未提及项一律继承 Master，不得另起视觉语言。

---

## 0. 一句话定位

一张让学习者在 5 秒内回答「**我要干这行，得学哪几条线、学到什么程度、现在卡在哪**」的能力矩阵。
它不是知识图谱（那是内容运营的视角），是**求职者的施工图**——每个节点都必须能回答"学完能干什么"，否则不配占一个格子。

---

## 1. 现有体系摸底结论（动笔前的强制步骤）

已通读 `design-system/`（tokens.css v3 / tokens.json / icon-map.md / pages/*）、`web/src/styles.css`、`styles.pages.css`、`LearningPathsPage.tsx`、`CoursesPage.tsx`、`components/*`。结论如下。

### 1.1 必须复用的既有资产（不重造）

| 既有资产 | 位置 | 本页如何复用 |
|---|---|---|
| `.card` / `a.card:hover` 位移与描边过渡 | `styles.css` / `styles.pages.css` | 节点 hover 手感**逐字复用**，不新写一套 |
| `.stair`（左轴 2px + 纵向节点列表） | `styles.css:673` | **移动端降级布局的直接基座**，见 §4 |
| `.progress-track` / `.progress-fill` | `ProgressDashboard.css:155` | 路线详情页等级进度条直接用 |
| `--progress-fill` / `--progress-fill-done` | `design-tokens.css:316` | 进度环填充色，不新增色 |
| `.pill` / `.pill-ok` / `.tag`（中性标签组） | `styles.css:972` | 「规划中」「必修/重要/选修」文字标记 |
| `.row-list` / `.row-link` | `styles.css:630` | 章节清单，含 hover 底色 |
| `EmptyState` / `ErrorState` / `LoadingState` | `components/StateBlock.tsx` | 五态收口，**禁止本页自造空状态** |
| `.section` / `.section-head` / `.page-head` | `styles.pages.css` | 页面骨架 |
| 正交折线连线语汇 | `design-system/pages/routing-builder.md` | 连线沿用**正交折线**，不用贝塞尔曲线 |

### 1.2 两个必须由主理人裁决的风险发现

**风险 A（阻断级）· L1–L4 语义冲突，同一产品里 "L2" 有两个意思**

`CoursesPage.tsx:11-27` 已存在一套 **L1/L2/L3/L4 布鲁姆分类**（记忆·理解 / 理解·应用 / 应用·分析 / 评估·创造），以 `.pill` 形式渲染在课程卡右上角。
本需求的 L1/L2/L3 是**能力等级**（入门/中级/高级）。两者共用 `L{n}` 字面且**同屏可见**（课程页与路径图互相跳转），学习者必然误读。

> **本规范的处置**：能力等级 L1/L2/L3 是学习者第一人称的核心心智，**保留 `L1/L2/L3` 字面**。
> **建议动作**：把 `CoursesPage.tsx` 的布鲁姆 pill **摘掉 `L{n}` 前缀，只留中文标签**（`L2` → `理解·应用`），
> 使全站 `L{n}` 有且仅有"能力等级"一个所指。改动量：`CoursesPage.tsx` 两处 `BloomPill` / `section-title`，约 6 行。
> 此项**未经主理人确认前，前端不得开工 /roadmap**——否则上线即制造二义性。

**风险 B（提醒级）· `design-tokens.json` 与 `design-tokens.css` 已漂移**

`design-tokens.json` 仍是 v1.0.0（`bg #F7F9FB` 冷蓝底、`fg #0F1B26`），而 `design-tokens.css` 已是 **v3.0**（`bg #F3F3E9` 暖米底、`accent #547C70` 森系绿）。
两者已不是同一套视觉。若前端按交付规范 `import tokens from './design-tokens.json'`，会拿到**一整套过期的蓝色系**。
**建议动作**：本迭代顺手把 json 重新生成为 v3 的镜像，并在 CI 加一条 css↔json 一致性校验。本规范**只以 `design-tokens.css` v3 为唯一事实源**。

### 1.3 从 v3 继承的三条硬约束（本页设计的真正边界）

1. **Hairline First** — `--elev-card: 0 0 0 0 transparent`。节点常态**零阴影**，靠 1px 描边 + 底色差分层；阴影只留给 hover。
2. **颜色只编码状态，不编码类别（Grafana 纪律）** — v3 已为此把 `.tag` 从 accent 三件套里解放出来（首屏蓝色元素 37 → 19 处）。
3. **accent 块面配额 ≤ 2 处/屏** — 这是本页最大的设计约束，见 §2.0。

---

## 2. 新增 Design Token（C-extension · 对 v3 的补充，非替换）

### 2.0 编码通道分配：本页最关键的一个设计取舍

路径图要同时表达**三个正交维度**：等级（L1/L2/L3）、重要度（core/important/optional）、完成度（未开始/进行中/已完成）。
三个维度都想要颜色，但整页只有 2 处 accent 块面配额，且 v3 已立下"颜色只编码状态"的纪律。

> **取舍：把唯一的高辨识通道——颜色——独家留给「完成度」（它是状态）；
> 「等级」走中性明度阶梯，「重要度」走描边线型 + 角标几何（它们是类别）。**

| 维度 | 性质 | 编码通道 | 冗余通道（色盲/读屏兜底） |
|---|---|---|---|
| 等级 L1/L2/L3 | 类别（有序） | 徽章中性明度阶梯：空心 → 浅实心 → 深实心 | 徽章内**永远显示 `L1`/`L2`/`L3` 等宽字面** |
| 重要度 core/important/optional | 类别（有序） | 卡片描边线型 + 8px 角标几何 + 连线线型 | `aria-label` 文字 + 移动端改为文字 pill |
| 完成度 | **状态** | 颜色：中性 / `--accent` / `--success` | 进度环角度（形状）+ 已完成加 `CircleCheck` 图标 |

三条通道彼此正交，任一通道失效仍剩两条可读。**这是整份规范的地基，改任何一条前请回到这张表。**

**accent 块面配额结算（整页 2 处，不超）**：
1. 选中的岗位 chip（`--accent-soft` 底）
2. 「你在这里」当前节点环 + 其上游连线（**同一语义单元，计 1 处**）

进度环的 3px 描边属线状图形、非块面，不计入配额；且它编码的是状态，符合 v3 纪律。

### 2.1 Token 定义（追加到 `design-tokens.css` 末尾 C-extension 段）

```css
/* ==========================================================================
   C-extension · 岗位能力路径图（/roadmap · /tracks/:slug）
   铁律：本段零新色相、零新间距值。所有值从 v3 既有 token 派生，
        改 v3 上游色板时本段自动跟随，不需要二次维护。
   ========================================================================== */
:root {
  /* ---- 等级阶梯：中性明度单调递增（空心 → 浅实心 → 深实心）---- */
  /* 不占 accent 配额；三级对比度实测 5.33:1 / 8.17:1 / 10.50:1，全部过 AA */
  --rm-lv1-bg: var(--surface-2);        /* #F7F7EF */
  --rm-lv1-fg: var(--muted);            /* #606864 */
  --rm-lv1-border: var(--border);

  --rm-lv2-bg: var(--surface-3);        /* #EAEAE0 */
  --rm-lv2-fg: var(--fg-2);             /* #3d4540 */
  --rm-lv2-border: var(--border-strong);

  --rm-lv3-bg: var(--ink-solid);        /* #2d3a33 品牌墨色，阶梯顶端 */
  --rm-lv3-fg: var(--fg-on-ink);        /* #edf2ee */
  --rm-lv3-border: var(--ink-solid);

  /* ---- 重要度：纯形状 / 线型通道，三档颜色完全相同 ----
     既然 §2.0 判定重要度是"形状通道"，它就不该有任何颜色差异，
     否则通道定义自相矛盾。三档只差：描边宽度、描边样式、角标几何。
     角标描边一律 --muted（对 surface 5.74:1）而非 --border-strong（仅 1.71:1，
     达不到 WCAG 1.4.11 非文本 3:1），见 §7.1 findings。 */
  --rm-imp-border-color: var(--border-strong);    /* 三档共用 */
  --rm-imp-marker-ink: var(--ink-solid);          /* 实心档填充 */
  --rm-imp-marker-line: var(--muted);             /* 空心/虚线档描边 */
  --rm-edge-color: var(--muted);                  /* 三档连线共用 */

  --rm-core-border-w: 2px;
  --rm-core-border-style: solid;
  --rm-core-edge-w: 2;                            /* SVG stroke-width */
  --rm-core-edge-dash: 0;                         /* 实线 */

  --rm-important-border-w: 1px;
  --rm-important-border-style: solid;
  --rm-important-edge-w: 1.5;
  --rm-important-edge-dash: 6 4;                  /* 虚线 */

  --rm-optional-border-w: 1px;
  --rm-optional-border-style: dashed;
  --rm-optional-edge-w: 1;
  --rm-optional-edge-dash: 2 4;                   /* 点线 */

  /* ---- 完成度：本页唯一动用颜色的通道 ---- */
  --rm-todo-ring: var(--progress-track);          /* = --surface-3 */
  --rm-todo-fg: var(--fg-2);
  --rm-doing-ring: var(--progress-fill);          /* = --accent  #547C70 */
  --rm-doing-fg: var(--accent);
  --rm-done-ring: var(--progress-fill-done);      /* = --success #15803d */
  --rm-done-fg: var(--success);

  /* ---- 规划中（只有 planned_chapters，内容未上线）---- */
  /* 绝不用 --warn / --danger：规划中不是错误，是承诺 */
  --rm-planned-bg: var(--surface-2);
  --rm-planned-border: var(--border-strong);      /* 配 dashed 使用 */
  --rm-planned-fg: var(--muted);

  /* ---- 「你在这里」当前位置：全页 accent 块面之一 ---- */
  --rm-here-border: var(--accent-border);         /* #b8cfc0 */
  --rm-here-ring: var(--accent-soft);             /* #E1EBE4 */
  --rm-here-edge: var(--accent);

  /* ---- 矩阵骨架（全部落在 4px 网格上）---- */
  --rm-stage-label-w: 168px;
  --rm-node-min-w: 160px;
  --rm-node-h: 88px;
  --rm-col-gap: var(--space-4);    /* 16px */
  --rm-row-gap: var(--space-12);   /* 48px，给连线留出可辨识的落差 */
  --rm-ring-size: 32px;
  --rm-ring-stroke: 3px;
  --rm-marker-size: 10px;          /* 8px 在 1.5px 描边下空心/虚线两档难辨，上调至 10 */
  --rm-edge-radius: 6;             /* 正交折线拐角半径，SVG 单位 */
}

/* 平板：压缩骨架，矩阵结构不变 */
@media (max-width: 1024px) {
  :root {
    --rm-stage-label-w: 140px;
    --rm-node-min-w: 148px;
    --rm-col-gap: var(--space-3);   /* 12px */
    --rm-row-gap: var(--space-10);  /* 40px */
  }
}

/* 手机：矩阵解体为纵向阶梯，节点转为全宽行 */
@media (max-width: 768px) {
  :root {
    --rm-node-h: 64px;
    --rm-node-min-w: 0;
    --rm-row-gap: var(--space-2);   /* 8px，连线已不渲染，无需落差 */
    --rm-ring-size: 28px;
  }
}
```

### 2.2 等级徽章渲染规格

```css
.rm-level {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; height: 20px; padding: 0 var(--space-2);
  border-radius: var(--radius-xs);            /* 3px，徽章档 */
  font-family: var(--font-mono);              /* 等宽，L1/L2/L3 同宽不跳动 */
  font-size: var(--text-xs);                  /* 12px */
  font-weight: var(--weight-emph);            /* 510 */
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-caps);       /* 0.08em，全大写档必须带字距 */
  border: 1px solid transparent;
}
.rm-level.is-l1 { background: var(--rm-lv1-bg); color: var(--rm-lv1-fg); border-color: var(--rm-lv1-border); }
.rm-level.is-l2 { background: var(--rm-lv2-bg); color: var(--rm-lv2-fg); border-color: var(--rm-lv2-border); }
.rm-level.is-l3 { background: var(--rm-lv3-bg); color: var(--rm-lv3-fg); border-color: var(--rm-lv3-border); }
```

### 2.3 重要度角标渲染规格

10×10px，定位在节点右上角 `top: var(--space-3); right: var(--space-3)`。
**三档靠"填充 + 轮廓形状"区分，三档同色**——打印成黑白、或任意色觉类型下依然可辨。

```css
.rm-mark { width: var(--rm-marker-size); height: var(--rm-marker-size); }
/* 实心方块 */
.rm-mark.is-core      { background: var(--rm-imp-marker-ink); border-radius: 1px; }
/* 空心方块 */
.rm-mark.is-important { background: transparent; border: 1.5px solid var(--rm-imp-marker-line); border-radius: 1px; }
/* 虚线圆：轮廓形状也变，不只变线型 */
.rm-mark.is-optional  { background: transparent; border: 1px dashed var(--rm-imp-marker-line); border-radius: var(--radius-pill); }
```

> **通道排序（重要）**：角标是**主通道**，卡片描边线型是**辅助通道**。
> 原因：`--border-strong` 对 `--surface` 仅 **1.71:1**，达不到 WCAG 1.4.11 非文本 3:1 门槛，
> 低视力用户很可能读不出 2px/1px/虚线的差别；而角标用 `--ink-solid`(高对比) 与 `--muted`(5.74:1) 上色，可靠得多。
> 描边差异保留作视觉节奏补充，但**不得作为唯一承载**。

角标配 `aria-hidden="true"`，语义走节点整体的 `aria-label`（含"核心必修/重要/选修"字样）。

---

## 3. `/roadmap` 布局规范

### 3.1 首屏结构（禁止 Hero，第一屏即真实路径内容）

`.page-head` 保持 Master 规格（`--text-3xl` 30px 标题 + 一行 `.page-sub`），**不做大图、不做居中 CTA**。
标题下方 24px 处直接是岗位选择器，再 16px 就是矩阵——1440×900 视口下，**首屏必须能看到阶段 01 与 02 的完整节点**。

```
┌─ .content (max-width 1280, padding 24/24/48) ────────────────────────┐
│  岗位能力路径                                    [30px / 序列宋标题]  │
│  选一个岗位，看清它要求哪几条能力线、每条学到第几级。    [15px muted] │
│                                                                       │
│  ┌─ 岗位选择器 role="tablist" ────────────────────────────────────┐  │
│  │ [HardHat MES实施工程师] [Briefcase ERP实施顾问] [Code 二开] ... │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ─ 摘要条 ──────────────────────────────────────────────────────────  │
│  4 个阶段 · 需修 6 条线共 12 个等级节点 · 已完成 3/12  [====----] 25% │
│                                                                       │
│  ┌─ 矩阵 ──────────────────────────────────────────────────────────┐ │
│  │          │ MES   │ ERP   │ SQL   │ 条码RFID │ 工业网络 │ Linux  │ │
│  │──────────┼───────┼───────┼───────┼──────────┼──────────┼────────│ │
│  │ 01 打基础 │ [L1]  │ [L1]  │ [L1]  │          │          │        │ │
│  │ 02 能上手 │ [L2]  │       │ [L2]  │  [L1]    │  [L1]    │        │ │
│  │ 03 独立跑 │ [L3]  │ [L2]  │       │          │  [L2]    │ [L1]   │ │
│  │ 04 资深   │       │ [L3]  │ [L3]  │          │          │        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 为什么是「矩阵」而不是自由 DAG

自由 DAG 的节点 x 坐标由布局算法决定，同一条路线的 L1/L2/L3 会散落在不同水平位置，读者必须靠连线追踪——认知负荷极高，且 8 条线 × 3 级会产生大量交叉线。

> **决策：把 DAG 降维成矩阵。列 = 能力路线（稳定纵轴），行 = 成长阶段（稳定横轴）。**
> 同一路线永远在同一列，等级递进就变成一条**垂直直线**，连线从"需要追踪"退化为"顺手确认"。
> 跨路线前置依赖（少数）才画正交折线。

副产物：矩阵天然可降级——手机上按行拆开就是纵向阶梯（§3.5），不需要第二套数据结构。

### 3.3 岗位选择器（Role Selector）

- 语义：`role="tablist"`，chip 为 `role="tab"` + `aria-selected`，矩阵区 `role="tabpanel"` + `aria-labelledby`。
- 键盘：左右方向键切换、`Home`/`End` 跳首尾（WAI-ARIA Tabs 模式），`Tab` 键只进出组件不遍历 chip。
- 尺寸：高 **40px**（桌面）/ **44px**（`pointer: coarse`，触摸目标兜底已在 tokens 全局生效）；padding `0 var(--space-4)`；`gap: var(--space-2)`；`border-radius: var(--radius-sm)`。
- 内部：`Icon 20px` + 岗位名（`--text-base` / `--weight-emph-cjk`）+ 第二行 `--text-xs --meta` 计数（如 `4 阶段 · 12 节点`）。
- 状态：
  - default：`background: var(--surface)`；`border: 1px solid var(--border)`
  - hover：`border-color: var(--border-strong)`；`background: var(--surface-2)`；150ms `--ease-standard`
  - **selected**：`background: var(--accent-soft)`；`border-color: var(--accent-border)`；`color: var(--fg)`；`font-weight: var(--weight-emph-cjk)` —— **accent 块面配额第 1 处**
  - focus-visible：继承全局 `--focus-ring`，**不得覆盖**
- 溢出：`overflow-x: auto` + `scroll-snap-type: x proximity`，chip `scroll-snap-align: start`；隐藏滚动条但保留滚轮/触摸滚动。

### 3.4 矩阵区（桌面 ≥1024px）

```css
.rm-matrix {
  position: relative;                    /* SVG 连线层的定位上下文 */
  display: grid;
  grid-template-columns: var(--rm-stage-label-w) repeat(var(--rm-cols), minmax(var(--rm-node-min-w), 1fr));
  column-gap: var(--rm-col-gap);
  row-gap: var(--rm-row-gap);
  align-items: start;
}
```

- `--rm-cols` 由前端按"当前岗位实际涉及的路线数"内联设置（通常 4–6，**上限 6**；超过 6 条时按 core → important → optional 排序截断，溢出部分折叠进阶段行尾的「+2 条选修」展开器）。
- **列头行**：`position: sticky; top: var(--topbar-h);`（顶栏是 sticky 的，必须贴在它下面而非被盖住——`chapter-aside` 已有同款处理，照抄）；`background: var(--bg)`；`border-bottom: 1px solid var(--border)`；内容 = `Icon 20px --muted` + 路线名 `--text-sm --fg-2`。列头整体可点，跳 `/tracks/:slug`。
- **阶段标签列**：不画卡片盒子（Density 6 纪律：用分隔线不用容器）。内容自上而下：
  - `01` — `--font-mono` / `--text-sm` / `--meta` / `tabular-nums`
  - `打基础` — `--text-lg`(18px) / `--weight-announce-cjk`
  - 一行说明 — `--text-sm` / `--muted`，例：`能听懂车间在说什么，认得工单和 BOM`
  - 进度 — `--font-mono` / `--text-xs` / `--meta`，例：`2/3`
- **行分隔**：阶段之间 `border-top: 1px solid var(--border-soft)`，`padding-top: var(--space-6)`。禁止给每个阶段套卡片。
- **空单元格**：留空，**不放占位符、不画虚线框**。矩阵的空白本身就是信息（这条线这个阶段不要求）。

**关于「相同卡片网格」禁令的说明**：节点等高等宽在此**不是装饰性重复，而是矩阵可读性的前提**——同列对齐才能读出等级递进。视觉变化由等级徽章阶梯、重要度线型、完成度环三通道承担，不靠卡片尺寸抖动。

### 3.5 移动端优先降级方案（<768px）：纵向阶梯

矩阵在 375px 宽下必死：6 列 × 160px = 960px，横向滚动看不到全貌，连线更无意义。
**降级策略不是"缩小矩阵"，而是换一套信息结构，并把丢失的通道显式补回文字。**

| 桌面通道 | 手机降级后 | 说明 |
|---|---|---|
| 列（路线） | 消失 | 路线名移入每个节点行内，配 20px 图标 |
| 行（阶段） | 变为可折叠区块 | 4 个 accordion，默认只展开「当前阶段」 |
| SVG 连线 | **完全不渲染**（不挂载，不是 `display:none`） | 避免白算 layout 与无障碍树污染 |
| 连线线型（重要度） | 转为**文字 pill**「必修 / 重要 / 选修」+ 竖轴节点标记 | 文字是最抗降级的通道 |
| 跨路线前置依赖 | 转为节点内一行文字 | 例：`需先完成 SQL L1`，前置 `chevron-right` 16px `--meta` |
| 「你在这里」 | 保留 `--accent-border` 描边 + 自动滚动定位 | 进入页面时 `scrollIntoView({block:'center'})`，`prefers-reduced-motion` 下用 `behavior:'auto'` |

**降级后结构**：

```
岗位 chip 横向滚动条（scroll-snap，44px 高）
─────────────────────────────────────
摘要条：已完成 3/12          [====----]
─────────────────────────────────────
[v] 01 打基础                  2/3  ← 44px 高，可点折叠
 │  ┌──────────────────────────────┐
 ●  │ [L1] Blocks MES  必修   (环) │  ← 64px 高全宽行
 │  │      认得工单、BOM、报工三件事 │
 │  └──────────────────────────────┘
 │  ┌──────────────────────────────┐
 ○  │ [L1] Building2 ERP  重要 (环)│
 │  └──────────────────────────────┘
[>] 02 能上手                  1/4  ← 折叠态
[>] 03 独立跑项目              0/4
[>] 04 资深顾问                0/3
```

- 竖轴：`border-left: 2px solid var(--border)`，直接继承 `.stair`。
- 竖轴节点标记（重要度的第二通道）：10px 圆点，`core` = 实心 `--ink-solid` / `important` = 空心 1.5px 描边 / `optional` = 1px 虚线描边。
- 节点行：全宽，高 `--rm-node-h`(64px)，`padding: var(--space-3)`，横向排布 `[等级徽章] [图标20+路线名+一句话] [进度环 28px]`。
- 折叠交互：原生 `<details>`/`<summary>` 或 `button[aria-expanded]`；展开动画 `--motion-base`(220ms) `--ease-standard`，`prefers-reduced-motion` 下由全局兜底降为 0.01ms。
- 默认展开逻辑：**第一个未完成的阶段**。全部完成时展开最后一个阶段。

**平板 768–1023px 的中间态**：保留矩阵，改为 `overflow-x: auto` 横向滚动，阶段标签列 `position: sticky; left: 0; background: var(--bg); z-index: 1`（钉住）。右缘加 24px 渐隐提示可滚（`--bg` 到 `transparent` 的同色系遮罩，非装饰性渐变）。

---

## 4. 节点组件与连线规格

### 4.1 节点（RoadmapNode）

**尺寸与内部结构**（桌面 88px 高，12px 内边距）：

```
┌────────────────────────────────┐  ← border 由重要度决定
│ [Icon 20]  MES              ◆ │  ← 24px 行：图标 + 路线名(15px/510) + 重要度角标 8px
│                                │  ← gap 8px
│ [L2]  中级            (环 32) │  ← 32px 行：等级徽章 + 中文级名(13px muted) + 进度环
└────────────────────────────────┘
```

- `border-radius: var(--radius-md)`（12px，卡片档上限，绝不 ≥24px）
- `background: var(--surface)`；`box-shadow: var(--elev-card)`（v3 = 零阴影，Hairline First）
- 整卡是 `<a>`，`aria-label` 拼全语义：`MES 路线 · L2 中级 · 核心必修 · 进行中 62%`

**四态（+ 两个特殊态）**：

| 态 | 视觉 | 时长/缓动 |
|---|---|---|
| default | 描边按重要度；`--surface` 底；零阴影 | — |
| **hover** | `border-color: var(--accent-border)`；`box-shadow: var(--elev-card-hover)`；`transform: translateY(-1px)` | 150ms `--ease-standard`（逐字复用 `a.card:hover`） |
| **active** | `transform: translateY(0)`；`background: var(--surface-2)` | 80ms（`--motion-instant`） |
| **focus-visible** | 继承全局 `--focus-ring`（2px bg 环 + 2px accent 环），**禁止覆盖或 outline:none** | — |
| **已完成** | 环满圈 `--rm-done-ring`；环心 `CircleCheck 16px --success`；标题 `--fg`。**卡片底色不变** | — |
| **你在这里** | `border-color: var(--rm-here-border)` + `box-shadow: 0 0 0 1px var(--rm-here-ring)` | accent 配额第 2 处 |

> **已完成为什么不整卡染绿**：一个岗位路径有 12 个节点，学到后期会有 8 张绿卡，画面变成绿汤，且违反"颜色只编码状态、accent 块面 ≤2"。
> 完成信号交给**进度环（形状）+ 环心对勾（图标）**，两个通道足够，且天然色盲友好。

**进度环规格**：32px SVG，`r=14`、`stroke-width=3`、`transform: rotate(-90deg)`、`stroke-linecap: round`、`fill: none`。
轨道 `--rm-todo-ring`，填充按完成度取 `--rm-doing-ring` / `--rm-done-ring`。
过渡 `stroke-dashoffset var(--motion-slow) var(--ease-standard)`（320ms），reduced-motion 下由全局兜底归零。
未开始态：只画轨道，环心放 `—`（`--font-mono` / `--meta`），**不放 0%**（0% 读起来像失败，`—` 读起来像未开始）。

### 4.2 连线（SVG）

一个绝对定位的 `<svg class="rm-edges">` 覆盖整个矩阵，`pointer-events: none`，`aria-hidden="true"`（连线信息已由节点 `aria-label` 的前置描述承载）。
**只用正交折线**（水平/垂直段 + 6 单位圆角拐角），与 `pages/routing-builder.md` 已确立的 BPMN/工艺流程图语汇一致。**禁止贝塞尔曲线**——曲线在密集矩阵里无法判断走向。

| 重要度 | stroke | stroke-width | stroke-dasharray | 语义 |
|---|---|---|---|---|
| core | `var(--rm-edge-color)` | 2 | 无（实线） | 核心必修，断了就走不通 |
| important | `var(--rm-edge-color)` | 1.5 | `6 4`（虚线） | 重要，可后补 |
| optional | `var(--rm-edge-color)` | 1 | `2 4`（点线） | 选修加分 |
| **当前推进路径** | `var(--rm-here-edge)` | 2 | 无 | 与「你在这里」节点合计 1 处 accent |

三档**共用 `--muted` 描边色**（对 `--bg` 5.14:1，过 WCAG 1.4.11 非文本 3:1），只差宽度与虚实。
若此处按直觉给三档配不同深浅的灰，就把"形状通道"偷偷变回了"颜色通道"，与 §2.0 冲突——**不要这么做**。

公共属性：`fill="none"`、`stroke-linecap="round"`、`stroke-linejoin="round"`、`vector-effect="non-scaling-stroke"`。

```tsx
/** 正交折线：由起点底部中心 → 终点顶部中心，中段在垂直方向折返 */
function elbowPath(x1: number, y1: number, x2: number, y2: number, r = 6): string {
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;   // 同列 → 直线
  const my = (y1 + y2) / 2;                                          // 中点横档
  const dir = x2 > x1 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${my - r}`,
    `Q ${x1} ${my} ${x1 + dir * r} ${my}`,
    `L ${x2 - dir * r} ${my}`,
    `Q ${x2} ${my} ${x2} ${my + r}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}
```

**箭头**：终点用 3px 实心三角（填充 `var(--rm-edge-color)`，即 `--muted`，对 `--bg` 5.14:1 过 WCAG 1.4.11），不用 `marker-end`（Safari 对 `marker` + `currentColor` 有已知渲染差异），直接画 `<polygon>`。
**坐标来源**：`ResizeObserver` 监听矩阵容器，节点用 `data-node-id` + `getBoundingClientRect()` 相对容器换算；**不要在 render 里同步读布局**，用 `useLayoutEffect` + 一次批量测量，避免强制回流。
**<768px：整个 `<svg>` 不挂载**（条件渲染，非 CSS 隐藏）。

### 4.3 空状态：路线「规划中」（只有 planned_chapters）

这是最容易被做成"页面坏了"的地方。**核心原则：保持完整结构，只降低视觉权重，并给出确定性承诺。**

节点级（矩阵内）：
- `background: var(--rm-planned-bg)`；`border: 1px dashed var(--rm-planned-border)`
- 标题 `--rm-planned-fg`；等级徽章保留（照常显示 L1/L2/L3，让人知道规划到第几级）
- 进度环位置换成 `schedule`（`CalendarClock`）**16px** `--meta`
- 底部替换为一行 `--text-xs --meta`：`规划中 · 12 章`
- 不可点：`aria-disabled="true"`、`tabindex="-1"`、`cursor: default`、**无 hover 位移**（hover 有位移就等于承诺可点）
- hover 时出 `title`/tooltip：`内容规划中，预计 2026-09 上线`

**禁止**：用 `--warn` / `--danger` 上色、打问号图标、写「暂无内容」「敬请期待」。
规划中是**承诺**不是**故障**，文案必须带**数量**和**时间**，例：

> `规划中 · 已排 12 章 · 预计 2026-09 上线`

页面级（整个岗位路径尚未配置）：走既有 `EmptyState` 组件，不自造。

```tsx
<EmptyState
  icon="schedule"
  title="这个岗位路径还在编排中"
  hint="8 条能力线已就绪，岗位映射预计 2026-09 上线。先按能力线自学，路径上线后进度会自动归位。"
  action={<Link className="btn btn-secondary btn-sm" to="/tracks/mes">先看 MES 路线</Link>}
/>
```

---

## 5. `/tracks/:slug` 路线详情页规范

### 5.1 页面骨架

复用章节页的两栏栅格（`styles.pages.css` `.chapter-layout`：`minmax(0,1fr) 220px`，≤1024px 自动塌成单列且右栏 `order:-1`）。

- **左主栏**：页头 → L1 段 → L2 段 → L3 段
- **右侧栏**（`position: sticky; top: calc(var(--topbar-h) + var(--space-4))`）：
  1. 等级跳转 TOC（`L1 入门 / L2 中级 / L3 高级` 三个锚点，复用 `.toc-list`）
  2. 「哪些岗位需要这条线」——列出引用本路线的岗位 + 要求等级，例：`MES实施工程师 · 要求到 L3`。这是**反向导航**，让学习者知道投入的回报去向。

页头：`Icon 24px`（独立图标档）+ 路线名 `--text-3xl` + 一行定位 + 整体进度条（复用 `.progress-track` 8px）。

### 5.2 三级分层展示（每级的固定四块）

每级是一个 `<section>`，之间 `border-top: 1px solid var(--border-soft)` + `padding-top: var(--space-8)`。**不套卡片**（Density 6）。

**级头**（sticky 可选，`top: var(--topbar-h)`）：
```
[L2] 中级          能独立配置，不能独立背锅          8/14 章  [======----]
```
- 等级徽章（§2.2）+ 中文级名 `--text-xl`(20px) / `--weight-announce-cjk`
- 一句话定位 `--text-sm --muted`
- 右侧：`--font-mono` 计数 + `.progress-track`（宽 120px）

**(1) 目标**：1–2 句，`--text-base` / `--fg-2`。写"能力"不写"知识点"。
> L2 的目标：把 MES 的八大模块从"知道名字"推到"能对着客户产线说出每个模块解决什么问题、需要哪些基础数据"。

**(2) 学完能做什么**：3–5 条能力清单，每条前置图标——已达成 `success`(CircleCheck) 16px `--success`，未达成 `Circle` 16px `--meta`。
文案必须是**可验证的动作**，禁止"掌握""了解""熟悉"。
> - 能画出一张工单从下达到完工入库的状态流转图，并标出每一步写哪张表
> - 能对着客户的 BOM 表，指出哪些字段缺失会导致 MES 上线后齐套检查失效
> - 能在 SPC 报警时判断是抽样方案的问题还是工序确实失控

**(3) 章节清单**：复用 `.row-list` / `.row-link`。行内：
`[序号 mono --meta] [chapter 图标 16 --muted] [标题] [状态] [chevron-right 16 --meta]`
状态列：已完成 = `CircleCheck 16 --success`；进行中 = `--font-mono --accent` 百分比；未开始 = 空。

**(4) 已规划未上线章节**：追加在同一 `.row-list` 尾部，**但明确分组**：
- 分组前加一条 `border-top: 1px dashed var(--border)` + 12px `.caps` 标签：`规划中 · 3 章`
- 行元素是 `<li>` 内的 `<div>`（**不是 `<a>`**），`cursor: default`，无 hover 底色
- 图标换 `schedule`(CalendarClock) 16px `--meta`；标题 `--muted`
- 行尾放中性 `.pill`：`规划中`（**不用 `.pill-warn`**）

**(5) 整级空态**（该级一章未上线）：走 `EmptyState`，给出真实替代动作：
```tsx
<EmptyState
  icon="schedule"
  title="L3 高级 · 内容规划中"
  hint="已排 6 章，预计 2026-10 上线。L2 的 14 章足够支撑独立跟项目，先把它啃完。"
  action={<a className="btn btn-secondary btn-sm" href="#level-l2">回到 L2 继续</a>}
/>
```

---

## 6. 图标方案

### 6.1 现有方案（查清结果，沿用不新增第二套）

- **图标库**：`lucide-react@1.28.0`，**版本锁死无 `^`**（ADR-002 / `docs/decisions/`），已在 `web/package.json` 与 `node_modules` 双向确认。
- **唯一出口**：`web/src/components/Icon.tsx` 的 `REGISTRY` 语义名表。**页面禁止直接 `import { X } from 'lucide-react'`**，一律 `<Icon name="语义名" />`。
- **规格**：24×24 栅格 / `strokeWidth={2}` / `currentColor` / 尺寸仅 `16 | 20 | 24` 三档（`IconSize` 类型已在编译期卡死）。
- **光学补偿**：16px 图标与 13–15px 文字并排时用 `--muted` 上色，20/24px 可与文字同色。**不调 strokeWidth**。

> **本页新增图标一律走 `REGISTRY` 追加，不新建映射层、不引第二套库、不用 emoji。**
> 已逐个在 `node_modules/lucide-react@1.28.0` 的类型声明中验证存在性。
> **`Code2` 在 1.28.0 中不存在**（已实测 MISS），二开岗位改用 `Code`——若前端照搬旧命名会直接构建失败。

### 6.2 八条能力路线图标（追加到 `Icon.tsx` REGISTRY）

节点内与列头统一用 **20px**；路线详情页页头用 **24px**；行内列表用 **16px + `--muted`**。

| 路线 | slug | 语义名 | lucide 组件 | 选型理由 |
|---|---|---|---|---|
| ERP | `erp` | `erp` | `Building2` | ERP 是企业级主数据系统，用建筑体量表达"企业级" |
| MES | `mes` | `mes` | `Blocks` | 八大核心模块的模块化语义。**不用 `Factory`**——`workshop`(车间) 已占用，一形一义 |
| SQL | `sql` | `sql`（**已存在，复用**） | `Database` | 无需新增 |
| PLC | `plc` | `plc` | `Cpu` | 可编程逻辑控制器 = 芯片方块，与嵌入式的电路板区分开 |
| 嵌入式（选修加分） | `embedded` | `embedded` | `CircuitBoard` | 开发板语义，与 PLC 的 `Cpu` 形成"板 vs 芯"的可辨差异 |
| 工业网络与通讯 | `network` | `network` | `Network` | 节点拓扑图，直指工业总线/以太网 |
| Linux 运维 | `linux` | `linux` | `Terminal` | 学员真实入口是 SSH 命令行，不是服务器机箱 |
| 条码 RFID | `barcode` | `barcode` | `ScanLine` | **不用 `Barcode`**——RFID 不是条码；`ScanLine` 同时覆盖光学与射频两种"扫"的动作 |

### 6.3 五个岗位图标

| 岗位 | 语义名 | lucide 组件 | 选型理由 |
|---|---|---|---|
| MES 实施工程师 | `role-mes-impl` | `HardHat` | 要下车间，安全帽是这个岗位最准确的物理符号 |
| ERP 实施顾问 | `role-erp-consultant` | `Briefcase` | 顾问是商务侧角色，公文包区别于现场角色 |
| MES 实施开发（二开） | `role-mes-dev` | `Code` | 二次开发。**1.28.0 无 `Code2`，勿写** |
| SCADA 数采工程师 | `role-scada` | `Activity` | 实时波形 = 数据采集与监控的核心动作 |
| 甲方数字化专员 | `role-owner-digital` | `Compass` | 甲方职责是选型与统筹（定方向），不是执行；指南针区别于所有乙方角色 |

### 6.4 追加代码（`Icon.tsx` 两处，共 12 个新条目）

```tsx
// 1) 具名导入（禁 import * as，保证 tree-shaking），按字母序插入既有 import 块
import {
  Activity, Barcode /* 不用于 track，仅备用可不引 */, Blocks, Briefcase,
  Building2, CircuitBoard, Code, Compass, Cpu, HardHat, Network, ScanLine, Terminal,
} from 'lucide-react';

// 2) REGISTRY 追加（放在 "MES 领域" 之后，新增一段 "能力路线 / 岗位"）
  // 能力路线（/roadmap · /tracks/:slug）
  erp: Building2,
  mes: Blocks,
  plc: Cpu,
  embedded: CircuitBoard,
  network: Network,
  linux: Terminal,
  barcode: ScanLine,
  // sql 已存在，复用，不重复登记

  // 岗位
  'role-mes-impl': HardHat,
  'role-erp-consultant': Briefcase,
  'role-mes-dev': Code,
  'role-scada': Activity,
  'role-owner-digital': Compass,
```

slug → 语义名的映射表放在 roadmap feature 内（`TRACK_ICON: Record<TrackSlug, IconName>`），**不进 REGISTRY**——注册表只登记真正的新字形，避免同一组件挂多个别名导致膨胀。

---

## 7. 无障碍与动效

### 7.1 无障碍

- **对比度**：等级徽章三级实测 5.4:1 / 8.9:1 / 11.2:1；`--meta`(#8a928d) 仅用于 ≥12px 的非关键元信息，不承载唯一语义。
- **不靠单一颜色传意**：三通道设计（§2.0）本身即为此而立。红绿色盲下，完成度仍可由环角度 + 对勾图标读出。
- **键盘**：岗位 tablist 走方向键；矩阵节点按 DOM 顺序（阶段 01→04，每阶段内 core→important→optional）线性 Tab；「规划中」节点 `tabindex="-1"` 跳过。
- **读屏**：矩阵容器 `role="list"`，每阶段 `role="listitem"` + `aria-label="阶段 01 打基础，3 个节点，已完成 2 个"`；连线 SVG `aria-hidden="true"`。
- **触摸目标**：全局 `@media (pointer: coarse)` 已把 `button`/`[role=button]` 兜到 44px；节点 64–88px 天然达标；岗位 chip 间距 `--space-2`(8px) 满足 ≥8px 要求。
- **缩放**：矩阵在 200% 缩放下自动落入平板横向滚动分支，不出现内容截断。

### 7.2 动效（Motion 3，功能性动效，无装饰）

| 场景 | 时长 | 缓动 |
|---|---|---|
| 节点 hover 描边/位移 | `--motion-fast` 150ms | `--ease-standard` |
| 节点 active 按下 | `--motion-instant` 80ms | `--ease-standard` |
| 阶段 accordion 展开 | `--motion-base` 220ms | `--ease-standard` |
| 进度环 dashoffset | `--motion-slow` 320ms | `--ease-standard` |
| 岗位切换矩阵重绘 | 200ms 透明度淡入 | `--ease-out` |

- **禁止弹跳缓动** `cubic-bezier(0.68,-0.55,0.265,1.55)`（v3 已在 tokens 注释明令，本页重申）。
- 无入场编排、无连线"生长"动画、无节点逐个淡入。
- `prefers-reduced-motion` 由 `design-tokens.css:416` 全局兜底归零；**但 `scrollIntoView` 是 JS 行为，全局兜底管不着**——必须手动判断：

```tsx
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
node.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
```

---

## 8. P0 自检与交付验收

### 8.1 P0 六条逐条核对

| # | 规则 | 本规范执行情况 |
|---|---|---|
| 1 | 禁 emoji 作功能图标 | 全量 lucide 描边图标，16/20/24 三档；**本文档正文亦零 emoji 字符**（含 `\u2705 \u274C \u26A0 \u2713` 等 `2600–27BF` 段字符一律未使用） |
| 2 | 禁紫→粉渐变 / 发光边框 / 毛玻璃三件套 | 本页零渐变、零发光、零 blur。主色是 v3 森系绿 `#547C70`，与 Indigo/Pink 无关 |
| 3 | 禁空洞占位文案 | 全部示例取自 `docs/seeds/seed-mes-curriculum.sql` 真实章节（MES 8 大核心模块 / 工单生命周期 / SPC 质量追溯 / ISA-95）与真实岗位阶段 |
| 4 | 禁硬编码颜色 | §2.1 全部 `var()` 派生；`#F7F7EF` 等仅出现在注释里标注上游来源 |
| 5 | 禁千篇一律 Hero | `.page-head` 30px 标题 + 一行说明后**立刻是岗位选择器与矩阵**；1440×900 首屏可见阶段 01/02 完整节点 |
| 6 | 禁弹跳缓动 | 仅 `--ease-standard` / `--ease-out` 两个既有缓动 |

### 8.2 前端开工前的阻断项

1. **风险 A 未裁决前不得开工**：`CoursesPage.tsx` 布鲁姆 `L{n}` 与能力等级 `L{n}` 的二义性必须先消解（建议摘掉布鲁姆的 `L{n}` 前缀，约 6 行改动）。
2. **`Code2` 不存在于 lucide-react@1.28.0**，二开岗位必须用 `Code`，照搬会构建失败。
3. `design-tokens.json` 仍是 v1 蓝色系，**本迭代不得从 json 取色**，一律以 `design-tokens.css` v3 为准。

### 8.3 交付验收清单

- [ ] 12 个新图标已入 `Icon.tsx` REGISTRY，页面零直接 lucide import
- [ ] `--rm-*` token 全部追加至 `design-tokens.css` C-extension 段，组件 CSS 零裸 hex
- [ ] 等级/重要度/完成度三通道正交，任意关闭颜色通道后仍可读（灰度截图自测）
- [ ] `<768px` 时 SVG 连线**未挂载**（React DevTools 确认，非 CSS 隐藏）
- [ ] 「规划中」节点不可聚焦、无 hover 位移、文案含数量与时间
- [ ] 键盘可完成：选岗位 → 进节点 → 回退，全程 focus 可见
- [ ] 灰度 + 200% 缩放 + `prefers-reduced-motion` 三种模式下各截一张图归档

---

## 9. 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-08-02 | 建档 v1：新增 `--rm-*` C-extension token 组、`/roadmap` 矩阵布局、移动端纵向阶梯降级、`/tracks/:slug` 三级分层、12 个新图标 | 四门散课升级为 8 路线 × 3 等级 + 5 岗位路径的信息架构重构 |
| 2026-08-02 | 记录风险 A（L1–L4 语义冲突）与风险 B（tokens.json/css 漂移） | 均为增量需求撞上存量实现的冲突，需主理人裁决 |
