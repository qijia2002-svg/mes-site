import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import {
  recordProgressSvc,
  listProgressSvc,
  todayProgressSvc,
  parseRecordInput,
  assertAnonId,
} from './progress.service';

/** 从 query 取 anon_id（兼容旧参数名 userId，前端迁移期不断链）。 */
function anonIdFromQuery(c: Ctx): string {
  const raw = c.url.searchParams.get('anon_id') ?? c.url.searchParams.get('userId');
  return assertAnonId(raw);
}

/** POST /api/v1/progress —— 记录学习事件（幂等，F5） */
export async function recordProgress(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  return ok(c, await recordProgressSvc(c, parseRecordInput(body)));
}

/** GET /api/v1/progress?anon_id= —— 汇总 + 近 50 条事件 */
export async function listProgress(c: Ctx): Promise<Response> {
  return ok(c, await listProgressSvc(c, anonIdFromQuery(c)));
}

/** GET /api/v1/progress/today?anon_id= —— 今日完成数（首页工作台） */
export async function todayProgress(c: Ctx): Promise<Response> {
  return ok(c, await todayProgressSvc(c, anonIdFromQuery(c)));
}
