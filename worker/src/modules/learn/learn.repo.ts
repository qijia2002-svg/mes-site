import type { DbSession } from '../../data/db';

/**
 * learn-redesign 内容仓储（零基础重学 v1）。
 *
 * 安全铁律（ADR-017 / ADR-019）：
 *  - 列表/详情接口（getMicro）**绝不** SELECT answer 列；answer 是服务端机密，
 *    只在服务端判分的 getMicroAnswer 里读取，且永不出网。
 *  - micro 的 payload 经此层解析为对象后上抛；判分用的 answer 不在此层解析，
 *    由 service 层按需读取原始字符串。
 */

/** 微练习列表/详情 DTO（不含 answer）。 */
export interface MicroPracticeRow {
  id: number;
  node_id: number;
  kind: string; // match | order | pick
  prompt: string;
  payload: string; // JSON 字符串，不含答案
}

/** 判分专用：只取 answer + 两种反馈，不暴露给 API 层之外的任何地方。 */
export interface MicroAnswerRow {
  id: number;
  kind: string;
  answer: string; // JSON 字符串：match/order/pick 各异
  feedback_ok: string;
  feedback_bad: string;
}

export const learnRepo = {
  /** 单条微练习（不含 answer）。查不到返回 null。 */
  getMicro(db: DbSession, id: number): Promise<MicroPracticeRow | null> {
    return db.first<MicroPracticeRow>(
      `SELECT id, node_id, kind, prompt, payload
       FROM micro_practices WHERE id = ?1`,
      id,
    );
  },

  /** 判分专用：取 answer + 反馈文案。仅服务端判分逻辑内使用，不通过 API 下发。 */
  getMicroAnswer(db: DbSession, id: number): Promise<MicroAnswerRow | null> {
    return db.first<MicroAnswerRow>(
      `SELECT id, kind, answer, feedback_ok, feedback_bad
       FROM micro_practices WHERE id = ?1`,
      id,
    );
  },
};
