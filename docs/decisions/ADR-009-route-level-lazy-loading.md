# ADR-009: 路由级懒加载 — React.lazy + Suspense + 强制 chunk-load ErrorBoundary

## Status

Proposed (2026-08-01) · 决策人：高见远 · 约束级别：P0

## Background

工艺路线搭建器引擎（引擎 + 渲染 + UI + 场景夹具）预估 gzip 60–90KB，加上首屏已静态引入的 `sql.js`（1.13.0，wasm loader + glue，自身是大头）。当前 `web/src/App.tsx` 把 12 个页面**全部静态 import**，所有代码进 entry chunk。学习目标：仿真引擎与 sql.js 不进首屏。

## Decision

**用 `React.lazy` + `Suspense` 做路由级懒加载，落点在 `AppShell` 内、`Routes` 外，并强制配 chunk-load ErrorBoundary。**

新增路由（均懒加载）：`/simulator`（场景卡片列表）、`/simulator/:scenarioSlug`（画布主体）。顺带同次改动拆掉既有重页面：`SqlSpacePage`/`ExercisePage`（拖 sql.js）、`AdminPage`、`QuizPage`；保持首屏主链路（`HomePage`/`CoursesPage`/`CourseDetailPage`/`ChapterPage`/`LoginPage`/`NotFoundPage`/`LearningPathsPage`）静态。

Suspense 结构（易错点已写明）：

```
<CrumbProvider>
  <AppShell>                       ← 侧栏/顶栏保持静态，切页不闪
    <RouteErrorBoundary>           ← 【必须】捕获 chunk 加载失败
      <Suspense fallback={<StateBlock kind="loading" />}>   ← 只覆盖内容区
        <Routes> … </Routes>
      </Suspense>
    </RouteErrorBoundary>
  </AppShell>
</CrumbProvider>
```

**`RouteErrorBoundary` 是必需项**：`React.lazy` 的 chunk 请求会失败（网络抖动、部署换 hash 致旧 chunk 404 是 SPA 经典生产事故）。无 ErrorBoundary 即整页白屏。当前代码库无 ErrorBoundary，属现存缺口。捕获 `ChunkLoadError` → 渲染 `StateBlock kind="error"` + 「重新加载」按钮（`Icon name="reset"`，`location.reload()` 拉新 hash）。

**预加载**：lazy factory 提成具名常量，场景卡片 `onPointerEnter`/`onFocus` 时预热（`React.lazy` 内部去重，重复调用无副作用）。

**Vite 分包**：用函数式 `manualChunks(id)` 显式隔离 `sql.js`（→`sqljs` chunk）与 `features/simulator/**`（→`sim` chunk），防止 Rollup 公共块提升把它们拽回 entry；**不用**对象式写法（易产生循环 chunk 引用）。

可测目标（进 PR 描述 + CI 门禁）：G1 首屏 entry chunk 改动后不增超 5KB；G2 访问 `/` 时 network 不出现 `sim-*.js`/`sqljs-*.js`；G3 `/simulator` 首次进入可交互 ≤1.5s（Fast 3G ≤4s）。

## Consequences

**正面**
- 首屏体积可控，仿真引擎/sql.js 按需加载。
- hover/focus 预热使进入画布主观"秒开"。
- 生产环境 chunk 404 有兜底，不再白屏。

**负面**
- 需新增 `RouteErrorBoundary` 组件（现有代码缺失）。
- 需配置 `manualChunks`，增加 vite 配置维护项。

## Related ADRs

- ADR-006（原生 Canvas 零依赖）——被懒加载拆出的正是 ADR-006 的引擎代码。
- ADR-010（不迁移路由库）——懒加载是 React 能力，与路由库无关。

## Verification

```bash
# 仿真/SQL 页面不得静态 import 进 entry
grep -rn "import.*SimulatorPage\|import.*SqlSpacePage" web/src/App.tsx   # 必须无静态 import
# 必须有 lazy + ErrorBoundary
grep -rn "React.lazy\|RouteErrorBoundary\|manualChunks" web/src web/vite.config.*   # 必须有匹配
```
