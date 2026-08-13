/**
 * 课程体系 — 布鲁姆分层（L1 基础认知 → L4 认证评估）+ 能力进阶视角。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type Topic } from '../api/endpoints';

const BLOOM_LABEL: Record<string, string> = {
  L1: '记忆·理解',
  L2: '理解·应用',
  L3: '应用·分析',
  L4: '评估·创造',
};

/** 按 slug/模块名推断布鲁姆层级 */
function bloomLevel(t: Topic): string {
  const s = (t.slug ?? '') + (t.modules ?? []).join(',');
  if (/cert|认证|综合|roadmap/.test(s)) return 'L4';
  if (/sql|exercise|实训|实战|排障/.test(s)) return 'L3';
  if (/bom|工艺|工单|报工|质量|追溯|物料/.test(s)) return 'L2';
  return 'L1';
}

const BLOOM_GROUPS = ['L1', 'L2', 'L3', 'L4'];

function BloomPill({ level }: { level: string }) {
  return (
    <span
      className="pill"
      style={{
        background: level === 'L1' ? 'var(--surface-2)' : level === 'L2' ? 'var(--accent-soft)' : level === 'L3' ? 'var(--info-soft)' : 'var(--success-soft)',
        color: level === 'L1' ? 'var(--muted)' : level === 'L2' ? 'var(--accent)' : level === 'L3' ? 'var(--accent-hover)' : 'var(--success)',
        fontSize: '10px', padding: '1px 6px',
      }}
    >
      {BLOOM_LABEL[level]}
    </span>
  );
}

function TopicCard({ topic, done, total }: {
  topic: Topic; done: number; total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const level = bloomLevel(topic);
  const isDone = total > 0 && done >= total;
  const isDoing = done > 0 && done < total;
  const statusClass = isDone ? 'is-done' : isDoing ? 'is-doing' : 'is-new';

  return (
    <Link className={`card ${statusClass}`} to={`/courses/${topic.id}`} style={{ position: 'relative', overflow: 'hidden' }}>
      <span className="card-status-bar" aria-hidden="true" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 className="card-title">{topic.title}</h3>
        <BloomPill level={level} />
      </div>
      <p className="card-desc">{topic.description || '暂无简介。'}</p>
      <div className="card-meta-row">
        {total > 0 && <span className="card-meta"><Icon name="chapter" size={16} />{total} 章</span>}
      </div>
      {isDone ? (
        <span className="tag" style={{ background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success-border)' }}>
          <Icon name="success" size={16} /> 已完成
        </span>
      ) : isDoing ? (
        <div className="card-progress">
          <span className="card-progress-label">{pct}%</span>
          <div className="progress-track" style={{ height: 3 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <span className="tag">待学习</span>
      )}
      <div className="tag-row">
        {topic.modules.map((m) => <span key={m} className="tag">{m}</span>)}
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const progress = useQuery({ queryKey: ['progress'], queryFn: api.progress });
  const pathsQ = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths });
  const exercisesQ = useQuery({ queryKey: ['all-sql'], queryFn: () => api.sqlExercises(0).catch(() => [] as any[]), enabled: false });

  const chapterQs = useQueries({
    queries: (topics.data ?? []).slice(0, 30).map((t) => ({
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
    const m = new Map<number, { done: number; total: number }>();
    (topics.data ?? []).forEach((t, i) => {
      const chs = chapterQs[i]?.data ?? [];
      m.set(t.id, { done: chs.filter((c) => completedSet.has(String(c.id))).length, total: chs.length });
    });
    return m;
  }, [topics.data, chapterQs, completedSet]);

  const globalDone = useMemo(() => {
    let d = 0, t = 0;
    for (const s of topicStats.values()) { d += s.done; t += s.total; }
    return { done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
  }, [topicStats]);

  const recentChapter = useMemo(() => {
    const events = progress.data?.events ?? [];
    const chEvents = events.filter((e) => e.itemType === 'chapter' && e.itemId);
    if (chEvents.length === 0) return null;
    const latest = chEvents.reduce((a, b) => ((a.createdAt ?? 0) > (b.createdAt ?? 0) ? a : b));
    return latest.itemId || null;
  }, [progress.data]);

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">课程体系</h1>
          <p className="page-sub">基于能力进阶模型，从基础认知到实战应用，系统化掌握 MES 实施核心技能。</p>
        </div>
        {topics.data && <span className="row-meta">共 {topics.data.length} 门课程</span>}
      </header>

      {/* 进度总览 */}
      <div className="stat-row" style={{ marginBottom: 'var(--space-2)' }}>
        <div className="stat">
          <span className="stat-value">{globalDone.pct}%</span>
          <span className="stat-label">总进度</span>
        </div>
        <div className="stat">
          <span className="stat-value">{globalDone.done}<span style={{ fontSize: 'var(--text-base)', color: 'var(--meta)', fontWeight: 400 }}>/{globalDone.total}</span></span>
          <span className="stat-label">已学章节</span>
        </div>
        <div className="stat">
          <span className="stat-value">{topics.data?.length ?? 0}</span>
          <span className="stat-label">课程数量</span>
        </div>
        {recentChapter && (
          <div className="stat">
            <Link className="text-link" to={`/chapters/${recentChapter}`} style={{ fontSize: 'var(--text-sm)' }}>
              <Icon name="run" size={16} /> 继续学习 →
            </Link>
            <span className="stat-label">最近学习</span>
          </div>
        )}
      </div>

      {/* 学习路线 · 零基础入口（置顶，确保二次访问稳定可达，不依赖看过序章） */}
      {pathsQ.data && pathsQ.data.length > 0 && (
        <div className="lp-highlight">
          <div className="lp-highlight-head">
            <Icon name="paths" size={20} />
            <div>
              <h2 className="lp-highlight-title">学习路线</h2>
              <p className="lp-highlight-sub">零基础？建议从最上面的路线开始——几小节大白话，不用任何前提。</p>
            </div>
          </div>
          <ul className="lp-highlight-list">
            {pathsQ.data.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link className="lp-highlight-item" to={`/learning-paths?path=${p.id}`}>
                  <span className="lp-highlight-name">{p.title}</span>
                  <span className="lp-highlight-meta">{p.topicIds.length} 阶段</span>
                  <Icon name="arrow-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topics.isLoading && <LoadingState label="加载课程…" />}
      {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
      {topics.data?.length === 0 && <EmptyState title="还没有课程" hint="内容由后台导入" icon="courses" />}

      {topics.data && BLOOM_GROUPS.map((level) => {
        const items = topics.data!
          .filter((t) => bloomLevel(t) === level && t.id < 5000) // exclude roadmap topics (id >= 5000)
          .sort((a, b) => {
            const sa = topicStats.get(a.id) ?? { done: 0, total: 0 };
            const sb = topicStats.get(b.id) ?? { done: 0, total: 0 };
            return (sa.total > 0 ? sa.done / sa.total : 0) - (sb.total > 0 ? sb.done / sb.total : 0);
          });
        if (items.length === 0) return null;
        return (
          <div key={level} className="section">
            <div className="section-head">
              <h2 className="section-title">
                <span className="pill" style={{
                  background: level === 'L1' ? 'var(--surface-2)' : level === 'L2' ? 'var(--accent-soft)' : level === 'L3' ? 'var(--info-soft)' : 'var(--success-soft)',
                  color: level === 'L1' ? 'var(--muted)' : level === 'L2' ? 'var(--accent)' : level === 'L3' ? 'var(--accent-hover)' : 'var(--success)',
                  marginRight: 'var(--space-2)', fontWeight: 600,
                }}>{level}</span>
                {level === 'L1' ? '基础认知' : level === 'L2' ? '核心知识' : level === 'L3' ? '实战应用' : '认证评估'}
              </h2>
              <span className="row-meta">
                {level === 'L1' ? '概念入门，建立认知框架' : level === 'L2' ? '深入理解，掌握核心概念' : level === 'L3' ? '动手实操，解决真实问题' : '综合认证，能力证明'}
              </span>
            </div>
            <ul className="card-grid">
              {items.map((t) => {
                const stat = topicStats.get(t.id) ?? { done: 0, total: 0 };
                return (
                  <li key={t.id}>
                    <TopicCard topic={t} done={stat.done} total={stat.total} />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }      )}
    </section>
  );
}
