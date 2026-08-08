# 前端重构方案：把「学习」与「工厂」融合进工厂

> 审计日期：2026-08-08
> 目标：消除重复的「学习 / 工厂」功能模块，单一「工厂」作为主壳，学习融入其中。
> 状态：融合重构已实现（见第五节）。

## 一、现状审计：重复在哪

### 1. 导航层重复（最直观）
- `AppShell.tsx` 侧栏：`学习` → `/engine`；`工具` 区：`SQL 沙盒` `/sql-space`、`工厂仿真` `/simulator`、`作品集` `/portfolio`。
- 移动端 tabbar 同时有 `学习`(`/engine`)、`工厂`(`/engine?tab=factory`)、`SQL`(`/sql-space`)。
  → `/engine` 被拆成多个入口，「学习」与「工厂」并列，互相重叠。

### 2. 「工厂」功能双实现
- `FactoryFlow`（`/engine?tab=factory`，首页默认）：工厂**全景学习地图**，工位挂 chapter/sql/quiz 资源。
- `SimulatorPage`（`/simulator`，独立路由）：工艺路线**搭建器**（拖拽产线 + 仿真）。
  → 两套「工厂」体验，两个独立入口。

### 3. 工厂领域模型双份定义（最隐蔽）
- `features/factory/factoryFlow.data.ts`：业务流视角，12 节点 / 4 阶段（plan·production·qc·logistics），订单→交付信息流。
- `features/simulator/simTypes.ts`：物理车间视角，20+ 工位类型（process/inspect/storage/endpoint）。
  → 同源「工厂」被两套词汇各自维护，改一处另一处不同步。

### 4. 学习工具卡片与侧栏工具重复指向同路由
- `EnginePage` 概览视图的「学习工具」卡片（作品集 / SQL 沙盒 / 工厂仿真）与侧栏「工具」区指向完全相同的路由，入口冗余。

## 二、根因
「学习」与「工厂」被当成两个**平级模块**来导航。但 `FactoryFlow` 早已把学习装进了工厂（工位即学习入口）。
因此「学习中心」(概览/课程/路径/职业) 是工厂的**冗余外壳**，而「工厂仿真」是工厂的**另一个入口**——二者都该回归「工厂」单一主壳。

## 三、重新设计：一切融入工厂

### A. 导航收敛（AppShell 侧栏 + 移动 tabbar 统一）
删除独立的「学习」导航项与独立的「工厂仿真」工具项。一级导航收敛为：
- **工厂**（首页 `/factory`，含「全景 / 搭建」双模式）
- SQL 沙盒 `/sql-space`
- 作品集 `/portfolio`
- 词典 `/dictionary`
- 我的 `/profile`
（职业/成长作为工厂内轻区块，不占一级导航。）

### B. 工厂页（原 `/engine` → `/factory`）双模式
- 顶部模式切换：**全景** | **搭建**
  - 全景模式 = 现有 `FactoryFlow`（学习地图，工位挂资源）
  - 搭建模式 = 现有 `Simulator`（拖拽产线 + 仿真），作为页内模式，不再是独立 `/simulator` 路由
- 全景内子视图：**全景 / 课程 / 路径 / 职业**（原「学习中心」四 tab 全部折进工厂）
  - 全景 = 概览仪表盘（续学 CTA + 完成度 + 当前进度）+ FactoryFlow 学习地图
  - 课程 / 路径 / 职业 = 原 CoursesView / PathsView / CareerView

### C. 领域模型统一（待办，未在本轮实现）
把工位/阶段定义抽到共享 `features/factory/domain`：`FactoryFlow` 的业务流与 `Simulator` 的物理工位共用一套阶段/分类 token 与图标映射，消除两套并行词汇。

### D. 路由变更（已实现）
- `/` → `/factory`
- `/factory` → 新 `FactoryPage`（参数 `?mode=panorama|build`、`?view=panorama|courses|paths|career`）
- `/engine` → 重定向 `/factory`（向后兼容）
- `/simulator` → 重定向 `/factory?mode=build`
- `/roadmap` → 重定向 `/factory?view=career`
- `/learning-paths` → 重定向 `/factory?view=paths`
- 删除独立「学习」概念入口

## 四、已确认的分叉（用户拍板，均走推荐）
1. Simulator → 工厂页「搭建模式」tab。
2. 学习中心四 tab → 全部融入工厂。

## 五、实现状态（2026-08-08 已完成）
- 新增 `pages/FactoryPage.tsx`：顶部「全景/搭建」模式切换；全景内再挂「全景/课程/路径/职业」子视图（原学习中心四 tab 折进工厂）；搭建模式 `lazy` 加载 `features/simulator/SimulatorPage`；概览仪表盘（续学 CTA + 完成度 + 当前进度）作为全景视图头部。
- `App.tsx`：`/` → `/factory`；新增 `/factory` 路由；`/engine`、`/roadmap`、`/learning-paths`、`/simulator` 全部 `<Navigate>` 重定向进工厂（向后兼容）；删除对应的悬挂懒加载声明。
- `AppShell.tsx`：侧栏「学习」改名「工厂」(`/factory`)，删并列「工厂仿真」，工具区补「工厂搭建」「名称翻译」；移动端 tabbar 合并「学习+工厂」为单一「工厂」，加「搭建」直达。
- `Breadcrumb.tsx`：`engine`→`factory`，`simulator`→`/factory?mode=build`，`roadmap`/`learning-paths`→对应工厂子视图。
- `NodeStation.tsx`：节点「搭建此产线」跳转改 `/factory?mode=build`。
- 直链修复：`HomeLearningPaths`、`TrackLevelSection`、`CoursesPage`、`TrackDetailPage` 中 `/roadmap`、`/learning-paths` 直链改到工厂子视图。
- 死代码归档（可恢复，不进构建）：`pages/EnginePage.tsx`、`pages/SimulatorPage.tsx`、`pages/RoadmapPage.tsx`、`pages/LearningPathsPage.tsx` → `E:\mes-learning-platform\_redesign_archive\`。
- 验证：`npm run typecheck` 通过（exit 0）；全 src 无悬挂 `/engine`/`/roadmap`/`/learning-paths`/`/simulator` 导航链接。

## 六、仍待办（非本次融合范围）
- **工厂领域模型统一（较深）**：`features/factory/factoryFlow.data.ts`（业务流 12 节点）与 `features/simulator/simTypes.ts`（物理工位 20+ 类型）仍各维护一套「工厂」词汇；抽共享 `features/factory/domain` 统一阶段/分类 token 与图标映射。
- P1 历史待办（来自首轮检查）：
  - ✅ 部署产物清理（dist/dist.bak/dist_old…）：2026-08-08 完成，约 61.5 MB 移至 `E:\mes-learning-platform\_trash_deploy_2026-08-08\`（可回收，未硬删）。
  - ⬜ README 写 TanStack Router 实则 react-router-dom ^7.18.2。
  - ⬜ sql.js 单点 CDN 兜底确认。
  - ⬜ schema.sql 无内容种子（7 页空态）。
  - ⬜ `mes-verify-tmp` 目录清理/归档。
