import type { Ctx } from '../../core/context';
import { quizRepo } from '../../data/repositories/quiz.repo';

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

/** 选择题列表（不含答案，DTO 白名单） */
export async function listQuestionsSvc(c: Ctx, chapterId: number) {
  const rows = await quizRepo.listQuestions(c.db, chapterId);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    stem: r.stem,
    options: parseJson(r.options) as string[],
  }));
}

/** SQL 实训题（不含 answer_sql） */
export async function getSqlExerciseSvc(c: Ctx, id: number) {
  const r = await quizRepo.getSqlExercise(c.db, id);
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    datasetJson: parseJson(r.dataset_json),
  };
}

export async function listSqlExercisesSvc(c: Ctx, topicId: number) {
  const rows = await quizRepo.listSqlExercises(c.db, topicId);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    datasetJson: parseJson(r.dataset_json),
  }));
}

/**
 * 判题在**客户端 sql.js** 内完成（跑 userSql 与 answer_sql 的结果集比对）。
 * 服务端此处仅记录尝试（框架阶段返回结构桩，真实落库待内容阶段）。
 */
export async function submitSqlSvc(_c: Ctx, b: { exerciseId?: number; userId?: string }) {
  return {
    received: true,
    exerciseId: b.exerciseId ?? null,
    note: 'judging performed client-side via sql.js; server records attempt only',
  };
}
