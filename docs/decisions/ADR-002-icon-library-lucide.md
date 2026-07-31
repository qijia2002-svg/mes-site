# ADR-002: 锁定 lucide-react 为全项目唯一图标库

## Status

Accepted (2026-07-31) · 决策人：高见远 · 约束级别：P0（团队铁律）

## Background

团队 P0 铁律：**禁止用 emoji 充当功能图标；全项目必须锁定一套 SVG 图标库，不得混用。**

当前 `web/package.json` **没有任何图标库依赖**，界面完全没有图标。
MES 实训平台需要表达设备、工单、质检、数据库、章节、证书、进度等一批领域概念，
没有图标的纯文字列表在信息密度和可扫读性上都不合格。技术栈为 React 19 + Vite 6。

## Decision

锁定 **`lucide-react` 1.28.0** 为全项目唯一图标库。

选型对比：

| 候选 | 图标数 | React 19 支持 | Vite 6 表现 | 判定 |
|------|--------|---------------|-------------|------|
| **lucide-react 1.28.0** | 1500+ | peer 含 `^19.0.0`（`npm view` 实测确认） | 纯 ESM，单图标独立导出，摇树干净 | **选中** |
| @tabler/icons-react | 5900+ | 支持 | barrel 导入使 Vite dev 冷启动显著变慢 | 落选 |
| react-icons | 多套聚合 | 支持 | 天然鼓励混用多套风格，直接违反 P0 铁律 | 否决 |
| Heroicons | 300+ | 支持 | 覆盖不了 MES 领域概念（设备/工单/质检） | 落选 |

选中依据：
1. 24×24 栅格 + `stroke-width=2` 统一线性风格，与现有 350 行手写极简 CSS 调性一致。
2. React 19 官方 peer 声明支持，非社区补丁。
3. MIT 协议，纯 React 组件，无字体文件、无 sprite sheet、无运行时。
4. 图标量足够覆盖 MES 领域，且不像 Tabler 那样为了数量牺牲构建速度。

## Consequences

**正面**
- 满足 P0 铁律：零 emoji 图标，单一图标源，全站视觉一致。
- 按需导入后单个图标约 0.3–0.6 KB，对首屏体积影响可忽略。
- 图标以 React 组件形式存在，`className` / `size` / `strokeWidth` 可直接受控。

**负面**
- lucide 历史上有过图标改名（如 `Trash` → `Trash2`）。因此**锁死精确版本，不用 `^`**。
- 团队需要建立"找不到合适图标时怎么办"的约定：优先复用近义图标，
  确需自绘时放进 `web/src/components/icons/` 并保持 24×24 / stroke=2 规格，**绝不引入第二个图标库**。

## 落地约束（强制）

1. `web/package.json` 写 `"lucide-react": "1.28.0"` —— **不加 `^`，锁死版本**。
2. 只允许具名按需导入：`import { Database, BookOpen } from 'lucide-react'`；
   **禁止** `import * as Icons from 'lucide-react'`（摧毁 tree-shaking）。
3. 统一封装 `web/src/components/Icon.tsx` 收口 `size` 与 `strokeWidth`，页面不直接调原始组件。
4. Code review 检查项：diff 中出现 emoji 当图标 → 直接驳回；出现第二个图标库依赖 → 直接驳回。

## Related ADRs

无

## Verification

```bash
# 图标库唯一性
grep -rn "react-icons\|@tabler/icons\|heroicons" web/src web/package.json   # 必须无匹配
# 无 emoji 图标
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src                  # 必须无匹配
```
