# 门户首页（/）改造 · 概览

> 日期：2026-08-16 · 关联：用户选择「建真正门户首页」

## 改了什么

之前 `/` 直接重定向到 `/factory`，平台已有 课程 / 知识图 / 练习 / 模拟器 / 职业路线 等多个板块，却一进来就掉进工厂全景，新用户看不出平台能玩什么。本次把 `/` 做成**独立门户首页**：

- **欢迎英雄区**：品牌身份 + 价值主张（"课程 + 模拟器 + 知识图 + 练习，边看边玩边练"）+ 两个主入口（进入工厂全景 / 浏览课程）+ 4 个能力胶囊标签。
- **新手上路三步**：看流程（订单到交付）→ 玩模拟器 → 系统学课程，带顺序箭头，指向三个招牌体验。
- **全站功能导览卡（8 张）**：工厂全景 / 模拟器 / 订单到交付 / 课程中心 / 学习路径 / 岗位路线 / 知识图谱 / 动手练习，与 AppShell 的 5 个一级区 + 招牌子页对齐；工厂全景与模拟器标「招牌」徽章。
- `/factory` 保持不变，继续做工厂深钻。

## 设计与纪律

- 纯 design token（--accent / --accent-soft / --surface / --border / --brand-ink / --ease-standard / --motion-* 等），**零裸 hex**。
- 无 emoji 功能图标（走 `Icon` 语义名）；无紫粉渐变；动效仅 hover + 轻量入场（≤420ms，`--ease-out`，无弹性缓动）。
- 定位是「应用门户」不是「营销落地页」：节区纵向间距走 48px 档，英雄区不做 80px 巨幅 hero（遵循 design-tokens v3 的「应用不是落地页」纪律）。
- 组件内联 `<style>` 作用域，沿用 `FactoryPage` 的同款模式，未改全局样式表。

## 文件改动

- `web/src/pages/HomePage.tsx`（新增）：门户首页全部结构与样式。
- `web/src/App.tsx`：`/` 路由由 `<Navigate to="/factory">` 改为 `<HomePage />`；保留 `/engine` → `/factory` 旧别名。

## 验证

- `tsc -p web/tsconfig.json --noEmit` 通过；P0 静态扫描（emoji / 渐变 / 裸 hex / 弹性缓动）零命中。
- `npm run deploy` 成功（先 `mv worker/dist/assets worker/dist/assets_<ts>` 规避 EPERM 覆盖写，因 `assets_old` 已存在故用时间戳名）。
- 线上 `https://shuojia.qzz.io/` → HTTP 200；主包 `index-B6hAQY9h.js` 含「把工厂和 MES / 探索平台 / 新手上路 / 招牌 / 浏览课程」。

## 待办 / 备注

- GitHub 推送仍被旧 token 吊销阻断，本次改动**仅本地提交未推送**，需用户在本机 `git push` 或提供新 token。
