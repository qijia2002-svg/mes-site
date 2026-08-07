import type { Ctx } from '../../core/context';
import { ok, fail } from '../../core/response';
import { Err } from '../../core/errors';
import { dictRepo, type DictTypeRow, type DictDataRow } from '../../data/repositories/dict.repo';

/**
 * 名称翻译 / 专业词典 API（借鉴 RuoYi 字典管理，按需裁剪为双表结构）。
 *
 * 读取（公开，无需登录，供「名称翻译」页与选中翻译缓存使用）：
 *   GET /api/v1/dict -> { types: DictType[], data: DictData[] }
 *
 * 后台管理（admin 管线，单管理员）：
 *   POST   /api/v1/admin/dict/type       创建类型
 *   PUT    /api/v1/admin/dict/type/:id   更新类型
 *   DELETE /api/v1/admin/dict/type/:id   删除类型（连带其词条）
 *   POST   /api/v1/admin/dict/data        创建词条
 *   PUT    /api/v1/admin/dict/data/:id    更新词条
 *   DELETE /api/v1/admin/dict/data/:id    删除词条
 */

const TYPE_KEY_RE = /^[a-zA-Z0-9_]{1,32}$/;
const MAX_NAME = 32;
const MAX_VALUE = 40;
const MAX_FIELD = 200;

async function jsonBody(c: Ctx): Promise<Record<string, unknown>> {
  const ct = c.req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw Err.schemaRejected();
  return (await c.req.json()) as Record<string, unknown>;
}

function str(v: unknown, max = MAX_FIELD): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toTypeDto(r: DictTypeRow) {
  return { id: r.id, typeKey: r.type_key, name: r.name, sort: r.sort, status: r.status, remark: r.remark };
}
function toDataDto(r: DictDataRow) {
  return {
    id: r.id,
    typeKey: r.type_key,
    value: r.value,
    pos: r.pos ?? '',
    zh: r.zh ?? '',
    example: r.example ?? '',
    exampleZh: r.example_zh ?? '',
    category: r.category ?? '',
    detail: r.detail ?? '',
    sort: r.sort,
    status: r.status,
  };
}

// ═══ 读取 ═══

/** GET /api/v1/dict —— 全量词典（类型 + 数据），供前端 TanStack Query 缓存。 */
export async function getDict(c: Ctx): Promise<Response> {
  const [types, data] = await Promise.all([
    dictRepo.listTypes(c.db),
    dictRepo.listData(c.db),
  ]);
  return ok(c, {
    types: types.map(toTypeDto),
    data: data.map(toDataDto),
  });
}

// ═══ 类型 CRUD ═══

export async function createDictType(c: Ctx): Promise<Response> {
  const b = await jsonBody(c);
  const typeKey = str(b.type_key, 32);
  const name = str(b.name, MAX_NAME);
  if (!TYPE_KEY_RE.test(typeKey)) return fail(c, Err.schemaRejected('type_key'));
  if (!name) return fail(c, Err.paramMissing());

  const existing = await dictRepo.listTypes(c.db);
  if (existing.some((t) => t.type_key === typeKey)) {
    return fail(c, Err.schemaRejected('type_key 已存在'));
  }
  const id = await dictRepo.createType(c.db, {
    type_key: typeKey,
    name,
    sort: num(b.sort, existing.length + 1),
    status: num(b.status, 1),
    remark: b.remark != null ? str(b.remark) : null,
  });
  return ok(c, { id, typeKey, name });
}

export async function updateDictType(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const b = await jsonBody(c);
  const typeKey = str(b.type_key, 32);
  const name = str(b.name, MAX_NAME);
  if (!TYPE_KEY_RE.test(typeKey)) return fail(c, Err.schemaRejected('type_key'));
  if (!name) return fail(c, Err.paramMissing());

  await dictRepo.updateType(c.db, id, {
    type_key: typeKey,
    name,
    sort: num(b.sort, 0),
    status: num(b.status, 1),
    remark: b.remark != null ? str(b.remark) : null,
  });
  return ok(c, { ok: true });
}

export async function deleteDictType(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  await dictRepo.deleteType(c.db, id);
  return ok(c, { ok: true });
}

// ═══ 数据 CRUD ═══

async function resolveTypeKey(c: Ctx, typeKey: string): Promise<string | null> {
  if (!TYPE_KEY_RE.test(typeKey)) return null;
  const types = await dictRepo.listTypes(c.db);
  return types.some((t) => t.type_key === typeKey) ? typeKey : null;
}

export async function createDictData(c: Ctx): Promise<Response> {
  const b = await jsonBody(c);
  const typeKey = await resolveTypeKey(c, str(b.type_key, 32));
  if (!typeKey) return fail(c, Err.schemaRejected('type_key'));
  const value = str(b.value, MAX_VALUE);
  if (!value) return fail(c, Err.paramMissing());

  const id = await dictRepo.createData(c.db, {
    type_key: typeKey,
    value,
    pos: b.pos != null ? str(b.pos, 24) : null,
    zh: b.zh != null ? str(b.zh, 80) : null,
    example: b.example != null ? str(b.example, 120) : null,
    example_zh: b.example_zh != null ? str(b.example_zh, 80) : null,
    category: b.category != null ? str(b.category, 16) : null,
    detail: b.detail != null ? str(b.detail, 200) : null,
    sort: num(b.sort, 0),
    status: num(b.status, 1),
  });
  return ok(c, { id, typeKey, value });
}

export async function updateDictData(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  const b = await jsonBody(c);
  const typeKey = await resolveTypeKey(c, str(b.type_key, 32));
  if (!typeKey) return fail(c, Err.schemaRejected('type_key'));
  const value = str(b.value, MAX_VALUE);
  if (!value) return fail(c, Err.paramMissing());

  await dictRepo.updateData(c.db, id, {
    type_key: typeKey,
    value,
    pos: b.pos != null ? str(b.pos, 24) : null,
    zh: b.zh != null ? str(b.zh, 80) : null,
    example: b.example != null ? str(b.example, 120) : null,
    example_zh: b.example_zh != null ? str(b.example_zh, 80) : null,
    category: b.category != null ? str(b.category, 16) : null,
    detail: b.detail != null ? str(b.detail, 200) : null,
    sort: num(b.sort, 0),
    status: num(b.status, 1),
  });
  return ok(c, { ok: true });
}

export async function deleteDictData(c: Ctx): Promise<Response> {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) return fail(c, Err.paramMissing());
  await dictRepo.deleteData(c.db, id);
  return ok(c, { ok: true });
}
