/**
 * Cache API 封装 + 单飞（single-flight）。方案 §A6 最大增量。
 * caches.default 不计入 D1 额度、不占 DO 请求、命中时 CPU 近乎为零。
 *
 * 注意：单飞只在**同一 isolate 内**生效，跨边缘节点无效。
 * 对个人 + 面试演示流量足够；不要为此引入分布式锁（会把 DO 额度推高）。
 */

const inflight = new Map<string, Promise<unknown>>();

export async function cachedJson<T>(
  key: string,
  ttl: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cache = (caches as unknown as { default: Cache }).default;
  const req = new Request(`https://c.internal/${key}`);

  const hit = await cache.match(req);
  if (hit) return (await hit.json()) as T;

  if (inflight.has(key)) return inflight.get(key) as Promise<T>;

  const p = (async () => {
    const data = await loader();
    const res = new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `max-age=${ttl}`,
      },
    });
    await cache.put(req, res.clone());
    return data;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/** L2 失效策略：版本号即缓存键（§A6.2）。发布时递增 content_version 即可，零 purge 调用。 */
export function contentCacheKey(path: string, contentVersion: number): string {
  return `cv${contentVersion}:${path}`;
}
