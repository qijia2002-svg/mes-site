/**
 * 匿名学员身份（F4 / AC-05）。
 * 零登录即可练：首次访问在 localStorage 落一个 UUID，之后全链路透传。
 * 不是账号体系——清缓存即失忆，这是 MVP 的明确取舍（Spec §3 不做学员账号）。
 */

const STORAGE_KEY = 'mes.anon_id';

/** 无 crypto.randomUUID 时的退化实现（旧 WebView / 非安全上下文）。 */
function fallbackUuid(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 v4 标记位
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallbackUuid();
}

// 进程内缓存：localStorage 在隐私模式下可能抛异常，抛了也要保证同一会话内 id 稳定。
let cached: string | null = null;

/** 取当前匿名 id，不存在则生成并持久化。 */
export function getAnonId(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length >= 8) {
      cached = stored;
      return cached;
    }
    const created = newId();
    localStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return cached;
  } catch {
    // Safari 无痕 / 存储被禁：退化为内存态，本次会话仍可练，只是刷新后重来。
    cached = newId();
    return cached;
  }
}
