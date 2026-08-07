import type { DbSession } from '../db';

/**
 * 名称翻译 / 专业词典仓储（借鉴 RuoYi 字典管理的「字典类型 + 字典数据」双表结构，按需裁剪）。
 *
 * 两张表：
 *   dict_type —— 分组（SQL 基础 / 数据库 / 编程通用 / MES 领域）
 *   dict_data —— 每个英文词一条记录，含词性/中文/例句/分类/详解，按 (type_key, value) 唯一
 *
 * 全部走 DbSession 护栏（请求级语句数上限 + 慢查询日志），与现有 repo 一致。
 */

export interface DictTypeRow {
  id: number;
  type_key: string;
  name: string;
  sort: number;
  status: number;
  remark: string | null;
  created_at: number;
  updated_at: number;
}

export interface DictDataRow {
  id: number;
  type_key: string;
  value: string;
  pos: string | null;
  zh: string | null;
  example: string | null;
  example_zh: string | null;
  category: string | null;
  detail: string | null;
  sort: number;
  status: number;
  created_at: number;
  updated_at: number;
}

/** 新建/更新类型入参（created_at 由仓储统一填，updated_at 每次刷新）。 */
export interface DictTypeInput {
  type_key: string;
  name: string;
  sort?: number;
  status?: number;
  remark?: string | null;
}

export interface DictDataInput {
  type_key: string;
  value: string;
  pos?: string | null;
  zh?: string | null;
  example?: string | null;
  example_zh?: string | null;
  category?: string | null;
  detail?: string | null;
  sort?: number;
  status?: number;
}

export const dictRepo = {
  // ═══ 读取 ═══

  /** 所有字典类型，按 sort 升序。 */
  listTypes(db: DbSession): Promise<DictTypeRow[]> {
    return db.all<DictTypeRow>(
      `SELECT id, type_key, name, sort, status, remark, created_at, updated_at
       FROM dict_type ORDER BY sort ASC, id ASC`,
    );
  },

  /** 所有字典数据；传 typeKey 则只取该类型。按类型 sort、条目 sort 升序。 */
  listData(db: DbSession, typeKey?: string): Promise<DictDataRow[]> {
    if (typeKey) {
      return db.all<DictDataRow>(
        `SELECT d.* FROM dict_data d JOIN dict_type t ON t.type_key = d.type_key
         WHERE d.type_key = ?1
         ORDER BY d.sort ASC, d.id ASC`,
        typeKey,
      );
    }
    return db.all<DictDataRow>(
      `SELECT d.* FROM dict_data d JOIN dict_type t ON t.type_key = d.type_key
       ORDER BY t.sort ASC, d.sort ASC, d.id ASC`,
    );
  },

  /** 按词查一条（大写匹配，explainWord 用）。未命中返回 null。 */
  findByValue(db: DbSession, value: string): Promise<DictDataRow | null> {
    const key = value.trim().toUpperCase();
    if (!key) return Promise.resolve(null);
    return db.first<DictDataRow>(
      `SELECT * FROM dict_data WHERE value = ?1`,
      key,
    );
  },

  // ═══ 类型写操作 ═══

  createType(db: DbSession, input: DictTypeInput): Promise<number> {
    const now = Date.now();
    return db
      .run(
        `INSERT INTO dict_type (type_key, name, sort, status, remark, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        input.type_key,
        input.name,
        input.sort ?? 0,
        input.status ?? 1,
        input.remark ?? null,
        now,
        now,
      )
      .then((r) => Number(r.meta.last_row_id));
  },

  updateType(db: DbSession, id: number, input: DictTypeInput): Promise<D1Result> {
    return db.run(
      `UPDATE dict_type
       SET type_key = ?1, name = ?2, sort = ?3, status = ?4, remark = ?5, updated_at = ?6
       WHERE id = ?7`,
      input.type_key,
      input.name,
      input.sort ?? 0,
      input.status ?? 1,
      input.remark ?? null,
      Date.now(),
      id,
    );
  },

  /** 删除类型时一并删除其下词条，避免孤儿数据。返回最后一条删除的结果。 */
  async deleteType(db: DbSession, id: number): Promise<D1Result> {
    const type = await db.first<{ type_key: string }>(
      `SELECT type_key FROM dict_type WHERE id = ?1`,
      id,
    );
    if (!type) return db.run(`SELECT 1`); // 不存在，空操作
    await db.run(`DELETE FROM dict_data WHERE type_key = ?1`, type.type_key);
    return db.run(`DELETE FROM dict_type WHERE id = ?1`, id);
  },

  // ═══ 数据写操作 ═══

  createData(db: DbSession, input: DictDataInput): Promise<number> {
    const now = Date.now();
    return db
      .run(
        `INSERT INTO dict_data (type_key, value, pos, zh, example, example_zh, category, detail, sort, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
        input.type_key,
        input.value.trim().toUpperCase(),
        input.pos ?? null,
        input.zh ?? null,
        input.example ?? null,
        input.example_zh ?? null,
        input.category ?? null,
        input.detail ?? null,
        input.sort ?? 0,
        input.status ?? 1,
        now,
        now,
      )
      .then((r) => Number(r.meta.last_row_id));
  },

  updateData(db: DbSession, id: number, input: DictDataInput): Promise<D1Result> {
    return db.run(
      `UPDATE dict_data
       SET type_key = ?1, value = ?2, pos = ?3, zh = ?4, example = ?5, example_zh = ?6,
           category = ?7, detail = ?8, sort = ?9, status = ?10, updated_at = ?11
       WHERE id = ?12`,
      input.type_key,
      input.value.trim().toUpperCase(),
      input.pos ?? null,
      input.zh ?? null,
      input.example ?? null,
      input.example_zh ?? null,
      input.category ?? null,
      input.detail ?? null,
      input.sort ?? 0,
      input.status ?? 1,
      Date.now(),
      id,
    );
  },

  deleteData(db: DbSession, id: number): Promise<D1Result> {
    return db.run(`DELETE FROM dict_data WHERE id = ?1`, id);
  },
};
