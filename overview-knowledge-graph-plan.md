# 知识点连线图 · 详细方案（Obsidian 式）

> 目标：让平台内所有知识点像 Obsidian 那样有一张可交互连线图，**同一个知识点在讲解 / 微练习 / 术语表 / SQL 练习里散落的多处表述自动聚成一簇**，点开任一节点能看到"谁在讲它"的反链。

---

## 1. 可行性结论

**好实现，中低工作量（MVP 约 1–2 周）。** 难点（过程图）已经在数据里：

| 已有（直接复用） | 说明 |
|---|---|
| `flow_nodes` + `flow_edges` | 12 节点 + 有向连线 = 一张现成的有向流程图 |
| `node_explainers` / `micro_practices` / `dict_data` / `topics` / `flow_stages` | 散落各处的"知识工件"，正是要连起来的叶子 |
| 设计令牌 `--accent:#547C70` 等 | 图配色直接复用，不引入紫粉渐变 |

**真正要新增的只有两块**：① 一个交互式力导向图组件；② 一个"概念连接层"（`concepts` + `knowledge_links`）。

---

## 2. 数据模型（DDL，新增两张表）

迁移文件：`worker/src/migrations/schema-knowledge-graph.sql`

```sql
-- 概念正主表：一个"知识点"一行，是连接图的聚合锚点
CREATE TABLE IF NOT EXISTS concepts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT    NOT NULL UNIQUE,   -- 规范 slug，如 'qty_done' / 'mrp' / 'first_inspection'
  label      TEXT    NOT NULL,          -- 展示名，如 '完工数量 qty_done'
  definition TEXT,                      -- 一句话定义，反链面板里展示
  topic_id   INTEGER REFERENCES topics(id) ON DELETE SET NULL, -- 可选归属主题
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- 知识工件 → 概念 的指认：同概念的工件都指向同一行 concepts，连线图即聚簇
CREATE TABLE IF NOT EXISTS knowledge_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  source_type TEXT    NOT NULL,  -- 'node' | 'explainer' | 'micro' | 'sql_ex' | 'glossary' | 'topic' | 'stage'
  source_ref  INTEGER NOT NULL,  -- 源表对应的行 id（flow_nodes.id / node_explainers.id / ...）
  relation    TEXT    NOT NULL DEFAULT 'about', -- 'about' | 'example' | 'prereq'
  weight      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_kl_concept ON knowledge_links(concept_id);
CREATE INDEX IF NOT EXISTS idx_kl_source ON knowledge_links(source_type, source_ref);
```

`source_type` 与真实表的映射（来自现有 schema 核对）：

| source_type | 源表 | 引用列 | 现有主键 |
|---|---|---|---|
| `node` | `flow_nodes` | `id` | `id` |
| `explainer` | `node_explainers` | `id` | `id`（含 `node_id` 反查节点） |
| `micro` | `micro_practices` | `id` | `id`（含 `node_id`） |
| `glossary` | `dict_data` | `id` | `id` |
| `topic` | `topics` | `id` | `id` |
| `stage` | `flow_stages` | `id` | `id` |
| `sql_ex` | SQL 练习表 | `id` | `id`（MVP 暂可不连，留接口） |

> 约束：仅做"指认"关联，不改任何现有表结构，也不动 `dataset.sql` / 练习答案（S1/E1 约束保持不变）。

---

## 3. 后端接口契约

新增文件：`worker/src/modules/knowledge/knowledge.routes.ts`，在 `flowchart.routes.ts` 同层挂载。

### 3.1 `GET /api/v1/knowledge-graph?flowId=generic-factory`
返回整张图的节点与边，前端直接喂给力导向库。

```jsonc
{
  "nodes": [
    { "id": "concept:qty_done", "kind": "concept",  "label": "完工数量 qty_done", "degree": 4 },
    { "id": "explainer:9522",   "kind": "explainer","label": "qty_done 不一定等于 qty_plan", "refId": 9522, "conceptId": "concept:qty_done" },
    { "id": "node:shopfloor",   "kind": "node",     "label": "车间报工", "refId": 9 }
    // ...
  ],
  "links": [
    { "source": "explainer:9522", "target": "concept:qty_done", "relation": "about" },
    { "source": "node:shopfloor", "target": "node:dispatch",    "relation": "process" } // 来自 flow_edges
    // ...
  ]
}
```

边来源：
- **process 边**：`flow_edges`（限当前 flowId），`node→node`。
- **about 边**：`knowledge_links`，`{source_type}:{source_ref} → concept:{key}`。

### 3.2 `GET /api/v1/knowledge-graph/concept/:key`
返回某概念的"局部图 + 反链清单"（点开概念节点时用）：

```jsonc
{
  "concept": { "key": "qty_done", "label": "...", "definition": "..." },
  "backlinks": [
    { "kind": "explainer", "refId": 9522, "title": "qty_done 不一定等于 qty_plan", "nodeKey": "stock-in" },
    { "kind": "micro",     "refId": 9410, "title": "算某工单的完工数",            "nodeKey": "produce" },
    { "kind": "glossary",  "refId": 77,   "title": "qty_done",                    "nodeKey": null }
  ]
}
```

---

## 4. 前端组件设计

新增：`web/src/features/knowledge/KnowledgeGraph.tsx` + `web/src/pages/KnowledgeGraphPage.tsx`，并在导航加入口。

- **渲染库**：`react-force-graph-2d`（canvas，单依赖，轻量；或 `cytoscape`）。力导向布局、可拖拽、点击聚焦。
- **配色（P0 硬规则）**：节点按 `kind` 上色，全部走设计令牌，**禁紫粉渐变、禁 emoji 图标**：
  - `concept` → `--accent` (#547C70 森绿，聚合锚点最醒目)
  - `node` → 阶段色 `--phase-*`
  - `explainer` / `micro` / `glossary` / `topic` / `stage` → 中性灰阶 `--muted` / `--border-strong` 区分
- **交互**：
  - 点击 `concept` 节点 → 右侧抽屉列"反链清单"（谁在讲它），点清单项跳到对应讲解/微练习。
  - 点击工件节点 → 打开现有 `NodeDrawer` 风格面板，展示内容 + 它指向的概念。
  - 点节点后**局部图高亮**：只保留 1–2 跳邻居，其余淡出（对标 Obsidian local graph）。
- **数据获取**：`KnowledgeGraphPage` 调 3.1 拉全图；点 concept 时懒加载 3.2。

---

## 5. 概念种子清单（15 个核心，MVP 起头）

种子文件：`worker/src/migrations/seed-knowledge-graph.sql`。每个概念附带已存在的真实工件 id（已核对 `node_explainers` 9521–9524、`shopfloor` 9517–9518、`qc` 9519–9520、`shipping` 9523–9524）。

| # | key | label | 关联的真实工件（示例） |
|---|---|---|---|
| 1 | `qty_done` | 完工数量 | explainer 9521/9522(stock-in)、produce 微练习、SQL 练习、术语表 |
| 2 | `qty_plan` | 计划数量 | explainer 9521、术语表 |
| 3 | `mrp` | 物料需求计划 | explainer(mrp 节点)、术语表 |
| 4 | `bom` | 物料清单 | explainer(bom-route)、术语表 |
| 5 | `mps` | 主生产计划 | explainer(mps 节点)、术语表 |
| 6 | `first_inspection` | 首检 | explainer 9520(qc)、术语表 |
| 7 | `shopfloor_report` | 报工 | explainer 9517/9518(shopfloor)、produce 微练习、SQL |
| 8 | `wip` | 在制品 | explainer(shopfloor 状态映射)、术语表 |
| 9 | `stock_in` | 入库 | explainer 9521/9522、术语表 |
| 10 | `due_date` | 交期 | explainer 9523/9524(shipping)、术语表 |
| 11 | `defect` | 不合格 | explainer 9519(qc)、术语表 |
| 12 | `traceability` | 追溯 | explainer 9519/9520、quality 站目标 |
| 13 | `kitting` | 齐套 | explainer(purchase/bom-route)、术语表 |
| 14 | `work_order` | 工单 | explainer(shopfloor/dispatch)、produce 站目标 |
| 15 | `sales_order` | 销售订单 | tour 站目标、shipping 9523 |

> 原则：概念种子**人工/半自动**维护（先 15 个锚点跑通，后续随内容增长补）。不靠爬虫自动抽取，避免误连。

---

## 6. 实施步骤（分阶段）

1. **DDL**：新增 `schema-knowledge-graph.sql`，随 D1 迁移上线（两张表 + 索引）。
2. **种子**：`seed-knowledge-graph.sql` 写入 15 个 concepts + 对应 knowledge_links（指认已核对 id）。
3. **后端**：`knowledge.routes.ts` 实现 3.1 / 3.2 两个端点，复用现有 D1 客户端与 `flowchart.routes.ts` 的查询模式。
4. **前端**：`KnowledgeGraph.tsx` + `KnowledgeGraphPage.tsx`，接 `react-force-graph-2d`，配色走令牌，点击聚焦局部图 + 反链抽屉。
5. **入口**：导航加"知识点连线图"，与现有"工厂全景"并列。
6. **验证**：本地 `wrangler` 起 D1 → 调 `/knowledge-graph` 看节点/边数量合理 → 点 `qty_done` 应看到 4 条反链（讲解/微练习/SQL/术语表）聚簇。

---

## 7. 风险与边界

- **S1/E1 约束**：不改 `dataset.sql`、不改任何练习答案与单号；`knowledge_links` 只做只读指认。
- **概念种子靠人工**：自动抽取易误连，MVP 用 15 个锚点 + 后续半自动补，不追求全量自动。
- **与 Obsidian 打通是另一条路**：把本地 `E:\我的脑库` 真·双链笔记并进这张图，需导出 Obsidian graph json 或 obsidian URI 联动，本方案不含（可另立专项）。
- **性能**：MVP 规模（百级节点）力导向无压力；后续若上千节点再考虑分层/虚拟滚动。

---

## 8. 验收标准

- [ ] `/knowledge-graph` 返回节点含 concept + 工件两类，边含 process + about 两类。
- [ ] 点 `qty_done` 概念，反链抽屉列出其在讲解(9522)/微练习/术语表/SQL 的 4 处落点。
- [ ] 力导向图可拖拽、点击聚焦局部图、配色全走令牌无紫粉渐变、无 emoji 图标。
- [ ] 不破坏现有工厂全景 / 学习路径 / 任何练习判分。
