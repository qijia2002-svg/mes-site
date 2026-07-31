import type { Handler, Middleware } from './context';

/**
 * 零依赖洋葱模型 compose。
 * 不引入 Hono / itty-router：路由规模 < 40，静态映射表更快、更小，
 * 且 10ms CPU 预算下每一次正则回溯都是成本（规范 §9.1）。
 */
export function compose(mws: Middleware[], handler: Handler): Handler {
  return mws.reduceRight<Handler>(
    (next, mw) => (c) => mw(c, next),
    handler,
  );
}
