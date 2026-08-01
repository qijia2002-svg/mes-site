/**
 * 首页驾驶舱 · 精简版。
 * 三个区块：GreetingBar → ProgressDashboard → 课程卡片（带进度条）
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { GreetingBar } from '../components/GreetingBar';
import { api } from '../api/endpoints';
import ProgressDashboard from '../components/ProgressDashboard';

export default function HomePage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const progress = useQuery({ queryKey: ['progress'], queryFn: api.progress });

  const chapterQs = useQueries({
    queries: (topics.data ?? []).map((t) => ({
      queryKey: ['chapters', t.id],
      queryFn: () => api.chapters(t.id),
      staleTime: 5 * 60_000,
      enabled: !!topics.data,
    })),
  });

  const completedSet = useMemo(
    () => new Set((progress.data?.completedChapterIds ?? []).map(String)),
    [progress.data],
  );

  const topicStats = useMemo(() => {
    return new Map((topics.data ?? []).map((t, i) => {
      const chs = chapterQs[i]?.data ?? [];
      const done = chs.filter((c) => completedSet.has(String(c.id))).length;
      return [t.id, { done, total: chs.length }];
    }));
  }, [topics.data, chapterQs, completedSet]);

  return (
    <section className="dash-page">
      <GreetingBar />
      <ProgressDashboard />

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">课程</h2>
          <Link className="text-link" to="/courses">查看全部</Link>
        </div>

        {topics.isLoading && <LoadingState label="正在加载课程…" />}
        {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
        {topics.data?.length === 0 && (
          <EmptyState title="还没有课程" hint="内容由后台导入，导入后会出现在这里。" icon="courses" />
        )}
        {topics.data && topics.data.length > 0 && (
          <ul className="card-grid">
            {topics.data.slice(0, 6).map((t) => {
              const stat = topicStats.get(t.id) ?? { done: 0, total: 0 };
              const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
              return (
                <li key={t.id}>
                  <Link className="card" to={`/courses/${t.id}`}>
                    <h3 className="card-title">{t.title}</h3>
                    <p className="card-desc">{t.description || '暂无课程简介。'}</p>
                    {stat.total > 0 && (
                      <div className="card-progress">
                        <span className="card-progress-label">已学 {stat.done}/{stat.total} 章 · {pct}%</span>
                        <div className="progress-track" style={{ height: 4 }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="tag-row">
                      {t.modules.map((m) => (
                        <span key={m} className="tag">{m}</span>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
