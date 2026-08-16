# 订单到交付（Order-to-Delivery）重做 · 概览

> 日期：2026-08-16 · 背景：用户反馈旧版「太花哨、没有实用价值、流向也不对」，要求重新升级改造

## 改了什么

把 v1「价值流河流 + 4 阶段流动色带 + 弹窗」的沉浸式叙事版，**整体重做为一张可直接读的「价值流参考表」**：

- **砍掉所有装饰性流动动画**：河流 token、阶段色带流动点、以及和下方 bands 重复的「流程总览条」全部删除。
- **改为顺序内联参考**：4 个阶段（接单与备料 → 生产执行 → 质检包装 → 入库交付）依次展开，每步带编号时间线节点，说明 / 配套单据 / 归属系统**全部内联可见**，不再藏进逐个点开的弹窗。
- **流向严格 1→16**，阶段速览条用箭头明确四阶段顺序，方向一目了然。
- 第 9 步「车间生产加工」保留内联入口指向 `/simulator`（承接工厂全景的「业务单据视角」）。
- 数据文件 `orderToDelivery.data.ts` 未动（16 步顺序与单据映射本就正确，旧版是呈现问题不是数据问题）。

## 设计与纪律

- 纯 design token：阶段只用 `--phase-*` 做小面积点缀（圆点 / 序号圈 / 阶段标题），不整块填充、无渐变。
- 无 emoji 功能图标（走 `Icon` 语义名）；无裸 hex；无弹性缓动；时间线用 Hairline First（细竖脊 + 边框，无阴影，hover 仅桥接卡轻微上浮）。
- 无入场编排动画（此前被批"花哨"），只保留必要的 hover 过渡。

## 文件改动

- `web/src/features/factory/OrderToDeliveryFlow.tsx`（重写）：移除河流 / 总览条 / 弹窗状态，改为阶段速览 + 4 段时间线（内联说明+单据+系统）。
- `web/src/features/factory/OrderToDeliveryFlow.css`（重写）：移除 river/band/modal 样式，新增 `od-phases` / `od-chain` / `od-marker` / `od-chip` 等价目表样式。

## 验证

- `tsc -p web/tsconfig.json --noEmit` 通过；P0 静态扫描（emoji / 渐变 / 裸 hex / 弹性缓动）零命中。
- `npm run deploy` 成功（先 `mv worker/dist/assets worker/dist/assets_<时间戳>` 规避 EPERM）。
- 线上 `/order-to-delivery` → HTTP 200；主包 `index-DSGij8NL.js` 含新标记（od-phases / 无独立业务单据 / od-marker / od-chip-sys），旧花哨标记（od-river / od-band-flow / od-river-token）全站零命中。

## 待办 / 备注

- GitHub 推送仍被旧 token 吊销阻断，本次改动**仅本地提交未推送**，需用户在本机 `git push` 或提供新 token。
