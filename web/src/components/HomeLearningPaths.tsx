/**
 * 首页「学习路径 / 职业途径」区块。
 * 把分散在 /learning-paths（学习路径）与 /roadmap（职业路径）的能力，
 * 以最省篇幅的形式沉到首页下方：让用户一进来就看到「我在哪条线、进度多少、下一步去哪」，
 * 并给出到达职业路径地图的入口。复用既有接口，无新增后端端点。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from './Icon';
import { ErrorState } from './StateBlock';
import { VoiceButton } from './VoiceButton';
import { api, type LearningPath, type Topic } from '../api/endpoints';

export default function HomeLearningPaths() {
  const pathsQ = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress });

  const allTopicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of pathsQ.data ?? []) for (const id of p.topicIds) ids.add(id);
    return [...ids];
  }, [pathsQ.data]);

  const chapterQs = useQueries({
    queries: allTopicIds.map((id) => ({
      queryKey: ['chapters', id],
      queryFn: () => api.chapters(id),
      staleTime: 60_000,
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

  const titleOf = (id: number) =>
    topicsQ.data?.find((t: Topic) => t.id === id)?.title ?? `课程 #${id}`;

  if (pathsQ.isError) return <ErrorState error={pathsQ.error} title="学习路径加载失败" onRetry={() => pathsQ.refetch()} />;
  if (pathsQ.isLoading || !pathsQ.data || pathsQ.data.length === 0) return null;

  return (
    <section className="home-paths">
      <div className="home-paths-head">
        <h2>学习路径</h2>
        <Link className="text-link" to="/roadmap">
          查看职业路径地图 <Icon name="chevron-right" size={16} className="inline-glyph" />
        </Link>
      </div>

      <div className="home-paths-grid">
        {pathsQ.data.map((p: LearningPath) => {
          let pathDone = 0, pathTotal = 0;
          for (const tid of p.topicIds) {
            const s = topicStats.get(tid) ?? { done: 0, total: 0 };
            pathDone += s.done;
            pathTotal += s.total;
          }
          const pct = pathTotal > 0 ? Math.round((pathDone / pathTotal) * 100) : 0;
          const isActive = pathDone > 0 && pathDone < pathTotal;

          // 下一步：第一个未完成的阶段
          const nextTopic = p.topicIds.find((tid) => {
            const s = topicStats.get(tid);
            return s && s.total > 0 && s.done < s.total;
          }) ?? p.topicIds[0];

          return (
            <div
              key={p.id}
              className="home-path-card"
              style={isActive ? { borderColor: 'var(--accent-border)' } : {}}
            >
              <h3>{p.title}</h3>
              <VoiceButton
                text={`${p.title}，进度 ${pct}%，共 ${pathTotal} 章，已完成 ${pathDone} 章。${
                  isActive ? '建议继续学习。' : '可以开始学习。'
                }`}
              />
              {p.description && <p>{p.description}</p>}

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                <span className="home-path-pct">{pct}%</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>
                  {pathDone}/{pathTotal} 章
                </span>
              </div>
              <div className="progress-track" style={{ height: 6 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>

              <div className="home-path-stages">
                {p.topicIds.map((tid, i) => {
                  const s = topicStats.get(tid) ?? { done: 0, total: 0 };
                  const done = s.total > 0 && s.done >= s.total;
                  return (
                    <span
                      key={tid}
                      className="tag"
                      style={{
                        background: done ? 'var(--success-soft)' : 'var(--surface-2)',
                        color: done ? 'var(--success)' : 'var(--muted)',
                        borderColor: done ? 'var(--success-border)' : 'var(--border)',
                      }}
                      title={titleOf(tid)}
                    >
                      {i + 1}. {titleOf(tid)}
                    </span>
                  );
                })}
              </div>

              <Link className="btn btn-sm btn-primary home-path-cta" to={`/courses/${nextTopic}`}>
                <Icon name={isActive ? 'run' : 'chapter'} size={16} />
                {isActive ? '继续学习' : '开始学习'}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
