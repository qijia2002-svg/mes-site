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
  anonId: string;
  itemType: ItemType;
  itemId: string;
  status: ItemStatus;
  payload?: unknown;
}

/**
 * 前端语义 → 存储枚举的归一化表。
 *
 * 前端说的是"sql 练习 / 已读"（sql_exercise / read），库里存的是 exercise / done。
 * 不做这层映射的话，章节阅读和 SQL 通过两条上报路径会**全部被 400 挡掉**，
 * 而前端对进度上报失败是静默兜底的（catch 后不打断 UI）——今日统计会一直是 0
 * 且没有任何报错。归一化必须发生在 buildEventId 之前，否则 read/done 会算出
 * 两个不同的幂等键，同一次阅读被计两次。
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
const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** 匿名 id 白名单校验：只允许 URL-safe 字符，长度 8~64（F4 生成的是 uuid/nanoid）。 */
export function assertAnonId(v: string | null | undefined): string {
  if (!v || !ANON_ID_RE.test(v)) throw Err.schemaRejected('anon_id');
  return v;
}

/** 归一化入参（同时兼容 snake_case 与 camelCase 两种 body 风格）。 */
export function parseRecordInput(b: Record<string, unknown>): RecordProgressInput {
  const pick = (a: string, b2: string): string => {
    const v = (b as Record<string, unknown>)[a] ?? (b as Record<string, unknown>)[b2];
    return typeof v === 'string' ? v : '';
  };
  const anonId = assertAnonId(pick('anon_id', 'anonId'));
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

  return { anonId, itemType, itemId, status, payload: b.payload };
}

/**
 * 幂等键：同一匿名用户 + 同一条目 + 同一状态 + 同一自然日 = 同一事件。
 * 反复点"完成"不会把今日统计刷成 99（AC-06 要求今日数反映真实完成条目数）。
 */
export function buildEventId(i: RecordProgressInput, ts = Date.now()): string {
  return `${i.anonId}:${i.itemType}:${i.itemId}:${i.status}:${dayStr(ts)}`;
}

/** 记录一次学习事件；返回是否真正新增（重复上报 progressUpdated=false）。 */
export async function recordProgressSvc(c: Ctx, input: RecordProgressInput) {
  const eventId = buildEventId(input);
  const inserted = await progressRepo.record(c.db, { ...input, eventId });
  if (inserted) {
    const col = statsColumn(input.itemType, input.status);
    if (col) await progressRepo.bumpStats(c.db, input.anonId, col);
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

/** GET /api/v1/progress/today —— 首页"今日完成"卡片唯一数据源（F5）。 */
export async function todayProgressSvc(c: Ctx, anonId: string): Promise<TodayView> {
  const s = await progressRepo.todayStats(c.db, anonId);
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
export async function listProgressSvc(c: Ctx, anonId: string) {
  const [events, summary, today, chapters, exercises] = await Promise.all([
    progressRepo.listByAnon(c.db, anonId),
    progressRepo.summaryByAnon(c.db, anonId),
    todayProgressSvc(c, anonId),
    progressRepo.completedItems(c.db, anonId, 'chapter'),
    progressRepo.completedItems(c.db, anonId, 'exercise'),
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
    anonId,
    totals,
    today,
    // 前端据此在列表页标记"已读章节 / 已通过练习"，无需逐条查
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
