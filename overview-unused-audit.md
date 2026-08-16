# 用不到的功能 · 专项审计与清理

> 2026-08-13 · 提交 `1fb52ea`（本地，未 push）

## 一、结论速览
- **真死代码：6 个文件，零引用、无配套 CSS —— 已全部删除并验证无回归。**
- 路由核实：`/roadmap`、`/learning-paths`、`/quiz`、`/portfolio`、`/admin` 均有来源入口（FactoryExtras / Profile / SqlSpace / TopbarSearch / Breadcrumb），属**深链二级页，非死链**，保留。
- 其余组件（`QuizDeck`、`WordExplainer`、`DictManagementPanel`、`ErrorBoundary`、`Toast` 等）均有真实引用，存活。

## 二、已删除的死代码（6 个）

| 文件 | 类型 | 死因 |
|------|------|------|
| `web/src/components/AiStudyTip.tsx` | 组件 | 全文只定义、从未被任何文件 import（纯死代码） |
| `web/src/features/roadmap/CareerAside.tsx` | 组件 | redesign 旧版 `RoadmapPage` 被 `CareerPage` 取代后的遗留，零引用 |
| `web/src/features/roadmap/RoadmapStair.tsx` | 组件 | 同上 |
| `web/src/features/roadmap/RoleSelector.tsx` | 组件 | 同上 |
| `web/src/hooks/useInView.ts` | Hook | 全仓库零引用 |
| `web/src/lib/anonId.ts` | 工具 | 全仓库零引用 |

> 注：`AiStudyTip` 依赖的 `VoiceButton` 仍被 `WordExplainer`/`TermPopover` 使用，已保留。

## 三、根目录垃圾清理

**已清（gitignore / 未跟踪，不入仓，无风险）：**
`_ctier_test.mjs`、`_ctier_test.ts`、`_leadverify.mjs`、`_p0scan.mjs`、`_p0scan2.mjs`、`.junk-designertemp`、`.trash-old-deps`

**仍待你确认（已提交入仓，删除会改动仓库）：**
- `prototype-factory-first.html` —— v1 原型，已被真实应用取代
- `outputs/` —— 历次审计 / 内容体检报告（md）
- `tmp/` —— 含 redesign 孤儿源码 `orphaned-src-2026-08-09/`（HomePage、GreetingBar 等）

## 四、审计方法（可复用）
用全量死代码探测器（node 扫 `web/src` 全部 `.tsx/.ts`，提取导出名 + 相对路径，在其它文件反向查引用，并校验 `lazy` 动态路径引用以避误杀）。已修复两个 Windows 路径坑（漏匹配 `export class`、import 省略扩展名导致路径匹配失效）。

## 五、验证
- `tsc -p web/tsconfig.json` → 0 错
- `npm run build`（web + worker dry-run）→ 0 错，`worker/dist/assets` 0 字节残留 0
- 删除 6 文件共 505 行，无任何存活引用断裂

## 六、待你拍板
1. 是否一并删除**已提交入仓**的历史遗留（`prototype-factory-first.html` / `outputs/` / `tmp/`）？
2. 本次清理是否**部署到生产并 push**？（目前仅本地提交，领先 origin 47 个提交）
