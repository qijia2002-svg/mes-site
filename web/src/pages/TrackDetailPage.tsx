/**
 * 能力路线详情（/tracks/:slug）。三级分层 + 右栏等级 TOC 与反向岗位导航。
 * 复用章节页的两栏栅格（.chapter-layout），≤1024px 自动塌成单列。
 *
 * 从路径图节点跳进来时 URL 带 `#level-l2`，react-router 不会自动滚动，
 * 这里按 hash 手动定位（滚动偏移交给 CSS scroll-margin-top，避开 sticky 顶栏）。
 */
import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useCrumbTail } from '../components/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { roadmapApi } from '../api/roadmap';
import { TrackLevelSection } from '../features/roadmap/TrackLevelSection';
import { levelAnchor } from '../features/roadmap/RoadmapNode';
import { trackIcon, careerIcon } from '../features/roadmap/trackIcons';
import { importanceLabel, isInverted, levelCn } from '../features/roadmap/roadmapLabels';
import { prefersReducedMotion } from '../features/roadmap/useIsNarrow';

export default function TrackDetailPage() {
  const { slug = '' } = useParams();
  const { hash } = useLocation();

  const trackQ = useQuery({
    queryKey: ['track', slug],
    queryFn: () => roadmapApi.track(slug),
    enabled: slug !== '',
    staleTime: 5 * 60_000,
  });

  const track = trackQ.data;
  useCrumbTail(track?.title);

  const levels = useMemo(
    () => [...(track?.levels ?? [])].sort((a, b) => a.level - b.level),
    [track],
  );

  const total = useMemo(
    () =>
      levels.reduce(
        (acc, l) => ({
          done: acc.done + (l.progress?.done ?? 0),
          all: acc.all + (l.progress?.total ?? 0),
        }),
        { done: 0, all: 0 },
      ),
    [levels],
  );
  const percent = total.all > 0 ? Math.round((total.done / total.all) * 100) : 0;

  useEffect(() => {
    if (!hash || !track) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [hash, track]);

  if (slug === '') {
    return <EmptyState title="路线地址无效" hint="URL 里缺少路线标识。" icon="empty-search" />;
  }

  return (
    <section>
      {trackQ.isLoading && <LoadingState label="正在加载路线…" />}
      {trackQ.isError && <ErrorState error={trackQ.error} onRetry={() => void trackQ.refetch()} />}

      {track && (
        <>
          <header className="page-head">
            <div className="rm-track-head">
              <Icon name={trackIcon(track.slug, track.icon)} size={24} className="rm-track-glyph" />
              <div>
                <h1 className="page-title">{track.title}</h1>
                <p className="page-sub">{track.subtitle || track.summary}</p>
              </div>
            </div>
            <div className="rm-track-progress">
              <span className="rm-summary-meta">
                {track.kind === 'core' ? '核心路线' : '选修路线'} · 已读 {total.done}/{total.all} 章
              </span>
              <span className="rm-bar" aria-hidden="true">
                <span className="rm-bar-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="rm-summary-pct">{percent}%</span>
            </div>
          </header>

          {!track.authenticated && (
            <div className="alert alert-info" role="note">
              <Icon name="info" size={16} className="alert-glyph" />
              <div>
                未登录时看到的是内容总量。
                <Link className="text-link" to="/login">
                  登录后
                </Link>
                这里会显示你自己的章节进度。
              </div>
            </div>
          )}

          {isInverted(levels, track.contentStatus) && (
            <div className="alert alert-info" role="note">
              <Icon name="warn" size={16} className="alert-glyph" />
              <div>
                这条线目前只有高级内容上线，入门与中级还在编排中。
                不建议直接从高级开始 —— 先在其他路线补齐基础，等前两级上线再回来按顺序走。
              </div>
            </div>
          )}

          <div className="chapter-layout">
            <div className="chapter-main">
              {levels.length === 0 ? (
                <EmptyState
                  title="这条路线还没有分级内容"
                  hint="三级大纲由后台导入，导入后会按入门 / 中级 / 高级依次出现。"
                  icon="schedule"
                  action={
                    <Link className="btn btn-secondary btn-sm" to="/roadmap">
                      回岗位路径
                    </Link>
                  }
                />
              ) : (
                levels.map((detail, index) => (
                  <TrackLevelSection
                    key={detail.level}
                    detail={detail}
                    prev={
                      index > 0
                        ? {
                            level: levels[index - 1].level,
                            name: levels[index - 1].name,
                            chapters: levels[index - 1].chapters?.length ?? 0,
                          }
                        : undefined
                    }
                  />
                ))
              )}
            </div>

            <aside className="chapter-aside">
              <p className="toc-title">
                <Icon name="toc" size={16} />
                等级
              </p>
              <ul className="toc-list">
                {levels.map((detail) => (
                  <li key={detail.level}>
                    <a href={`#${levelAnchor(detail.level)}`}>
                      {levelCn(detail.level, detail.name)}
                      <span className="rm-toc-count">
                        {detail.progress?.done ?? 0}/{detail.progress?.total ?? 0}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>

              {track.relatedCareers && track.relatedCareers.length > 0 && (
                <div className="rm-related">
                  <p className="toc-title">
                    <Icon name="user" size={16} />
                    哪些岗位要这条线
                  </p>
                  <ul className="toc-list">
                    {track.relatedCareers.map((career) => (
                      <li key={career.slug}>
                        <Link to="/roadmap">
                          <Icon
                            name={careerIcon(career.slug, career.icon)}
                            size={16}
                            className="rm-related-glyph"
                          />
                          {career.title}
                          <span className="rm-toc-count">{importanceLabel(career.importance)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
