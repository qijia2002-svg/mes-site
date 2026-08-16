/**
 * 学习脊柱（Spine）—— 全站「单一学习主线」的数据源。
 *
 * 后台 /api/v1/engine/status 已经会算好激活路径的名字、总进度、以及「下一步该学哪门课」
 * （nextCourse）；之前这条脊柱从没点亮，是因为全仓没有任何地方写 engine.activePath。
 * 现在学习路径页「设为学习主线」写入后，这里把它读出来喂给侧栏卡片与课程页路径栏。
 *
 * 见：UX 重梳文档 Phase A（激活学习引擎）。
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { useActivePath } from './userData';

export interface SpineState {
  /** 当前激活路径 id；null = 尚未设定主线。 */
  activePath: number | null;
  /** 激活路径名称（来自 engine/status 返回的 paths）。 */
  pathName: string | null;
  /** 主线总完成度（0–100，来自 engine/status.completion）。 */
  completion: number;
  /** 主线推荐的下一门课 id（engine/status.nextCourse）。 */
  nextCourseId: number | null;
  /** 下一门课名称。 */
  nextCourseName: string | null;
  isLoading: boolean;
}

export function useLearningSpine(): SpineState {
  const activePath = useActivePath();

  const statusQ = useQuery({
    queryKey: ['engine-status', activePath],
    queryFn: () =>
      api.engineStatus({
        activePath: activePath ?? undefined,
        selectedPaths: undefined,
      }),
    enabled: activePath != null,
    staleTime: 30_000,
  });

  const data = statusQ.data;
  const pathName =
    activePath != null ? data?.paths.find((p) => p.pathId === activePath)?.name ?? null : null;
  const nextCourse = data?.nextCourse ?? null;

  return {
    activePath,
    pathName,
    completion: data?.completion ?? 0,
    nextCourseId: nextCourse?.courseId ?? null,
    nextCourseName: nextCourse?.name ?? null,
    isLoading: statusQ.isLoading,
  };
}
