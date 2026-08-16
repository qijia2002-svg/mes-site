# OPEN DECISIONS — 悬而未决登记册

> 规则：只追加、就地关闭。OPEN → RESOLVED 时补 Resolution 字段，不删行。
> 每个 Phase 开始时，本文件全量复现到工作上下文最前面，逐条判断能否关闭。
> 已关闭且有长期约束力的项，升格为 `ADR-XXX.md`。

**当前状态：5 未决 / 7 已决 / 1 流程内（OD-016 升格 ADR-022）**

---

## 未决项

| # | Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Slug | Status |
|---|------|--------|-----------|---------------------|-----------------|------------|---------------|------|--------|
| OD-001 | 2026-08-02 | Phase 1 · PRD Q4 / ADR-007 | 学员画布方案是否需要 D1 云端同步 | ADR-007 定 v1 只走 localStorage；PM 建议 localStorage + D1 异步同步防丢 | v1 不做，仅 localStorage | 需真实用户反馈「换设备丢方案」是否成立 | 有 ≥3 名用户反馈跨设备丢失，或引入账号体系时 | design-decision-to-evaluate | OPEN |
| OD-003 | 2026-08-02 | Phase 1 · 架构 §13-4 | 首期示例数据的**具体数值**（各工序标准工时 / 3 类物料编码与单位用量 / 初始库存） | 结构已在 Spec §10.1 锁定（五工序 + 3 物料 + 1000 件），但数值未定；F6 是第一个交付项 | 由 PM 在 A 线开工前补出 | 等 PM 交付 | `docs/sim-seed-generic-discrete.json` 落盘 | waiting-on-external-condition | OPEN |
| OD-012 | 2026-08-02 | Spec §8.5 advisory | 搭建器「已完成 / 异常」两态描边亮度差仅 1.08:1，对红绿色盲不可分 | 非 v3 引入的既有问题；仅靠颜色区分状态违反无障碍 | 实现期补图标通道（形状 + 颜色双编码） | 无 | A 线 F5 验收时 | existing-design-boundary | OPEN |
| OD-013 | 2026-08-02 | 用户回执 §三-3 | 遗留临时脚本 `docs/_val*.txt`、`_apitest.mjs`、`_risk-test.mjs`、`design-system/pages/_fix.mjs`、`_wf.txt` | 开发阶段保留不影响主线 | 上线前统一清理 | 无 | Phase 4 交付前 | waiting-on-external-condition | OPEN |
| OD-005 | 2026-08-02 | Phase 1 · 设计 advisory | `Icon.tsx` 需新增 11 个语义名：pause / stop / step / undo / redo / zoom-in / zoom-out / fit-view / grip / folder / empty-search | ADR-002 锁死 lucide 单一图标库；搭建器控制条与导入页均依赖这批语义 | 一次性补齐并更新 IconName 联合类型 | 无 | Phase 3 前端开工前 | existing-design-boundary | OPEN |
| OD-017 | 2026-08-09 | 本总纲 §5 / 用户系统提示词 | 双端协同的「身份与同步」模型：用户提示词假设账号云同步 | **RESOLVED（2026-08-09 用户拍板）：启用 L2 账号云同步；认证=邮箱+密码；强制注册（取消匿名 `anonId` 基线）；同步进度/笔记/收藏/错题；冲突=per-field LWW**。升格 ADR-023 | 已确认 | — | design-decision-to-evaluate | RESOLVED |
| OD-016 | 2026-08-09 | 用户回执（Simulator 接入 FactoryFlow 验收入口） | 仿真搭建器是否沿用 FactoryPage 的「阶段软锁」门禁（给 SimNodeComp 传 stageStatus 做描边/弱化） | ADR-018 全站软引导；但仿真媒介本质=创造工具，任何门禁（含软锁视觉）会抑制自由探究 | **不引入任何门禁**：画布永远全开放，改用「违和提示」——用户连线/起跑顺序与 FLOW_ORDER 常态流相悖时，给一条非阻断、可 Dismiss 的业务常识气泡（「通常产线先有生产再质检，确定要这样搭吗？」），保留自由 | 无 | 用户确认方向即定 | simulator-free-build | RESOLVED |

---

## 已决项

| # | Date | Open Item | Resolution | Resolved At | 升格 ADR |
|---|------|-----------|------------|-------------|----------|
| OD-001 | 2026-08-02 | 学员画布是否需要 D1 云端同步 | **v1 不做，仅 localStorage**。用户回执确认：「v1优先保证核心仿真功能可用，不要一开始背负多端同步、冲突合并、登录鉴权大量工作量」。补偿措施已升格为硬约束——所有仿真数据可导出/导入 JSON，未来做云端同步只新增上传下载接口，不重构沙盒数据结构（Spec §4.2） | 2026-08-02 用户回执 | 承接 ADR-007 |
| OD-002 | 2026-08-02 | 仿真 tick 与动效毫秒的映射比 | **1 tick ≙ 1 标准工时单位；1x 速度下 1 tick = 1500ms（900ms 位移 + 600ms 驻留）；提供 2x / 4x 倍速**。已写入 Spec §10.2 | 2026-08-02 Spec v1 定稿 | — |
| OD-004 | 2026-08-02 | `DESIGN.md` §2 对比度表写着旧强调色 `#0E7490` | **随视觉升级 v3 一并重写**。v3 把 accent 定为 `#0a61b8`（色相 210°，与 brand-ink 206° 同源），DESIGN.md §2 对比度表按 v3 全表重算，不再单独修 v2 旧值 | 2026-08-02 Spec v1 §8 | — |
| OD-006 | 2026-08-02 | `chapters` / `topics` 缺 `source_path` 与幂等唯一索引 | **合并进单一迁移文件 `002-simulator.sql` 一次执行**。该文件同时承载三个来源：架构师 5 张 `sim_` 表、PM 的 `kind`/`archived_at`/`practice_link` 增列、本项 `source_path` + 部分唯一索引。不阻塞 A 线，B2 排在第 3 周，DDL 先落 | 2026-08-02 Spec v1 §6 | — |
| OD-014 | 2026-08-02 | Career Roadmap 的 `design-tokens.json` 与 CSS v3 漂移（roadmap 新增 `--rm-*` Token 只写入 `styles.roadmap.css` + `design-tokens.css`，未回写 `design-tokens.json`） | **以 CSS v3 为准，不回写 json**。`--rm-*` 设计令牌只落地在 `web/src/styles/design-system/design-tokens.css` 与 `styles.roadmap.css`；`design-tokens.json` 保持 v3 不动，避免双源漂移加剧。图标/配色均经 CSS v3 Token 渲染验证无缺陷（QA 门禁 pass，零裸 hex / 零 emoji / 零紫粉渐变） | 2026-08-02 QA 门禁 | — |
| OD-015 | 2026-08-02 | `track_level_chapters` 关联表建表 DDL 漏列 `content_status` / `target_topic_slug` / `chapter_notes` 三字段 | **不回填，声明为已知边界**。线上实测影响面为 0 —— 嵌入式路线「高级有内容、入门中级空」的倒挂已由前端 `isInverted()` 派生补偿，不依赖三字段。后人若见 DDL 缺列，**不要误判为 bug 去「修」**，以免触发新一轮迁移 + 数据回灌却无收益 | 2026-08-02 QA 门禁 | existing-design-boundary |
| OD-016 | 2026-08-09 | 仿真搭建器是否沿用 FactoryPage 阶段软锁门禁 | **不引入任何门禁**，改用「违和提示」：用户连线/起跑顺序与 FLOW_ORDER 常态流相悖时给一条非阻断可 Dismiss 的业务常识气泡，画布永远全开放 | 2026-08-09 用户回执 | 升格 ADR-022 |
| OD-017 | 2026-08-09 | 双端协同身份与同步模型：启用账号云同步 | **启用 L2 账号云同步**：认证=邮箱+密码，强制注册（取消匿名基线），同步进度/笔记/收藏/错题，冲突 per-field LWW；取代 ADR-014 匿名进度模型 | 2026-08-09 用户拍板 | 升格 ADR-023 |

---

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-02 | 创建登记册，录入 Phase 1 三文档交叉检查产生的 6 条未决项 |
| 2026-08-02 | 用户确认 Spec 阶段 + 补充约束 → 关闭 OD-001 / OD-002 / OD-004 / OD-006；OD-003 收窄范围（结构已锁，仅缺数值）；新增 OD-012 色盲双编码、OD-013 临时脚本清理 |
| 2026-08-02 | 能力路线 + 职业路径图功能上线收尾 → 新增 OD-014（`design-tokens.json` 与 CSS v3 漂移，以 CSS v3 为准）、OD-015（`track_level_chapters` 三字段未落库，影响面 0 不回填），均归为已决边界 |
| 2026-08-09 | 新增 OD-016（仿真搭建器门禁方向：不引入任何 stage 门禁，改用「违和提示」），用户回执即定 → RESOLVED 并升格 ADR-022 |
| 2026-08-09 | 新增 OD-017（双端协同身份与同步模型：账号假设 vs 匿名现状，分级 L0/L1/L2），来自《双端学习产品设计总纲 v1》§5 |
| 2026-08-09 | OD-017 RESOLVED：用户确认保持 L0 匿名现状，L1/L2 均不启动；跨端协同仅限同会话，不引入账号/配对码，跨设备同步留待真实需求（呼应 OD-001） |
| 2026-08-09 | OD-017 重开（撤销 RESOLVED）：用户 18:30 反转 18:26 决策，启用 L2 账号云同步；原 RESOLVED 撤销回到 OPEN，认证细节待确认 |
| 2026-08-09 | OD-017 RESOLVED + 升格 ADR-023：用户拍板邮箱+密码 + 强制注册；`SPEC-AccountSync-v1.md` 产出；匿名 `anonId` 基线取消，ADR-014 被覆盖 |
| 2026-08-13 | 新增《ARCH-Extensible-v1 可扩展系统架构总纲》；升格候选 ADR-024(岛屿扩展契约)/025(跨岛桥接)/026(内容即数据)/027(每岛独立迁移)/028(单体毕业触发器)。均 Proposed，待用户拍板后转 Accepted。核心结论：本系统可扩展靠模块化单体+岛屿契约+内容即数据+触发式毕业，而非微服务 |
