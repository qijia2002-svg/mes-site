import type { Middleware } from '../core/context';
import { fail } from '../core/response';
import { AppError } from '../core/errors';

/** 最外层兜底：捕获一切异常转统一响应，永不裸抛（§A3.2 #1） */
export const errorBoundary: Middleware = async (c, next) => {
  try {
    return await next(c);
  } catch (err) {
    if (err instanceof AppError) return fail(c, err);
    c.log.error({
      msg: 'unhandled',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return fail(c, new AppError(9000, 500, '服务器内部错误'));
  }
};
