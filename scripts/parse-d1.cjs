// 用法: node scripts/parse-d1.cjs <json文件>
const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('用法: node scripts/parse-d1.cjs file.json'); process.exit(1); }
const s = fs.readFileSync(p, 'utf8');
let j;
try { j = JSON.parse(s); } catch (e) { console.log('RAW:\n' + s.slice(0, 1500)); process.exit(0); }
const blocks = Array.isArray(j) ? j : (j.results ? [j] : []);
let rows = 0;
for (const b of blocks) {
  if (b && Array.isArray(b.results)) {
    for (const r of b.results) { console.log(JSON.stringify(r)); rows++; }
  }
}
console.log(`--- 共 ${rows} 行`);
