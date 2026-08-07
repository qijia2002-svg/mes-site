import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import {
  recordProgressSvc,
  listProgressSvc,
  todayProgressSvc,
  parseRecordInput,
} from './progress.service';

function getUserId(c: Ctx, body?: Record<string, unknown>): string {
  if (c.auth?.sub) return c.auth.sub;
  const anonId = typeof body?.anon_id === 'string' ? body.anon_id.trim() : '';
  if (anonId.length >= 8) return `anon:${anonId}`;
  throw Err.unauthorized();
}

/** POST /api/v1/progress —— 记录学习事件（支持匿名 anon_id） */
export async function recordProgress(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  const userId = getUserId(c, body);
  return ok(c, await recordProgressSvc(c, parseRecordInput(userId, body)));
}

/** GET /api/v1/progress —— 匿名返回空，不 401 */
export async function listProgress(c: Ctx): Promise<Response> {
  if (!c.auth?.sub) return ok(c, { totals: {}, today: {}, completedChapterIds: [], passedExerciseIds: [], events: [] });
  return ok(c, await listProgressSvc(c, c.auth.sub));
}

/** GET /api/v1/progress/today —— 匿名返回空 */
export async function todayProgress(c: Ctx): Promise<Response> {
  if (!c.auth?.sub) return ok(c, {});
  return ok(c, await todayProgressSvc(c, c.auth.sub));
}
