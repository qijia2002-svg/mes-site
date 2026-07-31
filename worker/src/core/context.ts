import type { Env } from '../env';
import type { DbSession } from '../data/db';
import type { Logger } from './logger';
import type { ExecutionContext } from '@cloudflare/workers-types';

/** 请求上下文：贯穿整个洋葱管道，禁止跨层反向依赖 */
export interface Ctx {
  req: Request;
  env: Env;
  exec: ExecutionContext;
  url: URL;
  params: Record<string, string>;
  traceId: string;
  startedAt: number;
  /** 带预算守卫的 D1 包装 */
  db: DbSession;
  /** 已鉴权的管理员会话（匿名请求为 undefined） */
  auth?: { sub: string; ver: number };
  log: Logger;
}

export type Handler = (c: Ctx) => Promise<Response>;
export type Middleware = (c: Ctx, next: Handler) => Promise<Response>;
