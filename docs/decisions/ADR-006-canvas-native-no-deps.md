# ADR-006: 工艺路线搭建器采用原生 Canvas 2D + DOM 叠加，零新增运行时依赖

## Status

Proposed (2026-08-01) · 决策人：高见远 · 约束级别：P0

## Background

P0『工艺路线搭建器』需要在 Canvas 画布上：拖拽「工序」块拼路线、连线成 DAG、点运行看工单沿工序流动（60fps 动画）、缺料/质检不合格即时标红。

产品 spec 明确要求使用**原生 Canvas API**。摆在面前的取舍是：是否引入一个绘制/状态库（Konva、React Flow、zustand 等）来"省力"，还是完全用原生 API 自管。

## Decision

**选 A：原生 Canvas 2D API 绘制 + DOM/React 承载交互控件，零新增运行时依赖。**

候选对比（5=最优，1=最差，权重按 MVP 矩阵：学习成本/生态/部署成本高权重，扩展性低权重）：

| 维度 | 权重 | A. 原生 Canvas+自管状态 | B. 原生+ zustand | C. Konva | D. React Flow | E. 纯 SVG |
|------|:----:|:---:|:---:|:---:|:---:|:---:|
| 懒加载 chunk 体积(gz) | 高 | **5**(~0KB) | 4(+1.2KB) | 2(+55KB) | 2(+50KB) | **5**(0KB) |
| 60fps 工单流动画 | 高 | **5** | **5** | 4 | 1 | 1 |
| 命中测试(≤100节点) | 中 | **5**(AABB逆序) | **5** | 4 | **5** | **5** |
| design-token 一致性 | 高 | 4(读token) | 4 | 3 | **1**(自带硬编码色表) | **5** |
| 无障碍 | 中 | 3(自建镜像) | 3 | 2 | 4 | **5** |
| 学习成本/熟悉度 | 高 | 4(基础API) | 4 | 2 | 3 | **5** |
| 与 spec 一致性 | 高 | **5** | **5** | 1(违背) | 1(违背) | 2 |
| 维护/供应链风险 | 中 | **5**(零依赖) | 4 | 3 | 3 | **5** |
| **判定** | | **选中** | 次选 | 落选 | **否决** | 落选 |

关于"是否借一个极轻量状态库（只借状态、不借绘制）"：判断是**不借**——仿真的状态每 16ms 变一次，无论放 `useState` 还是 zustand，订阅者都是画布本身，切片粒度优化不掉任何东西。正确解法是把高频可变状态放进 React 之外的普通对象实例（`SimEngine`），rAF 循环直接读它、直接画 canvas，完全绕过 React 调和；只把低频快照（运行状态/当前 tick/告警列表/完工数）以 ≤4Hz 节流 `setState` 推给 React。处理后 React 侧剩余共享状态寥寥，`useReducer`+`Context` 足够。撤销/重做是 30 行定长环形缓冲，不构成引库理由。

## Consequences

**正面**
- 零新增运行时依赖，供应链风险最低；首屏 chunk 不增重。
- 与 spec 的"原生 Canvas API"要求严格一致。
- 渲染/逻辑共用同一条贝塞尔曲线定义，动画轨迹与连线天然对齐。

**负面**
- 拖拽/连线/命中测试/固定步长循环需手写（约 300–400 行，已合理拆分到 `render/**` 与 `runtime/SimEngine.ts`）。
- canvas 内部不读 CSS 变量，需在 `render/palette.ts` 单点 `getComputedStyle` 读 token 快照并监听主题变化。
- 键盘可达性需自建 `sim-a11y-mirror` 镜像层（视觉隐藏列表 + 方向键移动）。

## 落地约束（强制）

1. Canvas 绘制逻辑全部在 `web/src/features/simulator/render/**` 与 `runtime/SimEngine.ts`，不进入 `ui/**`。
2. `render/palette.ts` 是**唯一**读 design-token 的文件；`features/simulator/**` 其余文件 grep 不到色值字面量。
3. 图标只走 `components/Icon.tsx` 语义名（canvas 内用形状编码：加工=圆角矩形/质检=菱形/物料=平行四边形/入库=桶形/工单=胶囊）。
4. 命中测试用 AABB 逆序遍历，**禁止引入四叉树**（节点 ≤100，O(n) 足够）。

## Related ADRs

- ADR-002（图标锁定 lucide）——本方案零新增图标，复用现有 REGISTRY 语义名。
- ADR-010（懒加载落点）——引擎代码经 `React.lazy` 拆出首屏。

## Verification

```bash
# 零新增绘制/状态库依赖
grep -rn "konva\|@xyflow\|react-flow\|zustand\|jotai" web/package.json web/src   # 必须无匹配
# 颜色零硬编码（仅 palette.ts 例外，需显式白名单）
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" web/src/features/simulator/      # 除 palette.ts 外必须无匹配
```
