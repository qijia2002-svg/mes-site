/**
 * AI 导师 · Spine 总线接入（v2.1 最小可行）。
 *
 * 之前导师是「旁路新特性」：不读路由、不读脊柱，回答与用户当前所学脱节，
 * 等于新增一个 N4 类断点。本 hook 把导师接回体验总线：
 *   1) 感知当前课程/章节 —— 从路由解析 + React Query 缓存取标题，喂给后端 tutor context；
 *   2) 同步脊柱下一步 —— 暴露 spineAction（与 simulatorNextActions / schedulingNextActions
 *      同构的 NextAction），让导师面板随用户练完/推进实时反映主线推荐，不再游离。
 *
 * 上下文一律从已有 React Query 缓存取（['topics'] / ['chapter', id]），
 * 导师常驻 AppShell 也不会因此多发请求；脊柱查询仅在用户设定主线后启用。
 */
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLearningSpine, type SpineState } from '../../lib/learningSpine';
import type { NextAction } from '../../components/NextAction';

interface TutorTopicLike {
  id: number;
  title: string;
}
interface TutorChapterLike {
  id: number;
  title: string;
  topicId?: number;
}

export type TutorScope = 'course' | 'chapter' | 'scheduling' | 'simulator' | 'none';

export interface TutorContext {
  /** 当前课程标题（命中 /courses/:id）；否则 null。 */
  topic: string | null;
  /** 当前章节标题（命中 /chapters/:id）；否则 null。 */
  chapter: string | null;
  /** 当前页面语义类型，用于 UI 文案。 */
  scope: TutorScope;
  /** 学习脊柱实时状态（来自 useLearningSpine）。 */
  spine: SpineState;
  /** 脊柱推荐的下一步；无主线建议时为 null。 */
  spineAction: NextAction | null;
}

export function useTutorContext(): TutorContext {
  const loc = useLocation();
  const qc = useQueryClient();
  const spine = useLearningSpine();
  const path = loc.pathname;

  let topic: string | null = null;
  let chapter: string | null = null;
  let scope: TutorScope = 'none';

  // /courses/:topicId —— 课程页：从 topics 缓存取标题
  const courseMatch = path.match(/^\/courses\/(\d+)/);
  if (courseMatch) {
    const id = Number(courseMatch[1]);
    const topics = qc.getQueryData(['topics']) as TutorTopicLike[] | undefined;
    topic = topics?.find((t) => t.id === id)?.title ?? `课程 #${id}`;
    scope = 'course';
  }

  // /chapters/:chapterId —— 章节页：从 chapter 缓存取标题，并尝试反查所属课程
  const chapterMatch = path.match(/^\/chapters\/(\d+)/);
  if (chapterMatch) {
    const id = Number(chapterMatch[1]);
    const ch = qc.getQueryData(['chapter', id]) as TutorChapterLike | undefined;
    chapter = ch?.title ?? `章节 #${id}`;
    if (ch?.topicId != null) {
      const topics = qc.getQueryData(['topics']) as TutorTopicLike[] | undefined;
      topic = topics?.find((t) => t.id === ch.topicId)?.title ?? topic;
    }
    scope = 'chapter';
  }

  if (scope === 'none') {
    if (/^\/scheduling/.test(path)) scope = 'scheduling';
    else if (/^\/simulator/.test(path)) scope = 'simulator';
  }

  // 脊柱下一步（与 simulatorNextActions / schedulingNextActions 同构）
  const spineAction: NextAction | null =
    spine.nextCourseId != null
      ? {
          to: `/courses/${spine.nextCourseId}`,
          label: `继续学：${spine.nextCourseName ?? '下一门课'}`,
          hint: '主线推荐的下一门课',
          icon: 'courses',
          kind: 'learn',
        }
      : spine.activePath != null
        ? {
            to: '/learning-paths',
            label: '系统梳理学习主线',
            hint: '选一条主线，学习会按主线推进',
            icon: 'paths',
            kind: 'learn',
          }
        : null;

  return { topic, chapter, scope, spine, spineAction };
}
