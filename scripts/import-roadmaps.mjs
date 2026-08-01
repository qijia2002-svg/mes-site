#!/usr/bin/env node
/**
 * import-roadmaps.mjs — 技术虾学习路线图 → MES 实训平台结构化课程数据
 * ----------------------------------------------------------------------------
 * 映射规则（v1）：
 *   路线图根目录（含 学习路线图.md）        → learning_paths（1 份路线图 = 1 条路径）
 *   阶段/周 子目录（第N阶段_xxx / 第N周_xxx）→ topics（1 阶段 = 1 主题）
 *   学习指南.md / 知识作业.md / 实战作业.md / 每日任务.md → chapters（theory，MD 客户端渲染）
 *
 * 设计约束：
 *   - 知识作业/实战作业是开放问答 + STAR 模板，不是结构化选择题，
 *     故映射为 chapter 正文（可读、可自查），不塞进 questions 表（需选项+答案）。
 *   - SQL 实战题需 dataset_json + answer_hash，路线图未提供，留人工补，导入器不臆造。
 *   - 全部用 rm- 前缀 slug，重跑安全：先 DELETE rm- 数据，再 INSERT。
 *   - 显式分配 ID（topic 5000+ / path 500+），避免依赖 autoincrement 起始值歧义。
 *
 * 用法：
 *   node scripts/import-roadmaps.mjs [sourceDir] [outSql]
 *   sourceDir 默认 C:/Users/Q0605/.qclaw/workspace-agent-191568ac
 *   outSql    默认 worker/src/migrations/seed-roadmaps.sql
 */

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SRC =
  'C:/Users/Q0605/.qclaw/workspace-agent-191568ac';
const DEFAULT_OUT = fileURLToPath(
  new URL('../worker/src/migrations/seed-roadmaps.sql', import.meta.url)
);

const srcDir = resolve(process.argv[2] || DEFAULT_SRC);
const outSql = resolve(process.argv[3] || DEFAULT_OUT);

if (!existsSync(srcDir)) {
  console.error(`[import-roadmaps] 源目录不存在: ${srcDir}`);
  process.exit(1);
}

// ---- 工具 ----
const q = (s) => `'${String(s).replace(/'/g, "''")}'`; // SQL 字符串转义
const j = (v) => q(JSON.stringify(v)); // JSON 字段转义

function readMd(p) {
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

// 取 md 第一个 H1 作为标题
function firstH1(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

// 取 md 第一个连续 blockquote 块作为描述（去 > 与 ** 强调）
function firstBlockquote(md) {
  const lines = md.split('\n');
  const out = [];
  let inBq = false;
  for (const ln of lines) {
    const bq = ln.match(/^>\s?(.*)$/);
    if (bq) {
      inBq = true;
      out.push(bq[1].trim());
    } else if (inBq) {
      break;
    }
  }
  return out
    .join(' / ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 阶段/周 目录名解析：第1阶段_MES概念深化 / 第1周_Linux与数据库
function parsePhaseName(name) {
  const m = name.match(/^第(\d+)(阶段|周)[_－-]?\s*(.*)$/);
  if (!m) return null;
  return { sort: parseInt(m[1], 10), title: (m[3] || '').trim() || m[2] };
}

const CHAPTER_ROLES = [
  { file: '学习指南.md', label: '学习指南' },
  { file: '知识作业.md', label: '知识作业（自测）' },
  { file: '实战作业.md', label: '实战作业（交付）' },
  { file: '每日任务.md', label: '每日任务清单' },
];

// ---- 扫描路线图 ----
const entries = readdirSync(srcDir).filter((n) =>
  statSync(join(srcDir, n)).isDirectory()
);

const roadmaps = [];
let topicSeq = 5000;
let pathSeq = 500;

for (const dir of entries) {
  const idxMd = join(srcDir, dir, '学习路线图.md');
  if (!existsSync(idxMd)) continue; // 只处理含 学习路线图.md 的目录

  const idx = readMd(idxMd);
  const pathId = pathSeq++;
  const slug = `rm-${pathId}`;
  const title = firstH1(idx) || dir;
  const desc = firstBlockquote(idx) || '';

  // 阶段子目录
  const subDirs = readdirSync(join(srcDir, dir)).filter((n) =>
    statSync(join(srcDir, dir, n)).isDirectory()
  );
  const phases = subDirs
    .map((sd) => ({ sd, meta: parsePhaseName(sd) }))
    .filter((x) => x.meta)
    .sort((a, b) => a.meta.sort - b.meta.sort);

  const topicIds = [];
  const topics = [];
  const chapters = [];

  for (const { sd, meta } of phases) {
    const topicId = topicSeq++;
    topicIds.push(topicId);
    const topicSlug = `${slug}-${meta.sort}`;
    topics.push({
      id: topicId,
      slug: topicSlug,
      title: meta.title,
      desc: `路线图「${title}」第${meta.sort}${meta.sort === meta.sort && /周/.test(sd) ? '周' : '阶段'}`,
      modules: ['theory'],
    });

    // 4 类 md → chapters
    let cSort = 1;
    for (const role of CHAPTER_ROLES) {
      const f = join(srcDir, dir, sd, role.file);
      if (!existsSync(f)) continue;
      const md = readMd(f);
      const chTitle = firstH1(md) || `${meta.title} · ${role.label}`;
      chapters.push({
        topicId,
        title: chTitle,
        sort: cSort++,
        md,
      });
    }
  }

  roadmaps.push({ pathId, slug, title, desc, topicIds, topics, chapters });
}

// ---- 生成 SQL ----
let sql = '';
sql += `-- 自动生成：技术虾学习路线图 → MES 实训平台课程数据\n`;
sql += `-- 来源目录：${srcDir}\n`;
sql += `-- 生成时间：${new Date().toISOString()}\n`;
sql += `-- 重跑安全：先清 rm- 前缀，再插入。\n\n`;
sql += `PRAGMA foreign_keys = OFF;\n`;
sql += `DELETE FROM chapters WHERE topic_id IN (SELECT id FROM topics WHERE slug LIKE 'rm-%');\n`;
sql += `DELETE FROM topics WHERE slug LIKE 'rm-%';\n`;
sql += `DELETE FROM learning_paths WHERE slug LIKE 'rm-%';\n`;
sql += `PRAGMA foreign_keys = ON;\n\n`;

// learning_paths
sql += `-- learning_paths\n`;
sql += `INSERT INTO learning_paths (id, slug, title, description, topic_ids, sort, status, created_at) VALUES\n`;
sql += roadmaps
  .map(
    (r, i) =>
      `  (${r.pathId}, ${q(r.slug)}, ${q(r.title)}, ${q(r.desc)}, ${j(
        r.topicIds
      )}, ${i + 1}, 'published', strftime('%s','now'))`
  )
  .join(',\n') + ';\n\n';

// topics
sql += `-- topics\n`;
sql += `INSERT INTO topics (id, slug, title, description, modules, sort, status, created_at, updated_at) VALUES\n`;
const topicRows = [];
roadmaps.forEach((r) => {
  r.topics.forEach((t, i) => {
    topicRows.push(
      `  (${t.id}, ${q(t.slug)}, ${q(t.title)}, ${q(t.desc)}, ${j(
        t.modules
      )}, ${i + 1}, 'published', strftime('%s','now'), strftime('%s','now'))`
    );
  });
});
sql += topicRows.join(',\n') + ';\n\n';

// chapters（学习指南/知识作业/实战作业/每日任务 → 理论正文）
// 每条 chapter 独立一条 INSERT：D1 对单条 SQL 语句长度有限制，
// 48 章正文合并成一条会触发 SQLITE_TOOBIG，故逐行插入。
sql += `-- chapters（学习指南/知识作业/实战作业/每日任务 → 理论正文）\n`;
roadmaps.forEach((r) => {
  r.chapters.forEach((c) => {
    sql += `INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at) VALUES (${c.topicId}, ${q(c.title)}, ${c.sort}, 'published', ${q(c.md)}, 1, strftime('%s','now'));\n`;
  });
});
sql += '\n';

// 触发 L2 缓存换键
sql += `-- 内容版本 +1，使 L2 缓存失效\n`;
sql += `UPDATE platform_config SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version';\n`;

// 写出
writeFileSync(outSql, sql, 'utf8');

  // 汇总
  const tCount = roadmaps.reduce((s, r) => s + r.topics.length, 0);
  const cCount = roadmaps.reduce((s, r) => s + r.chapters.length, 0);
  console.log('[import-roadmaps] 完成');
  console.log(`  源目录   : ${srcDir}`);
  console.log(`  输出 SQL : ${outSql}`);
  console.log(`  路线图   : ${roadmaps.length} 条`);
  roadmaps.forEach((r) =>
    console.log(
      `    - ${r.title}  (topics=${r.topics.length}, chapters=${r.chapters.length})`
    )
  );
  console.log(`  主题     : ${tCount} 个`);
  console.log(`  章节     : ${cCount} 个`);
  console.log('');
  console.log('  应用（远程 D1）：');
  console.log(
    '    wrangler d1 execute mes-learning --remote --file=./src/migrations/seed-roadmaps.sql'
  );
