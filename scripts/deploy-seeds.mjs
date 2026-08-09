// 把 12 个节点种子文件部署到线上 D1（默认 --remote）。带重试，逐文件汇报。
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = ['cust-order', 'order-review', 'mps', 'mrp', 'purchase', 'bom-route', 'picking', 'dispatch', 'shopfloor', 'qc', 'stock-in', 'shipping'];

function runFile(f) {
  // d1q.mjs --file 默认 remote
  return execFileSync('node', ['scripts/d1q.mjs', '--file', f], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let ok = 0;
let fail = 0;
async function main() {
  for (const k of KEYS) {
    const f = resolve(ROOT, `docs/seeds/seed-node-${k}.sql`);
    let done = false;
    for (let i = 0; i < 4 && !done; i++) {
      try {
        const out = runFile(f);
        done = true;
        ok++;
        console.log(`DEPLOY OK   ${k}  -> ${String(out).trim().split('\n').pop() || '(applied)'}`);
      } catch (e) {
        const msg = (e.stderr || e.stdout || e.message || '').toString().split('\n')[0];
        if (i < 3) { console.error(`  retry ${k} (${msg})`); await new Promise((r) => setTimeout(r, 1200)); }
        else { fail++; console.error(`DEPLOY FAIL ${k}: ${msg}`); }
      }
    }
  }
  console.log(`\n部署完成：成功 ${ok} / 失败 ${fail}`);
  process.exit(fail ? 1 : 0);
}
main();
