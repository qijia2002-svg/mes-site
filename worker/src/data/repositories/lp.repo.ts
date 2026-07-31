import type { DbSession } from '../db';

export interface LpRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  topic_ids: string; // JSON 数组
  sort: number;
  status: string;
}

// 依赖索引：idx_lp_sort
export const lpRepo = {
  list: (db: DbSession, cursor = 0) =>
    db.all<LpRow>(
      `SELECT id, slug, title, description, topic_ids, sort, status
       FROM learning_paths WHERE status = 'published' AND id > ?1
       ORDER BY id LIMIT 100`,
      cursor,
    ),
  get: (db: DbSession, id: number) =>
    db.first<LpRow>(
      `SELECT id, slug, title, description, topic_ids, sort, status
       FROM learning_paths WHERE id = ?1`,
      id,
    ),
};
