import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import * as svc from './admin.service';

async function jsonBody(c: Ctx): Promise<Record<string, unknown>> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw Err.schemaRejected();
  return (await c.req.json()) as Record<string, unknown>;
}

// ---- topics ----
export async function listTopics(c: Ctx): Promise<Response> {
  return ok(c, await svc.listTopicsSvc(c));
}
export async function getTopic(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getTopicSvc(c, id);
  if (!d) return fail(c, Err.draftHidden());
  return ok(c, d);
}
export async function createTopic(c: Ctx): Promise<Response> {
  return ok(c, await svc.createTopicSvc(c, await jsonBody(c)));
}
export async function updateTopic(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  return ok(c, await svc.updateTopicSvc(c, id, await jsonBody(c)));
}
export async function deleteTopic(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  return ok(c, await svc.deleteTopicSvc(c, id));
}

// ---- chapters ----
export async function listChapters(c: Ctx): Promise<Response> {
  const topicId = Number(c.url.searchParams.get('topicId'));
  if (!Number.isInteger(topicId)) return fail(c, Err.paramMissing());
  return ok(c, await svc.listChaptersSvc(c, topicId));
}
export async function getChapter(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getChapterSvc(c, id);
  if (!d) return fail(c, Err.draftHidden());
  return ok(c, d);
}
export async function createChapter(c: Ctx): Promise<Response> {
  return ok(c, await svc.createChapterSvc(c, await jsonBody(c)));
}
export async function updateChapter(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  return ok(c, await svc.updateChapterSvc(c, id, await jsonBody(c)));
}
export async function deleteChapter(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  return ok(c, await svc.deleteChapterSvc(c, id));
}

// ---- Excel 分片导入（两阶段） ----
export async function importStart(c: Ctx): Promise<Response> {
  await jsonBody(c);
  return ok(c, await svc.startImportSvc());
}
export async function importChunk(c: Ctx): Promise<Response> {
  return ok(c, await svc.recordChunkSvc(c, await jsonBody(c)));
}
export async function importCommit(c: Ctx): Promise<Response> {
  return ok(c, await svc.commitImportSvc(c, await jsonBody(c)));
}
