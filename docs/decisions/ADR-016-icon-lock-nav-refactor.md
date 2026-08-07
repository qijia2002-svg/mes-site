# ADR-016: 导航重构图标锁定（延续 ADR-002）

## Status

Accepted (2026-08-03) · 决策人：高见远（首席架构师）· 约束级别：P0（团队铁律）

## Background

用户拍板 P0 规则：Spec 中必须锁定一套 SVG 图标库（架构师选型，延续 ADR-002 的 lucide 风格）；技术栈选型须含图标库依赖；API/架构文档禁止 emoji。

本次导航重构新增一组需要图标的界面：
- 「学习」页四视图分段控制器（概览 / 课程 / 路径 / 职业）需 4 个 Tab 图标。
- 职业视图内 career→topic 反向链接的「进课程」入口需 1 个图标。
- 读码额外发现 `EnginePage.tsx:230 / 256 / 342` 锁定态直接使用 锁形 emoji（U+1F512），违反 P0「emoji 作功能图标」铁律，须注册 `lock` 语义名并全量替换（P0-1a/b，见 designer §0 / §9.5）。

现状（`web/src/components/Icon.tsx`）：全站唯一图标出口，仅 `lucide-react@1.28.0` 具名导入（`:94`），REGISTRY 语义名表（`:97-202`），未注册名降级为 `null`（`:228-231`，绝不渲染 emoji / `undefined` 组件，规避 React #130）。`web/package.json:18` 已锁 `"lucide-react": "1.28.0"`（无 `^`）。REGISTRY 当前**无** `lock` 语义名，故锁定态取不到图标（P0-1b）。

## Decision

**延续 ADR-002：图标库锁定 lucide-react@1.28.0，四 Tab 与反向链接图标全部复用既有 REGISTRY 语义名，不引入第二图标库、不使用 emoji。**

Tab 图标映射（均为已注册语义名）：
| 视图 | 语义名 | lucide 组件 | REGISTRY 位置 |
|---|---|---|---|
| 概览 | `stage` | Target | `Icon.tsx:184` |
| 课程 | `courses` | BookOpen | `Icon.tsx:100` |
| 路径 | `paths` | Route | `Icon.tsx:102` |
| 职业 | `portfolio` | Briefcase | `Icon.tsx:190` |
| 进课程（反向链接） | `courses` | BookOpen | `Icon.tsx:100` |

锁定态图标（P0-1a/b，**本次唯一新增注册的语义名**）：
- 现状：`EnginePage.tsx:230 / 256 / 342` 锁定态用 锁形 emoji（U+1F512）占位（「需先完成…」「未解锁」「锁定操作按钮」等写法），违反 P0「emoji 作功能图标」铁律；`Icon.tsx` REGISTRY 无 `lock` 语义名，未注册会退化成 `null`/`paths`，取不到锁定图标（P0-1b）。
- 决策：在 `Icon.tsx` REGISTRY 新增一行 `lock: Lock`（lucide-react@1.28.0 原生具名导出 `Lock`，构建期即校验存在），并将三处 锁形 emoji（U+1F512）全量替换为 `<Icon name="lock" size={16} />`，配色 `--muted`（designer §0 P0-1a / §9.5）。
- 其余四 Tab + 反向链接均复用既有 REGISTRY，**不引入第二图标库、不新增其他语义名**。

强制约束（继承 ADR-002）：
1. `web/package.json` 维持 `"lucide-react": "1.28.0"`（锁死，不加 `^`）。
2. 仅具名按需导入；禁止 `import * as`、禁止引入 `react-icons` / `@tabler/icons` / `heroicons`。
3. 页面一律走 `Icon` 语义名，不直引 lucide 组件；新增语义名只加进 REGISTRY 且须确认在 lucide-react@1.28.0 具名导出存在（构建失败即暴露）。
4. 图标尺寸仅 16/20/24，`strokeWidth=2`（design-token `--icon-stroke`）。
5. 未注册语义名 → `Icon` 返回 `null`（绝不 emoji / `undefined` 组件），与 `Icon.tsx:228-231` 兜底一致。

## Consequences

**正面**
- 满足 P0 铁律：零 emoji 图标、单一图标源、全站视觉一致；本次重构不引入任何新图标库依赖。
- 复用既有 REGISTRY 语义名（无需新增注册），四 Tab 图标语义贴合（概览=目标/下一步、课程=书、路径=路线、职业=公文包），零新增构建体积。

**负面**
- 需新增 1 个 REGISTRY 语义名 `lock: Lock`（修正 P0-1a/b emoji 违规）。代价极小：lucide-react@1.28.0 已含 `Lock`，仅一行注册 + 三处替换，零新依赖、零体积增长。若未来 Tab 语义调整需新图标，按 ADR-002 流程在 REGISTRY 补名并验证 1.28.0 存在。

## Related ADRs

- ADR-002（锁定 lucide-react 为全项目唯一图标库）——本 ADR 是其直接延伸，约束与验证命令继承。
- ADR-015（四视图组合）——本 ADR 为分段控制器与反向链接提供图标锁定方案。
- ADR-013 / ADR-014——本次重构整体不触及图标库选型，仅延续锁。

## Verification

```bash
# 图标库唯一性（ADR-002 继承）
grep -rn "react-icons\|@tabler/icons\|heroicons" web/src web/package.json   # 必须无匹配
# 无 emoji 图标
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" web/src                  # 必须无匹配
# 版本锁死
grep -n '"lucide-react"' web/package.json                                    # 应为 "1.28.0"（无 ^）
# Tab 语义名均在 REGISTRY
grep -nE "stage:|courses:|paths:|portfolio:" web/src/components/Icon.tsx     # 四名均应有
# lock 语义名已注册（P0-1a/b）
grep -nE "lock:" web/src/components/Icon.tsx                                  # 应有 lock: Lock
grep -nE "import .*\bLock\b" web/src/components/Icon.tsx                      # 具名导入 Lock（1.28.0）
# 锁定态 emoji（U+1F512）清零
grep -rnP "\x{1F512}" web/src/pages/EnginePage.tsx                            # 必须无匹配
```
