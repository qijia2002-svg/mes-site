import type { Middleware } from '../core/context';
import { createLogger } from '../core/logger';

/**
 * trace（§A3.2 #2）：生成 traceId、记录耗时。
 * 同时**就地**创建带 traceId 的结构化日志实例（Ctx.log 在入口是 noop 占位）。
 */
export const trace: Middleware = async (c, next) => {
  c.traceId = crypto.randomUUID();
  c.startedAt = Date.now();
  c.log = createLogger(c.traceId, c.env);

  const res = await next(c);

  const durationMs = Date.now() - c.startedAt;
  c.log.info({
    msg: 'req',
    method: c.req.method,
    path: c.url.pathname,
    status: res.status,
    durationMs,
    d1Stmts: c.db.used,
    degrade: 'L0',
  });

  const h = new Headers(res.headers);
  h.set('x-trace-id', c.traceId);
  return new Response(res.body, { status: res.status, headers: h });
};
