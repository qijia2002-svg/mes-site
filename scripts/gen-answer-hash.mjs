/**
 * SQL 判题哈希生成器 / 回归器（ADR-005 · F3 · AC-03）。
 *
 * [契约] 本脚本的归一化算法与 web/src/lib/resultHash.ts **必须逐字一致**。
 * 改任何一侧都要同步改另一侧，否则全站判题静默失效——
 * 不报错，只是所有人都判错，是最贵的失效模式。
 *
 * 归一化（与前端同源）：
 *   1. 取 db.exec(sql) 的**最后一个**结果集的 values（二维数组）
 *   2. 每行 JSON.stringify(row.map(v => v ?? null))，不含列名
 *   3. 不排序，保持 SQL 输出序（ORDER BY 是被考查的能力点）
 *   4. '\n' 连接 → UTF-8 → SHA-256 → 小写 hex
 *
 * 两端同用 sql.js 1.13.0（同一 WASM 二进制）+ 同一份 dataset.sql，返回序确定。
 *
 * 用法:
 *   node scripts/gen-answer-hash.mjs --regress
 *       拉线上所有真哈希题（排除 PLACEHOLDER_），重算并比对。不一致即退出码 1。
 *   node scripts/gen-answer-hash.mjs --sql "SELECT ..."
 *       算单条，打印 hash + canonical 预览。
 *   node scripts/gen-answer-hash.mjs --batch path/to/items.json
 *       批量：[{ "key": "purchase-overdue", "sql": "SELECT ..." }] → 打印 key→hash 映射。
 *   追加 --canonical 打印完整 canonical 字符串（排障用：比 hex 好 diff）。
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './lib/d1.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATASET_SQL = resolve(ROOT, 'web/src/features/sql-sandbox/dataset.sql');
const SQLJS_DIST = dirname(require.resolve('sql.js'));

// ---------- 归一化（与 resultHash.ts 对齐，勿改） ----------

export function canonicalizeRows(rows) {
  return rows.map((row) => JSON.stringify(row.map((v) => v ?? null))).join('\n');
}

export function sha256Hex(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

// ---------- 沙箱 ----------

async function openSandbox() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({ locateFile: (f) => resolve(SQLJS_DIST, f) });
  const datasetSql = readFileSync(DATASET_SQL, 'utf8');
  const db = new SQL.Database();
  db.run(datasetSql);
  return db;
}

/** 跑一条 SQL，返回 { hash, canonical, rowCount, colCount }。 */
function evaluate(db, sql) {
  const results = db.exec(sql);
  const rows = results.length === 0 ? [] : results[results.length - 1].values;
  const cols = results.length === 0 ? [] : results[results.length - 1].columns;
  const canonical = canonicalizeRows(rows);
  return { hash: sha256Hex(canonical), canonical, rowCount: rows.length, colCount: cols.length };
}

// ---------- CLI ----------

const argv = process.argv.slice(2);
const showCanonical = argv.includes('--canonical');
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function preview(text, n = 200) {
  const one = text.replace(/\n/g, ' ⏎ ');
  return one.length > n ? `${one.slice(0, n)}…` : one;
}

async function main() {
  const db = await openSandbox();

  if (argv.includes('--regress')) {
    const items = query(
      "SELECT id, title, answer_hash, answer_sql FROM sql_exercises " +
        "WHERE answer_hash IS NOT NULL AND answer_hash <> '' AND answer_hash NOT LIKE 'PLACEHOLDER%' " +
        'ORDER BY id',
    );
    if (items.length === 0) {
      console.error('没有可回归的题目（线上全是 PLACEHOLDER 或空哈希）');
      process.exit(1);
    }
    let bad = 0;
    console.log(`回归 ${items.length} 道真哈希题（dataset.sql + sql.js 本地复算）\n`);
    for (const it of items) {
      let r;
      try {
        r = evaluate(db, it.answer_sql);
      } catch (e) {
        bad++;
        console.log(`  [ERR ] #${it.id} ${it.title}\n         SQL 执行失败: ${e.message}`);
        continue;
      }
      const ok = r.hash === it.answer_hash;
      if (!ok) bad++;
      console.log(`  [${ok ? ' OK ' : 'FAIL'}] #${it.id} ${it.title}  (${r.rowCount}行×${r.colCount}列)`);
      if (!ok) {
        console.log(`         线上 : ${it.answer_hash}`);
        console.log(`         本地 : ${r.hash}`);
        console.log(`         canonical: ${preview(r.canonical)}`);
      } else if (showCanonical) {
        console.log(`         canonical: ${preview(r.canonical)}`);
      }
    }
    console.log(`\n结果: ${items.length - bad} 通过 / ${bad} 失败`);
    if (bad > 0) {
      console.log('\n判题哈希不一致。可能原因：dataset.sql 被改动、sql.js 版本漂移、归一化算法两端不同步。');
      process.exit(1);
    }
    console.log('脚本与前端判题口径一致，可用于生成新题哈希。');
    return;
  }

  const single = arg('--sql');
  if (single) {
    const r = evaluate(db, single);
    console.log(`hash : ${r.hash}`);
    console.log(`shape: ${r.rowCount} 行 × ${r.colCount} 列`);
    console.log(showCanonical ? `canonical:\n${r.canonical}` : `canonical: ${preview(r.canonical)}`);
    return;
  }

  const batchFile = arg('--batch');
  if (batchFile) {
    const items = JSON.parse(readFileSync(resolve(batchFile), 'utf8'));
    const out = {};
    for (const it of items) {
      const r = evaluate(db, it.sql);
      out[it.key] = r.hash;
      console.log(`  ${it.key}  ${r.hash}  (${r.rowCount}行×${r.colCount}列)`);
      if (showCanonical) console.log(`      canonical: ${preview(r.canonical)}`);
      if (r.rowCount === 0) console.log('      [警告] 结果集为空——空集哈希对所有空查询都相同，题目形同虚设');
    }
    console.log(`\n${JSON.stringify(out, null, 2)}`);
    return;
  }

  console.error('用法: --regress | --sql "SELECT ..." | --batch items.json  [--canonical]');
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
