import { expect } from 'vitest';

const BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:8788';

export interface CallOpts {
  body?: unknown;
  headers?: Record<string, string>;
  cookie?: string;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      // 仅对连接层错误（如 wrangler dev 偶发未就绪）重试，HTTP 错误直接上抛
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

/**
 * 通过真实 HTTP 调用 wrangler dev 起的 worker（完整中间件管线）。
 * - Host 由请求地址决定（127.0.0.1:8788）；写请求自动带 origin=BASE 以通过 security 中间件 Origin 校验。
 * - 返回原始 Response 与解析后的 JSON 信封（非 JSON 时 json=null）。
 */
export async function callApi(method: string, path: string, opts: CallOpts = {}) {
  const url = BASE + path;
  const h = new Headers(opts.headers ?? {});
  if (opts.body !== undefined) h.set('content-type', 'application/json');
  if (opts.cookie) h.set('cookie', opts.cookie);
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (!h.has('origin')) h.set('origin', BASE);
  }
  const res = await fetchWithRetry(url, {
    method,
    headers: h,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }
  return { res, json, text };
}

/** 断言响应符合统一信封 { code, data, msg, traceId } */
export function expectEnvelope(json: Record<string, unknown> | null) {
  expect(json).not.toBeNull();
  expect(typeof json!.code).toBe('number');
  expect(json!).toHaveProperty('msg');
  expect(typeof json!.traceId).toBe('string');
  expect((json!.traceId as string).length).toBeGreaterThan(0);
}
