import type { Ctx } from '../../core/context';
import { cachedJson, contentCacheKey } from '../../core/cache';
import { chapterRepo, type TopicRow, type ChapterRow } from '../../data/repositories/chapter.repo';

/**
 * content 只读链路（§A6 / §A9）：
 * - 所有只读接口走 L2 Cache（caches.default），键带 content_version（发布即换键失效）。
 * - DTO 显式字段白名单构造，禁止 SELECT * 后直接 JSON.stringify（防 R6 答案泄露）。
 */

let cvCache: { v: number; exp: number } | null = null;
async function getContentVersion(c: Ctx): Promise<number> {
  const now = Date.now();
  if (cvCache && cvCache.exp > now) return cvCache.v;
  const row = await c.db.first<{ v: number }>(
    `SELECT CAST(value AS INTEGER) AS v FROM platform_config WHERE key = 'content_version'`,
  );
  cvCache = { v: row?.v ?? 1, exp: now + 60_000 };
  return cvCache.v;
}

function safeParseModules(s: string): string[] {
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function listTopicsSvc(c: Ctx) {
  const cv = await getContentVersion(c);
  return cachedJson(contentCacheKey('topics', cv), 300, async () => {
    const rows = await chapterRepo.listTopics(c.db);
    return rows.map((r: TopicRow) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      modules: safeParseModules(r.modules),
    }));
  });
}

export async function listChaptersSvc(c: Ctx, topicId: number) {
  const cv = await getContentVersion(c);
  return cachedJson(contentCacheKey(`topics/${topicId}/chapters`, cv), 300, async () => {
    const rows = await chapterRepo.listByTopic(c.db, topicId);
    return rows.map((r: ChapterRow) => ({
      id: r.id,
      topicId: r.topic_id,
      title: r.title,
      sort: r.sort,
      updatedAt: r.updated_at,
    }));
  });
}

export async function getChapterSvc(c: Ctx, id: number) {
  const cv = await getContentVersion(c);
  return cachedJson(contentCacheKey(`chapters/${id}`, cv), 300, async () => {
    const r = await chapterRepo.getById(c.db, id);
    if (!r || r.status !== 'published') return null;
    return {
      id: r.id,
      topicId: r.topic_id,
      title: r.title,
      schemaVersion: r.schema_version,
      md: r.md_text,
      updatedAt: r.updated_at,
    };
  });
}
