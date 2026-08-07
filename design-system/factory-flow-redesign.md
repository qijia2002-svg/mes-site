# 工厂全景流程图 — UI/UX 重设计 Spec (v10)

> 状态：待用户确认（推荐方向 B）
> 背景：v9 四色分区全屏流程图被判定"别扭" → 重设计。
> 调性（用户拍板）：Notion / Linear 那种克制专业。

## 0. 问题诊断（v9 为什么别扭）
- **卡片太拥挤**：节点 = 大圆角色块 + 56px 图标徽章 + 标题 + 环节标签 + 状态点 叠在一起，信息密度高、视觉重。
- **不像学习产品**：整体偏"通用 BPM 绘图工具 / 工业流程图"，缺引导感与克制专业的气质。
- 根因之一是**整卡大色块填充** + 重徽章，既挤又像图表工具。

## 1. 设计原则（P0 合规，违反=退回）
- 禁 emoji 图标：全部走 `web/src/components/Icon.tsx` 注册表（lucide），尺寸 16/20/24。
- 禁紫→粉渐变 / Indigo→Pink 三位一体 AI 模板套路。
- 禁硬编码色：四阶段语义色**必须作为 design token 落地**（新增 `--phase-plan` / `--phase-production` / `--phase-qc` / `--phase-logistics` 到设计系统），组件内一律 `var(--token)`，不得写死 hex（#fff/#000 除外）。
- 禁 AI 模板味文案 / Lorem ipsum / "Welcome to"。
- 禁弹跳缓动 `cubic-bezier(0.68,-0.55,0.265,1.55)`；动效用 `ease` / `linear`。

## 2. 视觉语言（Notion/Linear 克制专业）
- **底色**：中性浅色（`var(--surface)` / 极浅中性），点阵背景降到近乎不可见（opacity ≤ .04）或去掉。
- **节点卡片**：白底 + 1px hairline 描边（`var(--border)`），圆角 12–14px，内边距放大（舒适留白）。**不再整卡填色**。
- **图标**：20px（行内档），置于卡片左侧或顶部，中性色（`var(--muted)` / `var(--ink-solid)`），hover/选中取 `var(--accent)`。去掉 56px 大徽章圆。
- **标题**：14px / 字重 500，字距收敛；环节副标 12px / 400 / `var(--muted)`。
- **四阶段语义**：仅以小面积点缀表达——卡片**左侧 2–3px 细色条** 或 **标题前 6px 圆点**，色值取对应 phase token。绝不做背景填充。
- **进度/状态（Linear 式克制）**：
  - 已学：标题前小 `success`（check-circle）图标，或细描边变实线 + 轻微 `var(--accent)` 描边。
  - 未开始：默认 hairline，无强调。
  - 推荐下一步：卡片描边转 `var(--accent)` 实线 + 极轻光晕（box-shadow accent @8%，非脉冲动画），标题后跟低调"下一步"文字 + `chevron-right`。
- **连线**：1.5px 中性灰（`var(--border)` 或 `--ff-line`），选中路径用 `var(--accent)` 细线 + 极轻流动虚线（dashoffset 动画，`linear`），不粗不艳。
- **工具栏**：hairline 风格，缩放 −/+（`minus`/`plus`）、适应（`expand`）、图例用 4 个 8px 圆点 + 文字（取 phase token）。保留缩放/平移 localStorage 记忆。
- **抽屉（节点详情）**：Notion/Linear 风——白底、hairline 分隔、标题区小图标 + 名称、phase 小色条/圆点、知识正文、涉及系统用低调 chip（`warehouse`/`equipment`/`sql`/`quiz` 等图标 + 文字）、实战入口为列表行（图标 + 标题 + 一句描述）。

## 3. 间距与节奏
- 节点间距拉大：横向节点间距 ≥ 150px，纵向分支留白更足；整体"透气"。
- 画布缩放策略保持（统一 `transform:scale`，不缩到 <1）。
- 字号层级：标题 14/500，副标 12/400，抽屉正文 14/400 lh1.7。

## 4. 图标清单（沿用 Icon.tsx 已注册语义名，禁新增 emoji）
- 节点图标（不变）：`shopping-cart` / `clipboard-check` / `calendar` / `calculator` / `truck` / `git-branch` / `package` / `send` / `factory` / `check-circle` / `warehouse` / `log-out`
- 交互/状态：`minus` / `plus` / `expand` / `close` / `success`(check-circle) / `chevron-right` / `equipment` / `sql` / `quiz` / `warehouse`

## 5. 两个方向
- **方向 B（推荐 · 用户选定先做）**：上述 Notion/Linear 克制专业——纯白 hairline 节点 + 极小 phase 点缀 + Linear 式进度。最契合"克制专业 + 不像 BPM 工具"。
- **方向 A（备选）**：在 B 基础上，节点底色用 phase token 的极淡 tint（~4–6% 透明度）而非纯白，让四阶段分区更可辨，但仍无重填充、无大色块。适合想"阶段感更强"的场景。

## 6. 实现备注
- 四阶段色须先作为 token 加入设计系统（design-tokens），组件引用 `var(--phase-*)`；不得组件内硬编码 hex。
- 保留：拖拽平移、缩放/平移 localStorage 记忆、选中流动线、详情抽屉、DEFAULT_FLOW 兜底。
- 删除/弱化：大色块 zone 背景、56px 徽章圆、脉冲状态点、粗连线。
- 落点文件：`web/src/features/factory/FactoryFlow.tsx`（重写 `<style>` 与节点/工具栏/抽屉结构）；phase token 加到 `web/src/styles.css` 设计系统区。
