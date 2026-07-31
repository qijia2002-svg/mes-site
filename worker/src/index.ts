import type { Env } from './env';
import type { Ctx } from './core/context';
import type { ExecutionContext } from '@cloudflare/workers-types';
import { DbSession } from './data/db';
import { noopLogger } from './core/logger';
import { matchRoute, buildPipeline } from './router';
import { RateLimiter } from './do/RateLimiter';

export { RateLimiter };

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // 静态资源（前端构建产物）由 Workers Static Assets 提供
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(req);
    }

    // CORS 预检
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': url.origin,
          'access-control-allow-headers': 'content-type, cookie',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'access-control-max-age': '86400',
        },
      });
    }

    const matched = matchRoute(req.method, url.pathname);
    if (!matched) {
      return new Response(
        JSON.stringify({ code: 404, msg: 'not found', data: null }),
        { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } },
      );
    }

    const c: Ctx = {
      req,
      env,
      exec: ctx,
      url,
      params: matched.params,
      traceId: '',
      startedAt: 0,
      db: new DbSession(env.DB, noopLogger),
      log: noopLogger,
    };

    const pipeline = buildPipeline(matched.route);
    return pipeline(c);
  },
} satisfies ExportedHandler<Env>;
