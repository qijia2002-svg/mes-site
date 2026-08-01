/**
 * 单题判题页（F3 闭环入口）。
 * 题面从 /sql-exercises/:id 取，只含 prompt / schema_hint / answer_hash，
 * 判题在 SqlSandbox 内部完成，答案 SQL 永不出网。
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useCrumbTail } from '../components/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { SqlSandbox } from '../features/sql-sandbox/SqlSandbox';
import { api, readAnswerHash } from '../api/endpoints';

export default function ExercisePage() {
  const { exerciseId } = useParams();
  const id = Number(exerciseId);
  const valid = Number.isInteger(id) && id > 0;

  const exercise = useQuery({
    queryKey: ['sql-exercise', id],
    queryFn: () => api.sqlExercise(id),
    enabled: valid,
  });

  useCrumbTail(exercise.data?.title);

  if (!valid) {
    return (
      <EmptyState
        title="题目地址无效"
        hint="URL 里的题目编号不是正整数。"
        icon="empty-search"
        action={
          <Link className="btn btn-secondary btn-sm" to="/sql-space">
            <Icon name="sql" size={16} />
            回 SQL 工作台
          </Link>
        }
      />
    );
  }

  if (exercise.isLoading) return <LoadingState label="正在加载题目…" />;
  if (exercise.isError) {
    return <ErrorState error={exercise.error} onRetry={() => void exercise.refetch()} />;
  }
  if (!exercise.data) {
    return <EmptyState title="题目不存在或已下线" icon="empty-search" />;
  }

  const hashMissing = readAnswerHash(exercise.data) === '';

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">{exercise.data.title}</h1>
          <p className="page-sub">{exercise.data.prompt}</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/sql-space">
          <Icon name="arrow-left" size={16} />
          自由练习
        </Link>
      </header>

      {hashMissing && (
        <p className="alert alert-warn" role="status">
          <Icon name="warn" size={16} className="alert-glyph" />
          <span>这道题还没配置标准答案哈希，可以照常写 SQL 试跑，但不会给出通过判定。</span>
        </p>
      )}

      <SqlSandbox exercise={exercise.data} />
    </section>
  );
}
