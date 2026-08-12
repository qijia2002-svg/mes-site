import type { DbSession } from '../db';

export interface LpRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  topic_ids: string;
  sort: number;
  status: string;
  stages: string;          // JSON: [{name, courses:[courseId]}]
  stage_unlock_type: string;
  stage_unlock_value: number;
}

export const lpRepo = {
  list: (db: DbSession, cursor = 0) =>
    db.all<LpRow>(
      `SELECT id, slug, title, description, topic_ids, sort, status,
              COALESCE(stages,'[]') as stages,
              COALESCE(stage_unlock_type,'all_prev') as stage_unlock_type,
              COALESCE(stage_unlock_value,0) as stage_unlock_value
       FROM learning_paths WHERE status = 'published' AND id > ?1
       ORDER BY sort, id LIMIT 100`,
      cursor,
    ),
  get: (db: DbSession, id: number) =>
    db.first<LpRow>(
      `SELECT id, slug, title, description, topic_ids, sort, status,
              COALESCE(stages,'[]') as stages,
              COALESCE(stage_unlock_type,'all_prev') as stage_unlock_type,
              COALESCE(stage_unlock_value,0) as stage_unlock_value
       FROM learning_paths WHERE id = ?1`,
      id,
    ),
};
