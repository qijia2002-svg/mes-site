import type { Ctx } from '../../core/context';
import { certRepo } from '../../data/repositories/cert.repo';

export async function listCertSvc(c: Ctx) {
  const rows = await certRepo.list(c.db);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    requireSql: !!r.require_sql,
    requireQuiz: !!r.require_quiz,
    status: r.status,
  }));
}
