import { useQuery } from '@tanstack/react-query';
import { api, type LearningPath } from '../api/endpoints';

export default function LearningPathsPage() {
  const lp = useQuery({ queryKey: ['lp'], queryFn: api.learningPaths });

  return (
    <section>
      <h2>学习路径</h2>
      {lp.isLoading && <div className="hint">加载中…</div>}
      {lp.data?.length === 0 && <div className="hint">暂无学习路径（待后台导入）。</div>}
      <ul className="grid">
        {lp.data?.map((p: LearningPath) => (
          <li key={p.id} className="card">
            <h3>{p.title}</h3>
            <p>{p.description || '（暂无描述）'}</p>
            <div className="tags">
              {p.topicIds.map((id) => (
                <span key={id} className="tag">
                  主题#{id}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
