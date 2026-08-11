/**
 * 统一 API 客户端。
 * 职责：统一响应包络解包、统一错误对象（含 traceId 供用户报障）、
 * Cookie 会话（全站登录态）。
 */

export interface ApiEnvelope<T> {
  code: number;
  data: T;
  msg: string;
  traceId: string;
}

/** 全链路唯一错误类型。UI 只认它，不认裸 Error。 */
export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(
    /** 业务错误码，见 openapi 错误码表；0 表示成功（不会构造成错误） */
    readonly code: number,
    message: string,
    /** 链路追踪 id，用户报障凭此定位；网络层错误时为 undefined */
    readonly traceId?: string,
    /** HTTP 状态码，网络层失败为 0 */
    readonly httpStatus: number = 0,
  ) {
    super(message);
  }

  /** 网络不可达 / DNS / 离线：与业务错误区分，UI 文案不同。 */
  get isNetwork(): boolean {
    return this.httpStatus === 0 && this.code === -1;
  }

  get isUnauthorized(): boolean {
    return this.httpStatus === 401 || this.code === 2001 || this.code === 2002 || this.code === 2003;
  }

  get isNotFound(): boolean {
    return this.httpStatus === 404 || this.code === 4001 || this.code === 4002;
  }

  get isRateLimited(): boolean {
    return this.httpStatus === 429 || this.code === 3001 || this.code === 3002;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

function buildHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  if (hasBody) headers['content-type'] = 'application/json';
  return headers;
}

/**
 * 解包响应。三条错误路径都要落到 ApiError，绝不让裸 Error / undefined 漏到 UI：
 *  1. 响应体不是 JSON（网关 502 返回 HTML）
 *  2. HTTP 非 2xx（此时优先读业务 msg/code/traceId，读不到用 HTTP 状态兜底）
 *  3. HTTP 200 但 code !== 0
 */
async function unwrap<T>(res: Response): Promise<T> {
  const traceHeader = res.headers.get('x-trace-id') ?? undefined;

  let body: Partial<ApiEnvelope<T>> | null = null;
  let rawText = '';
  try {
    rawText = await res.text();
    body = rawText ? (JSON.parse(rawText) as Partial<ApiEnvelope<T>>) : null;
  } catch {
    body = null;
  }

  if (!body || typeof body.code !== 'number') {
    throw new ApiError(
      res.ok ? 9000 : res.status,
      res.ok ? '服务返回了无法解析的响应' : `请求失败（HTTP ${res.status}）`,
      traceHeader,
      res.status,
    );
  }

  const traceId = body.traceId ?? traceHeader;

  if (!res.ok || body.code !== 0) {
    throw new ApiError(body.code, body.msg || `请求失败（HTTP ${res.status}）`, traceId, res.status);
  }

  return body.data as T;
}

async function request<T>(method: Method, path: string, payload?: unknown, timeoutMs = 0, signal?: AbortSignal): Promise<T> {
  const hasBody = payload !== undefined;
  const controller = timeoutMs > 0 ? new AbortController() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (controller) timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortSignal = signal ?? controller?.signal;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: buildHeaders(hasBody),
      body: hasBody ? JSON.stringify(payload) : undefined,
      signal: abortSignal,
    });
  } catch (e) {
    if (controller?.signal.aborted || signal?.aborted) {
      throw new ApiError(-1, '请求超时，请检查网络后重试', undefined, 0);
    }
    throw new ApiError(-1, e instanceof Error ? `网络不可达：${e.message}` : '网络不可达', undefined, 0);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return unwrap<T>(res);
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, 0, signal);
export const apiPost = <T>(path: string, payload: unknown = {}, timeoutMs = 0) =>
  request<T>('POST', path, payload, timeoutMs);
export const apiPut = <T>(path: string, payload: unknown = {}) => request<T>('PUT', path, payload);
export const apiDelete = <T>(path: string) => request<T>('DELETE', path);

/** 把任意 unknown 错误收敛成 ApiError，供组件层统一渲染。 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError(9000, err.message);
  return new ApiError(9000, '未知错误');
}
