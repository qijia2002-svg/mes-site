/**
 * 岗位能力路径（/roadmap）。
 * 桌面：列=能力路线、行=成长阶段的矩阵，等级递进走垂直连线；
 * 手机：同一份数据降级成阶段 accordion + 纵向阶梯，SVG 连线整段不挂载。
 * 岗位选择走 URL query（?role=），刷新和分享都能回到同一张图。
 */
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { roadmapApi } from '../api/roadmap';
import { RoleSelector, ROLE_PANEL_ID, roleTabId } from '../features/roadmap/RoleSelector';
import { RoadmapMatrix } from '../features/roadmap/RoadmapMatrix';
import { RoadmapStair } from '../features/roadmap/RoadmapStair';
import { CareerAside } from '../features/roadmap/CareerAside';
import { buildMatrix } from '../features/roadmap/roadmapLayout';
import { useIsNarrow } from '../features/roadmap/useIsNarrow';

const STALE = 5 * 60_000;

export default function RoadmapPage() {
  const [params, setParams] = useSearchParams();
  const narrow = useIsNarrow();

  const careersQ = useQuery({
    queryKey: ['careers'],
    queryFn: roadmapApi.careers,
    staleTime: STALE,
  });

  const items = careersQ.data?.items ?? [];
  const wanted = params.get('role') ?? '';
  const selected = items.some((c) => c.slug === wanted) ? wanted : (items[0]?.slug ?? '');

  const graphQ = useQuery({
    queryKey: ['roadmap-graph', selected],
    queryFn: () => roadmapApi.graph(selected),
    enabled: selected !== '',
    staleTime: STALE,
  });
  const careerQ = useQuery({
    queryKey: ['career', selected],
    queryFn: () => roadmapApi.career(selected),
    enabled: selected !== '',
    staleTime: STALE,
  });

  const matrix = useMemo(() => (graphQ.data ? buildMatrix(graphQ.data) : null), [graphQ.data]);
  const stageMap = useMemo(
    () => new Map((careerQ.data?.stages ?? []).map((s) => [s.stage, s])),
    [careerQ.data],
  );

  const summary = graphQ.data?.summary;
  const chapterPct = summary?.percent ?? 0;

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">岗位能力路径</h1>
          <p className="page-sub">
            选一个岗位，看清它要求哪几条能力线、每条要学到第几级、你现在卡在哪一格。
          </p>
        </div>
      </header>

      {careersQ.isLoading && <LoadingState label="正在加载岗位…" />}
      {careersQ.isError && (
        <ErrorState error={careersQ.error} onRetry={() => void careersQ.refetch()} />
      )}
      {careersQ.data && items.length === 0 && (
        <EmptyState
          title="还没有配置岗位路径"
          hint="岗位与能力线的映射由后台导入，导入后这里会直接出现矩阵。"
          icon="schedule"
          action={
            <Link className="btn btn-secondary btn-sm" to="/courses">
              先去课程体系
            </Link>
          }
        />
      )}

      {items.length > 0 && (
        <RoleSelector
          careers={items}
          value={selected}
          onChange={(slug) => setParams({ role: slug }, { replace: true })}
        />
      )}

      {summary && !summary.authenticated && (
        <div className="alert alert-info" role="note">
          <Icon name="info" size={16} className="alert-glyph" />
          <div>
            当前是未登录视角，节点显示的是内容总量而不是你的进度。
            <Link className="text-link" to="/login">
              登录后
            </Link>
            会自动把已读章节归位到对应等级。
          </div>
        </div>
      )}

      {matrix && summary && (
        <div className="rm-summary">
          <span className="rm-summary-main">
            {summary.stageCount} 个阶段 · {matrix.columns.length + matrix.overflowColumns.length}{' '}
            条能力线 · {matrix.nodeTotal} 个等级节点
          </span>
          <span className="rm-summary-meta">
            已完成 {matrix.nodeDone}/{matrix.nodeTotal} 个节点 · 章节 {summary.chapterDone}/
            {summary.chapterTotal}
          </span>
          <span className="rm-bar" aria-hidden="true">
            <span className="rm-bar-fill" style={{ width: `${chapterPct}%` }} />
          </span>
          <span className="rm-summary-pct">{chapterPct}%</span>
        </div>
      )}

      {selected !== '' && (
        <div
          className="rm-layout"
          id={ROLE_PANEL_ID}
          role="tabpanel"
          aria-labelledby={roleTabId(selected)}
        >
          <div className="rm-main">
            {graphQ.isLoading && <LoadingState label="正在加载路径图…" />}
            {graphQ.isError && (
              <ErrorState error={graphQ.error} onRetry={() => void graphQ.refetch()} />
            )}
            {matrix && matrix.nodeTotal === 0 && (
              <EmptyState
                title="这个岗位的路径还在编排中"
                hint="能力线本身已经可以学，路径上线后你的进度会自动归位到对应等级。"
                icon="schedule"
                action={
                  <Link className="btn btn-secondary btn-sm" to="/tracks/mes">
                    先看 MES 路线
                  </Link>
                }
              />
            )}
            {matrix && matrix.nodeTotal > 0 && (
              narrow ? (
                <RoadmapStair matrix={matrix} stageMap={stageMap} />
              ) : (
                <RoadmapMatrix matrix={matrix} stageMap={stageMap} />
              )
            )}
          </div>

          {careerQ.isError && (
            <ErrorState
              error={careerQ.error}
              title="岗位画像没加载出来"
              onRetry={() => void careerQ.refetch()}
            />
          )}
          {careerQ.data && <CareerAside career={careerQ.data} />}
        </div>
      )}
    </section>
  );
}
