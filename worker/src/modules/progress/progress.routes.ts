import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import {
  recordProgressSvc,
  listProgressSvc,
  todayProgressSvc,
  parseRecordInput,
} from './progress.service';

function requireUserId(c: Ctx): string {
  if (!c.auth?.sub) throw Err.unauthorized();
  return c.auth.sub;
}

/** POST /api/v1/progress —— 记录学习事件（幂等，F5） */
export async function recordProgress(c: Ctx): Promise<Response> {
  const userId = requireUserId(c);
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  return ok(c, await recordProgressSvc(c, parseRecordInput(userId, body)));
}

/** GET /api/v1/progress —— 汇总 + 近 50 条事件 */
export async function listProgress(c: Ctx): Promise<Response> {
  return ok(c, await listProgressSvc(c, requireUserId(c)));
}

/** GET /api/v1/progress/today —— 今日完成数（首页工作台） */
export async function todayProgress(c: Ctx): Promise<Response> {
  return ok(c, await todayProgressSvc(c, requireUserId(c)));
}
