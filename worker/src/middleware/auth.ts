import type { Ctx, Middleware } from '../core/context';
import { verifyToken } from '../core/crypto';
import { Err } from '../core/errors';

interface SessionPayload {
  sub: string;
  ver: number;
  exp: number; // 秒
  iat: number;
}

/**
 * auth（§A3.2 #4）：解析签名 Cookie，写入 c.auth。
 * 鉴权在限流之前，便于已登录管理员与匿名请求走不同桶键。
 * 未通过者保持匿名（c.auth 不设置），由下游守卫决定是否拒绝。
 */
export const auth: Middleware = async (c, next) => {
  const cookie = c.req.headers.get('cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (m) {
    try {
      const { ok, payload } = await verifyToken(m[1], c.env.SESSION_SECRET);
      if (ok && payload) {
        const p = JSON.parse(payload) as SessionPayload;
        if (p.exp > Math.floor(Date.now() / 1000)) {
          const tv = await getTokenVersion(c);
          // token_version 单调递增；会话 ver 低于当前版本即视为已吊销/过期
          if (p.ver >= tv) c.auth = { sub: p.sub, ver: p.ver };
        }
      }
    } catch {
      // 忽略损坏的 Cookie，按匿名处理
    }
  }
  return next(c);
};

/** 后台鉴权守卫：未登录直接 401（用于 /api/v1/admin/* 路由） */
export const guardAdmin: Middleware = async (c, next) => {
  if (!c.auth) throw Err.unauthorized();
  return next(c);
};

/** 全站鉴权守卫：未登录直接 401（用于除 login/health 外的所有路由） */
export const guardAll: Middleware = async (c, next) => {
  if (!c.auth) throw Err.unauthorized();
  return next(c);
};

/**
 * token_version 读取成本优化（§A8.2）：
 * 每个 /admin/* 都查一次 D1 会成倍消耗额度。改为 isolate 级 60s TTL 缓存。
 * 权衡：改密后旧 token 最坏仍可用 60s —— 单管理员个人项目完全可接受。
 */
let verCache: { v: number; exp: number } | null = null;

export async function getTokenVersion(c: Ctx): Promise<number> {
  const now = Date.now();
  if (verCache && verCache.exp > now) return verCache.v;
  const row = await c.db.first<{ v: number }>(
    `SELECT CAST(value AS INTEGER) AS v FROM platform_config WHERE key = 'token_version'`,
  );
  verCache = { v: row?.v ?? 1, exp: now + 60_000 };
  return verCache.v;
}
