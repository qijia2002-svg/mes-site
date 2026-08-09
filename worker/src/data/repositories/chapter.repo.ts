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
  prerequisites: string;  // JSON: [courseId, ...]
  difficulty: string;      // beginner / intermediate / advanced
  estimated_hours: number;
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

/** 章节骨架：只有数数与排序需要的列。学习引擎一次要几百章，带上 md_text 是白搬运。 */
export interface ChapterLiteRow {
  id: number;
  topic_id: number;
  sort: number;
}

/** 单条 IN 查询最多塞多少个 id（远低于 SQLite 变量上限，同时压住返回行数）。 */
const IN_CHUNK = 40;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * IN 占位符生成：只按**数组长度**产出 `?1,?2…`，值一律走 bind。
 * SQL 文本里不会出现任何入参内容，§A4.2「禁止拼接 SQL」仍然成立。
 */
function inPlaceholders(count: number, startAt = 1): string {
  let s = '';
  for (let i = 0; i < count; i++) s += (i === 0 ? '' : ',') + '?' + (startAt + i);
  return s;
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
      `SELECT id, slug, title, description, modules, sort, status,
              COALESCE(prerequisites,'[]') as prerequisites,
              COALESCE(difficulty,'beginner') as difficulty,
              COALESCE(estimated_hours,4) as estimated_hours
       FROM topics WHERE status = 'published' AND id > ?1
       ORDER BY id LIMIT 100`,
      cursor,
    ),

  getTopicById: (db: DbSession, id: number) =>
    db.first<TopicRow>(
      `SELECT id, slug, title, description, modules, sort, status,
              COALESCE(prerequisites,'[]') as prerequisites,
              COALESCE(difficulty,'beginner') as difficulty,
              COALESCE(estimated_hours,4) as estimated_hours
       FROM topics WHERE id = ?1`,
      id,
    ),

  /**
   * 批量取话题（学习引擎专用）。语义与 getTopicById 逐条循环**完全一致**——
   * 刻意不加 `status = 'published'`，否则学习路径里引用到的草稿课程会凭空消失，
   * 与改造前的行为不符。这里只把 N 条语句压成 ⌈N/40⌉ 条。
   */
  listTopicsByIds: async (db: DbSession, ids: number[]): Promise<TopicRow[]> => {
    const uniq = [...new Set(ids)];
    if (uniq.length === 0) return [];
    const out: TopicRow[] = [];
    for (const part of chunk(uniq, IN_CHUNK)) {
      // part.length ≤ 40 且 id 唯一 → 单条返回行数天然 ≤ 40，不会触碰 100 行上限
      const rows = await db.all<TopicRow>(
        `SELECT id, slug, title, description, modules, sort, status,
                COALESCE(prerequisites,'[]') as prerequisites,
                COALESCE(difficulty,'beginner') as difficulty,
                COALESCE(estimated_hours,4) as estimated_hours
         FROM topics WHERE id IN (${inPlaceholders(part.length)})
         ORDER BY id LIMIT 100`,
        ...part,
      );
      out.push(...rows);
    }
    return out;
  },

  /**
   * 批量取多个话题下的已发布章节骨架（学习引擎专用）。
   * 替代「每个话题一次 listByTopic」的 N+1：33 门课从 33 条语句压到 2 条，
   * 这正是 POST /api/v1/engine/status 撞穿 40 条语句预算返回 5002 的根因。
   * 单条仍守 ≤100 行（§A4.2），用 id 游标翻页补齐。
   */
  listChaptersByTopicIds: async (db: DbSession, topicIds: number[]): Promise<ChapterLiteRow[]> => {
    const uniq = [...new Set(topicIds)];
    if (uniq.length === 0) return [];
    const out: ChapterLiteRow[] = [];
    for (const part of chunk(uniq, IN_CHUNK)) {
      const ph = inPlaceholders(part.length);
      const cursorAt = part.length + 1;
      let cursor = 0;
      for (;;) {
        const rows = await db.all<ChapterLiteRow>(
          `SELECT id, topic_id, sort
             FROM chapters
            WHERE topic_id IN (${ph}) AND status = 'published' AND id > ?${cursorAt}
            ORDER BY id LIMIT 100`,
          ...part,
          cursor,
        );
        out.push(...rows);
        if (rows.length < 100) break;
        cursor = rows[rows.length - 1].id;
      }
    }
    return out;
  },

  getTopicBySlug: (db: DbSession, slug: string) =>
    db.first<TopicRow>(
      `SELECT id, slug, title, description, modules, sort, status,
              COALESCE(prerequisites,'[]') as prerequisites,
              COALESCE(difficulty,'beginner') as difficulty,
              COALESCE(estimated_hours,4) as estimated_hours
       FROM topics WHERE slug = ?1`,
      slug,
    ),
};
