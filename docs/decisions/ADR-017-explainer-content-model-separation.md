# ADR-017: 通俗讲解内容独立建表，不扩 node_resources.res_type

## Status
Accepted (2026-08-08)

> **部分修订：** `kind` 的值域已由 ADR-021 收敛为 `plain` / `example` / `misconception`，
> `analogy` 槽位删除（用户决定不用生活化比喻）。本 ADR 的核心决策——
> 讲解内容独立建表、不扩 `node_resources.res_type`——不受影响，依然成立。
> 下文中出现的「比喻」按「真实数据例子」理解即可，论证结构一字不变。

## Background

学习体验重构要给零基础学员补大量「讲解 / 例子 / 大白话 / 常见误解」内容。
最直觉的做法是复用现成的挂载机制——给 `node_resources.res_type`
加 `analogy` / `example` 两个值，内容就能挂到节点上。

这个直觉是错的，会引爆一个静默逻辑错误。

`web/src/features/factory/factoryFlow.data.ts:94-96` 用**排除法**判定什么算实战：

```ts
export function practicesOf(res: NodeResourceDTO[]): NodeResourceDTO[] {
  return res.filter((r) => r.type !== 'chapter');
}
```

只要不是 chapter 就算实战。所以任何新增的 res_type 值都会自动进入完成度分母。
再看 `useNodeStatus.ts:52`：

```ts
const practiced = practices.length > 0 && practices.every((r) => isDone(r.type, r.refId));
```

比喻类内容没有"完成"这个动作，`isDone` 对它永远返回 false。
结果：挂了比喻的节点 `practiced` 永远为 false，进度条永久卡住，
`nextKey` 永远指向同一个节点，学员做完所有实战也拿不到完成反馈。

编译通过、类型全绿、接口 200，只是数算错了——正是最贵的那类失效。

## Decision

1. **讲解类内容进独立表 `node_explainers`**，通过 `node_id` 直接关联 `flow_nodes`，
   完全绕开 `node_resources`。读物与实战在数据层就分开，不靠调用方自觉。
2. **`practicesOf` 由黑名单改白名单**：

   ```ts
   export const PRACTICE_TYPES = new Set(['quiz', 'sql', 'sim', 'micro']);
   export function practicesOf(res: NodeResourceDTO[]): NodeResourceDTO[] {
     return res.filter((r) => PRACTICE_TYPES.has(r.type));
   }
   ```

3. `node_resources.res_type` 本次**只**新增 `micro` 一个值，因为微练习确实是实战、确实该计分。

## Consequences

**正面**

- 讲解内容无论铺多少，都不可能影响进度计算——不是靠约定，是结构上做不到。
- 白名单的失败方向是安全的：未知类型不计分母，进度偏乐观，不会永久卡死。
- `node_explainers` 有自己的 `tier` / `kind` 维度，能表达"先全貌后细节"，
  硬塞进 `node_resources` 反而没地方放这两个字段。

**负面**

- 前端节点抽屉要多发一个请求（`GET /api/v1/nodes/:id/explainers`）。
  可接受：抽屉打开才拉，不拖首屏；并入首屏反而会撞 D1 Free 单次调用 50 条查询的上限。
- 多一张表、多一个 repository。相对静默算错进度，这个代价便宜。

**回归断言（必须进回归集）**

往 `node_resources` 插一条 `res_type='analogy'` 的脏数据，
该节点的 `practicableTotal` 必须不变。白名单没改对这条就会红。

## Related ADRs
ADR-014（进度单一真值来源）
