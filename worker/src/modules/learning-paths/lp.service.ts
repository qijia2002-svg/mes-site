import type { Ctx } from '../../core/context';
import { lpRepo } from '../../data/repositories/lp.repo';

function parseIds(s: string): number[] {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

export async function listLpSvc(c: Ctx) {
  const rows = await lpRepo.list(c.db);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    topicIds: parseIds(r.topic_ids),
    sort: r.sort,
    status: r.status,
  }));
}

export async function getLpSvc(c: Ctx, id: number) {
  const r = await lpRepo.get(c.db, id);
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    topicIds: parseIds(r.topic_ids),
    sort: r.sort,
    status: r.status,
  };
}
