#!/usr/bin/env node
/**
 * import-career-roadmap.mjs — PM 的职业路线图 JSON → D1 可执行 SQL
 * ----------------------------------------------------------------------------
 * 数据源：docs/seeds/career-roadmap-data.json
 * 产出  ：docs/seeds/career-roadmap-import.sql（超限时另出 .partNN.sql 分片）
 * 表结构：docs/architecture/career-roadmap-schema.md / ADR-012
 *
 * 硬要求（逐条对应总监指令）：
 *   1. 全部 INSERT OR REPLACE + 确定性主键 → 可重复执行，不产生重复数据。
 *   2. 单引号转义走 lib 的 q()，中文原样输出 UTF-8，不转码点。
 *   3. chapter_ids 落 track_level_chapters；导入前**逐个校验章节真实存在**，
 *      缺失一律列出并以非零码退出，绝不静默跳过（--allow-missing-chapters 可显式放行）。
 *   4. outcomes / planned_chapters / daily_work / outputs / interview_points /
 *      deliverables 存 JSON 列。
 *   5. 语句数或字节数超限自动分片。
 *
 * 用法：
 *   node scripts/import-career-roadmap.mjs                 # 校验 + 生成（远程查章节）
 *   node scripts/import-career-roadmap.mjs --local         # 章节校验查本地 D1
 *   node scripts/import-career-roadmap.mjs --chapters-json <f>  # 用已有导出，免查库
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { buildStatements, splitStatements } from './lib/career-roadmap-sql.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const DATA = resolve(opt('--data', `${ROOT}/docs/seeds/career-roadmap-data.json`));
const OUT = resolve(opt('--out', `${ROOT}/docs/seeds/career-roadmap-import.sql`));
const MAX_STMTS = Number(opt('--max-stmts', '120'));
const MAX_BYTES = Number(opt('--max-bytes', '45000'));
const DB_NAME = opt('--db', 'mes-learning');

/**
 * 图标语义名映射（ADR-002 / ADR-012 §8）。存语义名，禁 emoji / 组件名 / URL。
 *
 * 【与 ADR-012 §8 的偏离，需架构师确认】
 *   §8 与 API 文档示例里岗位图标写作 career-mes-impl / career-erp-consultant /
 *   career-mes-dev / career-scada / career-digital-owner，
 *   但已上线的 web/src/components/Icon.tsx REGISTRY 实际注册的是
 *   role-mes-impl / role-erp-consultant / role-mes-dev / role-scada / role-owner-digital
 *   （见该文件「岗位与成长阶段 —— UIUX-CareerRoadmap-v1 §6.3」段）。
 *   API 文档 §0.6 的**规范性要求**是「取值必须在 IconName 里」，
 *   因此这里以线上 REGISTRY 为准发 role-*，否则前端一律退化成 paths、图标全不显示。
 *   若架构师决定改回 career-*，改本表一行 + 重跑本脚本即可，无需动代码。
 */
const TRACK_ICON = {
  erp: 'erp',
  mes: 'mes',
  sql: 'sql',
  plc: 'plc',
  embedded: 'embedded',
  'industrial-network': 'network',
  'linux-ops': 'linux',
  'barcode-rfid': 'barcode',
  // PM 后补的两条 track，不在 ADR-012 §8 的 13 键清单内：
  // project-management 复用已注册的 schedule(CalendarClock)；
  // programming-dev 无合适已注册键，落 paths 兜底，待前端补专用键后回填。
  'project-management': 'schedule',
  'programming-dev': 'paths',
};
const CAREER_ICON = {
  'mes-implementation': 'role-mes-impl',
  'erp-consultant': 'role-erp-consultant',
  'mes-dev': 'role-mes-dev',
  'scada-engineer': 'role-scada',
  'digital-specialist': 'role-owner-digital',
};
const LEVEL_LABEL = { 1: 'L1', 2: 'L2', 3: 'L3' };
const KINDS = new Set(['core', 'elective']);
const IMPORTANCE = new Set(['core', 'important', 'optional']);
/** P0：数据里禁止任何 emoji，图标一律走语义名 */
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}]/u;

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

/** 递归扫描 emoji，定位到具体字段路径 */
function scanEmoji(node, path) {
  if (typeof node === 'string') {
    if (EMOJI.test(node)) err(`P0 违规：${path} 含 emoji -> ${node.slice(0, 40)}`);
    return;
  }
  if (Array.isArray(node)) return node.forEach((v, i) => scanEmoji(v, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) scanEmoji(v, `${path}.${k}`);
  }
}

/**
 * 解析前端 Icon.tsx 的 REGISTRY 键集合。
 * API 文档 §0.6 的规范性要求：icon 取值必须是 IconName 里已注册的语义名，
 * 否则前端只能退化成 paths。这里自动比对，避免靠人肉记。
 */
function loadIconRegistry() {
  const f = resolve(opt('--icon-registry', `${ROOT}/web/src/components/Icon.tsx`));
  let src;
  try {
    src = readFileSync(f, 'utf8');
  } catch {
    warn(`未找到 ${f}，跳过图标语义名注册校验`);
    return null;
  }
  const start = src.indexOf('REGISTRY');
  const body = start >= 0 ? src.slice(start) : src;
  const keys = new Set();
  for (const m of body.matchAll(/^\s*'?([A-Za-z][A-Za-z0-9-]*)'?\s*:\s*[A-Za-z]/gm)) keys.add(m[1]);
  return keys;
}

/** 从 D1 取全部章节 id + status，供存在性校验 */
function loadChapters() {
  const f = opt('--chapters-json', '');
  let raw;
  if (f) {
    raw = readFileSync(resolve(f), 'utf8');
  } else {
    const scope = flag('--local') ? '--local' : '--remote';
    console.log(`[校验] 查询 ${scope} D1 章节清单…`);
    // 走 shell：Windows 下 npx 是 .cmd，execFileSync 直接拉起会 EINVAL。
    // 拼进命令行的只有本文件内的常量，不含任何外部数据，无注入面。
    raw = execSync(
      `npx wrangler d1 execute ${DB_NAME} ${scope} --json --command "SELECT id, status FROM chapters"`,
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
    );
  }
  const rows = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;
  return new Map(rows.map((r) => [Number(r.id), r.status]));
}

// ---------------------------------------------------------------- 规范化 + 校验
const data = JSON.parse(readFileSync(DATA, 'utf8'));
if (!Array.isArray(data.tracks) || !Array.isArray(data.careers)) {
  console.error('[致命] 数据文件必须包含 tracks[] 与 careers[]');
  process.exit(1);
}
scanEmoji(data, 'data');

/** id 分配确定性：按 (sort, slug) 排序取序号，重跑同一份数据得到同一组 id */
const byOrder = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.slug).localeCompare(b.slug);

const tracks = [...data.tracks].sort(byOrder);
const seenTrack = new Set();
const levelIndex = new Map(); // `${slug}#${level}` -> track_levels.id

tracks.forEach((t, i) => {
  if (!t.slug) err(`tracks[${i}] 缺 slug`);
  if (seenTrack.has(t.slug)) err(`track slug 重复：${t.slug}`);
  seenTrack.add(t.slug);
  t._id = i + 1;
  // 注意：[...data.tracks] 是浅拷贝，t 与 data.tracks[x] 是同一对象引用。
  // 判定「原始数据是否带某字段」必须在赋值前取快照，否则读到的是自己刚写进去的值。
  const rawKind = t.kind;
  const rawIcon = typeof t.icon === 'string' && t.icon.trim() ? t.icon.trim() : '';
  t.kind = KINDS.has(rawKind) ? rawKind : 'core';
  if (!KINDS.has(rawKind)) warn(`track ${t.slug} kind 非法(${rawKind})，回落 core`);
  const mappedIcon = TRACK_ICON[t.slug];
  t.icon = rawIcon || mappedIcon || 'paths';
  if (EMOJI.test(t.icon)) err(`track ${t.slug} 的 icon 含 emoji：${t.icon}`);
  if (!rawIcon && !mappedIcon) {
    warn(`track ${t.slug} 不在 TRACK_ICON 映射表内，落 'paths' 兜底；请前端在 Icon.tsx REGISTRY 补专用键后回填映射`);
  }

  const levels = [...(t.levels ?? [])].sort((a, b) => a.level - b.level);
  const seenLv = new Set();
  for (const l of levels) {
    if (![1, 2, 3].includes(l.level)) err(`track ${t.slug} 出现非法 level=${l.level}`);
    if (seenLv.has(l.level)) err(`track ${t.slug} level ${l.level} 重复`);
    seenLv.add(l.level);
    l._id = t._id * 10 + l.level;
    // 契约里 levels[].name 形如「L1 入门」；PM 只给「入门」时补前缀，已带前缀则不重复加
    const label = LEVEL_LABEL[l.level] ?? `L${l.level}`;
    l.name = String(l.name ?? '').startsWith(label)
      ? String(l.name)
      : `${label} ${String(l.name ?? '').trim()}`.trim();
    l.outcomes = Array.isArray(l.outcomes) ? l.outcomes : [];
    l.planned_chapters = Array.isArray(l.planned_chapters) ? l.planned_chapters : [];
    l.chapter_ids = (Array.isArray(l.chapter_ids) ? l.chapter_ids : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    levelIndex.set(`${t.slug}#${l.level}`, l._id);
  }
  if (levels.length !== 3) warn(`track ${t.slug} 只有 ${levels.length} 级（契约要求 L1/L2/L3 齐全）`);
  t.levels = levels;
});

const careers = [...data.careers].sort(byOrder);
const seenCareer = new Set();
let reqSeq = 0;

careers.forEach((c, i) => {
  if (!c.slug) err(`careers[${i}] 缺 slug`);
  if (seenCareer.has(c.slug)) err(`career slug 重复：${c.slug}`);
  seenCareer.add(c.slug);
  c._id = i + 1;
  // 同 tracks：先取原始值快照，再赋值，避免读到自己写入的结果
  const rawCIcon = typeof c.icon === 'string' && c.icon.trim() ? c.icon.trim() : '';
  const mappedCIcon = CAREER_ICON[c.slug];
  c.icon = rawCIcon || mappedCIcon || 'user';
  if (EMOJI.test(c.icon)) err(`career ${c.slug} 的 icon 含 emoji：${c.icon}`);
  if (!rawCIcon && !mappedCIcon) {
    warn(`career ${c.slug} 不在 CAREER_ICON 映射表内，落 'user' 兜底；请补 CAREER_ICON 与 Icon.tsx REGISTRY`);
  }
  c.daily_work = Array.isArray(c.daily_work) ? c.daily_work : [];
  c.outputs = Array.isArray(c.outputs) ? c.outputs : [];

  const stages = [...(c.stages ?? [])].sort((a, b) => a.stage - b.stage);
  const seenStage = new Set();
  for (const s of stages) {
    if (!Number.isInteger(s.stage) || s.stage < 1) err(`career ${c.slug} 非法 stage=${s.stage}`);
    if (seenStage.has(s.stage)) err(`career ${c.slug} stage ${s.stage} 重复`);
    seenStage.add(s.stage);
    s._id = c._id * 100 + s.stage;
    s.interview_points = Array.isArray(s.interview_points) ? s.interview_points : [];
    s.deliverables = Array.isArray(s.deliverables) ? s.deliverables : [];

    const reqs = Array.isArray(s.requirements) ? s.requirements : [];
    const seenReq = new Set();
    for (const r of reqs) {
      const key = `${r.track}#${r.level}`;
      const lid = levelIndex.get(key);
      if (!lid) {
        err(`career ${c.slug} stage ${s.stage} 引用了不存在的能力等级：${key}`);
        continue;
      }
      if (seenReq.has(key)) {
        err(`career ${c.slug} stage ${s.stage} 重复要求同一等级：${key}（违反 UNIQUE(stage_id,level_id)）`);
        continue;
      }
      seenReq.add(key);
      if (!IMPORTANCE.has(r.importance)) {
        warn(`career ${c.slug} stage ${s.stage} ${key} importance 非法(${r.importance})，回落 core`);
        r.importance = 'core';
      }
      r._levelId = lid;
      r._id = ++reqSeq;
    }
    s.requirements = reqs.filter((r) => r._id);
  }
  c.stages = stages;
});

// ---------------------------------------------------------------- 图标语义名校验
const registry = loadIconRegistry();
if (registry && registry.size) {
  const unreg = [];
  for (const t of tracks) if (!registry.has(t.icon)) unreg.push(`track ${t.slug} -> '${t.icon}'`);
  for (const c of careers) if (!registry.has(c.icon)) unreg.push(`career ${c.slug} -> '${c.icon}'`);
  if (unreg.length) {
    warn(
      `以下 icon 语义名未在 Icon.tsx REGISTRY 注册，前端会退化成 'paths'（API 文档 §0.6）：\n    ` +
        unreg.join('\n    ') +
        `\n    处置：前端补齐 REGISTRY 键，或改本脚本的 TRACK_ICON / CAREER_ICON 映射后重跑。`,
    );
  }
}

// ---------------------------------------------------------------- 章节存在性校验
let chapterMap = null;
if (!flag('--skip-chapter-check')) {
  chapterMap = loadChapters();
  const missing = [];
  const draft = [];
  for (const t of tracks) {
    for (const l of t.levels) {
      for (const cid of l.chapter_ids) {
        const st = chapterMap.get(cid);
        if (st === undefined) missing.push(`${t.slug} L${l.level} -> chapter_id ${cid}`);
        else if (st !== 'published') draft.push(`${t.slug} L${l.level} -> chapter_id ${cid} (${st})`);
      }
    }
  }
  draft.forEach((d) => warn(`章节存在但未发布，不会进分母：${d}`));
  if (missing.length) {
    const msg = `chapters 表中不存在的 chapter_id 共 ${missing.length} 条：\n    ` + missing.join('\n    ');
    if (flag('--allow-missing-chapters')) warn(msg);
    else err(msg);
  }
}

// ---------------------------------------------------------------- 输出
if (errors.length) {
  console.error('\n[校验失败] 以下问题必须先修数据，未生成任何 SQL：');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
warns.forEach((w) => console.warn(`[warn] ${w}`));

const stmts = buildStatements({ tracks, careers });
const header =
  `-- 自动生成，请勿手改：node scripts/import-career-roadmap.mjs\n` +
  `-- 数据源：${DATA.replace(ROOT, '.')}\n` +
  `-- 生成时间：${new Date().toISOString()}\n` +
  `-- 幂等：全部 INSERT OR REPLACE + 确定性主键，可重复执行。\n` +
  `-- 顺序：父表先于子表（REPLACE 会触发 ON DELETE CASCADE），不要重排语句。\n\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header + stmts.join('\n') + '\n', 'utf8');

const parts = splitStatements(stmts, MAX_STMTS, MAX_BYTES);
const partFiles = [];
if (parts.length > 1) {
  parts.forEach((p, i) => {
    const f = OUT.replace(/\.sql$/, `.part${String(i + 1).padStart(2, '0')}.sql`);
    writeFileSync(f, `${header}-- 分片 ${i + 1}/${parts.length}\n\n${p.join('\n')}\n`, 'utf8');
    partFiles.push(f);
  });
}

// ---------------------------------------------------------------- 汇总
const count = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);
const levelRows = count(tracks, (t) => t.levels.length);
const tlcRows = count(tracks, (t) => count(t.levels, (l) => l.chapter_ids.length));
const stageRows = count(careers, (c) => c.stages.length);
const reqRows = count(careers, (c) => count(c.stages, (s) => s.requirements.length));

console.log('\n[import-career-roadmap] 生成完成');
console.log(`  输出            : ${OUT}`);
if (partFiles.length) console.log(`  分片            : ${partFiles.length} 个（单片上限 ${MAX_STMTS} 语句 / ${MAX_BYTES} 字节）`);
console.log(`  tracks              : ${tracks.length}`);
console.log(`  track_levels        : ${levelRows}`);
console.log(`  track_level_chapters: ${tlcRows}`);
console.log(`  career_paths        : ${careers.length}`);
console.log(`  career_stages       : ${stageRows}`);
console.log(`  career_stage_reqs   : ${reqRows}`);
console.log(`  SQL 语句总数        : ${stmts.length}`);
console.log('\n  导入远程 D1：');
if (partFiles.length) {
  partFiles.forEach((f) => console.log(`    npx wrangler d1 execute ${DB_NAME} --remote --file ${f.replace(ROOT, '..')}`));
} else {
  console.log(`    npx wrangler d1 execute ${DB_NAME} --remote --file ${OUT.replace(ROOT, '..')}`);
}
