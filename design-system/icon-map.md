# 图标映射表 — lucide-react@1.28.0

> 全项目唯一图标库（ADR-002）。版本锁死不加 `^`。
> 规格：24×24 栅格 / `strokeWidth=2` / `color="currentColor"`
> 尺寸三档：`16` 行内 · `20` 按钮内 · `24` 独立图标
> 命名遵循 lucide **新命名法**（`CircleCheck` 而非 `CheckCircle`，`TriangleAlert` 而非 `AlertTriangle`）。
> 用法：`import { Database, BookOpen } from 'lucide-react'` —— 具名导入，勿 `import * as`。

## 光学补偿规则（唯一一条，必守）

`strokeWidth=2` 在 16px 框里占 12.5% 宽，视觉重量会压过 400 字重的正文。
**16px 图标与 13–15px 文字并排时，图标用 `--muted` 上色，文字用 `--fg`。** 20/24px 图标可与文字同色。
不要为此去调 strokeWidth——全站单一 stroke 值比"每档一个 stroke"更重要。

---

## 1. 全局导航与 App Shell

| 位置 | 图标 | 尺寸 | 备注 |
|---|---|---|---|
| 首页 / 工作台 | `LayoutDashboard` | 20 | Sidebar |
| 课程 | `BookOpen` | 20 | Sidebar |
| 章节（列表项 / 面包屑末级） | `FileText` | 16 | |
| 学习路径 | `Route` | 20 | Sidebar |
| SQL 练习 | `Database` | 20 | Sidebar，核心页 |
| 题库 | `ListChecks` | 20 | Sidebar |
| 后台 | `Settings2` | 20 | Sidebar 底部分组 |
| 登录 / 登出 | `LogIn` / `LogOut` | 16 | |
| 用户区 | `CircleUser` | 20 | Sidebar 底部 |
| 全局搜索 | `Search` | 16 | Topbar 输入框前缀 |
| 侧栏折叠 / 展开 | `PanelLeftClose` / `PanelLeftOpen` | 20 | |
| 移动端汉堡 | `Menu` | 20 | <768px |
| 关闭抽屉 / 模态 | `X` | 20 | |
| 面包屑分隔 | `ChevronRight` | 16 | 用 `--meta` 色 |

## 2. 状态与反馈

| 语义 | 图标 | 配色 Token |
|---|---|---|
| 成功 / 判题通过 | `CircleCheck` | `--success` |
| 警告 / 待处理 | `TriangleAlert` | `--warn` |
| 错误 / 故障 / SQL 报错 | `CircleX` | `--danger` |
| 提示 / 说明 | `Info` | `--accent` |
| 加载中 | `LoaderCircle` | `--muted` + `animation: spin 1s linear infinite` |
| API 健康正常 | `CircleCheck` | `--success` |
| API 降级 | `TriangleAlert` | `--warn` |
| API 不可用 | `CircleX` | `--danger` |
| 空状态（无内容） | `Inbox` | `--meta`，48px 例外尺寸，仅空状态插图位 |
| 空状态（无查询结果） | `SearchX` | 同上 |

`SqlSandbox.tsx:192` 的 emoji 换成：`<CircleX size={16} strokeWidth={2} />` + `--danger` 色。

## 3. SQL 练习工作台

| 动作 / 元素 | 图标 | 尺寸 |
|---|---|---|
| 运行查询 | `Play` | 16（Primary 按钮内） |
| 重置样例数据 | `RotateCcw` | 16 |
| 复制 SQL / 复制结果 | `Copy` | 16 |
| 导出 CSV | `Download` | 16 |
| 执行历史 | `History` | 16 |
| 表结构（侧栏树） | `Table2` | 16 |
| 字段（树子节点） | `Columns3` | 16 |
| 展开 / 收起树节点 | `ChevronRight` / `ChevronDown` | 16 |
| 提交判题 | `CircleCheck` | 16 |
| 查看提示 | `Lightbulb` | 16 |
| 结果分页 | `ChevronLeft` / `ChevronRight` | 16 |

## 4. 章节正文页（.prose）

| 元素 | 图标 | 尺寸 |
|---|---|---|
| 上一章 / 下一章 | `ArrowLeft` / `ArrowRight` | 16 |
| 右侧目录（TOC）标题 | `List` | 16 |
| 标记已学完 | `CircleCheck` | 16 |
| 代码块复制 | `Copy` | 16，hover 才显形 |
| 外链 | `ExternalLink` | 12（跟随行内文字，例外尺寸） |
| callout · 提示 | `Info` | 16 |
| callout · 注意 | `TriangleAlert` | 16 |
| callout · 危险 | `CircleAlert` | 16 |
| 去练习（正文内嵌 CTA） | `Database` | 16 |

## 5. MES 领域概念（内容侧图标，用于主题卡 / 路径节点 / 正文 callout）

| MES 概念 | 图标 | 说明 |
|---|---|---|
| 工单 | `ClipboardList` | |
| 报工 / 完工确认 | `ClipboardCheck` | |
| 派工 | `UserCheck` | |
| 排产 / 计划 | `CalendarClock` | |
| BOM / 物料清单 | `Boxes` | |
| 物料 / 产品 | `Package` | |
| 设备 / 机台 | `Cog` | 不用 `Settings`，那是"设置" |
| 车间 / 工厂 | `Factory` | |
| 产线 / 工艺路线 | `Workflow` | |
| 工序 | `Milestone` | |
| 质检 | `ShieldCheck` | |
| 不良 / 报废 | `CircleSlash2` | |
| 追溯 | `GitBranch` | 正向/反向追溯的分叉语义 |
| 条码 / 二维码 | `Barcode` / `QrCode` | |
| 点检 / 保养 | `ListChecks` | |
| 仓库 / 库存 | `Warehouse` | |
| 稼动率 / OEE | `Gauge` | |
| 产量趋势 | `TrendingUp` | "趋势"语义更贴切；避开 `ChartLine`/`LineChart` 在 v1.x 的别名差异 |
| 数据表 / 数据字典 | `Table2` | |
| 接口 / 集成 | `Cable` | |
| 权限 / 角色 | `KeyRound` | |

## 6. 后台 / 表格

| 动作 | 图标 |
|---|---|
| 新建 | `Plus` |
| 编辑 | `Pencil` |
| 删除 | `Trash2` |
| 保存 | `Check` |
| 取消 | `X` |
| 筛选 | `ListFilter` |
| 排序 | `ArrowUpDown` |
| 行操作菜单 | `MoreHorizontal` |
| 发布 / 草稿切换 | `Eye` / `EyeOff` |
| 批量导入 | `Upload` |

---

## 缺图标处理流程

1. 先在 lucide.dev/icons 搜英文语义词（"work order" 搜不到就搜 "clipboard"）；1500+ 图标里近义图标基本都有。
2. 确实没有 → 通知架构师，在 `web/src/components/icons/` 自绘，规格必须对齐：24×24 viewBox / `stroke="currentColor"` / `stroke-width="2"` / `stroke-linecap="round"` / `stroke-linejoin="round"` / `fill="none"`。
3. **绝不引第二个图标库，绝不用 emoji 兜底。**

## 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-07-31 | 建表；strokeWidth 由设计初稿的 1.75 对齐为 **2** | 依 ADR-002 采用 lucide 原生规格；单一 stroke 值优先于分档微调，改以颜色做光学补偿 |
