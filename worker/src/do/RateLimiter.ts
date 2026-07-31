/**
 * RateLimiter Durable Object：令牌桶 + 登录阶梯锁定（方案 §A8.3 / §A8.4）。
 * 免费版 DO 为 SQLite-backed（见 wrangler.toml migrations 补正）。
 *
 * 设计要点：
 * - 只读接口**不挂** DO（靠 WAF 那 1 条规则 + Cache 兜底），避免 DO 与 Worker 额度双重消耗。
 * - 登录用账号+IP 双桶，一次 DO 往返同时完成计数、锁定判断与回填。
 */

interface Bucket {
  t: number; // 当前令牌数
  ts: number; // 上次回填时间戳(ms)
  fails?: number; // 登录失败计数（仅 login 桶）
  lockedUntil?: number; // 锁定到期时间戳(ms)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

interface ConsumeReq {
  key: string;
  capacity: number;
  refillPerSec: number;
  cost?: number;
}

interface ConsumeResp {
  allowed: boolean;
  retryAfterMs: number;
  locked?: boolean;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly state: DurableObjectState) {
    // 惰性加载：首次访问某 key 时才从 storage 取；无需启动时全量加载
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/consume') return this.consume(req);
    if (url.pathname === '/login') return this.login(req);
    if (url.pathname === '/loginFailure') return this.loginFailure(req);
    return new Response('Not Found', { status: 404 });
  }

  private async load(key: string): Promise<Bucket> {
    let b = this.buckets.get(key);
    if (!b) {
      const stored = await this.state.storage?.get<Bucket>(key);
      b = stored ?? { t: 0, ts: Date.now() };
      this.buckets.set(key, b);
    }
    return b;
  }

  private async persist(key: string, b: Bucket): Promise<void> {
    this.buckets.set(key, b);
    await this.state.storage?.put(key, b);
    await this.state.storage?.setAlarm(Date.now() + 3_600_000); // 1h 后清理冷键
  }

  private refill(b: Bucket, capacity: number, refillPerSec: number, now: number): void {
    b.t = Math.min(capacity, b.t + ((now - b.ts) / 1000) * refillPerSec);
    b.ts = now;
  }

  private async consume(req: Request): Promise<Response> {
    const { key, capacity, refillPerSec, cost = 1 } = (await req.json()) as ConsumeReq;
    const now = Date.now();
    const b = await this.load(key);
    this.refill(b, capacity, refillPerSec, now);

    const allowed = b.t >= cost;
    if (allowed) b.t -= cost;
    await this.persist(key, b);

    const retryAfterMs = allowed
      ? 0
      : Math.ceil(((cost - b.t) / refillPerSec) * 1000);
    return json({ allowed, retryAfterMs } as ConsumeResp);
  }

  /** 登录阶梯锁定：5 次锁 1 分钟 / 10 次锁 15 分钟。 */
  private async login(req: Request): Promise<Response> {
    const { key, capacity, refillPerSec } = (await req.json()) as ConsumeReq;
    const now = Date.now();
    const b = await this.load(key);
    this.refill(b, capacity, refillPerSec, now);

    if (b.lockedUntil && now < b.lockedUntil) {
      const retryAfterMs = b.lockedUntil - now;
      await this.persist(key, b);
      return Response.json({ allowed: false, retryAfterMs, locked: true } as ConsumeResp);
    }

    const allowed = b.t >= 1;
    if (allowed) b.t -= 1;
    await this.persist(key, b);
    const retryAfterMs = allowed ? 0 : Math.ceil((1 - b.t) / refillPerSec) * 1000;
    return json({ allowed, retryAfterMs } as ConsumeResp);
  }

  /** 登录失败时由 Worker 调用，累加失败计数并决定锁定。 */
  private async loginFailure(req: Request): Promise<Response> {
    const { key } = (await req.json()) as { key: string };
    const now = Date.now();
    const b = await this.load(key);
    b.fails = (b.fails ?? 0) + 1;
    if (b.fails >= 10) b.lockedUntil = now + 15 * 60_000;
    else if (b.fails >= 5) b.lockedUntil = now + 1 * 60_000;
    await this.persist(key, b);
    const locked = !!b.lockedUntil && now < b.lockedUntil;
    const retryAfterMs = locked ? b.lockedUntil! - now : 0;
    return json({ locked, retryAfterMs });
  }

  async alarm(): Promise<void> {
    // 清理长时间未使用的桶，控制 DO 存储在 5GB 免费额度内（实际用量极小）
    const now = Date.now();
    const all = await this.state.storage?.list<Bucket>();
    if (!all) return;
    for (const [key, b] of all) {
      if (now - b.ts > 3_600_000 && !b.lockedUntil) await this.state.storage?.delete(key);
    }
  }
}
