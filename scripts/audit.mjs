import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const EXTS = ['.ts', '.tsx'];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, 'web', 'src')), ...walk(join(ROOT, 'worker', 'src'))];

// --- 1. 行数分布 ---
const sized = files.map((f) => ({
  f: f.replace(ROOT + '\\', '').replace(/\\/g, '/'),
  n: readFileSync(f, 'utf8').split('\n').length,
})).sort((a, b) => b.n - a.n);

const over = sized.filter((x) => x.n > 300);
const near = sized.filter((x) => x.n > 250 && x.n <= 300);

console.log('=== 行数分布 ===');
console.log(`总文件: ${sized.length}  >300行: ${over.length}  250~300: ${near.length}`);
console.log('--- >300 行清单 ---');
over.forEach((x) => console.log(`${String(x.n).padStart(5)}  ${x.f}`));

// --- 2. 死引用 ---
console.log('\n=== 死引用 ===');
// 候选后缀必须含 '.d.ts'：worker/src/core/*.ts 里的 `from '../env'` 实际指向
// env.d.ts（纯类型声明文件）。漏掉它会把 3 条合法导入误报成死引用——
// 假阳性的真正危害不是多报几条，而是让人不再认真看报告，从而掩盖真实死链。
const CAND = ['.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', ''];
let dead = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const dir = f.substring(0, f.lastIndexOf('\\'));
  const re = /from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    let spec = m[1];
    if (/\.(css|svg|png|jpg|json|sql|wasm)(\?\w+)?$/.test(spec)) continue;
    if (spec.includes('?')) continue;
    const base = join(dir, spec);
    const ok = CAND.some((c) => existsSync(base + c));
    if (!ok) {
      dead++;
      console.log(`${f.replace(ROOT + '\\', '')}  ->  ${spec}`);
    }
  }
}
if (!dead) console.log('无');

// --- 3. 根目录垃圾 ---
console.log('\n=== 根目录可疑文件 ===');
const WHITE = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'wrangler.toml', 'README.md']);
readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isFile() && !WHITE.has(e.name))
  .filter((e) => /^(_|\.tmp_|tmp_)/.test(e.name) || /\.(json|txt)$/.test(e.name))
  .forEach((e) => console.log(' ', e.name));

// --- 4. 路由对账 ---
console.log('\n=== 路由对账 ===');
const appPath = join(ROOT, 'web', 'src', 'App.tsx');
if (existsSync(appPath)) {
  const app = readFileSync(appPath, 'utf8');
  const re = /const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)\)/g;
  let m, miss = 0, total = 0;
  while ((m = re.exec(app))) {
    total++;
    const t = join(ROOT, 'web', 'src', m[2].replace(/^\.\//, ''));
    const ok = CAND.some((c) => existsSync(t + c));
    if (!ok) { miss++; console.log(`  缺失: ${m[1]} -> ${m[2]}`); }
  }
  console.log(`  lazy 路由 ${total} 个，缺失 ${miss} 个`);
  const routes = [...app.matchAll(/path="([^"]+)"/g)].map((x) => x[1]);
  console.log(`  已注册路径(${routes.length}): ${routes.join(' ')}`);
}
