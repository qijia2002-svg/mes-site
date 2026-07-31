import type { Middleware } from '../core/context';
import { AppError } from '../core/errors';

/**
 * validate（§A3.2 #6）：入参体积/类型初检。
 * 精细 schema 校验（demo config 白名单等）在写入时（后台发布）做，不放在热路径。
 * 这里只拦明显违规：写请求 body > 256KB。
 */
export const validate: Middleware = async (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'DELETE') {
    const len = Number(c.req.headers.get('content-length') ?? '0');
    if (len > 256 * 1024) throw new AppError(1002, 413, '请求体过大');
  }
  return next(c);
};
