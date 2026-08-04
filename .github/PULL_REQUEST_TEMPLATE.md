<!--
MES 学习平台 PR 模板
配套标准：docs/CODE-REVIEW.md
合并硬规则：CI(typecheck+lint+test) 全绿 + 🔴 阻塞项清零 + ≥1 非作者审批
-->

## 变更摘要
<!-- 一句话 + 关键改动点。关联 ADR 决策必须贴链接 -->

## 关联 ADR / 决策
<!-- 无则填"无"。重大架构/设计改动须先有 docs/decisions/ADR-0xx -->

## 影响面
- [ ] 后端 API / 路由
- [ ] 前端页面 / 组件
- [ ] 数据库 schema / 迁移 / 种子
- [ ] 设计 token / 视觉
- [ ] 部署配置（wrangler.toml / secrets）

## 自测证据
<!-- 怎么验证的：本地 typecheck/lint/test 输出、手动操作步骤、线上验证截图/接口返回 -->

## 重点求评区
<!-- 希望评审者重点看哪里？已知权衡/风险？ -->

## 评审自检（对照 docs/CODE-REVIEW.md §4，逐条确认）
### 通用
- [ ] 输入参数化 / 已校验（无 SQL 拼接）
- [ ] 错误路径全覆盖（空结果/网络/JSON.parse）
- [ ] 无密钥/敏感值入仓
### 后端（如涉及）
- [ ] R6：SELECT 列表不含 answer/answer_sql，无 SELECT *
- [ ] 查询走 DbSession 预算守卫
- [ ] 写操作经 security（Origin+CSP）；敏感写挂 auth/ratelimit
- [ ] 对外 DTO 字段白名单
### 前端（如涉及）
- [ ] 未触碰 P0 设计红线（emoji 图标/紫粉渐变/硬编码色值/弹跳/Hero）
- [ ] fetch 失败收敛为 ApiError，UI 可恢复
- [ ] 无新增 camelCase/snake_case 双命名
### 数据（如涉及）
- [ ] 迁移幂等（可重复执行）
- [ ] 种子与 schema 一致

## 测试
- [ ] 已补/更新测试（路径：____）
- [ ] 暂无测试，原因 / follow-up issue：____
