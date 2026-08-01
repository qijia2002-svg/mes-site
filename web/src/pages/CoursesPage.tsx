import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function CoursesPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">课程</h1>
          <p className="page-sub">
            每门课由若干理论章节和配套 SQL 实训题组成。点进去按顺序读，读完就能上手写。
          </p>
        </div>
        {topics.data && <span className="row-meta">共 {topics.data.length} 门</span>}
      </header>

      {topics.isLoading && <LoadingState label="正在加载课程…" />}
      {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
      {topics.data?.length === 0 && (
        <EmptyState title="还没有课程" hint="内容由后台导入，导入后会出现在这里。" icon="courses" />
      )}

      {topics.data && topics.data.length > 0 && (
        <ul className="card-grid">
          {topics.data.map((t) => (
            <li key={t.id}>
              <Link className="card" to={`/courses/${t.id}`}>
                <h2 className="card-title">{t.title}</h2>
                <p className="card-desc">{t.description || '暂无课程简介。'}</p>
                <div className="tag-row">
                  {t.modules.map((m) => (
                    <span key={m} className="tag">
                      {m}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
