import type { Middleware } from '../core/context';
import { fail } from '../core/response';
import { Err } from '../core/errors';

/**
 * security（§A3.2 #3）：写操作校验 Origin；响应注入 CSP 与安全头。
 * 同域校验：origin 的主机须与请求 host 一致（兼容自定义域 / localhost）。
 * 严格模式下无 origin 的非浏览器调用直接拒绝。
 */
export const security: Middleware = async (c, next) => {
  const isWrite =
    c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'DELETE';

  if (isWrite) {
    const origin = c.req.headers.get('origin');
    const host = c.req.headers.get('host');
    if (!origin || !host || safeHost(origin) !== host.toLowerCase()) {
      return fail(c, Err.badOrigin());
    }
  }

  const res = await next(c);

  const h = new Headers(res.headers);
  h.set('x-content-type-options', 'nosniff');
  h.set('x-frame-options', 'DENY');
  h.set('referrer-policy', 'no-referrer');
  h.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  return new Response(res.body, { status: res.status, headers: h });
};

function safeHost(origin: string): string {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return '';
  }
}
