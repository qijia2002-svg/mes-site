import type { Ctx } from '../../core/context';
import { Err } from '../../core/errors';
import { progressRepo } from '../../data/repositories/progress.repo';

export interface RecordProgressInput {
  eventId: string;
  userId: string;
  type: string;
  refId?: string;
  payload?: unknown;
}

const VALID_TYPES = ['sql_done', 'quiz_done', 'practice_done'] as const;

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Phase 0.5：记录一次学习事件（幂等），并 UPSERT 当日聚合。 */
export async function recordProgressSvc(c: Ctx, input: RecordProgressInput) {
  if (!(VALID_TYPES as readonly string[]).includes(input.type)) throw Err.schemaRejected('type');
  await progressRepo.record(c.db, input);
  await progressRepo.bumpStats(c.db, input.userId, input.type);
  return { ok: true };
}

export async function listProgressSvc(c: Ctx, userId: string) {
  const events = await progressRepo.listByUser(c.db, userId);
  const stats = await progressRepo.todayStats(c.db, userId);
  return {
    events: events.map((e) => ({
      eventId: e.event_id,
      type: e.type,
      refId: e.ref_id,
      payload: safeParse(e.payload),
      createdAt: e.created_at,
    })),
    today: stats
      ? { sqlDone: stats.sql_done, quizDone: stats.quiz_done, practiceDone: stats.practice_done }
      : { sqlDone: 0, quizDone: 0, practiceDone: 0 },
  };
}
