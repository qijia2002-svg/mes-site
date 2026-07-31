import type { Env } from '../env';

/** 结构化 JSON 日志。字段统一 schema（见方案 §A10.1）。 */
export interface Logger {
  info(m: Record<string, unknown>): void;
  warn(m: Record<string, unknown>): void;
  error(m: Record<string, unknown>): void;
}

export function createLogger(traceId: string, env: Env): Logger {
  const sink = (lvl: string, m: Record<string, unknown>) => {
    // 行尾不带换行干扰；console.log 在 Workers 中按行输出
    console.log(JSON.stringify({ ts: Date.now(), lvl, traceId, ...m }));
  };
  return {
    info: (m) => sink('info', m),
    warn: (m) => sink('warn', m),
    error: (m) => sink('error', m),
  };
}

/** 路由构造 Ctx 前的占位，trace 中间件会就地替换为带 traceId 的实例 */
export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
