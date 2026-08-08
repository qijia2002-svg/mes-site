// 用法:
//   node scripts/d1q.mjs "SELECT ..."          执行一段 SQL 并打印行
//   node scripts/d1q.mjs --file path/to/x.sql  执行 SQL 文件（只回汇总，供 seed 用）
//   追加 --local 走本地库（默认 --remote）
//
// 实现细节与 Windows 踩坑说明见 scripts/lib/d1.mjs。
import { execFile, query } from './lib/d1.mjs';

const argv = process.argv.slice(2);
const local = argv.includes('--local');
const args = argv.filter((a) => a !== '--local');

try {
  const fileIdx = args.indexOf('--file');
  if (fileIdx >= 0) {
    const summary = execFile(args[fileIdx + 1] ?? '', { local });
    console.log(typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2));
  } else {
    const sql = args[0];
    if (!sql) {
      console.error('用法: node scripts/d1q.mjs "SELECT ..." | --file x.sql [--local]');
      process.exit(1);
    }
    const rows = query(sql, { local });
    for (const r of rows) console.log(JSON.stringify(r));
    console.log(`--- 共 ${rows.length} 行`);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
