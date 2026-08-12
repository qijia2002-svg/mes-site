-- 概念白话兜底字段 zero_basis_def（P1，专家评审结论）。
-- concepts 表已在远程 D1 部署，故用 ALTER 追加；初始建表见 schema-knowledge-graph.sql。
-- 语义：给零基础者一眼看懂的"人话"，不引用未解释的 jargon
--   （打破 mrp↔bom 死循环、kitting 的"布尔判断"无人解释等问题）。
--   前端概念详情优先展示 zero_basis_def；definition 作为技术定义兜底。
-- 重跑安全：ALTER 幂等（列已存在时 D1 会报错，故仅首次执行）。
ALTER TABLE concepts ADD COLUMN zero_basis_def TEXT DEFAULT NULL;
