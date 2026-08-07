import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { userDataRepo } from '../../data/repositories/userdata.repo';

/**
 * 跨设备用户数据 KV（Issue #2 修复）。
 * 所有读写都按登录账号 c.auth.sub 隔离（路由走默认管线 auth + guardAll，未登录 401）。
 * 前端把原本只存浏览器 localStorage 的用户内容（作品集 / 个人资料 / 引擎状态 / 仿真状态）
 * 改为云端为主、本地为兜底，从而实现多设备一致。
 *
 * 端点：
 *   GET  /api/v1/user/data/:key  -> { value }  value 为任意 JSON，缺省返回 null
 *   PUT  /api/v1/user/data/:key  body { value } -> { ok }
 */

// 允许的键：字母数字 + 点/下划线/连字符，长度 1..64，避免任意表名/路径注入。
const KEY_RE = /^[a-zA-Z0-9_.\-]{1,64}$/;
// 单条 value 上限 256KB（字符串化后），防止 D1 行体积滥用。
const MAX_VALUE_BYTES = 256 * 1024;

function validKey(key: string): boolean {
  return KEY_RE.test(key);
}

function byteLen(s: string): number {
  // TextEncoder 在所有 Workers 运行时可用；退化用 length*2 估算。
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length * 2;
  }
}

/** GET /api/v1/user/data/:key —— 返回该用户的某键 JSON 值，缺省 null */
export async function getUserData(c: Ctx): Promise<Response> {
  const key = c.params.key ?? '';
  if (!validKey(key)) return fail(c, Err.schemaRejected('key'));
  const raw = await userDataRepo.get(c.db, c.auth!.sub, key);
  if (raw === null) return ok(c, { value: null });
  let value: unknown = null;
  try {
    value = JSON.parse(raw);
  } catch {
    // 云端脏数据兜底：返回 null，不让前端崩溃。
    value = null;
  }
  return ok(c, { value });
}

/** PUT /api/v1/user/data/:key —— 写入该用户的某键（覆盖） */
export async function putUserData(c: Ctx): Promise<Response> {
  const key = c.params.key ?? '';
  if (!validKey(key)) return fail(c, Err.schemaRejected('key'));

  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return fail(c, Err.schemaRejected('content-type'));
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return fail(c, Err.paramMissing());
  if (!('value' in body)) return fail(c, Err.paramMissing());

  let serialized: string;
  try {
    serialized = JSON.stringify(body.value);
  } catch {
    return fail(c, Err.schemaRejected('value'));
  }
  if (byteLen(serialized) > MAX_VALUE_BYTES) return fail(c, Err.tooLarge());

  await userDataRepo.set(c.db, c.auth!.sub, key, serialized, Date.now());
  return ok(c, { ok: true });
}
