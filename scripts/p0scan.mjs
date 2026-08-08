// P0 合规扫描：emoji 功能图标 / 紫粉渐变 / 明显硬编码色值（除 #fff #000）
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'E:/mes-learning-platform/web/src';
const EXT = new Set(['.tsx', '.ts', '.css', '.jsx']);
const emojiRe = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
const gradRe = /(7C3AED|A855F7|EC4899|6366F1.*EC4899|indigo.*pink)/i;
const hardHexRe = /#([0-9a-fA-F]{3,8})\b/g;
const ALLOW = new Set(['#fff', '#ffffff', '#000', '#000000']);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (EXT.has(p.slice(p.lastIndexOf('.')))) out.push(p);
  }
  return out;
}

let emojiHits = 0, gradHits = 0, hexHits = 0;
const hexFiles = new Map();
for (const f of walk(ROOT)) {
  let txt;
  try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = txt.split('\n');
  lines.forEach((ln, i) => {
    if (emojiRe.test(ln)) { console.log(`[EMOJI] ${f}:${i + 1}`); emojiHits++; }
    if (gradRe.test(ln)) { console.log(`[GRADIENT] ${f}:${i + 1} -> ${ln.trim().slice(0, 80)}`); gradHits++; }
    // 注释行整行跳过：注释里的 "React #310" / "issue #130" 不是色值。
    // 旧版本把它们当硬编码色值报出来，长期挂着 4 条假阳性，掩盖真实违规。
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    let m;
    hardHexRe.lastIndex = 0;
    while ((m = hardHexRe.exec(ln))) {
      const c = m[0].toLowerCase();
      if (ALLOW.has(c)) continue;
      hexFiles.set(f, (hexFiles.get(f) || 0) + 1);
      hexHits++;
      console.log(`[HEX] ${f}:${i + 1} -> ${c}  |  ${ln.trim().slice(0, 60)}`);
    }
  });
}
console.log(`\n=== 扫描结果 ===`);
console.log(`emoji 功能图标命中: ${emojiHits}`);
console.log(`紫粉渐变命中: ${gradHits}`);
console.log(`硬编码色值(非#fff/#000)命中: ${hexHits} (涉及 ${hexFiles.size} 个文件)`);
if (hexHits > 0) {
  console.log('--- 含硬编码色值文件(前15):');
  let n = 0;
  for (const [f, c] of hexFiles) { if (n++ > 15) break; console.log(`  ${c}  ${f.replace(ROOT, 'src')}`); }
}
