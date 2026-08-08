/**
 * career-roadmap-sql.mjs — 职业路线图种子数据的 SQL 生成器（纯函数，无 IO）
 * ----------------------------------------------------------------------------
 * 只负责「规范化后的数据 → SQL 语句数组」，校验与文件读写在 import-career-roadmap.mjs。
 *
 * 【语句顺序是硬约束，不要重排】
 *   SQLite 的 INSERT OR REPLACE 在命中 UNIQUE/PK 冲突时会先 DELETE 旧行再插入，
 *   而 DELETE 会触发 ON DELETE CASCADE（外键动作不是触发器，REPLACE 一样会激发）。
 *   即：REPLACE 一条 tracks 会连带清掉它的 track_levels → track_level_chapters →
 *   career_stage_reqs。因此必须严格按「父表 → 子表」的顺序重建：
 *     tracks → track_levels → career_paths → career_stages
 *            → track_level_chapters → career_stage_reqs
 *   叶子表放最后，保证前面的级联清理不会把刚写好的叶子行再抹掉。
 *   （代价：文件中途失败会留下半截数据，重跑即可收敛。）
 */

/** SQL 字符串字面量转义：单引号翻倍，剥掉 NUL 与控制字符（保留 \n \t） */
export const q = (s) =>
  `'${String(s ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/'/g, "''")}'`;

/** JSON 字段：序列化后按字符串字面量转义。中文不转义码点，保持可读 + UTF-8 落库 */
export const j = (v) => q(JSON.stringify(v ?? []));

const int = (v, dflt = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : dflt);

/** 1. tracks —— 能力路线主体 */
export function tracksSql(tracks) {
  return tracks.map(
    (t) =>
      `INSERT OR REPLACE INTO tracks (id, slug, title, subtitle, kind, icon, summary, sort, status) VALUES ` +
      `(${t._id}, ${q(t.slug)}, ${q(t.title)}, ${q(t.subtitle)}, ${q(t.kind)}, ${q(t.icon)}, ` +
      `${q(t.summary)}, ${int(t.sort)}, 'published');`,
  );
}

/** 2. track_levels —— 三级，outcomes / planned_chapters 落 JSON 列 */
export function trackLevelsSql(tracks) {
  const out = [];
  for (const t of tracks) {
    for (const l of t.levels) {
      out.push(
        `INSERT OR REPLACE INTO track_levels (id, track_id, level, name, goal, hours, outcomes, planned_chapters, sort) VALUES ` +
          `(${l._id}, ${t._id}, ${int(l.level)}, ${q(l.name)}, ${q(l.goal)}, ${int(l.hours)}, ` +
          `${j(l.outcomes)}, ${j(l.planned_chapters)}, ${int(l.level)});`,
      );
    }
  }
  return out;
}

/** 3. career_paths —— 岗位主体 */
export function careersSql(careers) {
  return careers.map(
    (c) =>
      `INSERT OR REPLACE INTO career_paths (id, slug, title, tagline, salary, demand, overview, daily_work, outputs, icon, sort, status) VALUES ` +
      `(${c._id}, ${q(c.slug)}, ${q(c.title)}, ${q(c.tagline)}, ${q(c.salary)}, ${q(c.demand)}, ` +
      `${q(c.overview)}, ${j(c.daily_work)}, ${j(c.outputs)}, ${q(c.icon)}, ${int(c.sort)}, 'published');`,
  );
}

/** 4. career_stages —— 成长阶段 */
export function careerStagesSql(careers) {
  const out = [];
  for (const c of careers) {
    for (const s of c.stages) {
      out.push(
        `INSERT OR REPLACE INTO career_stages (id, career_id, stage, title, duration, goal, milestone, interview_points, deliverables) VALUES ` +
          `(${s._id}, ${c._id}, ${int(s.stage)}, ${q(s.title)}, ${q(s.duration)}, ${q(s.goal)}, ` +
          `${q(s.milestone)}, ${j(s.interview_points)}, ${j(s.deliverables)});`,
      );
    }
  }
  return out;
}

/**
 * 5. track_level_chapters —— 等级 ↔ 章节 有序映射
 * chapter_id 是软引用（无外键，见 ADR-012 D4）。这里用 WHERE EXISTS 在写入侧兜底：
 * 校验阶段已经确认过 id 存在，但导入与内容重建之间仍可能有时间差，
 * 加这层保证「章节被删」时退化为不写入，而不是留下悬空行污染进度分母。
 */
export function trackLevelChaptersSql(tracks) {
  const out = [];
  for (const t of tracks) {
    for (const l of t.levels) {
      l.chapter_ids.forEach((cid, i) => {
        out.push(
          `INSERT OR REPLACE INTO track_level_chapters (level_id, chapter_id, sort) ` +
            `SELECT ${l._id}, ${cid}, ${i} ` +
            `WHERE EXISTS (SELECT 1 FROM chapters WHERE id = ${cid} AND status = 'published');`,
        );
      });
    }
  }
  return out;
}

/** 6. career_stage_reqs —— 阶段 → 能力等级 的需求边（路径图的边） */
export function careerStageReqsSql(careers) {
  const out = [];
  for (const c of careers) {
    for (const s of c.stages) {
      s.requirements.forEach((r, i) => {
        out.push(
          `INSERT OR REPLACE INTO career_stage_reqs (id, stage_id, level_id, importance, note, sort) VALUES ` +
            `(${r._id}, ${s._id}, ${r._levelId}, ${q(r.importance)}, ${q(r.note)}, ${i});`,
        );
      });
    }
  }
  return out;
}

/**
 * 组装完整语句序列。顺序见文件头注释，不要重排。
 * 末尾 content_version 自增，触发 worker 侧 L2 缓存整体换键（core/cache.ts）。
 */
export function buildStatements({ tracks, careers }) {
  return [
    // 本文件按父→子顺序写入，正常不触发延迟校验；保留以防 D1 把整份文件包进单事务。
    'PRAGMA defer_foreign_keys = on;',
    ...tracksSql(tracks),
    ...trackLevelsSql(tracks),
    ...careersSql(careers),
    ...careerStagesSql(careers),
    ...trackLevelChaptersSql(tracks),
    ...careerStageReqsSql(careers),
    `UPDATE platform_config SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version';`,
  ];
}

/** 按语句数 / 字节数切片，规避 D1 单次执行上限 */
export function splitStatements(stmts, maxStmts, maxBytes) {
  const parts = [];
  let cur = [];
  let bytes = 0;
  for (const s of stmts) {
    const n = Buffer.byteLength(s, 'utf8') + 1;
    if (cur.length && (cur.length + 1 > maxStmts || bytes + n > maxBytes)) {
      parts.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(s);
    bytes += n;
  }
  if (cur.length) parts.push(cur);
  return parts;
}
