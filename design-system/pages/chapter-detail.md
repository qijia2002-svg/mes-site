# 页面设计稿 · 章节详情页（P0 缺口）

> 覆盖 `DESIGN.md` 的页面级 Override，只写差异，其余继承 MASTER。
> 路由：`/courses/:topicId/chapters/:chapterId`
> 接口：`GET /api/v1/chapters/:id`（已就绪，返回含 `md_text`）+ `GET /api/v1/topics/:id/chapters`（左侧目录）
> 依赖：`markdown-it` + `dompurify`（已装，零 import）
> 实现约束：**无 UI 组件库，原生 HTML + 手写 CSS**。本文附可直接粘贴的完整 CSS。

**为什么这页是 P0**：一个读不了课文的学习平台不能上线。后端能吐 markdown 正文，前端没有承接页面——这是整个 MVP 里"接口已就绪但零对接"的最大一块。

---

## 1. 布局骨架

桌面 ≥1280px 三栏，中间栏定宽居中，左右两栏是辅助：

```
┌──────────────────────────── Topbar 52px ────────────────────────────┐
│ [面包屑] 课程 › 工单管理 › 2.3 工单状态机     [搜索] [健康] [用户]  │
├──────────┬──────────────────────────────────┬───────────────────────┤
│ Sidebar  │  章节目录 240px                  │  正文 720px  │ TOC 200│
│ 240px    │  ─────────────                   │              │        │
│ 全局导航 │  第 1 章 工单基础       [已学完] │  # 2.3 ...   │ 本页目录│
│          │  第 2 章 状态流转                │              │ ・ 状态定义│
│          │   2.1 状态定义          [已学完] │  正文段落…   │ ・ 流转规则│
│          │   2.2 流转规则          [已学完] │              │ ・ 常见坑 │
│          │   2.3 状态机实现     ← 当前      │  ```sql      │        │
│          │   2.4 异常回滚                   │  ...         │ [进度]  │
│          │  第 3 章 报工                    │  ```         │        │
│          │                                  │              │        │
│          │                                  │ ←上一节 下一节→        │
└──────────┴──────────────────────────────────┴───────────────────────┘
```

三栏在窄屏逐级退场（内容永远不动，只有辅助栏退）：

| 宽度 | 全局 Sidebar | 章节目录 | 正文 | 右侧 TOC |
|---|---|---|---|---|
| ≥1440 | 240 展开 | 240 固定 | 720 | 200 固定 |
| 1280–1440 | 56 图标条 | 240 固定 | 720 | 200 固定 |
| 1024–1280 | 56 图标条 | 240 固定 | 弹性 min 560 | 隐藏 |
| 768–1024 | 抽屉 | 折叠为顶部「章节目录」下拉 | 弹性 | 隐藏 |
| <768 | 抽屉 | 同上 | 100% − 24 gutter | 隐藏 |

章节目录与 TOC 都 `position: sticky; top: calc(var(--topbar-h) + 16px)`，自身可滚。
正文列宽由 `--prose-measure: 68ch` 控制而非固定 px——换字号时行宽自动跟随。

---

## 2. 正文排版（markdown 四类元素）

字号在此页**切到 `--text-prose` 17px / 行高 1.75**，这是全站唯一使用阅读型正文的地方（UI chrome 仍是 15px）。两档正文是刻意的，不要归一。

### 标题
h1 只出现一次（章节标题，由页面渲染，不来自 markdown 正文——要求内容侧 md_text 从 `##` 起写）。

| 级别 | 字号 | 字重 | 上边距 | 下边距 | 其它 |
|---|---|---|---|---|---|
| h1 页面标题 | 30px `--text-3xl` | 590 | — | 8px | 上方挂 `--text-xs` caps 的「第 2 章 · 状态流转」 |
| h2 | 24px `--text-2xl` | 590 | 40px | 12px | 上方 1px `--border-soft` 分隔线，制造章节呼吸 |
| h3 | 20px `--text-xl` | 510 | 32px | 8px | |
| h4 | 17px `--text-prose` | 590 | 24px | 4px | 与正文同号，靠字重区分 |

h2/h3 带 `scroll-margin-top`，锚点跳转不被 Topbar 遮住。hover 时左侧浮出 `#` 锚链（`--meta` 色，`opacity 0→1`，150ms）。

### 列表
- `ul` 用 `--meta` 色实心小圆点，`li` 间距 8px，嵌套缩进 24px。
- `ol` 用 `tabular-nums` 数字，右对齐到内容左边线，序号 `--muted` 色。
- 任务列表 `- [ ]` / `- [x]` 渲染为 lucide `Square` / `SquareCheck` 16px，不用原生 checkbox（原生的在 Windows 上很丑且不可控）。
- **列表不要 marker 用 accent 色**——正文里的强调色配额要留给行内链接。

### 代码块
本项目最重要的正文元素（SQL 教学）。

- 深色面板，复用 SQL 沙箱的 `--code-*`，让"代码 = 深色"成为全站一条规则。
- 圆角 8px `--radius-md`，无外阴影，1px `--code-border`。
- 顶部 32px 工具条：左侧语言标签（`sql` / `bash`，`--text-xs` caps `--syn-comment` 色），右侧复制按钮（`Copy` 16px，**hover 才显形**，复制后 2s 内换 `Check` + `--success`）。
- 字体 `--font-mono` 13px / 行高 1.6。横向溢出时 `overflow-x: auto`，不换行（SQL 折行会破坏可读性）。
- SQL 语法着色沿用 `--syn-*` 六色。若 Phase 3 前来不及接高亮器，先出纯 `--code-fg` 单色版，**不要用第三方高亮主题**（会引入一整套外来色板）。
- 代码块右下角可选「在沙箱中打开」按钮（`Database` 16px），点击把该段 SQL 塞进 `/sql-space`。这是本平台理论与实训的连接点，比任何视觉设计都值钱。

### 表格
MES 教学里大量字段说明表、状态对照表。

- 外层 `overflow-x: auto` 包裹 + 1px `--border` + 8px 圆角，表格本身 `border-collapse: collapse`。
- 表头 `--surface-2` 底 + 13px / 510 字重 + `--fg-2` 色 + sticky。
- 行分隔 1px `--border-soft`，**无斑马纹**（斑马纹在 3 列小表里是噪音；行数多时靠 hover 定位）。
- hover 整行 `--surface-2`。
- 单元格 padding `10px 14px`，字号 15px（比正文小一档，表格要更密）。
- 纯数字列 `text-align: right` + `tabular-nums`。
- 窄屏首列 `position: sticky; left: 0` 加右侧 1px 分隔，横滚时字段名不丢。

### 其余元素
- **行内代码**：浅底 `--surface-2` + `--prose-code-inline-fg` + 1px 边框 + 3px 圆角 + 13px mono。深色行内码在长文里像被挖了个洞，所以行内走浅、块级走深。
- **链接**：`--accent` + `1px` 下划线（`--accent-border` 色，`text-underline-offset: 3px`），hover 下划线转 `--accent` 实色。不用纯色块背景。
- **blockquote**：左侧 2px `--prose-quote-bar` + 16px 左内距 + `--fg-2` 色。**这是全站唯一允许的左侧色条**（且是中性色，不是 accent）。
- **callout**：md 里以 `> [!NOTE]` / `> [!WARNING]` / `> [!DANGER]` 开头的 blockquote 转换为提示块——`-soft` 底 + 1px `-border` + 8px 圆角 + 左上角 16px 图标（`Info` / `TriangleAlert` / `CircleAlert`）+ 标题行。
- **图片**：`max-width: 100%` + `aspect-ratio` 占位防 CLS + 1px 边框 + 8px 圆角；`figcaption` 13px `--meta` 居中。
- **hr**：1px `--prose-hr`，上下 40px。

---

## 3. 页面专属组件

### 章节目录（左侧第二栏）
- 章分组标题：`--text-xs` caps `--meta`，不可点。
- 小节项：15px / `--muted`，高 32px，左内距 12px。
- hover：`--surface-2` 底。
- **当前项**：`--surface-3` 底 + `--fg` 文字 + 510 字重 + 2px `--accent` 左指示条（与全局 Sidebar 同一套语言）。
- 已学完：行尾 `CircleCheck` 14px `--success`。
- 未解锁（若路径有前置）：`--meta` 色 + `Lock` 14px + `cursor: not-allowed`。

### 右侧 TOC
- 只取 h2/h3 两级，h3 缩进 12px。
- 13px `--meta`，当前段 `--fg` + 510。
- 滚动同步用 `IntersectionObserver`（不要 scroll 事件轮询）。
- 底部挂本章进度条：4px 高，`--progress-track` 槽 + `--progress-fill`，下方 12px `--meta` 文案「本章 3/5 节」。

### 底部翻页
两个等宽卡片，各 1px `--border` + 8px 圆角 + 16px padding。
上一节靠左（`ArrowLeft` + 「上一节」caps 小字 + 标题），下一节靠右（右对齐 + `ArrowRight`）。
只有一侧时另一侧留空不占位。标题超长 `-webkit-line-clamp: 1`。

### 「标记已学完」按钮
正文末尾、翻页上方。Secondary 变体 + `CircleCheck` 16px。
点击后变 `--success-soft` 底 + `--success` 字 + 文案「已学完」，可再点取消。
**乐观更新**：先改 UI 再发请求，失败回滚并出 Toast。这页的进度写入不该让人等。

---

## 4. 五态

| 态 | 设计 |
|---|---|
| **Loading** | 骨架屏而非 spinner：标题条 + 6 行不等长灰条（宽度 100/95/88/97/60/92%，别做成等长的——等长骨架一眼假）+ 一块代码块方块。左侧目录同时骨架。1.4s 微光扫过。 |
| **Empty** | 章节存在但 `md_text` 为空。`FileText` 48px `--meta` + 「这一节的讲义还在编写中」+ 「你可以先做本章的 SQL 练习」+ Primary 按钮跳沙箱。不写"暂无数据"。 |
| **Error** | 三段式：`CircleX` 20px + 「讲义加载失败」+ 「服务端返回 5001，可能是数据库繁忙」+ 「重试」按钮 + 可折叠的 `traceId`（mono 13px + 复制按钮）。**保留 traceId 是这页的硬要求**，MES 实施人员本身就是会看日志的用户。 |
| **Populated** | 正常渲染。 |
| **Edge** | ① 超长无空格串（表名 / URL）→ `overflow-wrap: break-word` + 代码块 `overflow-x: auto`；② 超宽表格 → 横滚 + 首列 sticky；③ 单节正文 >10000 字 → 右侧 TOC 自身滚动，不跟页面撑高；④ md 里混入 `<script>` → **dompurify 强制过滤**，白名单标签，`ALLOWED_ATTR` 不含 `on*`；⑤ 标题层级跳级（h2 直接跳 h4）→ TOC 按出现顺序平铺，不强行补层级。 |

---

## 5. 无障碍与交互

- 正文容器 `<article>`，左目录 `<nav aria-label="章节目录">`，右 TOC `<nav aria-label="本页目录">`。
- 当前章节项 `aria-current="page"`。
- 代码块 `<pre><code class="language-sql">`，外层 `tabindex="0"` + `role="region"` + `aria-label="SQL 代码块"`——可横滚区域必须键盘可达。
- 复制按钮 `aria-label="复制代码"`，复制成功用 `aria-live="polite"` 播报。
- 锚链 `aria-label="链接到本节"`。
- 快捷键：`J` / `K` 上下节，`/` 聚焦搜索。**必须在输入框内失效**（`e.target` 是 input/textarea 时 return）。
- 全部动效 ≤220ms；`prefers-reduced-motion` 已由 tokens 全局兜底。

---

## 6. 可直接粘贴的 CSS

放到 `web/src/styles/prose.css`，在 `design-tokens.css` 之后引入。所有值走 token，零硬编码。

```css
/* ── 章节页三栏骨架 ───────────────────────────────────────── */
.chapter-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 200px;
  gap: var(--space-8);
  align-items: start;
  max-width: var(--container-app);
  margin: 0 auto;
  padding: var(--space-8) var(--gutter-desktop) var(--space-16);
}
.chapter-toc-left,
.chapter-toc-right {
  position: sticky;
  top: calc(var(--topbar-h) + var(--space-4));
  max-height: calc(100vh - var(--topbar-h) - var(--space-8));
  overflow-y: auto;
}
.chapter-main { min-width: 0; }               /* 让 grid 子项可缩，防表格顶宽 */

@media (max-width: 1280px) {
  .chapter-layout { grid-template-columns: 240px minmax(0, 1fr); }
  .chapter-toc-right { display: none; }
}
@media (max-width: 1024px) {
  .chapter-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
    padding: var(--space-5) var(--gutter-tablet) var(--space-12);
  }
  .chapter-toc-left { position: static; max-height: none; }
}
@media (max-width: 768px) {
  .chapter-layout { padding: var(--space-4) var(--gutter-phone) var(--space-10); }
}

/* ── 正文 ─────────────────────────────────────────────────── */
.prose {
  max-width: var(--prose-measure);
  font-size: var(--text-prose);
  line-height: var(--leading-prose);
  color: var(--fg-2);
  overflow-wrap: break-word;
}
.prose > * + * { margin-top: var(--prose-gap); }

.prose h2,
.prose h3,
.prose h4 {
  color: var(--fg);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-title);
  scroll-margin-top: calc(var(--topbar-h) + var(--space-5));
}
.prose h2 {
  margin-top: var(--prose-h2-mt);
  margin-bottom: var(--space-3);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-soft);
  font-size: var(--text-2xl);
  font-weight: var(--weight-announce);
}
.prose h3 {
  margin-top: var(--prose-h3-mt);
  margin-bottom: var(--space-2);
  font-size: var(--text-xl);
  font-weight: var(--weight-emph);
}
.prose h4 {
  margin-top: var(--space-6);
  margin-bottom: var(--space-1);
  font-size: var(--text-prose);
  font-weight: var(--weight-announce);
}
.prose :is(h2, h3) .anchor {
  margin-left: var(--space-2);
  color: var(--meta);
  opacity: 0;
  transition: opacity var(--motion-fast) var(--ease-out);
}
.prose :is(h2, h3):hover .anchor,
.prose :is(h2, h3) .anchor:focus-visible { opacity: 1; }

.prose a {
  color: var(--prose-link);
  text-decoration: underline;
  text-decoration-color: var(--prose-link-underline);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: text-decoration-color var(--motion-fast) var(--ease-out);
}
.prose a:hover { text-decoration-color: var(--prose-link); }

.prose :is(ul, ol) { padding-left: var(--space-6); }
.prose li + li { margin-top: var(--space-2); }
.prose li::marker { color: var(--meta); font-variant-numeric: tabular-nums; }
.prose :is(ul, ol) :is(ul, ol) { margin-top: var(--space-2); }

.prose blockquote {
  border-left: 2px solid var(--prose-quote-bar);
  padding-left: var(--space-4);
  color: var(--fg-2);
}
.prose hr { border: 0; border-top: 1px solid var(--prose-hr); margin: var(--space-10) 0; }

.prose img {
  max-width: 100%;
  height: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.prose figcaption {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--meta);
  text-align: center;
}

/* ── 行内代码：浅底 ───────────────────────────────────────── */
.prose :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.86em;
  background: var(--prose-code-inline-bg);
  color: var(--prose-code-inline-fg);
  border: 1px solid var(--prose-code-inline-border);
  border-radius: var(--radius-xs);
  padding: 0.1em 0.36em;
}

/* ── 块级代码：深色面板 ───────────────────────────────────── */
.code-block {
  border: 1px solid var(--prose-pre-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--prose-pre-bg);
}
.code-block__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--code-bg-gutter);
  border-bottom: 1px solid var(--prose-pre-border);
}
.code-block__lang {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--syn-comment);
}
.code-block__copy {
  opacity: 0;
  color: var(--syn-comment);
  background: none;
  border: 0;
  cursor: pointer;
  transition: opacity var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.code-block:hover .code-block__copy,
.code-block__copy:focus-visible { opacity: 1; }
.code-block__copy:hover { color: var(--code-fg); }
.code-block__copy[data-copied='true'] { opacity: 1; color: var(--success); }

.prose pre {
  margin: 0;
  padding: var(--space-4);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--prose-pre-fg);
  tab-size: 2;
}
.prose pre code { background: none; border: 0; padding: 0; font-size: inherit; }
.prose pre::selection,
.prose pre *::selection { background: var(--code-selection); }

.tok-keyword  { color: var(--syn-keyword); }
.tok-string   { color: var(--syn-string); }
.tok-number   { color: var(--syn-number); }
.tok-function { color: var(--syn-func); }
.tok-comment  { color: var(--syn-comment); font-style: italic; }
.tok-operator { color: var(--syn-operator); }

/* ── 表格 ─────────────────────────────────────────────────── */
.prose .table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.prose table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--text-base);
  font-variant-numeric: tabular-nums;
}
.prose th,
.prose td {
  padding: 10px var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--table-row-border);
}
.prose thead th {
  position: sticky;
  top: 0;
  background: var(--table-header-bg);
  color: var(--table-header-fg);
  font-size: var(--text-sm);
  font-weight: var(--weight-emph);
  white-space: nowrap;
}
.prose tbody tr:last-child td { border-bottom: 0; }
.prose tbody tr:hover { background: var(--table-row-bg-hover); }
@media (max-width: 768px) {
  .prose :is(th, td):first-child {
    position: sticky;
    left: 0;
    background: var(--surface);
    border-right: 1px solid var(--border-soft);
  }
  .prose thead th:first-child { background: var(--table-header-bg); }
}

/* ── Callout ──────────────────────────────────────────────── */
.callout {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  line-height: var(--leading-body);
  color: var(--fg-2);
}
.callout__icon { flex: 0 0 auto; margin-top: 2px; }
.callout__title {
  display: block;
  margin-bottom: var(--space-1);
  font-weight: var(--weight-emph);
  color: var(--fg);
}
.callout--note   { background: var(--callout-note-bg);   border-color: var(--callout-note-border); }
.callout--note   .callout__icon { color: var(--accent); }
.callout--warn   { background: var(--callout-warn-bg);   border-color: var(--callout-warn-border); }
.callout--warn   .callout__icon { color: var(--warn); }
.callout--danger { background: var(--callout-danger-bg); border-color: var(--callout-danger-border); }
.callout--danger .callout__icon { color: var(--danger); }

/* ── 骨架屏 ───────────────────────────────────────────────── */
.skeleton {
  background: var(--surface-2);
  border-radius: var(--radius-xs);
  position: relative;
  overflow: hidden;
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}
@keyframes skeleton-sweep { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) {
  .skeleton::after { animation: none; }
}
```

---

## 7. 实现要点

- markdown-it 配置 `{ html: false, linkify: true, breaks: false }`，输出经 `DOMPurify.sanitize()` 再 `dangerouslySetInnerHTML`。**`html: false` + dompurify 双保险**，正文来自后台可编辑内容，是 XSS 面。
- 代码块工具条与「在沙箱中打开」需要包裹 `<pre>`：用 markdown-it 的 `renderer.rules.fence` 覆写生成 `.code-block` 外壳，不要渲染完再用 DOM 操作补——那会引 hydration 抖动。
- 表格外层 `.table-wrap` 同理，覆写 `renderer.rules.table_open/table_close`。
- TOC 从渲染后的 h2/h3 提取，id 用 slugify(中文标题) 或 `h-${index}` 兜底；中文 slug 不稳，建议直接 `h-${index}` + `data-title`。
- 章节间导航需要同主题的章节列表，与左侧目录共用一次 `topics/:id/chapters` 查询，用 TanStack Query 同 key 复用，别请求两次。

## 引用

Master：`../../DESIGN.md`　Token：`../design-tokens.css`　图标：`../icon-map.md`
