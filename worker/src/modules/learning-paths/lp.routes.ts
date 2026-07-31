import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import * as svc from './lp.service';

/** GET /api/v1/learning-paths — 列表 */
export async function listLp(c: Ctx): Promise<Response> {
  return ok(c, await svc.listLpSvc(c));
}

/** GET /api/v1/learning-paths/:id — 详情 */
export async function getLp(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getLpSvc(c, id);
  if (!d) return fail(c, Err.draftHidden());
  return ok(c, d);
}
