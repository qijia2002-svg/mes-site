/**
 * 题库：按课程筛 SQL 实训题。
 * 课程用下拉选择——不让用户手填数据库主键（原来的「主题 ID」数字框既暴露内部
 * 主键、又要求用户猜编号，属于把数据库结构泄漏到 UI 上）。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';

export default function QuizPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const [topicId, setTopicId] = useState<number | null>(null);

  // 课程列表到位后默认选中第一门，避免空选态下面板一直空着。
  useEffect(() => {
    if (topicId === null && topics.data && topics.data.length > 0) {
      setTopicId(topics.data[0].id);
    }
  }, [topics.data, topicId]);

  const exercises = useQuery({
    queryKey: ['sql-exercises', topicId],
    queryFn: () => api.sqlExercises(topicId as number),
    enabled: topicId !== null,
  });

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">SQL 题库</h1>
          <p className="page-sub">
            题面不含答案。你的 SQL 在浏览器里执行，结果集归一化后算哈希再和标准答案比对，
            所以答案不会经过网络。
          </p>
        </div>
      </header>

      <div className="form-row">
        <label className="field">
          <span>选择课程</span>
          <select
            className="select"
            value={topicId ?? ''}
            disabled={topics.isLoading || !topics.data?.length}
            onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
          >
            {topics.isLoading && <option value="">加载中…</option>}
            {!topics.isLoading && !topics.data?.length && <option value="">暂无课程</option>}
            {topics.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}

      {topicId !== null && (
        <>
          {exercises.isLoading && <LoadingState label="正在加载题目…" />}
          {exercises.isError && (
            <ErrorState error={exercises.error} onRetry={() => void exercises.refetch()} />
          )}
          {exercises.data?.length === 0 && (
            <EmptyState
              title="这门课暂无题目"
              hint="换一门课，或到 SQL 工作台自由练习。"
              icon="empty-search"
              action={
                <Link className="btn btn-secondary btn-sm" to="/sql-space">
                  <Icon name="sql" size={16} />
                  自由练习
                </Link>
              }
            />
          )}
          {exercises.data && exercises.data.length > 0 && (
            <ul className="card-grid">
              {exercises.data.map((e) => (
                <li key={e.id}>
                  <Link className="card" to={`/sql-space/${e.id}`}>
                    <h2 className="card-title">{e.title}</h2>
                    <p className="card-desc">{e.prompt}</p>
                    <span className="text-link">
                      开始作答
                      <Icon name="chevron-right" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
