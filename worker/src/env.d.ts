// 绑定与环境类型（唯一事实来源：根 wrangler.toml）
// 业务无关，可整体复制到下一项目。

export interface Env {
  /** D1 数据库（免费版单库单线程，500MB） */
  DB: D1Database;
  /** 限流 + 登录阶梯锁定 Durable Object */
  RATE_LIMITER: DurableObjectNamespace;
  /** Workers Static Assets（前端构建产物） */
  ASSETS: Fetcher;
  /** HMAC 会话签名密钥（wrangler secret put，绝不入库） */
  SESSION_SECRET: string;
  /** 后台登录口令（Phase 1 启用后台时使用，wrangler secret put） */
  ADMIN_PASSWORD?: string;
  /** Workers AI 绑定（AI 判读自由理解，调 @cf/meta/llama-3.1-8b-instruct） */
  AI: Ai;
  /** 部署期环境标识 */
  NODE_ENV: string;
}
