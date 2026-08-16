# 工厂模拟器 & 订单流程图 · 沉浸式动画叙事重做

> 方向：用户选定「沉浸式动画叙事（推荐）」—— 零基础看动画就懂。
> 上线版本 `6c0e634a` · 本地提交 `321fd79` · 域名 shuojia.qzz.io

## 改了什么

### 1. 工厂模拟器 `/simulator` → 活体产线
文件：`web/src/features/factory-sim/FactorySimPage.tsx` + `.css`

- **光点沿传送带流动**：4 道工序之间用流动光点表示从制品在跑；流动快慢由真实产能 `Tshift` 驱动（产能越高跑得越快），不造假。
- **瓶颈红色脉冲闪烁**：最卡的工序（`bottleneckIndex`）整卡红色脉冲 + 「最卡」徽章，一眼定位约束点。
- **末端吞吐仪表跳动**：SVG 半圆仪表显示「本单本班发出占比」（M1 / Q），数值随参数实时跳动。
- **在制品堆积 + 报废红块**：M3（卡在半路的半成品）渲染成堆积块、M5（做坏扔掉）渲染成红色块，真实数值驱动。
- 机器加减、产能、开工率条、7 指标卡、大白话反馈、7 件事深链、桥接全部保留。

### 2. 订单到交付 `/order-to-delivery` → 价值流河流
文件：`web/src/features/factory/OrderToDeliveryFlow.tsx` + `.css`

- **价值流河**：顶部一条河，订单 token 从「客户下单」一路流到「发货出库」，连续不断，表达订单在工厂里穿行。
- **系统色带高亮**：4 个阶段各有一条按系统色（`--phase-plan/production/qc/logistics`）流动的高亮色带，把「每步归哪套系统」讲清楚。
- 点击弹窗（配套单据 / 归属系统）、顶部总览连线、移动端纵向折叠、桥接模拟器全部保留。

## 纪律（P0 合规，已扫描）
- 禁 emoji 功能图标（全程 lucide 语义名，16/20/24 三档）
- 禁紫粉渐变（组件 CSS 零 `linear-gradient`/`radial-gradient`）
- 禁硬编码 hex（组件 CSS 零裸色值，仅 token；原 3 处 `#fff` 白字已统一改 `var(--accent-on)`）
- 禁弹性缓动（仅用 token 的 `--ease-standard` / `--ease-out` / `linear`）
- 全部动画由 `simCalc` 真实字段驱动，无虚构数据

## 验证链路（全绿）
| 环节 | 结果 |
| ---- | ---- |
| `tsc -p web/tsconfig.json --noEmit` | 0 错 |
| P0 静态扫描（emoji / gradient / hex） | 0 命中 |
| `npm run build`（web + worker） | 0 错（新块 `FactorySimPage-CfIHimb8.js` / `OrderToDeliveryFlow-CknyoMcA.js`） |
| `wrangler deploy` | 成功，版本 `6c0e634a` |
| 线上核验 | `/simulator`、`/order-to-delivery` 均 200；新块含新代码已 curl 断言 |

## 备注
- 构建中途在 `worker/dist/assets` 残留 133 个 0 字节部分文件，导致下次 build 报 `EPERM`（woff2）。已用 `find worker/dist/assets -type f -size 0 -delete` 清理后重跑通过。该坑已记入项目 MEMORY.md。
- 提交 `321fd79` 已落地，**尚未 push**（本地领先 origin 较多，等用户确认再推）。
