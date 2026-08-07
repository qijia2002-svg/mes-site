// HMAC 会话签名/校验 + 常量时间比较。
// WebCrypto 在 Workers 运行时原生可用（globalThis.crypto.subtle）。

const b64urlEncode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlDecode = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const enc = new TextEncoder();

/** TS 5.7 下 Uint8Array 变为泛型；Web Crypto 的 keyData 期望 ArrayBuffer，这里显式转换。 */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

export async function hmacSign(msg: string, secret: string): Promise<string> {
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET 缺失或长度不足（<16字节），拒绝签名');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(enc.encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, toArrayBuffer(enc.encode(msg)));
  return b64urlEncode(sig);
}

export async function hmacVerify(msg: string, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(msg, secret);
  return constantTimeEqual(expected, sig);
}

/** 禁止用 === 比较签名（时序侧信道）。 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** 会话 token：base64url(JSON) . base64url(HMAC(JSON)) */
export async function signPayload(payloadJson: string, secret: string): Promise<string> {
  const sig = await hmacSign(payloadJson, secret);
  return `${b64urlEncode(enc.encode(payloadJson))}.${sig}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ ok: boolean; payload?: string }> {
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return { ok: false };
  const payloadJson = new TextDecoder().decode(b64urlDecode(payloadB64));
  const ok = await hmacVerify(payloadJson, sig, secret);
  return { ok, payload: ok ? payloadJson : undefined };
}
