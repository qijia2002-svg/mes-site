/**
 * 种子脚本干跑器：在 sql.js 里用线上真实表结构预演一遍 seed，跑两次验幂等。
 *
 * 为什么要有它：Windows 上 `wrangler d1 execute --local` 会把 workerd 跑崩
 * （access violation，环境问题不是 SQL 问题），本地库这条验证路径不可用。
 * 直接往 --remote 打未经验证的 seed 太野蛮，所以在纯 SQLite 里先演一遍。
 *
 * 做法：从线上 sqlite_master 拉 CREATE TABLE，加上 seed 依赖的既有数据
 * （flowcharts / flow_nodes），在内存库里执行 seed，检查结果，再执行一次，
 * 断言两次结果完全相同。
 *
 * 用法: node scripts/dry-run-seed.mjs <seed.sql> [--tables a,b,c] [--seed-rows-from d,e]
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './lib/d1.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SQLJS_DIST = dirname(require.resolve('sql.js'));

const argv = process.argv.slice(2);
const seedFile = argv.find((a) => !a.startsWith('--'));
const arg = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
if (!seedFile) {
  console.error('用法: node scripts/dry-run-seed.mjs <seed.sql> [--tables a,b] [--seed-rows-from a,b]');
  process.exit(1);
}

const tables = (arg('--tables') ?? '').split(',').filter(Boolean);
const rowTables = (arg('--seed-rows-from') ?? '').split(',').filter(Boolean);

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  console.log(`拉取线上表结构: ${tables.join(', ')}`);
  const list = tables.map((t) => `'${t}'`).join(',');
  const schemas = query(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN (${list})`);
  const missing = tables.filter((t) => !schemas.some((s) => s.name === t));
  if (missing.length) {
    console.error(`线上缺表: ${missing.join(', ')}`);
    process.exit(1);
  }

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({ locateFile: (f) => resolve(SQLJS_DIST, f) });
  const db = new SQL.Database();
  for (const s of schemas) db.run(`${s.sql};`);

  for (const t of rowTables) {
    const rows = query(`SELECT * FROM ${t}`);
    for (const r of rows) {
      const cols = Object.keys(r);
      db.run(
        `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map((c) => sqlLiteral(r[c])).join(',')})`,
      );
    }
    console.log(`  预置 ${t}: ${rows.length} 行`);
  }

  const seedSql = readFileSync(resolve(seedFile), 'utf8');

  // 比较时丢弃 autoincrement 的 id 列：本 seed 里 node_resources 故意不设显式 id
  // （没有任何表按 node_resources.id 引用它，进度用的是 flow_node.id），
  // 两次执行会因 sqlite_sequence 自增而拿到不同 id（1-9 → 10-18），
  // 但内容（node_id/res_type/ref_id/title/sort）是确定的。
  // 其它表即便有显式 id，内容也完全一致，丢掉 id 不影响幂等判断；
  // 引用完整性另由下面的悬空检查兜底。
  const IGNORE_COLS = new Set(['id']);
  const snapshot = () => {
    const out = {};
    for (const t of tables) {
      const res = db.exec(`SELECT * FROM ${t} ORDER BY 1`);
      if (!res.length) {
        out[t] = [];
        continue;
      }
      const keepIdx = res[0].columns
        .map((c, i) => [c, i])
        .filter(([c]) => !IGNORE_COLS.has(c))
        .map(([, i]) => i);
      out[t] = res[0].values.map((row) => keepIdx.map((i) => row[i]));
    }
    return out;
  };

  console.log('\n第 1 次执行 seed…');
  db.run(seedSql);
  const first = snapshot();

  console.log('第 2 次执行 seed（验幂等）…');
  db.run(seedSql);
  const second = snapshot();

  let drift = 0;
  for (const t of tables) {
    const a = JSON.stringify(first[t]);
    const b = JSON.stringify(second[t]);
    const same = a === b;
    if (!same) drift++;
    console.log(`  ${same ? '[幂等]' : '[漂移]'} ${t}: ${first[t].length} → ${second[t].length} 行`);
  }

  // 关键断言：node_resources 的 node_id 必须全部解析成功（子查询没落空）
  const orphan = db.exec(
    'SELECT COUNT(*) FROM node_resources WHERE node_id IS NULL OR node_id NOT IN (SELECT id FROM flow_nodes)',
  );
  const orphanCount = orphan.length ? orphan[0].values[0][0] : 0;
  console.log(`\nnode_resources 悬空引用: ${orphanCount}`);

  const detail = db.exec(
    `SELECT n.node_key, r.res_type, r.ref_id, r.title
     FROM node_resources r JOIN flow_nodes n ON n.id = r.node_id
     ORDER BY n.node_key, r.sort`,
  );
  if (detail.length) {
    console.log('挂载明细:');
    for (const row of detail[0].values) console.log(`  ${row[0].padEnd(9)} ${row[1].padEnd(8)} #${row[2]}  ${row[3]}`);
  }

  if (drift > 0 || orphanCount > 0) {
    console.log('\n干跑不通过。');
    process.exit(1);
  }
  console.log('\n干跑通过：幂等 + 引用完整。可以打 --remote。');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
