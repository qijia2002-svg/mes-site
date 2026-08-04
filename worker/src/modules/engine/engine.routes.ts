/**
 * 学习引擎 · 路由处理。
 */
import type { Ctx } from '../../core/context';
import type { Handler } from '../../core/context';
import { ok, fail } from '../../core/response';
import { AppError } from '../../core/errors';
import { computeEngineStatus, type EngineStatusBody } from './engine.service';

export const engineStatusHandler: Handler = async (c: Ctx) => {
  let body: EngineStatusBody;
  try {
    body = await c.req.json() as EngineStatusBody;
  } catch {
    return fail(c, new AppError(1001, 400, '请求体不是有效的 JSON'));
  }

  if (body.activePath !== undefined && (typeof body.activePath !== 'number' || body.activePath <= 0)) {
    return fail(c, new AppError(1002, 400, 'activePath 必须是正整数'));
  }
  if (body.selectedPaths !== undefined) {
    if (!Array.isArray(body.selectedPaths) || body.selectedPaths.some(p => typeof p !== 'number')) {
      return fail(c, new AppError(1003, 400, 'selectedPaths 必须是数字数组'));
    }
  }

  const result = await computeEngineStatus(c, body);
  return ok(c, result);
};
