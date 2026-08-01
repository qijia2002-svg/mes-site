import type { DbSession } from '../db';

/**
 * Repository 契约（§A4.2）：只出现 prepare-bind，禁止字符串拼接 SQL。
 * R6 铁律：`answer` / `answer_sql` 两列**永不出现在任何 SELECT 列表**里，
 * 从数据访问层就物理杜绝答案泄露，而不是依赖上层 DTO 记得删字段。
 */

export interface QuestionRow {
  id: number;
  chapter_id: number;
  type: string;
  stem: string;
  options: string; // JSON 数组
}

export interface SqlExerciseRow {
  id: number;
  topic_id: number;
  title: string;
  prompt: string;
  schema_hint: string;
  answer_hash: string | null;
  dataset_json: string; // JSON
}

// 依赖索引：idx_questions_chapter / idx_sql_ex_topic
export const quizRepo = {
  /** 选择题列表（**不含 answer**，防缓存泄露 R6） */
  listQuestions: (db: DbSession, chapterId: number, cursor = 0) =>
    db.all<QuestionRow>(
      `SELECT id, chapter_id, type, stem, options
       FROM questions WHERE chapter_id = ?1 AND id > ?2 ORDER BY id LIMIT 100`,
      chapterId,
      cursor,
    ),

  /** SQL 实训题详情（**不含 answer_sql**；只下发 answer_hash 供客户端比对） */
  getSqlExercise: (db: DbSession, id: number) =>
    db.first<SqlExerciseRow>(
      `SELECT id, topic_id, title, prompt, schema_hint, answer_hash, dataset_json
       FROM sql_exercises WHERE id = ?1`,
      id,
    ),

  /** 提交前的存在性校验（只取 id，避免多余列进内存） */
  existsSqlExercise: (db: DbSession, id: number) =>
    db.first<{ id: number }>(`SELECT id FROM sql_exercises WHERE id = ?1`, id),

  listSqlExercises: (db: DbSession, topicId: number, cursor = 0) =>
    db.all<SqlExerciseRow>(
      `SELECT id, topic_id, title, prompt, schema_hint, answer_hash, dataset_json
       FROM sql_exercises WHERE topic_id = ?1 AND id > ?2 ORDER BY id LIMIT 100`,
      topicId,
      cursor,
    ),

  /** 不限主题的全量列表（总览页 / 契约自检用），同样不含 answer_sql */
  listAllSqlExercises: (db: DbSession, cursor = 0) =>
    db.all<SqlExerciseRow>(
      `SELECT id, topic_id, title, prompt, schema_hint, answer_hash, dataset_json
       FROM sql_exercises WHERE id > ?1 ORDER BY id LIMIT 100`,
      cursor,
    ),
};
