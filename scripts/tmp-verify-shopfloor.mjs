// 临时验证脚本：校验 seed-node-shopfloor.sql 可执行且数据正确
// 表结构按 seed-node-bom-route.sql 同款（shopfloor seed 镜像的 schema）
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const initSqlJs = require('sql.js');
const SQL = await initSqlJs({ locateFile: (f) => resolve(ROOT, 'node_modules/sql.js/dist', f) });
const db = new SQL.Database();

// ---- 目标 schema（与 sibling seed-node-bom-route.sql 一致） ----
db.run(`
CREATE TABLE chapters (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  md_text TEXT NOT NULL DEFAULT '',
  node_slug TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  body_type TEXT NOT NULL DEFAULT 'markdown',
  answer_type TEXT NOT NULL DEFAULT 'single',
  choices TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  chapter_id INTEGER NOT NULL DEFAULT 0,
  bloom_level TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE sql_exercises (
  id INTEGER PRIMARY KEY,
  topic_id INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  dataset_json TEXT NOT NULL DEFAULT '{}',
  answer_sql TEXT NOT NULL DEFAULT '',
  answer_hash TEXT,
  schema_hint TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE micro_practices (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'match',
  prompt TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  answer TEXT NOT NULL DEFAULT '[]',
  feedback_ok TEXT NOT NULL DEFAULT '',
  feedback_bad TEXT NOT NULL DEFAULT '',
  chapter_id INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE node_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_slug TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`);

// ---- 执行 seed ----
const seed = readFileSync(resolve(ROOT, 'docs/seeds/seed-node-shopfloor.sql'), 'utf8');
let errors = [];
try {
  db.run(seed);
  console.log('✅ seed 执行成功（无语法错误）');
} catch (e) {
  console.log('❌ seed 执行失败：', e.message);
  process.exit(1);
}

// ---- 重跑安全：再执行一次应同样成功（DELETE 先于 INSERT） ----
try {
  db.run(seed);
  console.log('✅ 重跑安全验证通过（连续执行两次无冲突）');
} catch (e) {
  console.log('❌ 重跑失败：', e.message);
  errors.push(e.message);
}

const q = (sql) => db.exec(sql)?.[0]?.values ?? [];
console.log('\n--- 行数校验 ---');
console.log('chapters 9105:', q('SELECT COUNT(*) FROM chapters WHERE id=9105')[0]);
console.log('questions 9206-9207:', q('SELECT COUNT(*) FROM questions WHERE id IN (9206,9207)')[0]);
console.log('sql_exercises 9306-9307:', q('SELECT COUNT(*) FROM sql_exercises WHERE id IN (9306,9307)')[0]);
console.log('micro_practices 9414:', q('SELECT COUNT(*) FROM micro_practices WHERE id=9414')[0]);
console.log('node_resources shopfloor:', q('SELECT COUNT(*) FROM node_resources WHERE node_slug=\'shopfloor\'')[0]);

console.log('\n--- node_resources 挂载顺序 ---');
q('SELECT resource_type, resource_id, title, sort FROM node_resources WHERE node_slug=\'shopfloor\' ORDER BY sort').forEach(r => console.log(' ', r.join(' | ')));

console.log('\n--- 关键内容 spot-check ---');
console.log('chapters.node_slug:', q('SELECT node_slug FROM chapters WHERE id=9105')[0]?.[0]);
const md = q('SELECT md_text FROM chapters WHERE id=9105')[0]?.[0] ?? '';
console.log('章节含病灶 WO-20260801-01:', md.includes('WO-20260801-01'));
console.log('章节含锚点 sql:9306:', md.includes('[[sql:9306|查 WO-20260801-01 的报工记录]]'));
console.log('章节含锚点 sql:9307:', md.includes('[[sql:9307|查哪些工单完工数与报工汇总不一致]]'));
console.log('9306 answer_sql 与题面一致:', q('SELECT answer_sql FROM sql_exercises WHERE id=9306')[0]?.[0].includes('WHERE pr.wo_id = 1'));
console.log('9307 answer_sql 含 ORDER BY diff ASC:', q('SELECT answer_sql FROM sql_exercises WHERE id=9307')[0]?.[0].includes('ORDER BY diff ASC'));
console.log('9306 answer_hash 占位符:', q('SELECT answer_hash FROM sql_exercises WHERE id=9306')[0]?.[0]);
console.log('9307 answer_hash 占位符:', q('SELECT answer_hash FROM sql_exercises WHERE id=9307')[0]?.[0]);
console.log('9414 kind:', q('SELECT kind FROM micro_practices WHERE id=9414')[0]?.[0]);
console.log('9414 answer:', q('SELECT answer FROM micro_practices WHERE id=9414')[0]?.[0]);
console.log('9206 correct_answer:', q('SELECT correct_answer FROM questions WHERE id=9206')[0]?.[0]);
console.log('9207 correct_answer:', q('SELECT correct_answer FROM questions WHERE id=9207')[0]?.[0]);
console.log('9206 bloom_level:', q('SELECT bloom_level FROM questions WHERE id=9206')[0]?.[0]);
console.log('9207 bloom_level:', q('SELECT bloom_level FROM questions WHERE id=9207')[0]?.[0]);
console.log('9206 chapter_id:', q('SELECT chapter_id FROM questions WHERE id=9206')[0]?.[0]);
console.log('9207 chapter_id:', q('SELECT chapter_id FROM questions WHERE id=9207')[0]?.[0]);
console.log('sql_exercises topic_id:', q('SELECT DISTINCT topic_id FROM sql_exercises WHERE id IN (9306,9307)').map(r => r[0]).join(','));
console.log('micro chapter_id:', q('SELECT chapter_id FROM micro_practices WHERE id=9414')[0]?.[0]);

// 字符串引号逃逸检查：所有文本列中不应有未转义的单引号破坏 SQL
const allText = JSON.stringify(q('SELECT md_text FROM chapters WHERE id=9105')[0]);
const badQuote = (allText.match(/(?<![\\'])'(?!')/) ?? []).length;
console.log('\n单引号逃逸检查: md_text 中无裸单引号 =', !/^\s*$/.test(allText) && !badQuote);

process.exit(errors.length ? 1 : 0);
