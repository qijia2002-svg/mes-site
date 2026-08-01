import type { Ctx } from '../../core/context';
import { Err } from '../../core/errors';
import {
  progressRepo,
  statsColumn,
  dayStr,
  type ItemType,
  type ItemStatus,
} from '../../data/repositories/progress.repo';

export interface RecordProgressInput {
  userId: string;
  itemType: ItemType;
  itemId: string;
  status: ItemStatus;
  payload?: unknown;
}

/**
 * 前端语义 → 存储枚举的归一化表。
 */
const ITEM_TYPE_ALIAS: Readonly<Record<string, ItemType>> = {
  chapter: 'chapter',
  exercise: 'exercise',
  sql_exercise: 'exercise',
  sqlExercise: 'exercise',
  quiz: 'quiz',
};
const STATUS_ALIAS: Readonly<Record<string, ItemStatus>> = {
  done: 'done',
  read: 'done',
  passed: 'passed',
  failed: 'failed',
};

/** 归一化入参（同时兼容 snake_case 与 camelCase 两种 body 风格）。userId 由路由层从会话中提取。 */
export function parseRecordInput(userId: string, b: Record<string, unknown>): RecordProgressInput {
  const pick = (a: string, b2: string): string => {
    const v = (b as Record<string, unknown>)[a] ?? (b as Record<string, unknown>)[b2];
    return typeof v === 'string' ? v : '';
  };
  const itemTypeRaw = pick('item_type', 'itemType');
  const itemIdRaw = (b.item_id ?? b.itemId) as unknown;
  const itemId =
    typeof itemIdRaw === 'number' ? String(itemIdRaw) : typeof itemIdRaw === 'string' ? itemIdRaw : '';
  const statusRaw = (typeof b.status === 'string' ? b.status : '') || 'done';

  const itemType = ITEM_TYPE_ALIAS[itemTypeRaw];
  if (!itemType) throw Err.schemaRejected('item_type');
  const status = STATUS_ALIAS[statusRaw];
  if (!status) throw Err.schemaRejected('status');
  if (!itemId || itemId.length > 64) throw Err.schemaRejected('item_id');

  return { userId, itemType, itemId, status, payload: b.payload };
}

/**
 * 幂等键：同一用户 + 同一条目 + 同一状态 + 同一自然日 = 同一事件。
 */
export function buildEventId(i: RecordProgressInput, ts = Date.now()): string {
  return `${i.userId}:${i.itemType}:${i.itemId}:${i.status}:${dayStr(ts)}`;
}

/** 记录一次学习事件；返回是否真正新增（重复上报 progressUpdated=false）。 */
export async function recordProgressSvc(c: Ctx, input: RecordProgressInput) {
  const eventId = buildEventId(input);
  const inserted = await progressRepo.record(c.db, { ...input, eventId });
  if (inserted) {
    const col = statsColumn(input.itemType, input.status);
    if (col) await progressRepo.bumpStats(c.db, input.userId, col);
  }
  return { ok: true, eventId, progressUpdated: inserted };
}

export interface TodayView {
  day: string;
  chapterDone: number;
  exerciseDone: number;
  exercisePassed: number;
  quizDone: number;
  total: number;
}

function emptyToday(): TodayView {
  return {
    day: dayStr(Date.now()),
    chapterDone: 0,
    exerciseDone: 0,
    exercisePassed: 0,
    quizDone: 0,
    total: 0,
  };
}

/** GET /api/v1/progress/today —— 首页"今日完成"卡片唯一数据源。 */
export async function todayProgressSvc(c: Ctx, userId: string): Promise<TodayView> {
  const s = await progressRepo.todayStats(c.db, userId);
  if (!s) return emptyToday();
  return {
    day: s.day,
    chapterDone: s.chapter_done,
    exerciseDone: s.exercise_done,
    exercisePassed: s.exercise_passed,
    quizDone: s.quiz_done,
    total: s.chapter_done + s.exercise_done + s.exercise_passed + s.quiz_done,
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** GET /api/v1/progress —— 汇总 + 近 50 条事件 + 已完成条目清单。 */
export async function listProgressSvc(c: Ctx, userId: string) {
  const [events, summary, today, chapters, exercises] = await Promise.all([
    progressRepo.listByAnon(c.db, userId),
    progressRepo.summaryByAnon(c.db, userId),
    todayProgressSvc(c, userId),
    progressRepo.completedItems(c.db, userId, 'chapter'),
    progressRepo.completedItems(c.db, userId, 'exercise'),
  ]);

  const totals = { chapterDone: 0, exerciseDone: 0, exercisePassed: 0, quizDone: 0 };
  for (const r of summary) {
    if (r.item_type === 'chapter') totals.chapterDone += r.n;
    else if (r.item_type === 'quiz' && r.status !== 'failed') totals.quizDone += r.n;
    else if (r.item_type === 'exercise') {
      if (r.status === 'passed') totals.exercisePassed += r.n;
      else totals.exerciseDone += r.n;
    }
  }

  return {
    userId,
    totals,
    today,
    completedChapterIds: chapters.map((r) => r.item_id),
    passedExerciseIds: exercises.filter((r) => r.status === 'passed').map((r) => r.item_id),
    events: events.map((e) => ({
      eventId: e.event_id,
      itemType: e.item_type,
      itemId: e.item_id,
      status: e.status,
      payload: safeParse(e.payload),
      createdAt: e.created_at,
    })),
  };
}
