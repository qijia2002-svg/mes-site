# 零基础改造 P2 收官报告（2026-08-11）

> 目标：让**一个从没进过工厂的人**，打开这个站点能一步步看懂工厂，而不是一上来就被 MES/MRP/BOM 劝退。
> 本报告覆盖 P2 的五项工作，全部已上线 `shuojia.qzz.io`。

---

## 一、最终形成的零基础动线

```
品牌名「工厂与 MES 入门」
   ↓ 首次访问自动弹出
「工厂一日游」序章（5 屏，纯白话，不出现任何缩写）
   ↓ 末屏 CTA「从零看懂工厂」（本轮新增）
学习路径 · 置顶科普线《从零看懂工厂》（3 小节大白话）
   ↓ 看懂之后
职业线（实施工程师等 9 条原有路径）
   ↓ 随时旁路
工厂页「系统关系图谱」（五系统三流）/ 知识图谱（概念白话兜底）
```

**本轮之前的断点**：走完序章第 5 屏，只被引去「逛工厂」——一个纯小白进到全景四泳道，依旧不知道下一步该学什么。**现已疏通。**

---

## 二、五项交付明细

### ① 零基础科普学习线（提交 `774a4f9`）

原有 9 条学习路径**全部**是「实施工程师」职业线，零基础入口缺失。

- 新增 `worker/src/migrations/seed-popular-science-path.sql`（重跑安全，`pop-` 前缀先清后插）
  - 路径 `pop-100`《从零看懂工厂》，`sort=0`，`topic_ids=[1010,1011,1012]`
  - 3 个 beginner 主题：工厂到底是什么·用一天走完 / 一张订单怎么变成产品 / 工厂里几个关键数字（白话）
  - 每主题 1 节纯白话章节，口吻复用序章，全程避开实施、运维、职业术语
- 顺手修隐患：`lpRepo.list` 原 `ORDER BY id` **忽略了 schema 里设计好的 `sort` 列** → 改为 `ORDER BY sort, id`，科普线因此置顶
- 前端零改动——`LearningPathsPage` 本就按 `topic_ids` 数据驱动渲染

### ② 节点／术语去重核查 —— 结论：**无需清理**

| 检查项 | 远程 D1 实测 |
|---|---|
| 跨流程 `node_key` 重名 | 0 |
| topic 标题重名 | 0 |
| concept 与 glossary 完全同名 | 0 |

- 库层已有 `flow_nodes(flow_id, node_key)`、`dict_data(type_key, value)` 两条 UNIQUE 约束兜底，硬重复进不来。
- `concept(mrp)` ↔ `glossary(MRP)` 大小写不同、指同一事，但这是知识图**刻意建立的互联**（mrp 概念已反链 glossary `refId=61`），删掉反而会打断反链。
- **判据**：区分「DB 硬重复」与「知识图有意互链」，后者不动。

### ③ SystemMap 去留 —— 结论：**保留 + 打磨**

纯前端、零后端依赖、全程守 P0 规范，且正好回答「工厂为什么需要这些系统」，是零基础主线的必要一环。
仅改副标题为白话：先说「不用记那些缩写」安抚焦虑，再引导点开任一系统看它管什么。

### ④ 学习轨道打磨 + ⑤ 零基础可用性走查（提交 `aedb754`）

| 文件 | 改动 |
|---|---|
| `web/src/features/factory/FactoryPrologue.tsx` | 末屏新增 ghost CTA「从零看懂工厂」→ `onClose()` + `navigate('/learning-paths?path=100')` |
| `web/src/pages/LearningPathsPage.tsx` | 副标题下加零基础坡道提示，明确指向置顶科普线 |
| `web/src/features/factory/SystemMap.tsx` | 副标题白话化（见 ③） |

---

## 三、验证链

- `tsc --noEmit`：web / worker 双端 EXIT=0
- `npm run build`：EXIT=0（惯例先清 `worker/dist/assets` 规避 EPERM 字体锁）
- `wrangler deploy`：成功，Version `6acc0f38-4b86-4302-8726-f5bb83598fde`
- 线上核验
  - `GET /api/v1/learning-paths` 首条即 `pop-100`，`count=10`，无回归
  - `GET /api/v1/topics/1010/chapters` 返回章节 9119
  - 构建产物 `worker/dist/assets/*.js` 已含 SystemMap 新副标题、序章 CTA、坡道提示

**两个验证坑（已记录，供后续复用）**
1. 本站是 SPA 客户端渲染，`curl /learning-paths` 只能拿到空壳——验证前端文案一律 grep 构建产物 JS，别指望 HTML。
2. `/api/v1/learning-paths` 是 `{code, data:[...]}` 信封不是裸数组；章节端点为 `/api/v1/topics/:id/chapters`（`courses/:id` 返回 404）。

---

## 四、遗留

- **未 push**：本地已领先 `origin` 35+ 提交（含 `fa8c446` / `774a4f9` / `aedb754`），等你确认后再推。
- **真人零基础实测**：需真实用户参与，非代码可闭环。建议找一位没进过工厂的朋友走一遍上面的动线，看是否在某一屏卡住。
- 可选加深：科普线目前每主题 1 节，若实测反馈"不够"，可按同一 seed 模式扩到 2–3 节，仍无需改前端。
