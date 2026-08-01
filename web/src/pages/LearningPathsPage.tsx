import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function LearningPathsPage() {
  const paths = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths });
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  const titleOf = (id: number) => topics.data?.find((t) => t.id === id)?.title ?? `课程 #${id}`;

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

      {paths.isLoading && <LoadingState label="正在加载学习路径…" />}
      {paths.isError && <ErrorState error={paths.error} onRetry={() => void paths.refetch()} />}
      {paths.data?.length === 0 && (
        <EmptyState title="还没有学习路径" hint="后台配置后会出现在这里。" icon="paths" />
      )}

      {paths.data && paths.data.length > 0 && (
        <ul className="card-grid">
          {paths.data.map((p) => (
            <li key={p.id} className="card">
              <h2 className="card-title">{p.title}</h2>
              <p className="card-desc">{p.description || '暂无路径说明。'}</p>
              {p.topicIds.length > 0 ? (
                <ol className="row-list">
                  {p.topicIds.map((tid, i) => (
                    <li key={tid}>
                      <Link className="row-link" to={`/courses/${tid}`}>
                        <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                        <span className="row-title">{titleOf(tid)}</span>
                        <Icon name="chevron-right" size={16} className="row-glyph" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="row-meta">这条路径还没挂课程。</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
