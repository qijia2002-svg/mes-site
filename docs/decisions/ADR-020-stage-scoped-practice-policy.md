# ADR-020: 完成度按阶段限定实战类型，进度仍单源

## Status
Accepted (2026-08-08)

## Background

PM 的三阶段切分（PRD 3.1）里，tour 阶段取 4 个「看得见摸得着」的环节
（cust-order / shopfloor / qc / shipping），明确意图是**这一阶段还没到 SQL**。

但线上真实数据是：12 个节点**每一个**都挂了 chapter + sql + quiz 三件套
（36 条 node_resources，已在线验证）。tour 的 4 个节点也各自挂着 sql。

经 ADR-017 的白名单过滤后，`sql` 仍属于实战类型，进完成度分母。
后果：tour 的 4 个节点必须写完 SQL 才算 `practiced`——
学习者在**第一阶段**就撞上全平台最硬的门槛，整个「由浅入深」的设计当场失效。

这不是内容问题，是数据模型与新学习序的接缝问题。

## Decision

在 `flow_stages` 增列 `practice_types TEXT NOT NULL DEFAULT '["quiz","sql","sim","micro"]'`，
声明该阶段「算完成」要求做完哪几类实战。tour 设 `["micro","quiz"]`。

`practicesOf` 升级为「全局白名单 ∩ 阶段策略」：

```ts
export const PRACTICE_TYPES = new Set(['quiz', 'sql', 'sim', 'micro']);

export function practicesOf(
  res: NodeResourceDTO[],
  allowed: Set<string> = PRACTICE_TYPES,
): NodeResourceDTO[] {
  return res.filter((r) => PRACTICE_TYPES.has(r.type) && allowed.has(r.type));
}
```

未列入的类型**仍可自由练习**（tour 节点的 SQL 按钮照常在），只是不计入该阶段完成度。

## Consequences

**为什么是阶段级配置，不是资源级打标**

另一个可行解是给 `node_resources` 加 `stage_key`，逐条声明每个资源属于哪一阶段。
否掉的理由是成本不对称：阶段级是 **3 行配置**，资源级是 **36 行数据**，
两者解决的是同一个问题。且阶段级配置 PM 可以直接改，不需要开发介入，
也不会随内容增删而持续产生维护负担。

日后若真出现「同一节点的不同资源要分散到不同阶段」的需求，再升级到资源级，
届时阶段级配置作为默认值仍然成立，不冲突。

**为什么必须接进 useNodeStatus，而不是让 useStageProgress 自己算**

PRD F10 的验收写死了「节点状态与 `useNodeStatus` 派生结果一致」。
如果阶段进度自己算一套、节点三态另算一套，两套算法必然对不上：
tour 显示 4/4 完成，图上 4 个节点却是 `touched` 而非 `practiced`。
所以策略必须注入 `useNodeStatus`，保持 ADR-014 的单一真值来源。
这是对 ARCH v1 §5.2「useNodeStatus 不改语义」的修正——
那个判断是在不知道「每个节点都挂 sql」时做的，证据变了，结论跟着变。

**正面**

- tour 阶段可以真正做到无 SQL，第一阶段门槛由 micro + quiz 承担。
- 默认值是全集，无阶段数据时行为与今天完全一致，存量不受影响。
- 策略是数据不是代码，调整阶段难度不需要发版。

**负面**

- 完成度计算多一个入参，心智负担略增。用默认值兜底把这个成本压到最低。
- tour 节点的 SQL 成为「可做但不计分」的内容。这其实是想要的效果
  （学有余力的人可以做，不挡住零基础的人），但要向设计师说清楚，
  避免把它渲染成「未完成待办」制造无谓焦虑。

**回归断言**

tour 的 4 个节点在 `sql` 未完成、`micro`+`quiz` 已完成时，
tour 阶段进度必须为 4/4，且该 4 节点在图上为 `practiced` 态。
两者有一个不成立，即说明进度算法已分叉。

## Related ADRs
ADR-014（进度单一真值来源）、ADR-017（白名单与内容模型分离）、ADR-018（软引导）
