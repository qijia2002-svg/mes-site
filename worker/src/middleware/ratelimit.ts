import type { Ctx, Middleware } from '../core/context';
import { AppError } from '../core/errors';
import { Err } from '../core/errors';

interface ConsumeResp {
  allowed: boolean;
  retryAfterMs: number;
}

/** 调 RateLimiter DO 令牌桶。 */
export async function consume(
  c: Ctx,
  key: string,
  capacity: number,
  refillPerSec: number,
  cost = 1,
): Promise<ConsumeResp> {
  const id = c.env.RATE_LIMITER.idFromName('global');
  const stub = c.env.RATE_LIMITER.get(id);
  const res = await stub.fetch('https://rl.internal/consume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, capacity, refillPerSec, cost }),
  });
  if (!res.ok) throw new AppError(5003, 503, '服务暂时不可用，请稍后重试');
  return res.json<ConsumeResp>();
}

/** 通用限流中间件工厂（写接口 / 提交接口使用）。 */
export const ratelimit =
  (opts: { key: (c: Ctx) => string; capacity: number; refillPerSec: number }) =>
  (): Middleware =>
  async (c, next) => {
    const r = await consume(c, opts.key(c), opts.capacity, opts.refillPerSec);
    if (!r.allowed) throw Err.rateLimited(r.retryAfterMs);
    return next(c);
  };

/**
 * 登录专用限流（§A8.3）：账号+IP 双桶，先限流后验密。
 * 登录路由单独配置 [trace, security, loginRateLimit, validate, loginHandler]，
 * 不走默认 auth→ratelimit 顺序。
 */
export const loginRateLimit: Middleware = async (c, next) => {
  const ip = c.req.headers.get('cf-connecting-ip') ?? 'unknown';
  // 从 body 取账号（仅限流，不消费 body；解析为只读）
  let user = 'unknown';
  try {
    const ct = c.req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await c.req.clone().json()) as { username?: string };
      user = body.username ?? 'unknown';
    }
  } catch {
    /* 限流不依赖账号解析成功 */
  }
  const ipR = await consume(c, `login:ip:${ip}`, 5, 0.2);
  if (!ipR.allowed) throw Err.loginLocked(ipR.retryAfterMs);
  const userR = await consume(c, `login:user:${user}`, 5, 0.2);
  if (!userR.allowed) throw Err.loginLocked(userR.retryAfterMs);
  return next(c);
};

/** 登录失败后累加失败计数（Worker → DO /loginFailure）。 */
export async function recordLoginFailure(c: Ctx, user: string): Promise<void> {
  const id = c.env.RATE_LIMITER.idFromName('global');
  const stub = c.env.RATE_LIMITER.get(id);
  await stub
    .fetch('https://rl.internal/loginFailure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: `login:user:${user}` }),
    })
    .catch(() => undefined);
}
