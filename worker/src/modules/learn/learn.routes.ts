import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import * as svc from './learn.service';

/**
 * 零基础重学 v1 —— 微练习端点（SQL 前那级台阶，计入完成度）。
 *
 *   GET  /api/v1/micro-practices/:id        -> 题面（不含答案）
 *   POST /api/v1/micro-practices/:id/grade  -> 服务端判分，只回 correct + feedback
 *
 * 判分只在服务端做：answer 留库里，前端只提交作答、只收对错与反馈，
 * 绝不在前端比对答案（答案出网 = 判题基准失效）。
 * 公开读取/提交（noAuth）：练习不要求登录，匿名也能练。
 */
export async function getMicroPractice(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const d = await svc.getMicroSvc(c, id);
  if (!d) return fail(c, Err.notFound());
  return ok(c, d);
}

export async function gradeMicroPractice(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const answer = body.answer as svc.MicroAnswer | undefined;
  if (answer === undefined || answer === null) return fail(c, Err.paramMissing());
  const result = await svc.gradeMicroSvc(c, id, answer as svc.MicroAnswer);
  return ok(c, result);
}
