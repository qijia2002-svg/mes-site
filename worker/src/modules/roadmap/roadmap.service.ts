import type { Ctx } from '../../core/context';
import { roadmapRepo, type LevelAggRow, type TrackLevelRow, type LevelChapterRow, type RelatedCareerRow, type CareerListRow, type CareerRow, type StageRow, type ReqRow } from '../../data/repositories/roadmap.repo';
import { getContentVersion, cachedJson, contentCacheKey, maxImportance, parseStrArray, parsePlanned, buildProgress, clone, type Progress } from './roadmap.shared';

/**
 * 职业路线图：tracks / careers 的 DTO 组装 + L2 缓存（ADR-012 / API §0.3）。
 *
 * 缓存策略分两类：
 *  - 无进度的列表接口（/tracks、/careers）整体缓存，键 cv{v}:{path}。
 *  - 含 per-user 进度的详情接口（/tracks/:slug、/careers/:slug）缓存「骨架」，
 *    进度在缓存之外逐请求叠加。整体缓存会把 A 的进度发给 B（API §5 明确禁止）。
 *
 * D1 语句预算（API §0.4）：每条接口冷缓存 ≤5 条，严禁按 level/stage 循环查库。
 */

// ---------------------------------------------------------------- /tracks
export interface TrackLevelItem {
  level: number;
  name: string;
  goal: string;
  hours: number;
  chapterCount: number;
  plannedCount: number;
  hasContent: boolean;
}
export interface TrackListItem {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  summary: string;
  sort: number;
  chapterTotal: number;
  levels: TrackLevelItem[];
}

export async function listTracksSvc(c: Ctx) {
  const cv = await getContentVersion(c);
  return cachedJson(contentCacheKey('tracks', cv), 300, async () => {
    const tracks = await roadmapRepo.listTracks(c.db);
    const aggs = await roadmapRepo.listLevelAggs(c.db);
    const byTrack = new Map<number, LevelAggRow[]>();
    for (const a of aggs) {
      const arr = byTrack.get(a.track_id) ?? [];
      arr.push(a);
      byTrack.set(a.track_id, arr);
    }
    const items: TrackListItem[] = tracks.map((t) => {
      const ls = byTrack.get(t.id) ?? [];
      const levels: TrackLevelItem[] = [];
      for (let L = 1; L <= 3; L++) {
        const a = ls.find((x) => x.level === L) ?? null;
        const chapterCount = a?.chapter_count ?? 0;
        levels.push({
          level: L,
          name: a?.name ?? `L${L}`,
          goal: a?.goal ?? '',
          hours: a?.hours ?? 0,
          chapterCount,
          plannedCount: a?.planned_count ?? 0,
          hasContent: chapterCount > 0,
        });
      }
      const chapterTotal = levels.reduce((s, l) => s + l.chapterCount, 0);
      return {
        id: t.id, slug: t.slug, title: t.title, subtitle: t.subtitle,
        kind: t.kind, icon: t.icon, summary: t.summary, sort: t.sort,
        chapterTotal, levels,
      };
    });
    return { items, total: items.length };
  });
}

// ---------------------------------------------------------------- /tracks/:slug
export interface TrackChapter { id: number; title: string; topicId: number; sort: number; done: boolean; }
export interface TrackDetailLevel {
  level: number;
  name: string;
  goal: string;
  hours: number;
  outcomes: string[];
  chapters: TrackChapter[];
  plannedChapters: { title: string; desc: string }[];
  progress: Progress;
}
export interface RelatedCareer { slug: string; title: string; icon: string; importance: string; }
export interface TrackDetailData {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  summary: string;
  sort: number;
  authenticated: boolean;
  levels: TrackDetailLevel[];
  relatedCareers: RelatedCareer[];
}

export async function getTrackSvc(c: Ctx, slug: string): Promise<TrackDetailData | null> {
  const cv = await getContentVersion(c);
  const skeleton = await cachedJson(contentCacheKey(`tracks/${slug}`, cv), 300, async () => {
    const rows = await roadmapRepo.getTrackWithLevels(c.db, slug);
    if (rows.length === 0) return null;
    const t = rows[0];
    const chapters = await roadmapRepo.listTrackChapters(c.db, t.id);
    const related = await roadmapRepo.listRelatedCareers(c.db, t.id);

    const chaptersByLevel = new Map<number, LevelChapterRow[]>();
    for (const ch of chapters) {
      const arr = chaptersByLevel.get(ch.level_id) ?? [];
      arr.push(ch);
      chaptersByLevel.set(ch.level_id, arr);
    }

    const levels: TrackDetailLevel[] = [];
    for (let L = 1; L <= 3; L++) {
      const row: TrackLevelRow | undefined = rows.find((r) => r.level_id != null && r.level === L);
      const lvlChapters = row ? (chaptersByLevel.get(row.level_id as number) ?? []) : [];
      levels.push({
        level: L,
        name: row?.level_name ?? `L${L}`,
        goal: row?.goal ?? '',
        hours: row?.hours ?? 0,
        outcomes: parseStrArray(row?.outcomes),
        chapters: lvlChapters.map((ch) => ({
          id: ch.chapter_id, title: ch.title, topicId: ch.topic_id, sort: ch.sort, done: false,
        })),
        plannedChapters: parsePlanned(row?.planned_chapters),
        progress: buildProgress(0, lvlChapters.length),
      });
    }

    // 反查岗位：按路线整体去重，importance 取最强（core > important > optional）
    const relMap = new Map<string, RelatedCareer>();
    for (const r of related as RelatedCareerRow[]) {
      const ex = relMap.get(r.slug);
      if (!ex) relMap.set(r.slug, { slug: r.slug, title: r.title, icon: r.icon, importance: r.importance });
      else ex.importance = maxImportance(ex.importance, r.importance);
    }

    return {
      id: t.id, slug: t.slug, title: t.title, subtitle: t.subtitle,
      kind: t.kind, icon: t.icon, summary: t.summary, sort: t.sort,
      levels, relatedCareers: [...relMap.values()],
    };
  });

  if (!skeleton) return null;

  const authenticated = !!c.auth;
  const doneSet = new Set<number>();
  if (authenticated) {
    // 一条语句取该路线全部已学章节；chapter_ids 全局唯一（_verify-roadmap 校验），按 chapter_id 去重即可
    const done = await roadmapRepo.doneChaptersByTrack(c.db, c.auth!.sub, skeleton.id);
    for (const d of done) doneSet.add(d.chapter_id);
  }

  const data = clone(skeleton);
  data.levels = data.levels.map((lvl) => {
    let doneCount = 0;
    const chapters = lvl.chapters.map((ch) => {
      const isDone = doneSet.has(ch.id);
      if (isDone) doneCount++;
      return { ...ch, done: isDone };
    });
    return { ...lvl, chapters, progress: buildProgress(doneCount, chapters.length) };
  });
  return { ...data, authenticated };
}

// ---------------------------------------------------------------- /careers
export interface CareerListItem {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  salary: string;
  demand: string;
  overview: string;
  icon: string;
  sort: number;
  stageCount: number;
  trackCount: number;
}

export async function listCareersSvc(c: Ctx) {
  const cv = await getContentVersion(c);
  return cachedJson(contentCacheKey('careers', cv), 300, async () => {
    const rows = await roadmapRepo.listCareers(c.db);
    const items: CareerListItem[] = rows.map((r: CareerListRow) => ({
      id: r.id, slug: r.slug, title: r.title, tagline: r.tagline,
      salary: r.salary, demand: r.demand, overview: r.overview,
      icon: r.icon, sort: r.sort, stageCount: r.stage_count, trackCount: r.track_count,
    }));
    return { items, total: items.length };
  });
}

// ---------------------------------------------------------------- /careers/:slug
export interface CareerRequirement {
  trackSlug: string;
  trackTitle: string;
  trackIcon: string;
  level: number;
  levelName: string;
  importance: string;
  note: string;
  progress: Progress;
}
export interface CareerStage {
  stage: number;
  title: string;
  duration: string;
  goal: string;
  milestone: string;
  interviewPoints: string[];
  deliverables: string[];
  requirements: CareerRequirement[];
}
export interface CareerSummary { chapterDone: number; chapterTotal: number; percent: number; }
export interface CareerDetailData {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  salary: string;
  demand: string;
  overview: string;
  icon: string;
  authenticated: boolean;
  dailyWork: string[];
  outputs: string[];
  stages: CareerStage[];
  summary: CareerSummary;
}

export async function getCareerSvc(c: Ctx, slug: string): Promise<CareerDetailData | null> {
  const cv = await getContentVersion(c);
  const skeleton = await cachedJson(contentCacheKey(`careers/${slug}`, cv), 300, async () => {
    const career = await roadmapRepo.getCareerBySlug(c.db, slug);
    if (!career) return null;
    const stages = await roadmapRepo.listStages(c.db, career.id);
    const reqs = await roadmapRepo.listRequirements(c.db, career.id);

    const reqsByStage = new Map<number, ReqRow[]>();
    const uniqueTotals = new Map<number, number>(); // level_id -> 分母（去重）
    for (const r of reqs) {
      const arr = reqsByStage.get(r.stage_id) ?? [];
      arr.push(r);
      reqsByStage.set(r.stage_id, arr);
      uniqueTotals.set(r.level_id, r.total);
    }

    const stageList: CareerStage[] = stages.map((s: StageRow) => ({
      stage: s.stage,
      title: s.title,
      duration: s.duration,
      goal: s.goal,
      milestone: s.milestone,
      interviewPoints: parseStrArray(s.interview_points),
      deliverables: parseStrArray(s.deliverables),
      requirements: (reqsByStage.get(s.id) ?? []).map((r) => ({
        trackSlug: r.track_slug,
        trackTitle: r.track_title,
        trackIcon: r.track_icon,
        level: r.level,
        levelName: r.level_name,
        importance: r.importance,
        note: r.note,
        // 内部字段：叠加进度时用，返回前剔除
        _levelId: r.level_id,
        _total: r.total,
        progress: buildProgress(0, r.total),
      })),
    }));

    const chapterTotal = [...uniqueTotals.values()].reduce((a, b) => a + b, 0);
    return {
      id: career.id, slug: career.slug, title: career.title, tagline: career.tagline,
      salary: career.salary, demand: career.demand, overview: career.overview, icon: career.icon,
      dailyWork: parseStrArray(career.daily_work),
      outputs: parseStrArray(career.outputs),
      stages: stageList,
      summary: { chapterDone: 0, chapterTotal, percent: 0 },
    };
  });

  if (!skeleton) return null;

  const authenticated = !!c.auth;
  type InternalReq = CareerRequirement & { _levelId: number; _total: number };
  const uniqueLevelIds: number[] = [];
  for (const st of skeleton.stages) for (const r of st.requirements as unknown as InternalReq[]) {
    if (!uniqueLevelIds.includes(r._levelId)) uniqueLevelIds.push(r._levelId);
  }
  const doneMap = new Map<number, number>();
  if (authenticated) {
    const done = await roadmapRepo.doneCountByLevels(c.db, c.auth!.sub, uniqueLevelIds);
    for (const d of done) doneMap.set(d.level_id, d.done);
  }

  const data = clone(skeleton);
  let chapterDone = 0;
  data.stages = data.stages.map((st) => ({
    ...st,
    requirements: (st.requirements as unknown as InternalReq[]).map((r) => {
      const done = doneMap.get(r._levelId) ?? 0;
      const { _levelId, _total, ...clean } = r;
      void _levelId; void _total;
      return { ...clean, progress: buildProgress(done, r._total) };
    }),
  }));
  for (const id of uniqueLevelIds) chapterDone += doneMap.get(id) ?? 0;
  const chapterTotal = data.summary.chapterTotal;
  data.summary = { chapterDone, chapterTotal, percent: chapterTotal === 0 ? 0 : Math.round((chapterDone / chapterTotal) * 100) };
  return { ...data, authenticated };
}
