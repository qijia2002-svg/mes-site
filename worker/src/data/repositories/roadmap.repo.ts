import type { DbSession } from '../db';

/**
 * 职业路线图数据访问（ADR-012）。纯 SQL，无业务分支。
 *
 * 两条硬约束：
 * 1. 每个接口 ≤5 条语句（DbSession 上限 40，超限抛 5002）。因此所有「按 level / stage
 *    取明细」的查询一律**一次取全集**，由 service 在内存里分组，严禁循环调用本文件。
 * 2. progress_events.item_id 是 TEXT、chapters.id 是 INTEGER，比较必须 CAST，
 *    否则 SQLite 类型亲和性会静默返回空结果（schema §7 坑 2）。
 */

export interface TrackRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  summary: string;
  sort: number;
}

export interface LevelAggRow {
  track_id: number;
  level_id: number;
  level: number;
  name: string;
  goal: string;
  hours: number;
  chapter_count: number;
  planned_count: number;
}

export interface TrackLevelRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  summary: string;
  sort: number;
  level_id: number | null;
  level: number | null;
  level_name: string | null;
  goal: string | null;
  hours: number | null;
  outcomes: string | null;
  planned_chapters: string | null;
}

export interface LevelChapterRow {
  level_id: number;
  chapter_id: number;
  title: string;
  topic_id: number;
  sort: number;
}

export interface RelatedCareerRow {
  slug: string;
  title: string;
  icon: string;
  importance: string;
}

export interface CareerListRow {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  salary: string;
  demand: string;
  overview: string;
  icon: string;
  sort: number;
  stage_count: number;
  track_count: number;
}

export interface CareerRow {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  salary: string;
  demand: string;
  overview: string;
  daily_work: string;
  outputs: string;
  icon: string;
  sort: number;
}

export interface StageRow {
  id: number;
  stage: number;
  title: string;
  duration: string;
  goal: string;
  milestone: string;
  interview_points: string;
  deliverables: string;
}

export interface ReqRow {
  req_id: number;
  stage_id: number;
  importance: string;
  note: string;
  sort: number;
  level_id: number;
  level: number;
  level_name: string;
  hours: number;
  track_slug: string;
  track_title: string;
  track_icon: string;
  track_kind: string;
  /** tracks.sort，graph 的 level 节点按 (track_sort, level) 升序排列 */
  track_sort: number;
  total: number;
}

export interface DoneCountRow {
  level_id: number;
  done: number;
}

export interface DoneChapterRow {
  level_id: number;
  chapter_id: number;
}

/** 「该 level 下已发布章节数」子查询，进度分母。planned_chapters 不参与，永不进分母。 */
const PUBLISHED_TOTAL = `(SELECT COUNT(*) FROM track_level_chapters tlc
    JOIN chapters c ON c.id = tlc.chapter_id AND c.status = 'published'
   WHERE tlc.level_id = tl.id)`;

export const roadmapRepo = {
  // ---------------------------------------------------------------- tracks
  listTracks: (db: DbSession) =>
    db.all<TrackRow>(
      `SELECT id, slug, title, subtitle, kind, icon, summary, sort
         FROM tracks WHERE status = 'published'
        ORDER BY sort, id`,
    ),

  /** 全部已发布路线的三级聚合，一次取全集供内存分组（禁止按 track 循环） */
  listLevelAggs: (db: DbSession) =>
    db.all<LevelAggRow>(
      `SELECT tl.track_id                AS track_id,
              tl.id                      AS level_id,
              tl.level                   AS level,
              tl.name                    AS name,
              tl.goal                    AS goal,
              tl.hours                   AS hours,
              COUNT(c.id)                AS chapter_count,
              CASE WHEN json_valid(tl.planned_chapters)
                   THEN json_array_length(tl.planned_chapters) ELSE 0 END AS planned_count
         FROM track_levels tl
         JOIN tracks t ON t.id = tl.track_id AND t.status = 'published'
    LEFT JOIN track_level_chapters tlc ON tlc.level_id = tl.id
    LEFT JOIN chapters c ON c.id = tlc.chapter_id AND c.status = 'published'
        GROUP BY tl.id
        ORDER BY tl.track_id, tl.level`,
    ),

  /**
   * 路线详情骨架：LEFT JOIN 三级，一条语句同时拿到路线与等级。
   * 用 LEFT JOIN 而非 INNER，是为了让「存在但尚未建等级」的路线仍能返回行，
   * 否则 service 无法区分 404 与「有路线无等级」。
   */
  getTrackWithLevels: (db: DbSession, slug: string) =>
    db.all<TrackLevelRow>(
      `SELECT t.id, t.slug, t.title, t.subtitle, t.kind, t.icon, t.summary, t.sort,
              tl.id     AS level_id,
              tl.level  AS level,
              tl.name   AS level_name,
              tl.goal   AS goal,
              tl.hours  AS hours,
              tl.outcomes,
              tl.planned_chapters
         FROM tracks t
    LEFT JOIN track_levels tl ON tl.track_id = t.id
        WHERE t.slug = ?1 AND t.status = 'published'
        ORDER BY tl.level`,
      slug,
    ),

  /** 某路线全部等级的已发布章节，一次取全（悬空 / 草稿章节被 INNER JOIN 天然过滤） */
  listTrackChapters: (db: DbSession, trackId: number) =>
    db.all<LevelChapterRow>(
      `SELECT tlc.level_id, c.id AS chapter_id, c.title, c.topic_id, tlc.sort
         FROM track_level_chapters tlc
         JOIN track_levels tl ON tl.id = tlc.level_id
         JOIN chapters c ON c.id = tlc.chapter_id AND c.status = 'published'
        WHERE tl.track_id = ?1
        ORDER BY tlc.level_id, tlc.sort, c.id`,
      trackId,
    ),

  /** 反查该路线被哪些岗位要求（service 侧按岗位去重并取最强 importance） */
  listRelatedCareers: (db: DbSession, trackId: number) =>
    db.all<RelatedCareerRow>(
      `SELECT cp.slug, cp.title, cp.icon, csr.importance
         FROM career_stage_reqs csr
         JOIN track_levels tl ON tl.id = csr.level_id
         JOIN career_stages cs ON cs.id = csr.stage_id
         JOIN career_paths cp ON cp.id = cs.career_id AND cp.status = 'published'
        WHERE tl.track_id = ?1
        ORDER BY cp.sort, cp.id`,
      trackId,
    ),

  // ---------------------------------------------------------------- careers
  /** 列表页：stageCount 与 trackCount（去重路线数，不是需求边数）一条语句算完 */
  listCareers: (db: DbSession) =>
    db.all<CareerListRow>(
      `SELECT cp.id, cp.slug, cp.title, cp.tagline, cp.salary, cp.demand,
              cp.overview, cp.icon, cp.sort,
              COUNT(DISTINCT cs.id)       AS stage_count,
              COUNT(DISTINCT tl.track_id) AS track_count
         FROM career_paths cp
    LEFT JOIN career_stages cs ON cs.career_id = cp.id
    LEFT JOIN career_stage_reqs csr ON csr.stage_id = cs.id
    LEFT JOIN track_levels tl ON tl.id = csr.level_id
        WHERE cp.status = 'published'
        GROUP BY cp.id
        ORDER BY cp.sort, cp.id`,
    ),

  getCareerBySlug: (db: DbSession, slug: string) =>
    db.first<CareerRow>(
      `SELECT id, slug, title, tagline, salary, demand, overview,
              daily_work, outputs, icon, sort
         FROM career_paths WHERE slug = ?1 AND status = 'published'`,
      slug,
    ),

  listStages: (db: DbSession, careerId: number) =>
    db.all<StageRow>(
      `SELECT id, stage, title, duration, goal, milestone, interview_points, deliverables
         FROM career_stages WHERE career_id = ?1
        ORDER BY stage, id`,
      careerId,
    ),

  /** 该岗位全部需求边 + 路线/等级信息 + 进度分母，一条语句取全集 */
  listRequirements: (db: DbSession, careerId: number) =>
    db.all<ReqRow>(
      `SELECT csr.id         AS req_id,
              csr.stage_id   AS stage_id,
              csr.importance AS importance,
              csr.note       AS note,
              csr.sort       AS sort,
              tl.id          AS level_id,
              tl.level       AS level,
              tl.name        AS level_name,
              tl.hours       AS hours,
              t.slug         AS track_slug,
              t.title        AS track_title,
              t.icon         AS track_icon,
              t.kind         AS track_kind,
              ${PUBLISHED_TOTAL} AS total
         FROM career_stage_reqs csr
         JOIN career_stages cs ON cs.id = csr.stage_id
         JOIN track_levels tl ON tl.id = csr.level_id
         JOIN tracks t ON t.id = tl.track_id
        WHERE cs.career_id = ?1
        ORDER BY cs.stage, csr.sort, csr.id`,
      careerId,
    ),

  // ---------------------------------------------------------------- progress
  /**
   * 指定 level 集合的已完成章节数。**一条语句**覆盖全部 level，禁止按 level 循环。
   *
   * COUNT(DISTINCT c.id) 而非 COUNT(pe.event_id)：progress_events 按 event_id 去重，
   * 同一章节跨天重复上报会产生多行；用事件数当分子会让 done > total、percent > 100。
   * 口径是「已学章节数」，所以按章节去重。
   */
  doneCountByLevels: (db: DbSession, userId: string, levelIds: number[]) => {
    const ph = levelIds.map((_, i) => `?${i + 2}`).join(', ');
    return db.all<DoneCountRow>(
      `SELECT tlc.level_id AS level_id, COUNT(DISTINCT c.id) AS done
         FROM track_level_chapters tlc
         JOIN chapters c ON c.id = tlc.chapter_id AND c.status = 'published'
         JOIN progress_events pe
              ON  pe.anon_id   = ?1
              AND pe.item_type = 'chapter'
              AND pe.status    = 'done'
              AND pe.item_id   = CAST(c.id AS TEXT)
        WHERE tlc.level_id IN (${ph})
        GROUP BY tlc.level_id`,
      userId,
      ...levelIds,
    );
  },

  /** 某路线下已完成的 (level_id, chapter_id) 明细，供 chapters[].done 与逐级计数复用 */
  doneChaptersByTrack: (db: DbSession, userId: string, trackId: number) =>
    db.all<DoneChapterRow>(
      `SELECT tlc.level_id AS level_id, c.id AS chapter_id
         FROM track_level_chapters tlc
         JOIN track_levels tl ON tl.id = tlc.level_id
         JOIN chapters c ON c.id = tlc.chapter_id AND c.status = 'published'
         JOIN progress_events pe
              ON  pe.anon_id   = ?1
              AND pe.item_type = 'chapter'
              AND pe.status    = 'done'
              AND pe.item_id   = CAST(c.id AS TEXT)
        WHERE tl.track_id = ?2
        GROUP BY tlc.level_id, c.id`,
      userId,
      trackId,
    ),
};
