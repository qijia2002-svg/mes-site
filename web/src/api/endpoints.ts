import { apiGet, apiPost, apiPut, apiDelete } from './client';

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
  userId?: string;
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

/** POST /api/v1/ai/study-tip 入参：把学习进度摘要发给 Workers AI，换一句个性化建议。 */
export interface AiStudyTipBody {
  doneChapters: number;
  totalChapters: number;
  currentTopic: string;
  streakDays: number;
  needReview: boolean;
  reviewTopic: string;
}
export interface AiStudyTipResult {
  tip: string;
}

/** POST /api/v1/ai/explain-word 入参：一个英文单词（如 SELECT）。 */
export interface ExplainWordBody {
  word: string;
}
/** POST /api/v1/ai/explain-word 出参：结构化翻译/解释卡，全部字段后端已兜底，前端无需再判空。 */
export interface ExplainWordResult {
  word: string;
  pos: string;
  zh: string;
  example: string;
  exampleZh: string;
  category: string;
  detail: string;
}

/** 字典类型（dict_type 表的 API 视图，camelCase）。 */
export interface DictType {
  id: number;
  typeKey: string;
  name: string;
  sort: number;
  status: number;
  remark: string | null;
}
/** 字典数据（dict_data 表的 API 视图）。 */
export interface DictData {
  id: number;
  typeKey: string;
  value: string;
  pos: string;
  zh: string;
  example: string;
  exampleZh: string;
  category: string;
  detail: string;
  sort: number;
  status: number;
}
/** GET /api/v1/dict 返回：类型 + 数据全量。 */
export interface DictBundle {
  types: DictType[];
  data: DictData[];
}

/** 工厂流程图（factory-first 导航主干）。 */
export interface FlowNodeDTO {
  id: number;
  key: string;
  label: string;
  kind: string;
  icon: string;
  x: number;
  y: number;
  description: string;
  /**
   * 所属 6 站主线（SPEC §6）。后端 ALTER 未执行前该字段缺失，空串 = 未分配。
   * BLOCK-04：空串不参与阶段分组，绝不默认落到 'tour'，否则全平台一夜静默改分。
   */
  stageKey?: string;
  /** 大白话一句话（SPEC §6）。缺失时前端回落 factoryStages.data 的静态兜底。 */
  oneLiner?: string;
}

/**
 * 6 站主线阶段（flow_stages）。practiceTypes 是**阶段级完成度口径**（BLOCK-02）：
 * 入门段只认 ["micro","quiz"]，SQL 不进分母，避免小白入门即撞最硬门槛。
 */
export interface FlowStageDTO {
  stageKey: string;
  title: string;
  subtitle: string;
  goal?: string;
  icon: string;
  practiceTypes: string[];
  sort: number;
}
export interface FlowEdgeDTO {
  from: string;
  to: string;
  label: string;
}
export interface NodeResourceDTO {
  id: number;
  nodeId: number;
  type: string;
  refId: number;
  title: string;
  sort: number;
}
export interface FlowchartBundle {
  flow: { id: number; slug: string; title: string; description: string; status: string };
  nodes: FlowNodeDTO[];
  edges: FlowEdgeDTO[];
  resources: NodeResourceDTO[];
  /** 后端 flow_stages 端点未上线前缺失，调用方须回落静态 DEFAULT_STAGES。 */
  stages?: FlowStageDTO[];
}

/**
 * 微练习（SQL 前台阶，计入完成度）。
 * answer 由服务端留存，**绝不出网**——判分只走 gradeMicroPractice。
 * payload 按 kind 取不同形状，见 MicroPayload。
 */
export type MicroKind = 'match' | 'order' | 'pick';

export interface MicroItem {
  id: string;
  text: string;
}

/** match：左右配对；order：拖成正确顺序；pick：单选/多选。 */
export interface MicroPayload {
  left?: MicroItem[];
  right?: MicroItem[];
  items?: MicroItem[];
  options?: MicroItem[];
  multiple?: boolean;
}

export interface MicroPracticeDTO {
  id: number;
  nodeId: number;
  kind: MicroKind;
  prompt: string;
  payload: MicroPayload;
}

/** 判分结果。feedback 由服务端按 feedback_ok / feedback_bad 下发，前端不编错因。 */
export interface MicroGradeResult {
  correct: boolean;
  feedback: string;
}

/** match 提交 {左id: 右id}；order 提交有序 id 数组；pick 提交选中 id 数组。 */
export type MicroAnswer = Record<string, string> | string[];

/**
 * 节点进阶详解（node_explainers）。tier=overview 进抽屉默认区，tier=detail 进折叠「进阶详解」。
 * kind 与前端知识卡四枚举对齐：plain 概念 / example 实例 / mapping 映射 / misconception 误区。
 * 生产 D1 当前为 0 行——前端须按空数组降级（不渲染折叠区），不能假定一定有数据。
 * bodyMd 为 Markdown，由知识卡组件渲染。
 */
export interface NodeExplainerDTO {
  id: number;
  nodeId: number;
  tier: 'overview' | 'detail';
  kind: 'plain' | 'example' | 'mapping' | 'misconception';
  title: string;
  bodyMd: string;
  icon: string;
  sort: number;
}

/**
 * 分级提示（practice_hints）。按 level 单条下发，绝不随题面下发（ADR-019，防剧透）。
 * hasNext 布尔让前端决定是否展示「再看下一条」按钮，但不泄露下一级内容。
 * answer 永不出网——hint 只给思路，不给答案。
 */
export interface PracticeHintDTO {
  targetType: 'quiz' | 'sql' | 'sim' | 'micro';
  targetId: number;
  level: 1 | 2 | 3;
  bodyMd: string;
  hasNext: boolean;
}

/** 兼容后端 snake_case / camelCase 两种命名，避免单点字段名不一致导致整页失效。 */
export function readSchemaHint(e: SqlExercise): string {
  return e.schemaHint ?? e.schema_hint ?? '';
}
export function readAnswerHash(e: SqlExercise): string {
  return (e.answerHash ?? e.answer_hash ?? '').trim().toLowerCase();
}

// ---- 学习引擎 v3 DTO ----

export type CourseStatus = 'completed' | 'inherited' | 'doing' | 'locked' | 'pending' | 'skipped';

export interface CourseState {
  courseId: number; name: string; slug: string; modules: string[];
  difficulty: string; estimatedHours: number;
  status: CourseStatus; sourcePath?: string;
  chapterDone?: number; totalChapters: number; percent: number;
  missingPrerequisites: string[];
  stageName?: string; stageIndex?: number;
  currentChapterId?: number; // 续学锚点：第一个未完成章；全完成时为空
}

export interface StageSummary {
  name: string; courseCount: number; doneCount: number;
  unlocked: boolean; pct: number;
}

export interface PathSummary {
  pathId: number; name: string; slug: string; description: string;
  stages: StageSummary[];
  inheritedCount: number; newCount: number; totalCount: number;
  completion: number; savedHours: number;
}

export interface InheritanceBanner {
  show: boolean; inheritedCount: number; savedHours: number;
  sourcePathName?: string;
}

export interface EngineStatus {
  activePath: number | null; completion: number;
  nextCourse: CourseState | null; courses: CourseState[]; paths: PathSummary[];
  banner: InheritanceBanner;
}

export interface EngineStatusBody {
  activePath?: number; selectedPaths?: number[];
  skippedCourseIds?: number[];
}

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
  /** 单题深链（工厂全景节点内嵌测验用，不含答案） */
  quizQuestion: (id: number) =>
    apiGet<QuizQuestion>(`/api/v1/quiz/questions/${id}`),
  topicQuestions: (topicId: number) =>
    apiGet<QuizQuestion[]>(`/api/v1/quiz/topic-questions?topicId=${topicId}`),
  gradeQuestion: (questionId: number, answer: string) =>
    apiPost<{ correct: boolean; correctAnswer: string; explanation: string }>(
      '/api/v1/quiz/grade',
      { question_id: questionId, answer },
    ),
  /** AI 判读自由理解（open 题）：用户写理解文本 → 模型评分+反馈 */
  aiGradeQuestion: (questionId: number, text: string) =>
    apiPost<{ score: number; feedback: string; keyPoints: string[] }>(
      '/api/v1/quiz/ai-grade',
      { question_id: questionId, text },
    ),
  sqlExercises: (topicId: number) =>
    apiGet<SqlExercise[]>(`/api/v1/sql-exercises?topicId=${topicId}`),
  sqlExercise: (id: number) => apiGet<SqlExercise>(`/api/v1/sql-exercises/${id}`),
  submitSql: (id: number, body: { passed: boolean; client_hash: string }) =>
    apiPost<SubmitSqlResult>(`/api/v1/sql-exercises/${id}/submit`, body),

  // 进度（登录会话身份，后端从 sid cookie 读取用户标识）
  progress: () => apiGet<ProgressSummary>('/api/v1/progress'),
  progressToday: () => apiGet<TodayProgress>('/api/v1/progress/today'),
  recordProgress: (item: RecordProgressBody) =>
    apiPost<{ ok?: boolean }>('/api/v1/progress', item),

  // 后台（需管理员登录）
  adminTopics: () => apiGet<Topic[]>('/api/v1/admin/topics'),
  createTopic: (body: unknown) => apiPost('/api/v1/admin/topics', body),
  updateTopic: (id: number, body: unknown) => apiPut(`/api/v1/admin/topics/${id}`, body),
  deleteTopic: (id: number) => apiDelete(`/api/v1/admin/topics/${id}`),
  adminChapters: (topicId: number) =>
    apiGet<Chapter[]>(`/api/v1/admin/chapters?topicId=${topicId}`),
  /**
   * 后台单章详情（含 md 正文）。**编辑器必须用这个，不能用公开的 api.chapter()**：
   * 公开接口对 status !== 'published' 一律返回 null，草稿章拿不到正文，
   * 编辑框会停在空串，一点保存就把正文清空写回去。列表接口的 DTO 也不带 md。
   */
  adminChapter: (id: number) =>
    apiGet<{ id: number; topicId: number; title: string; sort: number; status: string; md: string; schemaVersion: number; updatedAt: number }>(
      `/api/v1/admin/chapters/${id}`,
    ),
  createChapter: (body: unknown) => apiPost('/api/v1/admin/chapters', body),
  updateChapter: (id: number, body: unknown) => apiPut(`/api/v1/admin/chapters/${id}`, body),
  deleteChapter: (id: number) => apiDelete(`/api/v1/admin/chapters/${id}`),

  // 导入内容
  importContent: (body: unknown) =>
    apiPost<{ ok: boolean; topicsCreated: number; chaptersCreated: number }>('/api/v1/admin/import/content', body),

  // 学习引擎
  engineStatus: (body: EngineStatusBody) =>
    apiPost<EngineStatus>('/api/v1/engine/status', body),

  // 工厂流程图（factory-first 导航主干；公开读）
  flowchart: (slug: string) =>
    apiGet<FlowchartBundle>(`/api/v1/flowchart/${encodeURIComponent(slug)}`),

  // 微练习（SQL 前台阶）。按需单条拉取——只在用户展开某个 micro 时触发，
  // 不按节点循环预拉（D1 Free 单次查询 ≤50 行，禁批量循环）。
  microPractice: (id: number) =>
    apiGet<MicroPracticeDTO>(`/api/v1/micro-practices/${id}`),
  /** 判分只在服务端做：answer 留服务端，前端只提交作答、只收 correct + feedback。 */
  gradeMicroPractice: (id: number, answer: MicroAnswer) =>
    apiPost<MicroGradeResult>(`/api/v1/micro-practices/${id}/grade`, { answer }),

  // 节点进阶详解（node_explainers）。公开读；按需单条节点拉取，不按节点循环预拉。
  // tier 可选：不传返回该节点全部，传 overview/detail 只返回对应层级。
  nodeExplainers: (nodeId: number, tier?: 'overview' | 'detail') =>
    apiGet<{ items: NodeExplainerDTO[] }>(
      `/api/v1/node-explainers?node_id=${nodeId}${tier ? `&tier=${tier}` : ''}`,
    ),

  // 分级提示（practice_hints）。公开读；按 level 单条下发，绝不随题面下发（ADR-019）。
  // 仅答错/主动求提示时按需拉取，不预拉。
  practiceHint: (targetType: 'quiz' | 'sql' | 'sim' | 'micro', targetId: number, level: 1 | 2 | 3) =>
    apiGet<PracticeHintDTO>(
      `/api/v1/practice-hints?target_type=${targetType}&target_id=${targetId}&level=${level}`,
    ),

  // 认证
  whoami: () => apiGet<{ sub: string }>('/api/v1/auth/whoami'),
  login: (body: { username: string; password: string }) =>
    apiPost<{ ok: boolean }>('/api/v1/auth/login', body),
  logout: () => apiPost('/api/v1/auth/logout', {}),

  // AI 学习建议（Workers AI，按需调用，不阻塞首屏）
  aiStudyTip: (body: AiStudyTipBody) => apiPost<AiStudyTipResult>('/api/v1/ai/study-tip', body),

  // AI 英文单词翻译/解释（离线词典兜底 + Workers AI 生成，按需调用）
  explainWord: (body: ExplainWordBody) => apiPost<ExplainWordResult>('/api/v1/ai/explain-word', body),

  // 跨设备用户数据 KV（云端为主、本地兜底，按登录账号隔离）
  userDataGet: (key: string) =>
    apiGet<{ value: unknown | null }>(`/api/v1/user/data/${encodeURIComponent(key)}`),
  userDataPut: (key: string, value: unknown) =>
    apiPut(`/api/v1/user/data/${encodeURIComponent(key)}`, { value }),

  // 名称翻译 / 专业词典（读取公开；后台管理需管理员）
  dictGet: () => apiGet<DictBundle>('/api/v1/dict'),
  dictTypeCreate: (body: unknown) => apiPost<{ id: number }>('/api/v1/admin/dict/type', body),
  dictTypeUpdate: (id: number, body: unknown) => apiPut(`/api/v1/admin/dict/type/${id}`, body),
  dictTypeDelete: (id: number) => apiDelete(`/api/v1/admin/dict/type/${id}`),
  dictDataCreate: (body: unknown) => apiPost<{ id: number }>('/api/v1/admin/dict/data', body),
  dictDataUpdate: (id: number, body: unknown) => apiPut(`/api/v1/admin/dict/data/${id}`, body),
  dictDataDelete: (id: number) => apiDelete(`/api/v1/admin/dict/data/${id}`),
};
