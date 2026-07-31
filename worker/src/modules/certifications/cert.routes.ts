import type { Ctx } from '../../core/context';
import { ok } from '../../core/response';
import * as svc from './cert.service';

/** GET /api/v1/certifications — 证书列表 */
export async function listCert(c: Ctx): Promise<Response> {
  return ok(c, await svc.listCertSvc(c));
}
