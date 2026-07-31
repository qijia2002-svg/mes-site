// 统一 API 客户端：带 traceId、credentials（Cookie 会话）、统一错误。
export interface ApiResult<T> {
  code: number;
  data: T;
  msg: string;
  traceId: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResult<T>;
  if (body.code !== 0) {
    throw new Error(`${body.msg || '请求失败'} (code=${body.code})`);
  }
  return body.data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
  return parse<T>(res);
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parse<T>(res);
}

export async function apiPut<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  });
  return parse<T>(res);
}
