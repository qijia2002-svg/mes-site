import type { DbSession } from '../db';

export interface CertRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  require_sql: number;
  require_quiz: number;
  status: string;
}

export const certRepo = {
  list: (db: DbSession, cursor = 0) =>
    db.all<CertRow>(
      `SELECT id, slug, title, description, require_sql, require_quiz, status
       FROM certifications WHERE status = 'published' AND id > ?1
       ORDER BY id LIMIT 100`,
      cursor,
    ),
};
