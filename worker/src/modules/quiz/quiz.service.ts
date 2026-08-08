import type { Ctx } from '../../core/context';
import { Err } from '../../core/errors';
import { quizRepo, type SqlExerciseRow } from '../../data/repositories/quiz.repo';
import { recordProgressSvc } from '../progress/progress.service';

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

/** 单题深链（不含答案，DTO 白名单） */
export async function getQuestionSvc(c: Ctx, id: number) {
  const r = await quizRepo.getQuestion(c.db, id);
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    stem: r.stem,
    options: parseJson(r.options) as string[],
  };
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

/** 答案校验：比对用户答案与正确答案，返回对错 + 解析。
 *
 * 约定：`answer` 列存的是**选项索引**（0-based，多选用逗号分隔），不是选项文本。
 * 例如 options=["A","B","C","D"]、answer="1" 表示正确答案是 B。
 * 前端提交的是选项**文本**，因此这里先把索引映射回选项文本再比对；
 * 同时兼容 answer 直接存文本的老数据（opts.includes 命中即按文本比）。
 */
export async function gradeAnswerSvc(c: Ctx, questionId: number, userAnswer: string) {
  const row = await quizRepo.getAnswer(c.db, questionId);
  if (!row) return null;

  const opts = parseJson(row.options) as string[];
  let correct = false;
  let correctAnswerText = '';

  if (row.type === 'multi') {
    // 多选：answer 是索引串 "0,1,3"，映射成文本集合后比对
    const idxs = row.answer.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
    const correctTexts = idxs.map((i) => opts[i]).filter((t): t is string => typeof t === 'string');
    const userSet = userAnswer.split(',').map((s) => s.trim()).filter(Boolean).sort();
    const correctSet = correctTexts.map((t) => t.trim()).sort();
    correct = userSet.length > 0 && userSet.length === correctSet.length && userSet.every((v, i) => v === correctSet[i]);
    correctAnswerText = correctTexts.join(',');
  } else {
    // 单选/判断：索引 → 文本；兼容直接存文本
    const raw = row.answer.trim();
    if (opts.includes(raw)) {
      correctAnswerText = raw;
    } else {
      const idx = parseInt(raw, 10);
      correctAnswerText = typeof opts[idx] === 'string' ? opts[idx] : raw;
    }
    correct = userAnswer.trim() === correctAnswerText.trim() && correctAnswerText !== '';
  }

  return {
    correct,
    correctAnswer: correctAnswerText,
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
  userId: string;
  passed: boolean;
  clientHash: string;
}

// ---------- AI 判读自由理解（Workers AI） ----------

export interface AiGradeResult {
  /** 0-100 整数评分 */
  score: number;
  /** 中文反馈：到位与不到位的地方 */
  feedback: string;
  /** 用户遗漏或应补充的要点 */
  keyPoints: string[];
}

const AI_SYSTEM_PROMPT =
  '你是一名制造业数字化学习平台的 AI 评分助教。用户会提交对某个知识点的自由理解，' +
  '你需要评分并给出反馈。必须严格只返回 JSON，不要任何额外文字或 markdown 代码块标记。' +
  'JSON 格式：{"score": 0到100的整数, "feedback": "中文反馈，指出理解到位与不到位之处，80字内", ' +
  '"keyPoints": ["用户遗漏或应补充的要点1", "要点2"]}。评分标准：' +
  '完全覆盖参考答案要点且表述准确=80-100；覆盖主要要点但有偏差=60-79；' +
  '仅部分相关或明显误解=30-59；基本无关或空白=0-29。';

function buildAiPrompt(stem: string, reference: string, userText: string): string {
  return [
    `题目：${stem}`,
    reference ? `参考答案要点：${reference}` : '（本题无标准参考答案，请基于制造业常识评价用户理解的正确性与深度）',
    `用户的回答：${userText}`,
    '请按系统指令要求返回 JSON。',
  ].join('\n');
}

/** 容错解析 AI 返回的 JSON（模型偶尔会包 markdown 代码块） */
function parseAiResponse(raw: string): AiGradeResult {
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(cleaned.slice(start, end + 1));
      const score = Math.max(0, Math.min(100, Math.round(Number(obj.score) || 0)));
      const feedback = typeof obj.feedback === 'string' ? obj.feedback : '';
      const keyPoints = Array.isArray(obj.keyPoints)
        ? obj.keyPoints.filter((k: unknown) => typeof k === 'string').slice(0, 5)
        : [];
      return { score, feedback, keyPoints };
    } catch {
      /* 落到下方兜底 */
    }
  }
  return {
    score: 50,
    feedback: raw.slice(0, 200) || '已收到你的回答，但评分解析异常，请参考参考答案自行核对。',
    keyPoints: [],
  };
}

/**
 * AI 判读：用户写自由理解 → 调 Workers AI 评分。
 * 仅 open 题型可调用；reference_answer 从服务端读取，API 层不下发，避免泄题。
 * AI 调用失败时不抛错，返回兜底结果保证前端可用。
 */
export async function aiGradeSvc(c: Ctx, questionId: number, userText: string): Promise<AiGradeResult | null> {
  const row = await quizRepo.getReference(c.db, questionId);
  if (!row || row.type !== 'open') return null;

  try {
    const resp = await c.env.AI.run(
      '@cf/meta/llama-3.2-3b-instruct',
      {
        prompt: `${AI_SYSTEM_PROMPT}\n\n${buildAiPrompt(row.stem, row.reference_answer, userText)}\n请严格只返回 JSON。`,
        temperature: 0.3,
      },
    );
    const text = typeof (resp as { response?: unknown }).response === 'string'
      ? (resp as { response: string }).response
      : '';
    return parseAiResponse(text);
  } catch (e) {
    c.log.error({ msg: 'ai-grade failed', err: String(e) });
    return { score: 0, feedback: 'AI 评分服务暂时不可用，请稍后重试。', keyPoints: [] };
  }
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** 归一化提交入参（前端发 snake_case，这里同时兼容 camelCase）。userId 由路由层从会话中提取。 */
export function parseSubmitInput(userId: string, exerciseId: number, b: Record<string, unknown>): SubmitSqlInput {
  const rawHash = b.client_hash ?? b.clientHash;
  const clientHash = typeof rawHash === 'string' ? rawHash.trim().toLowerCase() : '';
  if (clientHash !== '' && !SHA256_HEX.test(clientHash)) throw Err.schemaRejected('client_hash');

  return { exerciseId, userId, passed: b.passed === true, clientHash };
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
  if (input.passed) {
    const r = await recordProgressSvc(c, {
      userId: input.userId,
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
