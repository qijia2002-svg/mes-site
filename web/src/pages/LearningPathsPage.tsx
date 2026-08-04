import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function LearningPathsPage() {
  const pathsQ = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress });

  // 收集所有路径涉及的 topicId
  const allTopicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of pathsQ.data ?? []) for (const id of p.topicIds) ids.add(id);
    return [...ids];
  }, [pathsQ.data]);

  const chapterQs = useQueries({
    queries: allTopicIds.map((id) => ({
      queryKey: ['chapters', id],
      queryFn: () => api.chapters(id),
      staleTime: 5 * 60_000,
    })),
  });

  const completedSet = useMemo(
    () => new Set((progressQ.data?.completedChapterIds ?? []).map(String)),
    [progressQ.data],
  );

  const topicStats = useMemo(() => {
    const m = new Map<number, { done: number; total: number }>();
    allTopicIds.forEach((id, i) => {
      const chs = chapterQs[i]?.data ?? [];
      m.set(id, { done: chs.filter((c) => completedSet.has(String(c.id))).length, total: chs.length });
    });
    return m;
  }, [allTopicIds, chapterQs, completedSet]);

  const titleOf = (id: number) => topicsQ.data?.find((t) => t.id === id)?.title ?? `课程 #${id}`;

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">学习路径</h1>
          <p className="page-sub">
            把零散课程串成有先后关系的一条线：先懂业务对象，再学数据表，最后写查询。
          </p>
        </div>
      </header>

      {pathsQ.isLoading && <LoadingState label="正在加载学习路径…" />}
      {pathsQ.isError && <ErrorState error={pathsQ.error} onRetry={() => void pathsQ.refetch()} />}
      {pathsQ.data?.length === 0 && (
        <EmptyState title="还没有学习路径" hint="后台配置后会出现在这里。" icon="paths" />
      )}

      {pathsQ.data && pathsQ.data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {pathsQ.data.map((p) => {
            // 计算路径整体完成度
            let pathDone = 0, pathTotal = 0;
            for (const tid of p.topicIds) {
              const s = topicStats.get(tid) ?? { done: 0, total: 0 };
              pathDone += s.done;
              pathTotal += s.total;
            }
            const pathPct = pathTotal > 0 ? Math.round((pathDone / pathTotal) * 100) : 0;
            const isActive = pathDone > 0 && pathDone < pathTotal;

            return (
              <div key={p.id} className="panel" style={isActive ? { borderColor: 'var(--accent-border)', boxShadow: '0 0 0 1px var(--accent-soft)' } : {}}>
                <div className="panel-head">
                  <Icon name="paths" size={20} className="panel-glyph" />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce-cjk)' }}>
                      {p.title}
                    </h2>
                    {p.description && (
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{p.description}</p>
                    )}
                  </div>
                  {pathTotal > 0 && (
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-announce)', color: isActive ? 'var(--accent)' : 'var(--fg)' }}>
                      {pathPct}%
                    </span>
                  )}
                </div>

                {/* 整体进度条 */}
                {pathTotal > 0 && (
                  <div className="progress-track" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${pathPct}%` }} />
                  </div>
                )}

                {/* 阶段步骤 */}
                <div className="path-phases">
                  {p.topicIds.map((tid, i) => {
                    const s = topicStats.get(tid) ?? { done: 0, total: 0 };
                    const isPhaseDone = s.total > 0 && s.done >= s.total;
                    const isPhaseDoing = s.done > 0 && s.done < s.total;
                    const isPhaseLocked = !isPhaseDone && !isPhaseDoing && i > 0;
                    const hasPreceding = i > 0;
                    const preceding = hasPreceding ? topicStats.get(p.topicIds[i - 1]) : null;
                    const isUnlocked = !hasPreceding || (preceding && preceding.total > 0 && preceding.done >= preceding.total);

                    const phaseClass = isPhaseDone
                      ? 'is-done'
                      : isPhaseDoing
                        ? 'is-doing'
                        : (!isUnlocked ? 'is-locked' : '');

                    return (
                      <div key={tid} className={`path-phase ${phaseClass}`}>
                        <div className="path-phase-circle">
                          {isPhaseDone ? (
                            <Icon name="success" size={16} />
                          ) : isPhaseDoing ? (
                            String(i + 1)
                          ) : !isUnlocked ? (
                            <Icon name="hide" size={16} />
                          ) : (
                            String(i + 1)
                          )}
                        </div>
                        <span className="path-phase-title">{titleOf(tid)}</span>
                        {s.total > 0 && (
                          <span className="path-phase-sub">
                            {s.done}/{s.total} 章 · {s.total > 0 ? Math.round((s.done / s.total) * 100) : 0}%
                          </span>
                        )}
                        {isPhaseDone && (
                          <span className="tag" style={{ background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success-border)' }}>已完成</span>
                        )}
                        {isPhaseDoing && (
                          <span className="tag" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', borderColor: 'var(--warn-border)' }}>进行中</span>
                        )}
                        {!isUnlocked && (
                          <span className="tag">待解锁</span>
                        )}
                        <Link className="btn btn-sm btn-secondary" to={`/courses/${tid}`} style={{ marginTop: 'auto' }}>
                          {isPhaseDone ? '复习' : isPhaseDoing ? '继续' : '查看'}
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {/* 课程列表 */}
                <ul className="row-list" style={{ marginTop: 'var(--space-2)' }}>
                  {p.topicIds.map((tid, i) => {
                    const s = topicStats.get(tid) ?? { done: 0, total: 0 };
                    const isTopicDone = s.total > 0 && s.done >= s.total;
                    const isTopicDoing = s.done > 0 && s.done < s.total;
                    return (
                      <li key={tid}>
                        <Link className="row-link" to={`/courses/${tid}`}>
                          <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                          <Icon
                            name={isTopicDone ? 'success' : isTopicDoing ? 'run' : 'chapter'}
                            size={16}
                            style={{
                              color: isTopicDone ? 'var(--success)' : isTopicDoing ? 'var(--warn)' : 'var(--meta)',
                            }}
                          />
                          <span className="row-title">{titleOf(tid)}</span>
                          {s.total > 0 && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', fontFamily: 'var(--font-mono)' }}>
                              {s.done}/{s.total}
                            </span>
                          )}
                          <Icon name="chevron-right" size={16} className="row-glyph" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
