import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { listTracksSvc, getTrackSvc, listCareersSvc, getCareerSvc } from './roadmap.service';
import { getRoadmapGraphSvc } from './roadmap.graph';

/**
 * 职业路线图薄路由（API §0.2）：取参 → 校验 → 调 service → ok/fail。
 * 5 个接口都允许匿名，但登录用户要看到进度，故 router 用 optionalAuth 显式挂 auth。
 * slug 非法（>64 或含 /）→ 1003；career 缺失/空 → 1001；查不到 → 4001（Err.draftHidden）。
 */

const MAX_SLUG = 64;

export async function listTracks(c: Ctx): Promise<Response> {
  return ok(c, await listTracksSvc(c));
}

export async function getTrack(c: Ctx): Promise<Response> {
  const slug = c.params.slug;
  if (slug.length > MAX_SLUG || slug.includes('/')) return fail(c, Err.schemaRejected());
  const d = await getTrackSvc(c, slug);
  if (!d) return fail(c, Err.draftHidden());
  return ok(c, d);
}

export async function listCareers(c: Ctx): Promise<Response> {
  return ok(c, await listCareersSvc(c));
}

export async function getCareer(c: Ctx): Promise<Response> {
  const slug = c.params.slug;
  if (slug.length > MAX_SLUG || slug.includes('/')) return fail(c, Err.schemaRejected());
  const d = await getCareerSvc(c, slug);
  if (!d) return fail(c, Err.draftHidden());
  return ok(c, d);
}

export async function getRoadmapGraph(c: Ctx): Promise<Response> {
  const career = c.url.searchParams.get('career') ?? '';
  if (!career) return fail(c, Err.paramMissing());
  if (career.length > MAX_SLUG || career.includes('/')) return fail(c, Err.schemaRejected());
  const d = await getRoadmapGraphSvc(c, career);
  if (!d) return fail(c, Err.draftHidden());
  return ok(c, d);
}
