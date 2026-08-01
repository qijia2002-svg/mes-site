import type { Ctx } from '../../core/context';
import { Err } from '../../core/errors';
import { quizRepo, type SqlExerciseRow } from '../../data/repositories/quiz.repo';
import { recordProgressSvc, assertAnonId } from '../progress/progress.service';

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

/** 模块汇总：按 topic 查所有章节的题目（不含答案） */
export async function listTopicQuestionsSvc(c: Ctx, topicId: number) {
  const rows = await quizRepo.listQuestionsByTopic(c.db, topicId);
  return rows.map((r) => ({
    id: r.id,
    chapterId: r.chapter_id,
    type: r.type,
    stem: r.stem,
    options: parseJson(r.options) as string[],
  }));
}

/** 答案校验：比对用户答案与正确答案，返回对错 + 解析 */
export async function gradeAnswerSvc(c: Ctx, questionId: number, userAnswer: string) {
  const row = await quizRepo.getAnswer(c.db, questionId);
  if (!row) return null;

  let correct = false;
  if (row.type === 'multi') {
    // 多选：排序后比对
    const userSet = userAnswer.split(',').map((s) => s.trim()).sort();
    const correctSet = row.answer.split(',').map((s) => s.trim()).sort();
    correct = userSet.length === correctSet.length && userSet.every((v, i) => v === correctSet[i]);
  } else {
    // 单选/判断：直接比对
    correct = userAnswer.trim() === row.answer.trim();
  }

  return {
    correct,
    correctAnswer: row.answer,
    explanation: row.explanation,
  };
}

/**
 * SQL 实训题 DTO（ADR-005 判题契约）。
 *
 * 必须下发 answerHash：判题在浏览器 sql.js 内完成，客户端拿用户 SQL 的结果集
 * 算 SHA-256 后与它比对。**漏掉这个字段不会报错，只会让全站每道题都判不通过**
 * （前端 readAnswerHash 拿到空串 → 静默失效），属最危险的失效模式，勿删。
 *
 * 必须不含 answer_sql：答案 SQL 是服务端机密，repo 层的 SELECT 列白名单已
 * 物理杜绝它进内存，这里再显式列一遍字段作为第二道闸。
 */
function toSqlExerciseDto(r: SqlExerciseRow) {
  return {
    id: r.id,
    topicId: r.topic_id,
    title: r.title,
    prompt: r.prompt,
    // 无提示时给空串而不是 null，前端可直接 `if (schemaHint)` 判空
    schemaHint: r.schema_hint ?? '',
    // 兼容前端 snake_case 读取口径（readSchemaHint / readAnswerHash 两种都认）
    schema_hint: r.schema_hint ?? '',
    answerHash: r.answer_hash ?? '',
    answer_hash: r.answer_hash ?? '',
    datasetJson: parseJson(r.dataset_json),
  };
}

/** SQL 实训题详情（含 answerHash，不含 answer_sql） */
export async function getSqlExerciseSvc(c: Ctx, id: number) {
  const r = await quizRepo.getSqlExercise(c.db, id);
  if (!r) return null;
  return toSqlExerciseDto(r);
}

/** SQL 实训题列表；topicId 省略时返回全部（供总览页/契约自检） */
export async function listSqlExercisesSvc(c: Ctx, topicId?: number) {
  const rows =
    topicId === undefined
      ? await quizRepo.listAllSqlExercises(c.db)
      : await quizRepo.listSqlExercises(c.db, topicId);
  return rows.map(toSqlExerciseDto);
}

export interface SubmitSqlInput {
  exerciseId: number;
  anonId: string | null;
  passed: boolean;
  clientHash: string;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** 归一化提交入参（前端发 snake_case，这里同时兼容 camelCase）。 */
export function parseSubmitInput(exerciseId: number, b: Record<string, unknown>): SubmitSqlInput {
  const rawAnon = b.anon_id ?? b.anonId;
  const anonId = typeof rawAnon === 'string' && rawAnon !== '' ? assertAnonId(rawAnon) : null;

  const rawHash = b.client_hash ?? b.clientHash;
  const clientHash = typeof rawHash === 'string' ? rawHash.trim().toLowerCase() : '';
  if (clientHash !== '' && !SHA256_HEX.test(clientHash)) throw Err.schemaRejected('client_hash');

  return { exerciseId, anonId, passed: b.passed === true, clientHash };
}

/**
 * 提交一次判题结果。
 *
 * 判定以**客户端**为准：答案 SQL 永不出网，服务端没有复算能力，这里不做二次裁决。
 * 服务端职责只有两件——校验题目存在、把通过状态落进度。
 * 进度写入与前端随后调用的 POST /api/v1/progress 共用同一幂等键
 * （anonId:exercise:itemId:passed:当天），因此两条路径都跑也不会重复计数。
 */
export async function submitSqlSvc(c: Ctx, input: SubmitSqlInput) {
  const exists = await quizRepo.existsSqlExercise(c.db, input.exerciseId);
  if (!exists) return null;

  let progressUpdated = false;
  if (input.passed && input.anonId) {
    const r = await recordProgressSvc(c, {
      anonId: input.anonId,
      itemType: 'exercise',
      itemId: String(input.exerciseId),
      status: 'passed',
      payload: { clientHash: input.clientHash },
    });
    progressUpdated = r.progressUpdated;
  }

  return {
    ok: true,
    exerciseId: input.exerciseId,
    passed: input.passed,
    progressUpdated,
    progress_updated: progressUpdated,
  };
}
