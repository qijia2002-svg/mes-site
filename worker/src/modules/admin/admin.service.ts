import type { Ctx } from '../../core/context';
import { Err } from '../../core/errors';
import { adminRepo } from '../../data/repositories/admin.repo';

const asStr = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const asNum = (v: unknown, d = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
const asModules = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function parseModules(s: string): string[] {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// ---- topics ----
export async function listTopicsSvc(c: Ctx) {
  const rows = await adminRepo.listTopics(c.db);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    modules: parseModules(r.modules),
    sort: r.sort,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

export async function getTopicSvc(c: Ctx, id: number) {
  const r = await adminRepo.getTopic(c.db, id);
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    modules: parseModules(r.modules),
    sort: r.sort,
    status: r.status,
    updatedAt: r.updated_at,
  };
}

export async function createTopicSvc(c: Ctx, b: Record<string, unknown>) {
  const slug = asStr(b.slug);
  const title = asStr(b.title);
  if (!slug || !title) throw Err.paramMissing();
  await adminRepo.createTopic(c.db, {
    slug,
    title,
    description: asStr(b.description),
    modules: JSON.stringify(asModules(b.modules)),
    sort: asNum(b.sort),
    status: asStr(b.status, 'draft'),
  });
  return { ok: true };
}

export async function updateTopicSvc(c: Ctx, id: number, b: Record<string, unknown>) {
  await adminRepo.updateTopic(c.db, id, {
    slug: asStr(b.slug),
    title: asStr(b.title),
    description: asStr(b.description),
    modules: JSON.stringify(asModules(b.modules)),
    sort: asNum(b.sort),
    status: asStr(b.status, 'draft'),
  });
  return { ok: true };
}

export async function deleteTopicSvc(c: Ctx, id: number) {
  await adminRepo.deleteTopic(c.db, id);
  return { ok: true };
}

// ---- chapters ----
export async function listChaptersSvc(c: Ctx, topicId: number) {
  const rows = await adminRepo.listChapters(c.db, topicId);
  return rows.map((r) => ({
    id: r.id,
    topicId: r.topic_id,
    title: r.title,
    sort: r.sort,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

export async function getChapterSvc(c: Ctx, id: number) {
  const r = await adminRepo.getChapter(c.db, id);
  if (!r) return null;
  return {
    id: r.id,
    topicId: r.topic_id,
    title: r.title,
    sort: r.sort,
    status: r.status,
    md: r.md_text,
    schemaVersion: r.schema_version,
    updatedAt: r.updated_at,
  };
}

export async function createChapterSvc(c: Ctx, b: Record<string, unknown>) {
  const topicId = asNum(b.topicId);
  const title = asStr(b.title);
  if (!topicId || !title) throw Err.paramMissing();
  await adminRepo.createChapter(c.db, {
    topic_id: topicId,
    title,
    sort: asNum(b.sort),
    status: asStr(b.status, 'draft'),
    md_text: asStr(b.md),
    schema_version: asNum(b.schemaVersion, 1),
  });
  return { ok: true };
}

export async function updateChapterSvc(c: Ctx, id: number, b: Record<string, unknown>) {
  await adminRepo.updateChapter(c.db, id, {
    topic_id: asNum(b.topicId),
    title: asStr(b.title),
    sort: asNum(b.sort),
    status: asStr(b.status, 'draft'),
    md_text: asStr(b.md),
    schema_version: asNum(b.schemaVersion, 1),
  });
  return { ok: true };
}

export async function deleteChapterSvc(c: Ctx, id: number) {
  await adminRepo.deleteChapter(c.db, id);
  return { ok: true };
}

// ---- import（两阶段；行级物化留待内容阶段） ----
export async function startImportSvc(): Promise<{ importId: string }> {
  return { importId: crypto.randomUUID() };
}

export async function recordChunkSvc(c: Ctx, b: Record<string, unknown>) {
  const importId = asStr(b.importId);
  const chunkIndex = asNum(b.chunkIndex, -1);
  if (!importId || chunkIndex < 0) throw Err.paramMissing();
  await adminRepo.recordChunk(c.db, importId, chunkIndex, asNum(b.rows));
  return { ok: true };
}

export async function commitImportSvc(c: Ctx, b: Record<string, unknown>) {
  const importId = asStr(b.importId);
  if (!importId) throw Err.paramMissing();
  const r = await adminRepo.countChunks(c.db, importId);
  return {
    ok: true,
    chunks: r?.n ?? 0,
    rows: r?.total ?? 0,
    note: 'row materialization (parse Excel → insert) deferred to content phase',
  };
}
