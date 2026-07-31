import { useQuery } from '@tanstack/react-query';
import { api, type Topic } from '../api/endpoints';
import { SqlSandbox } from '../features/sql-sandbox/SqlSandbox';

export default function HomePage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  return (
    <>
      <section className="intro">
        <h1>边学边练的 MES 实训平台</h1>
        <p>理论 + 在线 SQL 沙箱 + 题库 + 学习路径，全部运行在零成本 Cloudflare 边缘。</p>
      </section>

      <section className="topics">
        <h2>学习主题</h2>
        {topics.isLoading && <div className="hint">加载中…</div>}
        {topics.data && topics.data.length === 0 && (
          <div className="hint">尚未录入主题（待后台导入内容）。</div>
        )}
        <ul className="topic-list">
          {topics.data?.map((t: Topic) => (
            <li key={t.id} className="topic-card">
              <h3>{t.title}</h3>
              <p>{t.description}</p>
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

      <SqlSandbox />
    </>
  );
}
