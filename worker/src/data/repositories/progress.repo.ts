import type { DbSession } from '../db';

/**
 * 进度数据访问。身份标识来自登录会话（c.auth.sub），不再使用 localStorage UUID。
 * 幂等：event_id 为主键 + INSERT OR IGNORE；`changes` 为 0 表示当天该条目该状态已记过。
 * 依赖索引：idx_progress_anon_time / idx_progress_anon_item
 */

export type ItemType = 'chapter' | 'exercise' | 'quiz';
export type ItemStatus = 'done' | 'passed' | 'failed';

export interface ProgressEventRow {
  event_id: string;
  anon_id: string;
  item_type: string;
  item_id: string;
  status: string;
  payload: string;
  created_at: number;
}

export interface StatsDailyRow {
  anon_id: string;
  day: string;
  chapter_done: number;
  exercise_done: number;
  exercise_passed: number;
  quiz_done: number;
  updated_at: number;
}

export interface ProgressSummaryRow {
  item_type: string;
  status: string;
  n: number;
}

export interface ProgressEventInput {
  eventId: string;
  userId: string;
  itemType: ItemType;
  itemId: string;
  status: ItemStatus;
  payload?: unknown;
}

/** UTC 自然日；与 stats_daily.day 口径一致，避免时区导致今日统计漂移。 */
export const dayStr = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

/** 每日聚合的计数列：item_type + status 唯一决定一列，未覆盖组合返回 null（不计数）。 */
export function statsColumn(itemType: ItemType, status: ItemStatus): keyof StatsDailyRow | null {
  if (itemType === 'chapter') return 'chapter_done';
  if (itemType === 'quiz') return status === 'failed' ? null : 'quiz_done';
  if (itemType === 'exercise') return status === 'passed' ? 'exercise_passed' : 'exercise_done';
  return null;
}

export const progressRepo = {
  /** 写入事件；返回是否为新增（false = 幂等命中，已存在同 event_id）。 */
  async record(db: DbSession, e: ProgressEventInput): Promise<boolean> {
    const r = await db.run(
      `INSERT OR IGNORE INTO progress_events
         (event_id, anon_id, item_type, item_id, status, payload, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      e.eventId,
      e.userId,
      e.itemType,
      e.itemId,
      e.status,
      JSON.stringify(e.payload ?? {}),
      Date.now(),
    );
    return (r.meta?.changes ?? 0) > 0;
  },

  /**
   * 累加当日聚合。列名来自 statsColumn() 的封闭枚举，非用户输入，
   * 不构成 SQL 注入面（D1 不支持把列名做占位符绑定）。
   */
  bumpStats(db: DbSession, userId: string, col: keyof StatsDailyRow): Promise<D1Result> {
    const ts = Date.now();
    return db.run(
      `INSERT INTO stats_daily (anon_id, day, ${col}, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(anon_id, day) DO UPDATE SET ${col} = ${col} + 1, updated_at = ?3`,
      userId,
      dayStr(ts),
      ts,
    );
  },

  listByAnon: (db: DbSession, userId: string, limit = 50) =>
    db.all<ProgressEventRow>(
      `SELECT event_id, anon_id, item_type, item_id, status, payload, created_at
       FROM progress_events WHERE anon_id = ?1
       ORDER BY created_at DESC LIMIT ?2`,
      userId,
      limit,
    ),

  /** 全量汇总：按 (item_type, status) 分组计数，走 idx_progress_anon_item。 */
  summaryByAnon: (db: DbSession, userId: string) =>
    db.all<ProgressSummaryRow>(
      `SELECT item_type, status, COUNT(*) AS n
       FROM progress_events WHERE anon_id = ?1
       GROUP BY item_type, status`,
      userId,
    ),

  /** 已完成条目 id 清单（供前端标记"已读/已通过"），限 200 条防超量。 */
  completedItems: (db: DbSession, userId: string, itemType: ItemType) =>
    db.all<{ item_id: string; status: string }>(
      `SELECT item_id, MAX(status) AS status
       FROM progress_events WHERE anon_id = ?1 AND item_type = ?2
       GROUP BY item_id LIMIT 200`,
      userId,
      itemType,
    ),

  todayStats: (db: DbSession, userId: string) =>
    db.first<StatsDailyRow>(
      `SELECT anon_id, day, chapter_done, exercise_done, exercise_passed, quiz_done, updated_at
       FROM stats_daily WHERE anon_id = ?1 AND day = ?2`,
      userId,
      dayStr(Date.now()),
    ),
};
