import { useQuery } from '@tanstack/react-query';
import { api, type Topic } from '../api/endpoints';

export default function CoursesPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  return (
    <section>
      <h2>课程 / 课时</h2>
      {topics.isLoading && <div className="hint">加载中…</div>}
      {topics.data?.length === 0 && <div className="hint">暂无课程（待后台导入）。</div>}
      <ul className="grid">
        {topics.data?.map((t: Topic) => (
          <li key={t.id} className="card">
            <h3>{t.title}</h3>
            <p>{t.description || '（暂无描述）'}</p>
            <div className="tags">
              {t.modules.map((m) => (
                <span key={m} className="tag">
                  {m}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
