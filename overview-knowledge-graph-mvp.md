# 知识点连线图（Obsidian 式）· MVP 交付总览

> 生成日期：2026-08-12
> 状态：**代码落地完成，双端 typecheck 通过，数据连通自检 PASS**
> 落盘状态：未提交（需本机 git 收口 + wrangler D1 迁移 + 部署后三件事验证）

---

## 1. 做了什么

在现有 MES 实训平台上新增「知识图」模块，把分散在平台里的**概念**与**真实工件**（工厂过程节点、讲解视频、微练习、SQL 练习、术语、主题）连成一张可交互的关系网，实现用户要的「和 Obsidian 一样的连线图」效果——相同知识点自动连接。

- 不新建业务表之外的结构，复用现成的 `flow_nodes` / `flow_edges`（工厂过程图）。
- 新增「概念连接层」：`concepts`（概念正主表）+ `knowledge_links`（工件→概念指认，**只读关联，不改动任何现有表/练习答案**）。
- 全图含两类边：`process`（工厂节点→节点，来自 flow_edges）与 `about`（工件→概念，来自 knowledge_links）。
- 力导向图用**零依赖自研 Canvas** 实现（不引入 react-force-graph-2d），可在本环境平滑 typecheck，也方便用户本机替换为更重的库。

---

## 2. 交付物清单

### 后端（worker / Cloudflare Worker + D1）
| 文件 | 作用 |
|------|------|
| `worker/src/migrations/schema-knowledge-graph.sql` | 新增 `concepts` + `knowledge_links` 两表及索引；不动任何现有表 |
| `worker/src/migrations/seed-knowledge-graph.sql` | 15 个核心概念 + 64 条真实工件指认（重跑安全：先清本文件负责部分） |
| `worker/src/modules/knowledge/knowledge.repo.ts` | `knowledgeRepo`：概念/指认/工厂节点/边/各工件按 id 拉取；`inPlaceholders` 辅助 |
| `worker/src/modules/knowledge/knowledge.routes.ts` | `getKnowledgeGraph`（整图）、`getKnowledgeConcept`（局部图+反链）；`noAuth` 公开读 |
| `worker/src/router.ts` | 注册两条路由（第 169/170 行） |

### 前端（web / Vite + React + TS）
| 文件 | 作用 |
|------|------|
| `web/src/features/knowledge/ForceGraphCanvas.tsx` | 零依赖力导向 Canvas：仿真 + 拖拽 + 点击聚焦 1 跳邻居高亮 + 设计令牌配色 |
| `web/src/features/knowledge/KnowledgeGraphPage.tsx` | 拉全图；点概念节点懒加载反链；右侧抽屉列 backlinks，工厂类反链跳 `/factory?node=…` |
| `web/src/api/endpoints.ts` | DTO：`KgNode`/`KgLink`/`KnowledgeGraphBundle`/`KgBacklink`/`KnowledgeConcept` + `knowledgeGraph`/`knowledgeGraphConcept` |
| `web/src/App.tsx` | 注册 `/knowledge-graph` 路由（lazy） |
| `web/src/components/AppShell.tsx` | 导航新增「知识图」（`network` 图标，零 emoji） |
| `web/src/components/Breadcrumb.tsx` | section/fallback 映射 |
| `web/src/styles.css` | `.kg-*` 全套样式，全走设计令牌，无硬编码 hex；≥1024px 转双列 |

### 验证脚本
| 文件 | 作用 |
|------|------|
| `worker/scripts/check_kg_refs.py` | 静态自检：逐条核对 `knowledge_links` 的 `source_ref` 在源种子中真实存在，防悬空引用 |

---

## 3. 关键工程决策

- **零依赖图组件**：本环境 `npm install` 不可靠，放弃 `react-force-graph-2d`，自研 Canvas 力导向（斥力 O(n²) + 弹簧 + 向心 + 边界收敛 + alpha 衰减）。typecheck 可立即收敛，用户本机可平滑替换。
- **配色走设计令牌**：`ForceGraphCanvas` 用 `getComputedStyle(documentElement)` 读 `--accent/--brand-ink/--muted/--fg/--fg-2/--border/--surface/--bg`，不硬编码颜色（符合 P0-3）。
- **节点种类**：`concept / node / explainer / micro / glossary / topic / sql_ex`，各有配色与图例。
- **局部聚焦**：点概念节点 → 高亮其 1 跳邻居 + 右抽屉列反链（含可跳工厂全景的 nodeKey 反链）。
- **P0 纪律**：无 emoji 图标（用 `network` 语义图标）、无紫粉渐变、无弹性缓动、无硬编码色值。

---

## 4. 验证结果

| 检查项 | 结果 |
|--------|------|
| `web` typecheck（`tsc --noEmit`） | ✅ EXIT=0 |
| `worker` typecheck（`tsc --noEmit`） | ✅ EXIT=0 |
| 前后端 DTO 字段对齐 | ✅ `KgNode/KgLink/KnowledgeConcept` 与后端响应逐字段一致 |
| 数据连通自检 `check_kg_refs.py` | ✅ PASS，64 条指认全部命中真实工件，无悬空引用 |
| `mrp` 术语指认 bug | 🐞→✅ 已修（见下） |

### 自检发现的真实 bug（已修复）
`MRP` 术语在 `dict_data` 中实际存于 `type_key='mes_abbr'`，而种子原写 `type_key='mes'`。该子查询会解析为 `NULL`，触发 `knowledge_links.source_ref` 的 NOT NULL 约束，导致部署失败。已将子查询改为 `mes_abbr`，并同步更新自检脚本使其按实际 `type_key` 校验。**这是一次典型的「部署前静态校验拦住生产事故」**。

---

## 5. 部署步骤（本机执行）

```bash
cd E:/mes-learning-platform

# 1) 结构迁移（仅首次）
wrangler d1 execute mes-learning --local  --file=./worker/src/migrations/schema-knowledge-graph.sql
wrangler d1 execute mes-learning --remote --file=./worker/src/migrations/schema-knowledge-graph.sql

# 2) 概念 + 指认种子（可重复跑，已做重跑安全）
wrangler d1 execute mes-learning --local  --file=./worker/src/migrations/seed-knowledge-graph.sql
wrangler d1 execute mes-learning --remote --file=./worker/src/migrations/seed-knowledge-graph.sql

# 3) 前端构建 / 部署照现有流程（vite build → 部署 shuojia.qzz.io）
```

> 注：本会话环境无 D1/网络，未执行上述 wrangler 命令；结构与种子均经静态自检 + 双端 typecheck 验证。

---

## 6. 部署后三件事验证（人工/本机）

1. 打开 `/knowledge-graph`，图里应**同时**有「概念节点」与「工厂过程节点」两类。
2. 点 `qty_done` 概念节点 → 右抽屉应出现 **4+ 条反链**（stock-in / shopfloor 节点、9502/9521/9522 讲解、topic 3、micro 9411）。
3. 整体配色为森绿/墨绿系，**无紫粉**、无 emoji 图标。

---

## 7. 已知边界 / 未做

- 概念为人工锚定的 15 个，非自动从全部工件抽取（MVP 范围，符合 S1/E1 约束）。
- 未提交 git，未执行 wrangler 迁移（环境限制，需用户本机收口）。
- 未做：节点内容去重、术语表去重、P2 learning_tracks A 方向打磨、SystemMap.tsx 去留（前序遗留，本次未推进）。
- 力导向为轻量自研；如后续节点规模增大，可平滑替换为 `react-force-graph-2d` 等。
