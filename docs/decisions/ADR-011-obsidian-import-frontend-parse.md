# ADR-011: Obsidian 导入 — 前端解析 + 后端幂等三阶段写入；手写受限 frontmatter 解析器

## Status

Proposed (2026-08-01) · 决策人：高见远 · 约束级别：P1

## Background

P1『Obsidian 导入』：本地 Markdown 文件/文件夹 → 解析 frontmatter → 写入现有 `topics`/`chapters`。

两条硬约束决定了"在哪端解析"：
1. **写请求 body ≤ 256KB**（`worker/src/middleware/validate.ts:12`，超限抛 1002）——一个 vault 轻松超，原始文件不能上传。
2. **Workers 10ms CPU/次调用**——解析 200 篇 YAML 必超预算。

`chapters` 表当前无稳定文件标识，重复导入会产生重复章节（见下方 DDL 增量，唯一硬阻断项）。

## Decision

**① 前端解析 + 后端幂等三阶段写入。** 解析是纯计算，放算力充裕的浏览器；写入是共享状态变更，必须放服务端（幂等 upsert + 服务端二次校验 + 事务边界）。

文件选择：主路径 `<input type="file" webkitdirectory multiple accept=".md">`（`File.webkitRelativePath` 还原目录）；增强路径 `showDirectoryPicker()` 仅 Chromium 且**非 Baseline**（Firefox/Safari 不支持），只做渐进增强、绝不做主路径。

**② 三阶段写入（复用现有 `import_chunks`）：**
- `preview`：只传 `{path, frontmatter, bodyBytes, bodyHash}` 元数据，服务端比对现状，返回创建/更新/跳过/报错清单，**不写库**。
- `commit`：分片（可并发上限 1），每片 ≤15 篇且 ≤200KB（硬上限依据：`MAX_STMT_PER_REQUEST=40`，15×2 语句留 10 条余量给 `import_chunks` 与前置查询，20 篇会顶到 40 触发 5002）；服务端 `db.batch()` 单批提交。
- `finalize`：校验分片齐全 → bump `platform_config.content_version` → 汇总（L2 缓存一次性换键，导入对读者透明）。

**③ frontmatter 解析器：手写受限解析器 + 快速失败，不引 gray-matter。** gray-matter（~10KB gz，Node 取向用 `Buffer`，带无用格式）落选；`gray-matter-es` 为次选（若真实 vault 不支持构造占比 >5% 则切换，不手写补功能）。

手写解析器只支持 Obsidian frontmatter 实际子集：`---...---` 分隔、`key: 标量`、`key:[a,b]` 行内数组、`key:\n - a` 块数组、布尔/整数/引号字符串（约 90 行）。**遇到不支持构造（嵌套 map、多行标量 `|`/`>`、锚点 `&`/`*`）立即抛错并在 dry-run 报告中逐文件列出，绝不静默猜测。** 因强制经过 dry-run 预览，解析失败写库前被人眼看到——此安全网使"受限解析器"从赌博变可控取舍。

字段映射见 `tech-spec-simulator-v1.md §7.3`；Obsidian 语法转换（`[[Wiki Link]]`→`#/wiki/<slug>` 运行时解析、`![[img]]` 首期占位、`%%comment%%` 剥离）见 §7.5；`md_text` 全程按不可信输入，沿用 `markdown.ts` 的 `markdown-it{html:false}`+DOMPurify 双保险，导入不得放宽白名单。

**安全默认：导入永远不自动发布**，所有新建 `status='draft'`，防私人笔记同步上线。

**DDL 增量（唯一硬阻断项，必须先行）：**

```sql
ALTER TABLE topics   ADD COLUMN source_path TEXT NOT NULL DEFAULT '';
ALTER TABLE chapters ADD COLUMN source_path TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_chapters_source
  ON chapters(topic_id, source_path) WHERE source_path <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_source
  ON topics(source_path) WHERE source_path <> '';
```

SQLite 支持带 `WHERE` 的部分唯一索引，正好解决"导入内容要唯一、手工内容不受限"双重需求；`ADD COLUMN ... DEFAULT` 是 O(1) 元数据操作，对现有数据零风险。

## Consequences

**正面**
- 突破 256KB body 上限与 10ms CPU 预算：只传结构化 JSON 且分片。
- 隐私更好：无关笔记根本不出网（白名单过滤后才传）。
- dry-run 预览天然即时，写库前可见全量 diff。

**负面**
- 手写解析器对复杂 YAML 构造覆盖有限（已设 <5% 逃生门切换 `gray-matter-es`）。
- 必须先做 `chapters.source_path` DDL 增量，否则不能开工建设。

## Related ADRs

- ADR-007（落库边界）——Obsidian 写入复用现有 `import_chunks`/`progress` 链路，与素材落库同套机制。
- ADR-008（诚实客户端）——导入内容 `status='draft'` 默认不发布，与"学习平台非考试"定位一致。

## Verification

```bash
# 不应引 gray-matter（除非已切 gray-matter-es，届时仅允许 -es 后缀）
grep -rn "gray-matter\b" web/package.json web/src   # 必须无匹配（gray-matter-es 除外）
# 导入内容默认 draft
grep -rn "status.*draft\|'draft'" web/src/features/obsidian-import/   # 必须有默认 draft 逻辑
```
