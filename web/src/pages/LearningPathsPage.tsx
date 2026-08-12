/**
 * /learning-paths —— 学习路径（由 FactoryPage 内联的 PathsView 平移独立成页）。
 *
 * 工厂全景是主轴，这里是「想按课表学」的旁路入口：一条路径 = 一串有先后的课程。
 * 数据源不变：api.learningPaths 拿路径，api.topics 把 topicId 翻成课名。
 */
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function LearningPathsPage() {
  const pathsQ = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  const titleOf = (id: number) => topicsQ.data?.find((t) => t.id === id)?.title ?? `#${id}`;
  const paths = pathsQ.data ?? [];

  // 深链 ?path=<id>：从课程页那几张路径卡点进来时，直接定位到对应的那一条。
  // 以前它们统一指向 /factory?view=paths，而工厂页根本不读 view，四张卡等于同一个链接。
  const [sp] = useSearchParams();
  const focusId = Number(sp.get('path'));
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusRef.current) return;
    focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, paths.length]);

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
          <Icon name="paths" size={24} /> 学习路径
        </h1>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
          按顺序排好的课程串。想看这些课在工厂里对应哪个环节，回 <Link to="/factory" style={{ color: 'var(--accent)' }}>工厂全景</Link>。
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          零基础？建议从最上面的 <span style={{ color: 'var(--accent)' }}>《从零看懂工厂》</span> 开始——三小节大白话，不用任何前提。
        </p>
      </header>

      {pathsQ.isLoading && <LoadingState label="加载路径…" />}
      {pathsQ.isError && <ErrorState error={pathsQ.error} onRetry={() => pathsQ.refetch()} />}
      {!pathsQ.isLoading && !pathsQ.isError && paths.length === 0 && (
        <EmptyState title="还没有学习路径" hint="内容陆续上线，先去工厂全景按环节练。" />
      )}

      {paths.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {paths.map((p) => (
            <div
              key={p.id}
              className="card"
              ref={p.id === focusId ? focusRef : undefined}
              style={p.id === focusId
                ? { outline: '2px solid var(--accent)', outlineOffset: 2 }
                : undefined}
            >
              <h3 className="card-title">{p.title}</h3>
              <p className="card-desc">{p.description}</p>
              <ol style={{ margin: 0, padding: '0 0 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
                {p.topicIds.map((tid) => (
                  <li key={tid} style={{ marginBottom: 2 }}>
                    <Link to={`/courses/${tid}`} style={{ color: 'var(--accent)' }}>{titleOf(tid)}</Link>
                  </li>
                ))}
              </ol>
              <span className="tag" style={{ marginTop: 'auto' }}>{p.topicIds.length} 门课</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
