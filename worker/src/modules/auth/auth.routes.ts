import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { loginSvc } from './auth.service';

function cookieHeader(token: string, maxAge: number): string {
  return `sid=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/** 登录（路由单独配置限流：先限流后验密） */
export async function loginHandler(c: Ctx): Promise<Response> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected());
  const body = (await c.req.json()) as { username?: string; password?: string };
  if (!body.username || !body.password) return fail(c, Err.paramMissing());

  const { token, maxAge } = await loginSvc(c, body.username, body.password);
  return new Response(
    JSON.stringify({ code: 0, data: { ok: true }, msg: 'ok', traceId: c.traceId }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': cookieHeader(token, maxAge),
        'cache-control': 'no-store',
      },
    },
  );
}

/** 登出：清 Cookie */
export async function logoutHandler(c: Ctx): Promise<Response> {
  return new Response(
    JSON.stringify({ code: 0, data: null, msg: 'ok', traceId: c.traceId }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': cookieHeader('', 0),
        'cache-control': 'no-store',
      },
    },
  );
}

/** 身份查询：返回当前登录用户（前端 AuthGuard 依赖此端点判断登录态） */
export async function whoamiHandler(c: Ctx): Promise<Response> {
  if (!c.auth) return fail(c, Err.unauthorized());
  return ok(c, { sub: c.auth.sub });
}
