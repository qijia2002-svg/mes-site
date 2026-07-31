import type { Logger } from '../core/logger';
import { AppError } from '../core/errors';

/**
 * DbSession：把 D1 硬约束变成**运行时护栏**（方案 §A4）。
 * 任何人写出"循环里查库"，在 Preview 环境第一次跑就会被 5002 打断，
 * 而不是上线后把 Worker 调用打到 50 次触发平台报错。用架构约束替代人工纪律。
 */

const MAX_STMT_PER_REQUEST = 40; // 免费版红线 50，留 20% 余量
const SLOW_QUERY_MS = 100;

export class DbSession {
  #used = 0;
  constructor(
    private readonly db: D1Database,
    private readonly log: Logger,
  ) {}

  get used(): number {
    return this.#used;
  }

  #charge(n: number): void {
    this.#used += n;
    if (this.#used > MAX_STMT_PER_REQUEST) {
      throw new AppError(5002, 500, '请求过于复杂', { used: this.#used });
    }
  }

  async first<T>(sql: string, ...binds: unknown[]): Promise<T | null> {
    this.#charge(1);
    return this.#run(() => this.db.prepare(sql).bind(...(binds as never[])).first<T>(), sql);
  }

  async all<T>(sql: string, ...binds: unknown[]): Promise<T[]> {
    this.#charge(1);
    const r = await this.#run(
      () => this.db.prepare(sql).bind(...(binds as never[])).all<T>(),
      sql,
    );
    return r.results;
  }

  async batch(stmts: D1PreparedStatement[]): Promise<D1Result[]> {
    this.#charge(stmts.length);
    return this.#run(() => this.db.batch(stmts), `batch(${stmts.length})`);
  }

  async exec(sql: string): Promise<void> {
    this.#charge(1);
    await this.#run(() => this.db.exec(sql), 'exec');
  }

  /** 写操作（INSERT/UPDATE/DELETE）。返回 D1Result。 */
  async run(sql: string, ...binds: unknown[]): Promise<D1Result> {
    this.#charge(1);
    return this.#run(
      () => this.db.prepare(sql).bind(...(binds as never[])).run(),
      sql,
    );
  }

  async #run<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } catch (err) {
      throw mapD1Error(err, label);
    } finally {
      const ms = Date.now() - t0;
      if (ms > SLOW_QUERY_MS) this.log.warn({ msg: 'slow_query', label, ms });
    }
  }
}

/** D1 错误映射到业务错误码。overloaded → 5001（触发 L1 降级）。 */
export function mapD1Error(err: unknown, label: string): AppError {
  const msg = err instanceof Error ? err.message : String(err);
  if (/overloaded/i.test(msg))
    return new AppError(5001, 503, '服务暂时不可用，请稍后重试', { label });
  return new AppError(9000, 500, '服务器内部错误', { label, raw: msg.slice(0, 200) });
}
