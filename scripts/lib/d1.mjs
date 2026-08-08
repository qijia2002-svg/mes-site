/**
 * D1 远程/本地查询的唯一入口，供 scripts/ 下所有工具复用。
 *
 * 历史坑（勿回退）：早先用 execFileSync('wrangler.cmd', ..., { shell: true })，
 * Windows 的 shell 会按空格把 SQL 拆成一堆词，报 "Unknown arguments: id,, topic_id,,"。
 * 解法是**直接用 node 跑 wrangler.js**，不经 .cmd、不开 shell，参数原样传递。
 *
 * 另一个坑：`--file` 模式 wrangler 只回执行汇总，不回结果集；
 * 要拿行必须走 `--command`。所以 query() 用 command，execFile() 用 file。
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WRANGLER_JS = resolve(ROOT, 'node_modules/wrangler/bin/wrangler.js');
const DB_NAME = 'mes-learning';

function runWrangler(modeArgs, { local = false } = {}) {
  if (!existsSync(WRANGLER_JS)) {
    throw new Error(`找不到 wrangler: ${WRANGLER_JS}（先在仓库根跑 npm i）`);
  }
  try {
    return execFileSync(
      process.execPath,
      [WRANGLER_JS, 'd1', 'execute', DB_NAME, local ? '--local' : '--remote', ...modeArgs, '--json', '-y'],
      { encoding: 'utf8', maxBuffer: 1e9, cwd: ROOT },
    );
  } catch (e) {
    const detail = `${e.stdout || ''}\n${e.stderr || ''}`.trim();
    throw new Error(`wrangler d1 execute 失败:\n${detail}`);
  }
}

/** wrangler 会在 JSON 前后夹杂 banner / 版本提示，先切出 JSON 主体。 */
export function extractJson(text) {
  const s = text.indexOf('[');
  const o = text.indexOf('{');
  const start = s < 0 ? o : o < 0 ? s : Math.min(s, o);
  if (start < 0) return null;
  const closeCh = text[start] === '[' ? ']' : '}';
  const end = text.lastIndexOf(closeCh);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 执行 SELECT，返回行对象数组。 */
export function query(sql, opts = {}) {
  const raw = runWrangler(['--command', sql], opts);
  const j = extractJson(raw);
  if (j === null) throw new Error(`D1 返回无法解析:\n${raw.slice(0, 2000)}`);
  const blocks = Array.isArray(j) ? j : j.results ? [j] : [];
  const rows = [];
  for (const b of blocks) {
    if (b && Array.isArray(b.results)) rows.push(...b.results);
  }
  return rows;
}

/** 执行 SQL 文件（seed 用），返回 wrangler 的执行汇总。 */
export function execFile(sqlFile, opts = {}) {
  const abs = resolve(sqlFile);
  if (!existsSync(abs)) throw new Error(`找不到 SQL 文件: ${abs}`);
  const raw = runWrangler(['--file', abs], opts);
  return extractJson(raw) ?? raw;
}
