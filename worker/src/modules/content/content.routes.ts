import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { listTopicsSvc, listChaptersSvc, getChapterSvc } from './content.service';

export async function listTopics(c: Ctx): Promise<Response> {
  const data = await listTopicsSvc(c);
  return ok(c, data);
}

export async function listChapters(c: Ctx): Promise<Response> {
  const topicId = Number(c.params.id);
  if (!Number.isInteger(topicId)) return fail(c, Err.paramMissing());
  const data = await listChaptersSvc(c, topicId);
  return ok(c, data);
}

export async function getChapter(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const data = await getChapterSvc(c, id);
  if (!data) return fail(c, Err.draftHidden());
  return ok(c, data);
}
