import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SqlExercise } from '../api/endpoints';

export default function QuizPage() {
  const [topicId, setTopicId] = useState(1);
  const ex = useQuery({
    queryKey: ['sql-ex', topicId],
    queryFn: () => api.sqlExercises(topicId),
  });

  return (
    <section>
      <h2>SQL 题库（练习 + 判题）</h2>
      <p className="hint">
        题面不含答案；判题在浏览器端 sql.js 内比对结果集（对应 v2 §4）。
      </p>
      <div className="field">
        <label>
          主题 ID：
          <input
            type="number"
            value={topicId}
            min={1}
            onChange={(e) => setTopicId(Number(e.target.value) || 1)}
          />
        </label>
      </div>
      {ex.isLoading && <div className="hint">加载中…</div>}
      {ex.data?.length === 0 && <div className="hint">该主题暂无题目（待后台导入）。</div>}
      <ul className="grid">
        {ex.data?.map((e: SqlExercise) => (
          <li key={e.id} className="card">
            <h3>{e.title}</h3>
            <p>{e.prompt}</p>
            <a className="tag" href="/sql-space">
              前往沙箱练习
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
