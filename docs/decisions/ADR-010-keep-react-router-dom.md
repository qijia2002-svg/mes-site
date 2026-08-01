# ADR-010: 不迁移 TanStack Router，保留 react-router-dom 7 + 类型化路径常量表

## Status

Proposed (2026-08-01) · 决策人：高见远 · 约束级别：P0

## Background

路线图 §3.1 记录了"spec 写 TanStack Router，现状 react-router-dom 7"这一待拍板项。本阶段因懒加载（ADR-009）与仿真模块引入新路由，需要明确路由库走向。

## Decision

**v1 不迁移 TanStack Router，保留 react-router-dom 7，配一个 30 行类型化路径常量表。**

理由：

1. **懒加载是 React 的能力**（`React.lazy`/`Suspense`），不是路由库的能力。换库对 ADR-009 的目标零增益。
2. TanStack Router 的核心价值是**类型安全的路径与参数**。同等收益用 30 行常量表 + 类型化 builder 即可拿到 ~80%：

   ```ts
   export const R = {
     simulator: () => '/simulator',
     simulatorScenario: (slug: string) => `/simulator/${encodeURIComponent(slug)}`,
   } as const;
   ```

   全站 `<Link to={R.simulatorScenario(s.slug)}>`，改路径只改一处，拼错编译期即红。**零迁移成本、零新依赖。**
3. 迁移代价：12 个路由文件重写 + codegen 接入 CI + 团队学习成本，MVP 阶段明确负收益。

保留退路：若 P2 出现深度嵌套路由 + 复杂 search params 校验需求，届时再评估——**不是不能迁，是现在迁不划算**。

## Consequences

**正面**
- 零迁移成本、零新依赖，懒加载目标照常达成。
- 路径集中一处，类型安全覆盖绝大多数拼错场景。

**负面**
- 未获得 TanStack Router 的"编译期路由树 + 自动推断 loader 入参"等深度能力（P1 阶段用不到）。

## Related ADRs

- ADR-009（路由级懒加载）——本 ADR 是 ADR-009 的路由库前提。

## Verification

```bash
# 不应出现 TanStack Router 依赖
grep -rn "@tanstack/router" web/package.json web/src   # 必须无匹配
# 应有类型化路径常量表
grep -rn "simulatorScenario" web/src   # 必须有匹配
```
