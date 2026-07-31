import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import {
  recordProgressSvc,
  listProgressSvc,
  type RecordProgressInput,
} from './progress.service';

/** POST /api/v1/progress — 记录学习事件（幂等） */
export async function recordProgress(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected());
  const b = (await c.req.json()) as RecordProgressInput;
  if (!b.eventId || !b.userId || !b.type) return fail(c, Err.paramMissing());
  const data = await recordProgressSvc(c, b);
  return ok(c, data);
}

/** GET /api/v1/progress?userId=... — 近期事件 + 当日聚合 */
export async function listProgress(c: Ctx): Promise<Response> {
  const userId = c.url.searchParams.get('userId');
  if (!userId) return fail(c, Err.paramMissing());
  const data = await listProgressSvc(c, userId);
  return ok(c, data);
}
