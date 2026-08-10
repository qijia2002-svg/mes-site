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

/** 节点进阶详解行（node_explainers 全部对外列，无隐藏列）。 */
export interface NodeExplainerRow {
  id: number;
  node_id: number;
  tier: string; // overview | detail
  kind: string; // plain | example | mapping | misconception
  title: string;
  body_md: string;
  icon: string;
  sort: number;
}

/** 分级提示行。只取单个 level，绝不整组取出（整组取出等于把 L3 提前送到浏览器）。 */
export interface PracticeHintRow {
  target_type: string; // quiz | sql | sim | micro
  target_id: number;
  level: number; // 1 | 2 | 3
  body_md: string;
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

  /**
   * 某节点的进阶详解列表，按 sort 升序。
   * tier 省略时返回该节点全部层级；给定时只过滤该层级（?2 仅在此分支绑定）。
   * tier 的合法性由上层校验，此处只负责参数化查询，不做业务判断。
   */
  listNodeExplainers(db: DbSession, nodeId: number, tier?: string): Promise<NodeExplainerRow[]> {
    const cols = 'id, node_id, tier, kind, title, body_md, icon, sort';
    if (tier === undefined) {
      return db.all<NodeExplainerRow>(
        `SELECT ${cols} FROM node_explainers WHERE node_id = ?1 ORDER BY sort ASC`,
        nodeId,
      );
    }
    return db.all<NodeExplainerRow>(
      `SELECT ${cols} FROM node_explainers WHERE node_id = ?1 AND tier = ?2 ORDER BY sort ASC`,
      nodeId,
      tier,
    );
  },

  /** 单条分级提示。查不到返回 null。一次只取一个 level（ADR-019）。 */
  getPracticeHint(
    db: DbSession,
    targetType: string,
    targetId: number,
    level: number,
  ): Promise<PracticeHintRow | null> {
    return db.first<PracticeHintRow>(
      `SELECT target_type, target_id, level, body_md
       FROM practice_hints
       WHERE target_type = ?1 AND target_id = ?2 AND level = ?3`,
      targetType,
      targetId,
      level,
    );
  },

  /**
   * 下一级提示是否存在。只回存在性，**绝不 SELECT body_md**——
   * 这个查询的唯一用途是点亮「再看下一条」按钮，取到正文就等于提前泄露 L2/L3。
   */
  async hasPracticeHintLevel(
    db: DbSession,
    targetType: string,
    targetId: number,
    level: number,
  ): Promise<boolean> {
    const r = await db.first<{ one: number }>(
      `SELECT 1 AS one
       FROM practice_hints
       WHERE target_type = ?1 AND target_id = ?2 AND level = ?3
       LIMIT 1`,
      targetType,
      targetId,
      level,
    );
    return r !== null;
  },
};
