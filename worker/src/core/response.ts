import type { Ctx } from './context';
import { AppError } from './errors';

function json(c: Ctx, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-trace-id': c.traceId,
      'cache-control': 'no-store',
    },
  });
}

/** 成功响应：统一 { code:0, data, msg, traceId } */
export const ok = <T>(c: Ctx, data: T, status = 200): Response =>
  json(c, { code: 0, data, msg: 'ok', traceId: c.traceId }, status);

/** 失败响应：统一 { code, data:null, msg, traceId } */
export const fail = (c: Ctx, e: AppError): Response =>
  json(c, { code: e.code, data: null, msg: e.publicMsg, traceId: c.traceId }, e.status);
