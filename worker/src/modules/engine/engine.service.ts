/**
 * 智造学院 · 学习引擎 v3
 *
 * 三层数据模型：
 *   L1 课程库 — topics 表（全局唯一，独立于路径）
 *   L2 学习记录 — progress_events（跨路径共享）
 *   L3 职业路径 — learning_paths（引用课程 + 阶段 + 前置规则）
 *
 * 6种课程状态：
 *   ✅ completed  本路径内完成
 *   ⭐ inherited  其他路径完成，自动继承
 *   🔄 doing      进行中
 *   🔒 locked     前置未完成（课程级或阶段级）
 *   ○ pending     待学习
 *   ⊘ skipped     继承后主动跳过
 */
import type { Ctx } from '../../core/context';
import type { ChapterRow } from '../../data/repositories/chapter.repo';
import { lpRepo } from '../../data/repositories/lp.repo';
import { chapterRepo } from '../../data/repositories/chapter.repo';
import { progressRepo } from '../../data/repositories/progress.repo';

// ─── 类型 ────────────────────────────────────────────────────

export type CourseStatus = 'completed' | 'inherited' | 'doing' | 'locked' | 'pending' | 'skipped';

export interface CourseState {
  courseId: number; name: string; slug: string; modules: string[];
  difficulty: string; estimatedHours: number;
  status: CourseStatus; sourcePath?: string;
  chapterDone?: number; totalChapters: number; percent: number;
  missingPrerequisites: string[];
  stageName?: string; stageIndex?: number; // 所在阶段
}

export interface StageSummary {
  name: string; courseCount: number; doneCount: number;
  unlocked: boolean; pct: number;
}

export interface PathSummary {
  pathId: number; name: string; slug: string; description: string;
  stages: StageSummary[];
  inheritedCount: number; newCount: number; totalCount: number;
  completion: number;
  savedHours: number; // 继承节省的课时
}

export interface InheritanceBanner {
  show: boolean;
  inheritedCount: number;
  savedHours: number;
  sourcePathName?: string;
}

export interface EngineStatus {
  activePath: number | null; completion: number;
  nextCourse: CourseState | null; courses: CourseState[];
  paths: PathSummary[];
  banner: InheritanceBanner;
}

export interface EngineStatusBody {
  activePath?: number; selectedPaths?: number[];
  skippedCourseIds?: number[]; // 用户主动跳过的课程
}

// ─── 工具 ────────────────────────────────────────────────────

function parseIds(s: string): number[] {
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.filter((x): x is number => typeof x === 'number') : []; }
  catch { return []; }
}
function parseModules(s: string): string[] {
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []; }
  catch { return []; }
}
function parseStages(s: string): { name: string; courses: number[] }[] {
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

class ChapterCache {
  cache = new Map<number, ChapterRow[]>();
  constructor(private db: Ctx['db']) {}
  async get(tid: number): Promise<ChapterRow[]> {
    if (this.cache.has(tid)) return this.cache.get(tid)!;
    const rows = await chapterRepo.listByTopic(this.db, tid);
    this.cache.set(tid, rows);
    return rows;
  }
  async preload(tids: number[]): Promise<void> {
    await Promise.all([...new Set(tids)].map(id => this.get(id)));
  }
}

interface TopicInfo {
  id: number; slug: string; title: string; modules: string[];
  prerequisites: number[]; difficulty: string; estimatedHours: number;
}

type TopicDoneMap = Map<number, { allDone: boolean }>;

// ─── 单课程状态计算（6种状态） ──

function computeCourseState(
  topic: TopicInfo,
  chapters: ChapterRow[],
  completedChapterIds: Set<string>,
  skippedIds: Set<number>,
  firstPathName: string | undefined,
  currentPathName: string,
  allTopics: Map<number, TopicInfo>,
  topicDoneMap: TopicDoneMap,
  stageUnlocked: boolean,
): { status: CourseStatus; sourcePath?: string; chapterDone: number; percent: number; missingPrerequisites: string[] } {

  let chapterDone = 0;
  for (const ch of chapters) {
    if (completedChapterIds.has(String(ch.id))) chapterDone++;
  }
  const totalChapters = chapters.length;
  const allDone = totalChapters > 0 && chapterDone >= totalChapters;
  const isDoing = chapterDone > 0 && chapterDone < totalChapters;
  const percent = totalChapters > 0 ? Math.round((chapterDone / totalChapters) * 100) : 0;

  // 1. 已完成（本路径）
  if (allDone) {
    if (firstPathName && firstPathName !== currentPathName) {
      // 在其他路径完成的 → 检查是否已跳过
      if (skippedIds.has(topic.id)) {
        return { status: 'skipped', sourcePath: firstPathName, chapterDone, percent, missingPrerequisites: [] };
      }
      return { status: 'inherited', sourcePath: firstPathName, chapterDone, percent, missingPrerequisites: [] };
    }
    return { status: 'completed', chapterDone, percent, missingPrerequisites: [] };
  }

  // 2. 进行中
  if (isDoing) {
    return { status: 'doing', chapterDone, percent, missingPrerequisites: [] };
  }

  // 3. 阶段未解锁
  if (!stageUnlocked) {
    return { status: 'locked', chapterDone, percent, missingPrerequisites: ['当前阶段未解锁'] };
  }

  // 4. 课程级前置依赖检查
  const missing: string[] = [];
  for (const preId of topic.prerequisites) {
    const preTopic = allTopics.get(preId);
    if (!preTopic) continue;
    const td = topicDoneMap.get(preId);
    if (td && !td.allDone) {
      missing.push(preTopic.title);
    }
  }
  if (missing.length > 0) {
    return { status: 'locked', chapterDone, percent, missingPrerequisites: missing };
  }

  // 5. 待学习
  return { status: 'pending', chapterDone, percent, missingPrerequisites: [] };
}

// ─── 主计算入口 ─────────────────────────────────────────────

export async function computeEngineStatus(c: Ctx, body: EngineStatusBody): Promise<EngineStatus> {
  const userId = c.auth?.sub;
  const activePathId = body.activePath ?? null;
  const selectedPathIds = body.selectedPaths ?? [];
  const skippedIds = new Set(body.skippedCourseIds ?? []);

  const chapterCache = new ChapterCache(c.db);

  // ── L1: 加载全部数据 ──
  const allLpRows = await lpRepo.list(c.db);
  const targetPaths = selectedPathIds.length > 0
    ? allLpRows.filter(r => selectedPathIds.includes(r.id))
    : allLpRows;

  const allTopicIds = new Set<number>();
  const pathTopics = new Map<number, number[]>();
  const pathStages = new Map<number, { name: string; courses: number[] }[]>();
  for (const lp of targetPaths) {
    const tids = parseIds(lp.topic_ids);
    pathTopics.set(lp.id, tids);
    pathStages.set(lp.id, parseStages(lp.stages));
    for (const tid of tids) allTopicIds.add(tid);
  }

  // 加载所有话题 + 章节
  const allTopics = new Map<number, TopicInfo>();
  for (const tid of allTopicIds) {
    const t = await chapterRepo.getTopicById(c.db, tid);
    if (t) {
      allTopics.set(tid, {
        id: t.id, slug: t.slug, title: t.title, modules: parseModules(t.modules),
        prerequisites: parseIds(t.prerequisites),
        difficulty: t.difficulty || 'beginner',
        estimatedHours: t.estimated_hours || 4,
      });
    }
  }
  await chapterCache.preload([...allTopicIds]);

  // ── L2: 用户进度 ──
  const completedChapterIds = new Set<string>();
  if (userId) {
    const items = await progressRepo.completedItems(c.db, userId, 'chapter');
    for (const item of items) completedChapterIds.add(item.item_id);
  }

  // 预计算 done/allDone
  const topicDoneMap = new Map<number, { allDone: boolean }>();
  for (const tid of allTopicIds) {
    const chs = await chapterCache.get(tid);
    let cd = 0;
    for (const ch of chs) if (completedChapterIds.has(String(ch.id))) cd++;
    topicDoneMap.set(tid, { allDone: chs.length > 0 && cd >= chs.length });
  }

  // ── 首次完成路径映射（用于继承检测） ──
  const topicFirstPath = new Map<number, string>();
  for (const lp of targetPaths) {
    const tids = pathTopics.get(lp.id) ?? [];
    for (const tid of tids) {
      if (!topicFirstPath.has(tid)) topicFirstPath.set(tid, lp.title);
    }
  }

  // ── L3: 计算路径状态 ──
  const pathSummaries: PathSummary[] = [];

  for (const lp of targetPaths) {
    const tids = pathTopics.get(lp.id) ?? [];
    const stages = pathStages.get(lp.id) ?? [];
    let pathDone = 0, pathInherited = 0, pathSavedHours = 0;
    const stageSummaries: StageSummary[] = [];

    // 如果路径有定义 stages，用阶段模式；否则扁平化
    const hasStages = stages.length > 0;
    const effectiveTids = hasStages
      ? stages.flatMap(s => s.courses)
      : tids;

    if (hasStages) {
      let prevStageAllDone = true;
      for (let si = 0; si < stages.length; si++) {
        const stage = stages[si];
        let sDone = 0;
        for (const cid of stage.courses) {
          const td = topicDoneMap.get(cid);
          if (td && td.allDone) sDone++;
        }
        const unlocked = si === 0 || prevStageAllDone;
        stageSummaries.push({
          name: stage.name,
          courseCount: stage.courses.length,
          doneCount: sDone,
          unlocked,
          pct: stage.courses.length > 0 ? Math.round((sDone / stage.courses.length) * 100) : 0,
        });
        prevStageAllDone = sDone >= stage.courses.length;
      }
    }

    // 逐课程计算
    const courses: CourseState[] = [];
    for (let i = 0; i < effectiveTids.length; i++) {
      const tid = effectiveTids[i];
      const topic = allTopics.get(tid);
      if (!topic) continue;

      const chapters = await chapterCache.get(tid);

      // 判断阶段是否解锁
      let stageUnlocked = true;
      let stageInfo: { name?: string; index?: number } = {};
      if (hasStages) {
        for (let si = 0; si < stages.length; si++) {
          if (stages[si].courses.includes(tid)) {
            stageInfo = { name: stages[si].name, index: si };
            stageUnlocked = stageSummaries[si]?.unlocked ?? false;
            break;
          }
        }
      }

      const result = computeCourseState(
        topic, chapters, completedChapterIds, skippedIds,
        topicFirstPath.get(tid), lp.title, allTopics, topicDoneMap, stageUnlocked,
      );

      if (result.status === 'completed' || result.status === 'inherited') {
        pathDone++;
        if (result.status === 'inherited') {
          pathInherited++;
          pathSavedHours += topic.estimatedHours;
        }
      }

      courses.push({
        courseId: tid, name: topic.title, slug: topic.slug,
        modules: topic.modules, difficulty: topic.difficulty, estimatedHours: topic.estimatedHours,
        status: result.status, sourcePath: result.sourcePath,
        chapterDone: result.chapterDone, totalChapters: chapters.length, percent: result.percent,
        missingPrerequisites: result.missingPrerequisites,
        stageName: stageInfo.name, stageIndex: stageInfo.index,
      });
    }

    pathSummaries.push({
      pathId: lp.id, name: lp.title, slug: lp.slug, description: lp.description,
      stages: stageSummaries,
      inheritedCount: pathInherited, newCount: courses.length - pathDone,
      totalCount: courses.length,
      completion: courses.length > 0 ? Math.round((pathDone / courses.length) * 100) : 0,
      savedHours: pathSavedHours,
    });
  }

  // ── Active path 数据 ──
  const activePathSummary = activePathId
    ? pathSummaries.find(p => p.pathId === activePathId)
    : pathSummaries[0];

  const activeLp = activePathSummary
    ? targetPaths.find(lp => lp.id === activePathSummary.pathId)
    : targetPaths[0];

  let activeCourses: CourseState[] = [];
  let activeCompletion = 0;
  let activeNext: CourseState | null = null;

  if (activeLp) {
    const stages = pathStages.get(activeLp.id) ?? [];
    const hasStages = stages.length > 0;
    const effectiveTids = hasStages ? stages.flatMap(s => s.courses) : (pathTopics.get(activeLp.id) ?? []);
    const stageSummaries = activePathSummary?.stages ?? [];

    for (let i = 0; i < effectiveTids.length; i++) {
      const tid = effectiveTids[i];
      const topic = allTopics.get(tid);
      if (!topic) continue;
      const chapters = await chapterCache.get(tid);
      let stageUnlocked = true;
      let stageInfo: { name?: string; index?: number } = {};
      if (hasStages) {
        for (let si = 0; si < stages.length; si++) {
          if (stages[si].courses.includes(tid)) {
            stageInfo = { name: stages[si].name, index: si };
            stageUnlocked = stageSummaries[si]?.unlocked ?? false;
            break;
          }
        }
      }
      const result = computeCourseState(
        topic, chapters, completedChapterIds, skippedIds,
        topicFirstPath.get(tid), activeLp.title, allTopics, topicDoneMap, stageUnlocked,
      );
      activeCourses.push({
        courseId: tid, name: topic.title, slug: topic.slug,
        modules: topic.modules, difficulty: topic.difficulty, estimatedHours: topic.estimatedHours,
        status: result.status, sourcePath: result.sourcePath,
        chapterDone: result.chapterDone, totalChapters: chapters.length, percent: result.percent,
        missingPrerequisites: result.missingPrerequisites,
        stageName: stageInfo.name, stageIndex: stageInfo.index,
      });
    }
    activeCompletion = activePathSummary?.completion ?? 0;
    activeNext = activeCourses.find(c => c.status === 'doing' || c.status === 'pending') ?? activeCourses[0] ?? null;
  }

  // ── 继承横幅 ──
  const banner: InheritanceBanner = {
    show: false, inheritedCount: 0, savedHours: 0,
  };
  if (activePathSummary && activePathSummary.inheritedCount > 0) {
    banner.show = true;
    banner.inheritedCount = activePathSummary.inheritedCount;
    banner.savedHours = activePathSummary.savedHours;
    // 找来源路径名
    const inherited = activeCourses.find(c => c.status === 'inherited');
    if (inherited?.sourcePath) banner.sourcePathName = inherited.sourcePath;
  }

  return {
    activePath: activePathId,
    completion: activeCompletion,
    nextCourse: activeNext,
    courses: activeCourses,
    paths: pathSummaries,
    banner,
  };
}
