import type { DbSession } from '../db';

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

  /** SQL 实训题（**不含 answer_sql**，判题在客户端 sql.js 内完成） */
  getSqlExercise: (db: DbSession, id: number) =>
    db.first<SqlExerciseRow>(
      `SELECT id, topic_id, title, prompt, dataset_json
       FROM sql_exercises WHERE id = ?1`,
      id,
    ),

  listSqlExercises: (db: DbSession, topicId: number, cursor = 0) =>
    db.all<SqlExerciseRow>(
      `SELECT id, topic_id, title, prompt, dataset_json
       FROM sql_exercises WHERE topic_id = ?1 AND id > ?2 ORDER BY id LIMIT 100`,
      topicId,
      cursor,
    ),
};
