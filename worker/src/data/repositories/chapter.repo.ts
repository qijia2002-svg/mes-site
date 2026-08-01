import type { DbSession } from '../db';

/**
 * Repository 契约（§A4.2）：
 * - 只出现 prepare-bind，任何字符串拼接 SQL 在 code review 直接驳回。
 * - 单次返回 ≤ 100 行，列表接口一律 cursor 分页 `WHERE id > ? LIMIT 100`。
 * - 头部注释写明依赖的索引（CI 用 EXPLAIN QUERY PLAN 校验无 SCAN TABLE）。
 */

export interface TopicRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  modules: string; // JSON 数组
  sort: number;
  status: string;
}

export interface ChapterRow {
  id: number;
  topic_id: number;
  title: string;
  sort: number;
  status: string;
  md_text: string;
  schema_version: number;
  updated_at: number;
}

// 依赖索引：idx_topics_sort / idx_chapters_topic
export const chapterRepo = {
  listByTopic: (db: DbSession, topicId: number, cursor = 0) =>
    db.all<ChapterRow>(
      `SELECT id, topic_id, title, sort, status, md_text, schema_version, updated_at
       FROM chapters
       WHERE topic_id = ?1 AND status = 'published' AND id > ?2
       ORDER BY id LIMIT 100`,
      topicId,
      cursor,
    ),

  getById: (db: DbSession, id: number) =>
    db.first<ChapterRow>(
      `SELECT id, topic_id, title, sort, status, md_text, schema_version, updated_at
       FROM chapters WHERE id = ?1`,
      id,
    ),

  listTopics: (db: DbSession, cursor = 0) =>
    db.all<TopicRow>(
      `SELECT id, slug, title, description, modules, sort, status
       FROM topics WHERE status = 'published' AND id > ?1
       ORDER BY id LIMIT 100`,
      cursor,
    ),

  getTopicById: (db: DbSession, id: number) =>
    db.first<TopicRow>(
      `SELECT id, slug, title, description, modules, sort, status
       FROM topics WHERE id = ?1`,
      id,
    ),

  /** 走 topics.slug UNIQUE 索引 */
  getTopicBySlug: (db: DbSession, slug: string) =>
    db.first<TopicRow>(
      `SELECT id, slug, title, description, modules, sort, status
       FROM topics WHERE slug = ?1`,
      slug,
    ),
};
