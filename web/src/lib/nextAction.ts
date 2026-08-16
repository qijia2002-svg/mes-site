/**
 * 跨模式「下一步」解析器 —— UX 重梳文档 Phase B（打通看→玩→练闭环）。
 *
 * 把「当前在哪个模式、主线在哪」翻译成一致的下一步建议。
 * 模拟器 / 订单到交付这些「玩」的终点，过去没有任何回链到「学」，
 * 这里依据脊柱的 nextCourse 给出「继续学：X 课」，没设主线时落回学习路径总入口。
 */
import type { NextAction } from '../components/NextAction';

/** 模拟器跑完后的下一步：优先接主线推荐的下一门课，否则落回学习路径入口。 */
export function simulatorNextActions(spine: {
  nextCourseId: number | null;
  nextCourseName: string | null;
}): NextAction[] {
  if (spine.nextCourseId != null) {
    return [
      {
        to: `/courses/${spine.nextCourseId}`,
        label: `继续学：${spine.nextCourseName ?? '下一门课'}`,
        hint: '把刚跑的产线环节系统学一遍',
        icon: 'courses',
        kind: 'learn',
      },
    ];
  }
  return [
    {
      to: '/learning-paths',
      label: '系统学：把产线环节对应到课程',
      hint: '先看哪门课讲车间生产加工',
      icon: 'paths',
      kind: 'learn',
    },
  ];
}

/** 订单到交付看完后的下一步：落回学习路径（系统学 16 步业务流）。 */
export function otdNextActions(): NextAction[] {
  return [
    {
      to: '/learning-paths',
      label: '系统学：订单到交付对应课程',
      hint: '把 16 步业务流系统学一遍',
      icon: 'paths',
      kind: 'learn',
    },
  ];
}

/** 章节读完后的下一步：下一章 + 去模拟器把文字变活 + 做章节测试。 */
export function chapterNextActions(args: {
  nextChapterId: number | null;
  nextChapterTitle?: string;
  hasQuiz: boolean;
  onQuiz: () => void;
}): NextAction[] {
  const acts: NextAction[] = [];
  if (args.nextChapterId != null) {
    acts.push({
      to: `/chapters/${args.nextChapterId}`,
      label: `下一章：${args.nextChapterTitle ?? ''}`.trim(),
      hint: '接着往下读',
      icon: 'courses',
      kind: 'learn',
    });
  }
  acts.push({
    to: '/simulator',
    label: '去模拟器看这一章的流程',
    hint: '把文字变成会动的产线',
    icon: 'gauge',
    kind: 'play',
  });
  if (args.hasQuiz) {
    acts.push({
      onClick: args.onQuiz,
      label: '做章节测试',
      hint: '测测看懂没',
      icon: 'quiz',
      kind: 'practice',
    });
  }
  return acts;
}
