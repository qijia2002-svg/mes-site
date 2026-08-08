/**
 * /roadmap —— 岗位路线（由 FactoryPage 内联的 CareerView 平移独立成页）。
 *
 * 回答「学完能干什么岗」。每张卡进 /tracks/:slug 看分级明细，那页早就存在，这里只做入口。
 * 数据源不变：roadmapApi.tracks。
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { roadmapApi } from '../api/roadmap';

export default function CareerPage() {
  const q = useQuery({ queryKey: ['tracks'], queryFn: roadmapApi.tracks });
  const tracks = q.data?.items ?? [];

  return (
    <section style={{ maxWidth: 'var(--container-app)', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1
          className="page-title"
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-announce-cjk)',
            letterSpacing: 'var(--tracking-title)', margin: 0,
          }}
        >
          <Icon name="stage" size={24} /> 岗位路线
        </h1>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
          学完这些能去做哪些岗。想先看这些能力落在工厂哪一环，回 <Link to="/factory" style={{ color: 'var(--accent)' }}>工厂全景</Link>。
        </p>
      </header>

      {q.isLoading && <LoadingState label="加载岗位路线…" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {!q.isLoading && !q.isError && tracks.length === 0 && (
        <EmptyState title="还没有岗位路线" hint="内容陆续上线，先去工厂全景按环节练。" />
      )}

      {tracks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {tracks.map((tr) => (
            <Link key={tr.slug} to={`/tracks/${tr.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  }}
                >
                  <Icon name="workshop" size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="card-title">{tr.title}</h3>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', margin: 0 }}>{tr.subtitle}</p>
                </div>
              </div>
              <p className="card-desc">{tr.summary}</p>
              <div className="tag-row">
                <span className="tag">{tr.kind === 'core' ? '核心' : '选修'}</span>
                <span className="tag">{tr.chapterTotal} 章</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
