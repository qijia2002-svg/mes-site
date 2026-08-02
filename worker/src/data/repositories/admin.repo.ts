import type { DbSession } from '../db';

export interface AdminTopicRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  modules: string;
  sort: number;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface AdminChapterRow {
  id: number;
  topic_id: number;
  title: string;
  sort: number;
  status: string;
  md_text: string;
  schema_version: number;
  updated_at: number;
}

const now = () => Date.now();

// 依赖索引：idx_topics_sort / idx_chapters_topic
export const adminRepo = {
  // ---- topics ----
  listTopics: (db: DbSession, cursor = 0) =>
    db.all<AdminTopicRow>(
      `SELECT id, slug, title, description, modules, sort, status, created_at, updated_at
       FROM topics WHERE id > ?1 ORDER BY id LIMIT 100`,
      cursor,
    ),

  getTopic: (db: DbSession, id: number) =>
    db.first<AdminTopicRow>(
      `SELECT id, slug, title, description, modules, sort, status, created_at, updated_at
       FROM topics WHERE id = ?1`,
      id,
    ),

  createTopic: (
    db: DbSession,
    t: { slug: string; title: string; description: string; modules: string; sort: number; status: string },
  ) =>
    db.run(
      `INSERT INTO topics (slug, title, description, modules, sort, status, created_at, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?7)`,
      t.slug,
      t.title,
      t.description,
      t.modules,
      t.sort,
      t.status,
      now(),
    ),

  updateTopic: (
    db: DbSession,
    id: number,
    t: { slug: string; title: string; description: string; modules: string; sort: number; status: string },
  ) =>
    db.run(
      `UPDATE topics SET slug=?1, title=?2, description=?3, modules=?4, sort=?5, status=?6, updated_at=?7 WHERE id=?8`,
      t.slug,
      t.title,
      t.description,
      t.modules,
      t.sort,
      t.status,
      now(),
      id,
    ),

  deleteTopic: (db: DbSession, id: number) => db.run(`DELETE FROM topics WHERE id = ?1`, id),

  // ---- chapters ----
  listChapters: (db: DbSession, topicId: number, cursor = 0) =>
    db.all<AdminChapterRow>(
      `SELECT id, topic_id, title, sort, status, md_text, schema_version, updated_at
       FROM chapters WHERE topic_id = ?1 AND id > ?2 ORDER BY id LIMIT 100`,
      topicId,
      cursor,
    ),

  getChapter: (db: DbSession, id: number) =>
    db.first<AdminChapterRow>(
      `SELECT id, topic_id, title, sort, status, md_text, schema_version, updated_at
       FROM chapters WHERE id = ?1`,
      id,
    ),

  createChapter: (
    db: DbSession,
    ch: { topic_id: number; title: string; sort: number; status: string; md_text: string; schema_version: number },
  ) =>
    db.run(
      `INSERT INTO chapters (topic_id, title, sort, status, md_text, schema_version, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7)`,
      ch.topic_id,
      ch.title,
      ch.sort,
      ch.status,
      ch.md_text,
      ch.schema_version,
      now(),
    ),

  updateChapter: (
    db: DbSession,
    id: number,
    ch: { topic_id: number; title: string; sort: number; status: string; md_text: string; schema_version: number },
  ) =>
    db.run(
      `UPDATE chapters SET topic_id=?1, title=?2, sort=?3, status=?4, md_text=?5, schema_version=?6, updated_at=?7 WHERE id=?8`,
      ch.topic_id,
      ch.title,
      ch.sort,
      ch.status,
      ch.md_text,
      ch.schema_version,
      now(),
      id,
    ),

  deleteChapter: (db: DbSession, id: number) => db.run(`DELETE FROM chapters WHERE id = ?1`, id),

  getTopicBySlug: (db: DbSession, slug: string) =>
    db.first<{ id: number }>(`SELECT id FROM topics WHERE slug = ?1`, slug),

  /** 内容变更后 bump content_version，L2 缓存自动失效 */
  bumpContentVersion: (db: DbSession) =>
    db.run(`UPDATE platform_config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = strftime('%s','now') WHERE key = 'content_version'`),

  // ---- import（两阶段：chunk 落 import_chunks，commit 校验整体到达） ----
  recordChunk: (db: DbSession, importId: string, chunkIndex: number, rows: number) =>
    db.run(
      `INSERT OR REPLACE INTO import_chunks (import_id, chunk_index, rows, done_at)
       VALUES (?1,?2,?3,?4)`,
      importId,
      chunkIndex,
      rows,
      now(),
    ),

  countChunks: (db: DbSession, importId: string) =>
    db.first<{ n: number; total: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(rows),0) AS total FROM import_chunks WHERE import_id = ?1`,
      importId,
    ),
};
