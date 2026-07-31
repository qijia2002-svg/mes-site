import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ---- DTO（与后端白名单对齐） ----
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
export interface LearningPath {
  id: number;
  slug: string;
  title: string;
  description: string;
  topicIds: number[];
  sort: number;
  status: string;
}
export interface Cert {
  id: number;
  slug: string;
  title: string;
  description: string;
  requireSql: boolean;
  requireQuiz: boolean;
  status: string;
}
export interface SqlExercise {
  id: number;
  title: string;
  prompt: string;
  datasetJson: unknown;
}
export interface QuizQuestion {
  id: number;
  type: string;
  stem: string;
  options: string[];
}

/** 统一 API 方法集合（框架阶段：覆盖全部已定义端点）。 */
export const api = {
  // 公共读
  health: () => apiGet<Health>('/api/v1/health'),
  topics: () => apiGet<Topic[]>('/api/v1/topics'),
  chapters: (topicId: number) => apiGet<Chapter[]>(`/api/v1/topics/${topicId}/chapters`),
  chapter: (id: number) => apiGet<Chapter>(`/api/v1/chapters/${id}`),

  // 进度（Phase 0.5）
  progress: (userId: string) =>
    apiGet<unknown>(`/api/v1/progress?userId=${encodeURIComponent(userId)}`),
  postProgress: (body: unknown) => apiPost('/api/v1/progress', body),

  // 学习路径 / 证书（Phase 3）
  learningPaths: () => apiGet<LearningPath[]>('/api/v1/learning-paths'),
  certifications: () => apiGet<Cert[]>('/api/v1/certifications'),

  // 题库 / SQL 实训（Phase 2）
  quizQuestions: (chapterId: number) =>
    apiGet<QuizQuestion[]>(`/api/v1/quiz/questions?chapterId=${chapterId}`),
  sqlExercises: (topicId: number) =>
    apiGet<SqlExercise[]>(`/api/v1/sql-exercises?topicId=${topicId}`),
  sqlExercise: (id: number) => apiGet<SqlExercise>(`/api/v1/sql-exercises/${id}`),
  submitSql: (id: number, body: unknown) =>
    apiPost(`/api/v1/sql-exercises/${id}/submit`, body),

  // 后台（Phase 1，需管理员登录）
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
    apiPost('/api/v1/auth/login', body),
  logout: () => apiPost('/api/v1/auth/logout', {}),
};
