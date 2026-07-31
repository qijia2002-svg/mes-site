import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import * as svc from './quiz.service';

/** GET /api/v1/quiz/questions?chapterId= — 选择题（不含答案） */
export async function listQuestions(c: Ctx): Promise<Response> {
  const chapterId = Number(c.url.searchParams.get('chapterId'));
  if (!Number.isInteger(chapterId)) return fail(c, Err.paramMissing());
  return ok(c, await svc.listQuestionsSvc(c, chapterId));
}

/** GET /api/v1/sql-exercises/:id — SQL 实训题（不含答案） */
export async function getSqlExercise(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getSqlExerciseSvc(c, id);
  if (!d) return fail(c, Err.notFound());
  return ok(c, d);
}

/** GET /api/v1/sql-exercises?topicId= — SQL 实训题列表 */
export async function listSqlExercises(c: Ctx): Promise<Response> {
  const topicId = Number(c.url.searchParams.get('topicId'));
  if (!Number.isInteger(topicId)) return fail(c, Err.paramMissing());
  return ok(c, await svc.listSqlExercisesSvc(c, topicId));
}

/** POST /api/v1/sql-exercises/:id/submit — 提交（判题在客户端） */
export async function submitSql(c: Ctx): Promise<Response> {
  const b = ((await c.req.json().catch(() => ({}))) as { exerciseId?: number; userId?: string });
  return ok(c, await svc.submitSqlSvc(c, b));
}
