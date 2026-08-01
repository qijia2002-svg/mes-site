import { apiGet, apiPost, apiPut, apiDelete } from './client';
import { getAnonId } from '../lib/anonId';

// ---- DTO（与 docs/api/openapi.yaml + Spec §5 对齐） ----

export interface Health {
  status: string;
  degrade: string;
  d1Stmts: number;
  ts: number;
}

export interface Topic {
  id: number;
  slug: string;
  title: string;
  description: string;
  modules: string[];
  status?: string;
}

export interface Chapter {
  id: number;
  topicId: number;
  title: string;
  sort: number;
  status: string;
  updatedAt: number;
}

/** 章节详情：md 为不可信输入，渲染前必须过 renderChapterMarkdown。 */
export interface ChapterDetail {
  id: number;
  topicId: number;
  title: string;
  md: string;
  schemaVersion?: number;
  updatedAt?: number;
}

export interface LearningPath {
  id: number;
  slug: string;
  title: string;
  description: string;
  topicIds: number[];
  sort: number;
  status: string;
}

/**
 * SQL 实训题（Spec §5 DTO 白名单 / AC-04）。
 * 只含 answer_hash，**绝不含 answer_sql**——答案永不出网。
 */
export interface SqlExercise {
  id: number;
  topicId?: number;
  title: string;
  prompt: string;
  /** 表结构提示文本，后端保证为字符串（无提示给空串） */
  schemaHint?: string;
  schema_hint?: string;
  /** 期望结果集的归一化 SHA-256，判题在客户端比对 */
  answerHash?: string;
  answer_hash?: string;
}

export interface QuizQuestion {
  id: number;
  type: string;
  stem: string;
  options: string[];
}

// ---- 进度（F4/F5） ----

export type ProgressItemType = 'chapter' | 'sql_exercise';
export type ProgressStatus = 'read' | 'passed' | 'failed';

export interface RecordProgressBody {
  anon_id: string;
  item_type: ProgressItemType;
  item_id: string;
  status: ProgressStatus;
}

/** 今日完成统计。后端字段名若有出入，这里全为可选，UI 侧按 0 兜底。 */
export interface TodayProgress {
  chapterRead?: number;
  sqlPassed?: number;
  total?: number;
}

/** 单条进度事件（来自 listProgressSvc 的 events 字段）。 */
export interface ProgressEvent {
  eventId: string;
  itemType?: string;
  itemId?: string;
  status?: string;
  payload?: unknown;
  createdAt?: number;
}

export interface ProgressTotals {
  chapterDone: number;
  exerciseDone: number;
  exercisePassed: number;
  quizDone: number;
}

/** GET /api/v1/progress 全量汇总。服务端 listProgressSvc 实际返回以下字段，
 *  前端类型此前只声明了 items/today，导致 completedChapterIds 拿不到类型——补齐。 */
export interface ProgressSummary {
  anonId?: string;
  totals?: ProgressTotals;
  today?: TodayProgress;
  /** 已完成（已读）章节的 item_id 清单，前端据此在仪表盘标记进度，无需逐章查。 */
  completedChapterIds?: string[];
  passedExerciseIds?: string[];
  events?: ProgressEvent[];
}

export interface SubmitSqlResult {
  ok?: boolean;
  progress_updated?: boolean;
  progressUpdated?: boolean;
}

/** 兼容后端 snake_case / camelCase 两种命名，避免单点字段名不一致导致整页失效。 */
export function readSchemaHint(e: SqlExercise): string {
  return e.schemaHint ?? e.schema_hint ?? '';
}
export function readAnswerHash(e: SqlExercise): string {
  return (e.answerHash ?? e.answer_hash ?? '').trim().toLowerCase();
}

const q = encodeURIComponent;

export const api = {
  // 公共读
  health: () => apiGet<Health>('/api/v1/health'),
  topics: () => apiGet<Topic[]>('/api/v1/topics'),
  chapters: (topicId: number) => apiGet<Chapter[]>(`/api/v1/topics/${topicId}/chapters`),
  chapter: (id: number) => apiGet<ChapterDetail>(`/api/v1/chapters/${id}`),

  // 学习路径
  learningPaths: () => apiGet<LearningPath[]>('/api/v1/learning-paths'),
  learningPath: (id: number) => apiGet<LearningPath>(`/api/v1/learning-paths/${id}`),

  // 题库 / SQL 实训
  quizQuestions: (chapterId: number) =>
    apiGet<QuizQuestion[]>(`/api/v1/quiz/questions?chapterId=${chapterId}`),
  topicQuestions: (topicId: number) =>
    apiGet<QuizQuestion[]>(`/api/v1/quiz/topic-questions?topicId=${topicId}`),
  gradeQuestion: (questionId: number, answer: string) =>
    apiPost<{ correct: boolean; correctAnswer: string; explanation: string }>(
      '/api/v1/quiz/grade',
      { question_id: questionId, answer },
    ),
  sqlExercises: (topicId: number) =>
    apiGet<SqlExercise[]>(`/api/v1/sql-exercises?topicId=${topicId}`),
  sqlExercise: (id: number) => apiGet<SqlExercise>(`/api/v1/sql-exercises/${id}`),
  submitSql: (id: number, body: { passed: boolean; client_hash: string }) =>
    apiPost<SubmitSqlResult>(`/api/v1/sql-exercises/${id}/submit`, {
      anon_id: getAnonId(),
      ...body,
    }),

  // 进度（匿名身份，anon_id 同时走 query 与 x-anon-id 头）
  progress: () => apiGet<ProgressSummary>(`/api/v1/progress?anon_id=${q(getAnonId())}`),
  progressToday: () => apiGet<TodayProgress>(`/api/v1/progress/today?anon_id=${q(getAnonId())}`),
  recordProgress: (item: Omit<RecordProgressBody, 'anon_id'>) =>
    apiPost<{ ok?: boolean }>('/api/v1/progress', { anon_id: getAnonId(), ...item }),

  // 后台（需管理员登录）
  adminTopics: () => apiGet<Topic[]>('/api/v1/admin/topics'),
  createTopic: (body: unknown) => apiPost('/api/v1/admin/topics', body),
  updateTopic: (id: number, body: unknown) => apiPut(`/api/v1/admin/topics/${id}`, body),
  deleteTopic: (id: number) => apiDelete(`/api/v1/admin/topics/${id}`),
  adminChapters: (topicId: number) =>
    apiGet<Chapter[]>(`/api/v1/admin/chapters?topicId=${topicId}`),
  createChapter: (body: unknown) => apiPost('/api/v1/admin/chapters', body),
  updateChapter: (id: number, body: unknown) => apiPut(`/api/v1/admin/chapters/${id}`, body),

  // 认证
  login: (body: { username: string; password: string }) =>
    apiPost<{ ok: boolean }>('/api/v1/auth/login', body),
  logout: () => apiPost<{ ok: boolean }>('/api/v1/auth/logout', {}),
};
