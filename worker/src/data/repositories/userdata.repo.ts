import type { DbSession } from '../db';

/**
 * 跨设备用户数据 KV 仓储（Issue #2）。
 * 按登录账号 (sub) 隔离，value 为 JSON 字符串。
 * 幂等：INSERT OR REPLACE 覆盖同 (sub, k)。
 */
export const userDataRepo = {
  /** 读取某用户的某个键，不存在返回 null。 */
  get(db: DbSession, sub: string, k: string): Promise<string | null> {
    return db
      .first<{ v: string }>(`SELECT v FROM user_kv WHERE sub = ?1 AND k = ?2`, sub, k)
      .then((row) => row?.v ?? null);
  },

  /** 写入（覆盖）某用户的某个键。 */
  set(db: DbSession, sub: string, k: string, v: string, ts: number): Promise<D1Result> {
    return db.run(
      `INSERT OR REPLACE INTO user_kv (sub, k, v, updated_at) VALUES (?1, ?2, ?3, ?4)`,
      sub,
      k,
      v,
      ts,
    );
  },
};
