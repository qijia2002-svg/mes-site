import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { signPayload } from '../../src/core/crypto';
import { callApi } from './client';

/** 通过真实登录接口拿管理员 sid cookie（依赖 .dev.vars 的 ADMIN_PASSWORD）。
 *  口令优先读 TEST_ADMIN_PASSWORD（CI 自洽），回退本地默认值 qijia2002。 */
export async function getAdminCookie(): Promise<string> {
  const adminPw = process.env.TEST_ADMIN_PASSWORD ?? 'qijia2002';
  const { res } = await callApi('POST', '/api/v1/auth/login', {
    body: { username: 'tester', password: adminPw },
  });
  const sc = res.headers.get('set-cookie') ?? '';
  const m = sc.match(/sid=([^;]+)/);
  if (!m) throw new Error('login did not return sid cookie (检查 .dev.vars ADMIN_PASSWORD)');
  return `sid=${m[1]}`;
}

/** 直接签发一个会话 cookie（绕开登录，提速；用于鉴权/守卫类用例）。 */
export async function forgeCookie(
  secret: string,
  opts: { exp?: number; ver?: number; sub?: string } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    sub: opts.sub ?? 'tester',
    ver: opts.ver ?? 1,
    exp: opts.exp ?? now + 3600,
    iat: now,
  });
  const token = await signPayload(payload, secret);
  return `sid=${token}`;
}

/** 从仓库根 .dev.vars 读取 SESSION_SECRET（与 worker 运行时一致）。 */
export function getSecret(): string {
  const root = fileURLToPath(new URL('../../../', import.meta.url)); // worker/test -> repo root
  const raw = readFileSync(root + '.dev.vars', 'utf-8');
  const m = raw.match(/SESSION_SECRET=(.*)/);
  if (!m) throw new Error('未能从 .dev.vars 读取 SESSION_SECRET');
  return m[1].trim();
}
