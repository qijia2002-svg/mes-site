/**
 * AppError 体系与错误码分区。
 * `publicMsg` 只允许固定文案，禁止把 D1 原始错误回传前端（会泄露表名/列名）。
 * 原始错误只进结构化日志，前端凭 traceId 报障。
 */
export class AppError extends Error {
  constructor(
    public readonly code: number,
    public readonly status: number,
    public readonly publicMsg: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(publicMsg);
    this.name = 'AppError';
  }
}

export const Err = {
  // 1xxx 入参/校验
  paramMissing: () => new AppError(1001, 400, '缺少必要参数'),
  tooLarge: () => new AppError(1002, 413, '请求体过大'),
  schemaRejected: (field?: string) => new AppError(1003, 400, '参数未通过校验', { field }),
  // 2xxx 认证授权
  unauthorized: () => new AppError(2001, 401, '未登录或登录已失效'),
  tokenExpired: () => new AppError(2002, 401, '登录已过期'),
  tokenVersion: () => new AppError(2003, 401, '登录状态已失效，请重新登录'),
  badOrigin: () => new AppError(2004, 403, '非法来源'),
  // 3xxx 限流锁定
  rateLimited: (retryAfterMs: number) =>
    new AppError(3001, 429, '请求过于频繁，请稍后再试', { retryAfterMs }),
  loginLocked: (retryAfterMs: number) =>
    new AppError(3002, 429, '账号已锁定，请稍后再试', { retryAfterMs }),
  // 4xxx 业务规则
  draftHidden: () => new AppError(4001, 404, '内容不存在或尚未发布'),
  notFound: () => new AppError(4002, 404, '题目不存在'),
  /** 拦住「用空内容覆盖已有正文」这类不可逆写入，要清空必须显式声明 */
  refuseBlankOverwrite: (field: string) =>
    new AppError(4003, 409, '拒绝用空内容覆盖已有正文', { field }),
  // 5xxx 依赖故障
  d1Overloaded: () => new AppError(5001, 503, '服务暂时不可用，请稍后重试'),
  budgetExceeded: () => new AppError(5002, 500, '请求过于复杂'),
  doUnreachable: () => new AppError(5003, 503, '服务暂时不可用，请稍后重试'),
  // 9xxx 未分类
  internal: (detail?: Record<string, unknown>) => new AppError(9000, 500, '服务器内部错误', detail),
};
