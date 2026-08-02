/**
 * 从 E:\我的脑库\10_Learning（学习）\MES 读取 markdown，
 * 生成 seed-mes-knowledge.sql 和 mes-content.json（供后台导入）。
 *
 * 用法：node scripts/import-mes-content.mjs
 * 输出：worker/src/migrations/seed-mes-knowledge.sql（本地 D1 执行用）
 *       worker/public/mes-content.json（前端导入用）
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = 'E:\\我的脑库\\10_Learning（学习）\\MES';

// YAML frontmatter 简单解析
function parseFM(text) {
  if (!text.startsWith('---')) return { meta: {}, body: text };
  const end = text.indexOf('---', 3);
  if (end === -1) return { meta: {}, body: text };
  const fm = text.slice(3, end);
  const body = text.slice(end + 3).trim();
  const meta = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      let val = m[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map((s) => s.trim());
      }
      meta[m[1]] = val;
    }
  }
  return { meta, body };
}

function escapeSQL(s) {
  return s.replace(/'/g, "''");
}

const files = [];
for (const f of readdirSync(SRC)) {
  if (f.startsWith('_') || f.startsWith('mes培训') || !f.endsWith('.md')) continue;
  const num = parseInt(f);
  if (!num || num < 1 || num > 16) continue;
  files.push({ num, name: f, path: join(SRC, f) });
}
files.sort((a, b) => a.num - b.num);

// 生成 SQL
const topicSlug = 'mes-knowledge';
const topicTitle = 'MES 核心知识';
const topicDesc = 'ERP / MES / PLC 三层架构，从基础术语到质量追溯的完整 MES 知识体系。适合 MES 实施顾问、运维工程师、求职者系统化学习。';
const now = Math.floor(Date.now() / 1000);

let sql = `-- MES 核心知识 种子数据（生成时间 ${new Date().toISOString()}）
-- 来源：E:\\我的脑库\\10_Learning（学习）\\MES\\
-- 16 章完整 MES 知识体系

INSERT OR IGNORE INTO topics (slug, title, description, modules, status, sort, updated_at)
VALUES ('${topicSlug}', '${escapeSQL(topicTitle)}', '${escapeSQL(topicDesc)}', '["MES","ERP","PLC","基础知识"]', 'published', 8, ${now});

`;

// 同时生成 JSON（供后台导入用）
const jsonChapters = [];

const topicIdPlaceholder = '{{mes_topic_id}}';

for (const f of files) {
  const raw = readFileSync(f.path, 'utf-8');
  const { body } = parseFM(raw);
  const titleMatch = body.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : f.name.replace('.md', '');

  // SQL: 用占位符 {{mes_topic_id}}
  sql += `INSERT OR IGNORE INTO chapters (topic_id, title, sort, md_text, status, updated_at)
SELECT id, '${escapeSQL(title)}', ${f.num}, '${escapeSQL(body)}', 'published', ${now}
FROM topics WHERE slug = '${topicSlug}';\n\n`;

  // JSON
  jsonChapters.push({ title, sort: f.num, md: body });
}

// 生成最终的 SQL（查找 topic_id）
const finalSQL = sql;

writeFileSync(join(ROOT, 'worker', 'src', 'migrations', 'seed-mes-knowledge.sql'), finalSQL, 'utf-8');
console.log(`✓ SQL 写入 worker/src/migrations/seed-mes-knowledge.sql（${files.length} 章）`);

// 生成 JSON
const json = {
  topics: [{
    slug: topicSlug,
    title: topicTitle,
    description: topicDesc,
    modules: ['MES', 'ERP', 'PLC', '基础知识'],
    chapters: jsonChapters,
  }],
};
writeFileSync(join(ROOT, 'worker', 'public', 'mes-content.json'), JSON.stringify(json, null, 2), 'utf-8');
console.log(`✓ JSON 写入 worker/public/mes-content.json（${files.length} 章）`);
