import type { Ctx } from '../core/context';
import { ok } from '../core/response';

/** Phase 0 验收：一条 /api/v1/health 走完整管道，日志含 traceId 与 d1Stmts。 */
export async function healthHandler(c: Ctx): Promise<Response> {
  return ok(c, {
    status: 'ok',
    degrade: 'L0',
    d1Stmts: c.db.used,
    ts: Date.now(),
  });
}
