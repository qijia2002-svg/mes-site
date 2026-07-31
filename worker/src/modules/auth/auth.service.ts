import type { Ctx } from '../../core/context';
import { signPayload, constantTimeEqual } from '../../core/crypto';
import { getTokenVersion } from '../../middleware/auth';
import { recordLoginFailure } from '../../middleware/ratelimit';
import { AppError } from '../../core/errors';

/**
 * 登录：校验口令（常量时间比较，防时序侧信道）→ 签发 HMAC 无状态会话。
 * 口令错误时累加登录失败计数（触发阶梯锁定）。
 */
export async function loginSvc(
  c: Ctx,
  username: string,
  password: string,
): Promise<{ token: string; maxAge: number }> {
  const expected = c.env.ADMIN_PASSWORD ?? '';
  if (!expected || !constantTimeEqual(password, expected)) {
    await recordLoginFailure(c, username);
    throw new AppError(2001, 401, '用户名或密码错误');
  }
  const tv = await getTokenVersion(c);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 28800; // 8h
  const payload = { sub: username, ver: tv, exp, iat: now };
  const token = await signPayload(JSON.stringify(payload), c.env.SESSION_SECRET);
  return { token, maxAge: 28800 };
}
