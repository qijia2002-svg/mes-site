import type { DbSession } from '../db';

export interface ProgressEventRow {
  event_id: string;
  user_id: string;
  type: string;
  ref_id: string;
  payload: string;
  created_at: number;
}

export interface StatsDailyRow {
  user_id: string;
  day: string;
  sql_done: number;
  quiz_done: number;
  practice_done: number;
  updated_at: number;
}

const dayStr = (ts: number) => new Date(ts).toISOString().slice(0, 10);

// 依赖索引：idx_progress_user
export const progressRepo = {
  record: (
    db: DbSession,
    e: { eventId: string; userId: string; type: string; refId?: string; payload?: unknown },
  ) =>
    db.run(
      `INSERT OR IGNORE INTO progress_events (event_id, user_id, type, ref_id, payload, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      e.eventId,
      e.userId,
      e.type,
      e.refId ?? '',
      JSON.stringify(e.payload ?? {}),
      Date.now(),
    ),

  bumpStats: (db: DbSession, userId: string, type: string) => {
    const day = dayStr(Date.now());
    const col =
      type === 'sql_done' ? 'sql_done' : type === 'quiz_done' ? 'quiz_done' : 'practice_done';
    return db.run(
      `INSERT INTO stats_daily (user_id, day, ${col}, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(user_id, day) DO UPDATE SET ${col} = ${col} + 1, updated_at = ?3`,
      userId,
      day,
      Date.now(),
    );
  },

  listByUser: (db: DbSession, userId: string) =>
    db.all<ProgressEventRow>(
      `SELECT event_id, user_id, type, ref_id, payload, created_at
       FROM progress_events WHERE user_id = ?1
       ORDER BY created_at DESC LIMIT 50`,
      userId,
    ),

  todayStats: (db: DbSession, userId: string) =>
    db.first<StatsDailyRow>(
      `SELECT user_id, day, sql_done, quiz_done, practice_done, updated_at
       FROM stats_daily WHERE user_id = ?1 AND day = ?2`,
      userId,
      dayStr(Date.now()),
    ),
};
