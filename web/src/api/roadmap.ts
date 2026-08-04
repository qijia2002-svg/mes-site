/**
 * 职业路线图 DTO 与请求封装（契约：docs/api/career-roadmap-api.md）。
 * 只读接口，全部走 client.ts 的统一解包 + ApiError，不另起请求栈。
 * 字段名严格照契约 camelCase；后端未就绪时由 UI 走 LoadingState / ErrorState，
 * 这里不放任何兜底假数据。
 */
import { apiGet } from './client';

export type Importance = 'core' | 'important' | 'optional';
export type TrackKind = 'core' | 'elective';
export type ProgressState = 'planned' | 'not_started' | 'in_progress' | 'completed';

export interface LevelProgress {
  done: number;
  total: number;
  percent: number;
  state: ProgressState;
}

// ---- GET /api/v1/tracks ----

export interface TrackLevelBrief {
  level: number;
  name: string;
  goal: string;
  hours: number;
  chapterCount: number;
  /** planned_chapters 长度，不进分母 */
  plannedCount: number;
  hasContent: boolean;
}

export interface TrackListItem {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  kind: TrackKind;
  icon: string;
  summary: string;
  sort: number;
  chapterTotal: number;
  levels: TrackLevelBrief[];
}

export interface TrackListResponse {
  items: TrackListItem[];
  total: number;
}

// ---- GET /api/v1/tracks/:slug ----

export interface TrackChapter {
  id: number;
  title: string;
  topicId: number;
  sort: number;
  done: boolean;
}

/** 已排大纲、内容未上线：只展示标题与简介，不可点击 */
export interface PlannedChapter {
  title: string;
  desc: string;
}

export interface TrackLevelDetail {
  level: number;
  name: string;
  goal: string;
  hours: number;
  outcomes: string[];
  chapters: TrackChapter[];
  plannedChapters: PlannedChapter[];
  progress: LevelProgress;
}

export interface RelatedCareer {
  slug: string;
  title: string;
  icon: string;
  importance: Importance;
}

export interface TrackDetail {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  kind: TrackKind;
  icon: string;
  summary: string;
  sort: number;
  authenticated: boolean;
  levels: TrackLevelDetail[];
  relatedCareers: RelatedCareer[];
  /** 内容倒挂标记（高级有内容、入门中级空）。后端未下发时前端按 levels 自行判定。 */
  contentStatus?: string;
}

// ---- GET /api/v1/careers ----

export interface CareerListItem {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  salary: string;
  demand: string;
  overview: string;
  icon: string;
  sort: number;
  stageCount: number;
  trackCount: number;
}

export interface CareerListResponse {
  items: CareerListItem[];
  total: number;
}

// ---- GET /api/v1/careers/:slug ----

export interface CareerRequirement {
  trackSlug: string;
  trackTitle: string;
  trackIcon: string;
  level: number;
  levelName: string;
  importance: Importance;
  note: string;
  progress: LevelProgress;
}

export interface CareerStage {
  stage: number;
  title: string;
  duration: string;
  goal: string;
  milestone: string;
  interviewPoints: string[];
  deliverables: string[];
  requirements: CareerRequirement[];
}

export interface CareerDetail {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  salary: string;
  demand: string;
  overview: string;
  icon: string;
  authenticated: boolean;
  dailyWork: string[];
  outputs: string[];
  stages: CareerStage[];
  summary: { chapterDone: number; chapterTotal: number; percent: number };
}

// ---- GET /api/v1/roadmap/graph?career=:slug ----

export interface GraphStageNode {
  id: string;
  type: 'stage';
  stage: number;
  title: string;
  duration: string;
  goal: string;
  milestone: string;
  icon: string;
}

export interface GraphLevelNode {
  id: string;
  type: 'level';
  trackSlug: string;
  trackTitle: string;
  trackIcon: string;
  trackKind: TrackKind;
  level: number;
  levelName: string;
  hours: number;
  progress: LevelProgress;
}

export type GraphNode = GraphStageNode | GraphLevelNode;

export interface GraphEdge {
  id: string;
  /** 只有 stage → level 一种方向，且不会有悬空边 */
  from: string;
  to: string;
  importance: Importance;
  note: string;
}

export interface RoadmapGraph {
  career: { slug: string; title: string; tagline: string; icon: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    authenticated: boolean;
    stageCount: number;
    levelCount: number;
    chapterDone: number;
    chapterTotal: number;
    percent: number;
  };
}

export const roadmapApi = {
  tracks: () => apiGet<TrackListResponse>('/api/v1/tracks'),
  track: (slug: string) => apiGet<TrackDetail>(`/api/v1/tracks/${encodeURIComponent(slug)}`),
  careers: () => apiGet<CareerListResponse>('/api/v1/careers'),
  career: (slug: string) => apiGet<CareerDetail>(`/api/v1/careers/${encodeURIComponent(slug)}`),
  graph: (career: string) =>
    apiGet<RoadmapGraph>(`/api/v1/roadmap/graph?career=${encodeURIComponent(career)}`),
};
