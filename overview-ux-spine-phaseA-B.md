# MES 平台 UX 重梳 · Phase A+B 实施记录

> 依据：`C:\Users\Q0605\WorkBuddy\2026-08-16-20-02-22\MES平台UX架构重梳.md`
> 范围：本次落地 **A（激活学习引擎 / 脊柱）** + **B（跨模式下一步闭环）**
> 日期：2026-08-16 | 部署：fb6c99f1-…（mes-site.qijia2002.workers.dev）

---

## 0. 文档诊断复核（落地前先验证）

- **B3 学习引擎死代码 —— 证实**：全仓 `web/src` 只有 `engine.activePath`/`engine.selectedPaths` 的「定义」与「读取」（`CourseDetailPage.PathContextBar` 经 `peek` 读），**零 `write(...)` 写入点**。`api.engineStatus`（POST `/api/v1/engine/status`）已经会算好 `nextCourse / completion / paths`，只是从未被喂入 `activePath`。
  → 结论：后端脊柱数学已就绪，**激活引擎 = 前端写入 `engine.activePath`**，无需新增后端端点。
- **B2 看→玩→练 断链 —— 证实**：模拟器/订单到交付完成后无回链到课程；课程页仅死掉的 `PathContextBar` 指向工厂。
- 现状导航确为 5 组（工厂/课程/知识图/练习/我的），与文档一致。

---

## 1. Phase A · 激活学习引擎（脊柱）

### 1.1 数据层 `web/src/lib/userData.ts`
- 新增轻量发布订阅 `subscribeUserData` + `emitUd()`：`write()` 与 `load()` 成功后触发，供侧栏卡片 / 路径页即时刷新。
- 新增 `useActivePath()`（基于 `useSyncExternalStore` 读 `engine.activePath`）、`activatePath(id)`、`clearActivePath()`。
- 写入仍走既有云端镜像 KV（`/api/v1/user/data/:key`），离线也能记。

### 1.2 脊柱数据源 `web/src/lib/learningSpine.ts`（新增）
- `useLearningSpine()`：`useActivePath()` + `api.engineStatus({activePath})`（仅激活时启用）→ 返回 `pathName / completion / nextCourseId / nextCourseName`。

### 1.3 侧栏卡片 `web/src/components/LearningSpine.tsx`（新增）
- **取代**原 `AppShell` 的「工厂进度」卡（`SidebarProgress` 删除）。
- 未设定主线：引导文案 + 「选一条学习路径」CTA + 工厂进度副行（保留工厂可见性，避免回归）。
- 已设定主线：路径名 + 主线进度 % / 工厂进度 % 双指标 + 脊柱推荐的「继续学：X 课」下一步卡 + 工厂进度副行。

### 1.4 落地页 `web/src/pages/LearningPathsPage.tsx`
- 每条路径卡加「设为学习主线 / 当前主线」切换按钮（写入 `activatePath` / `clearActivePath`），激活卡加 accent 描边 + 「学习中」提示。

### 1.5 课程页 `web/src/pages/CourseDetailPage.tsx`
- `PathContextBar` 由 `peek` 改为 `useActivePath()` 响应式，设定主线后路径栏自动亮起。

---

## 2. Phase B · 跨模式下一步闭环

### 2.1 通用件
- `web/src/components/NextAction.tsx`（新增）：`NextActionCard`（Link 或 onClick 按钮，`kind=learn/play/practice`）+ `NextActionGroup`。
- `web/src/lib/nextAction.ts`（新增）：`simulatorNextActions` / `otdNextActions` / `chapterNextActions`，依据脊柱给出跨模式下一步。

### 2.2 断链修复（B2）
- **模拟器完成态**（`FactorySimPage` `play==='done'`）：接脊柱 `nextCourse` 推荐「继续学：X 课」，否则落回 `/learning-paths`。
- **订单到交付末尾**（`OrderToDeliveryFlow`）：「系统学：订单到交付对应课程」→ `/learning-paths`。
- **章节页脚**（`ChapterPage`）：「下一章 / 去模拟器看这一章的流程 / 做章节测试（就地展开）」三连，课程→模拟器回链落实。

---

## 3. 设计纪律（P0 零回归）
- 纯 design token；图标用项目锁定语义 SVG（`stage`/`check-circle`/`courses`/`gauge`/`quiz`/`paths`/`arrow-right`）。
- 无 emoji 功能图标、无紫粉渐变、无裸 hex（仅 CSS `#fff`）、无弹性缓动。
- 类型检查 `tsc -p web/tsconfig.json` 通过；P0 静态扫描（emoji/渐变/弹性）本批次改动文件零命中。

---

## 4. 验证
- 本地构建产物 `worker/dist/assets` 含全部新标记（spine-label/我的学习主线/设为学习主线/这 16 步看完了/去模拟器看这一章的流程/做章节测试/继续学），旧 `sidebar-progress-label` 全仓 0。
- 线上 entry 哈希本地=远程（`index-7HQz1xZD.js`），压缩后远程包含 `我的学习主线`(2)/`spine-label`(2)/`继续学`(3)。
- 部署 Version `fb6c99f1-…`，4 个域名均 200。

---

## 5. 遗留 / 后续（文档 Phase C/D/E 未做）
- **C 合并练习入口**：章节测验/模块考试/SQL 沙盒/测验/词典/错题本统一进练习中心并汇总进度（B4）。
- **D 导航按意图重组**：一级导航改 学习主线/看·工厂/学·课程/练·练习/我的，知识图降级为顶栏搜索（依赖本批次脊柱数据）。
- **E 统一个人中心**：`ProfilePage` 改为 Spine 总进度 + 续学 + 活跃度（B5）。
- 内容覆盖缺口（约 76% 课程无练习题）需同步补，否则「练」仍是死路。
