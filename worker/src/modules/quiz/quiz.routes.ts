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

/** GET /api/v1/quiz/topic-questions?topicId= — 模块汇总抽题（不含答案） */
export async function listTopicQuestions(c: Ctx): Promise<Response> {
  const topicId = Number(c.url.searchParams.get('topicId'));
  if (!Number.isInteger(topicId)) return fail(c, Err.paramMissing());
  return ok(c, await svc.listTopicQuestionsSvc(c, topicId));
}

/** POST /api/v1/quiz/grade — 答案校验（返回对错+解析，不下发正确答案直到提交后） */
export async function gradeAnswer(c: Ctx): Promise<Response> {
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const questionId = Number(body.question_id ?? body.questionId);
  const userAnswer = String(body.answer ?? '');
  if (!Number.isInteger(questionId) || !userAnswer) return fail(c, Err.paramMissing());
  const result = await svc.gradeAnswerSvc(c, questionId, userAnswer);
  if (!result) return fail(c, Err.notFound());
  return ok(c, result);
}

/** GET /api/v1/sql-exercises/:id — SQL 实训题（不含答案） */
export async function getSqlExercise(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getSqlExerciseSvc(c, id);
  if (!d) return fail(c, Err.notFound());
  return ok(c, d);
}

/** GET /api/v1/sql-exercises[?topicId=] — SQL 实训题列表（省略 topicId 返回全部） */
export async function listSqlExercises(c: Ctx): Promise<Response> {
  const raw = c.url.searchParams.get('topicId');
  if (raw === null || raw === '') return ok(c, await svc.listSqlExercisesSvc(c));
  const topicId = Number(raw);
  if (!Number.isInteger(topicId)) return fail(c, Err.schemaRejected('topicId'));
  return ok(c, await svc.listSqlExercisesSvc(c, topicId));
}

/** POST /api/v1/sql-exercises/:id/submit — 提交判题结果（判定在客户端，服务端只落进度） */
export async function submitSql(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const userId = c.auth?.sub;
  if (!userId) return fail(c, Err.unauthorized());
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const d = await svc.submitSqlSvc(c, svc.parseSubmitInput(userId, id, body));
  if (!d) return fail(c, Err.notFound());
  return ok(c, d);
}
