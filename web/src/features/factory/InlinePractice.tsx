/**
 * 节点抽屉里的「同屏实战」内联壳（第 1 步 · A 方案）。
 *
 * 设计前提：判题口径只能有一份。所以这里不重写任何练习逻辑，
 * 只做「取数 + 挂内核组件」，与 ExercisePage / QuizQuestionPage 用的是同一套：
 *   sql   → api.sqlExercise(id)  → <SqlSandbox exercise>
 *   quiz  → api.quizQuestion(id) → <QuizDeck questions={[q]}>
 *
 * 进度回写的两种口径（别搞混）：
 *   sql  —— SqlSandbox 判过后**自己**派发 NODE_RESOURCE_DONE，这里不要重复派发，
 *           否则同一题会被记两次。
 *   quiz —— QuizDeck 只回调 onComplete，事件必须由调用方派发（与 QuizQuestionPage 一致）。
 *
 * queryKey 刻意与两个独立页保持一致（['sql-exercise',id] / ['quiz-question',id]），
 * 抽屉内练过的题再跳独立页时直接命中缓存，不会重新转圈。
 *
 * SqlSandbox 走 lazy：它牵着 sql.js WASM 沙盒，不能进工厂全景的首屏包。
 */
import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateBlock';
import { QuizDeck } from '../../components/QuizDeck';
import { api } from '../../api/endpoints';
import { NODE_RESOURCE_DONE } from './useNodeProgress';

const SqlSandbox = lazy(() =>
  import('../sql-sandbox/SqlSandbox').then((m) => ({ default: m.SqlSandbox })),
);

function InlineSql({ id }: { id: number }) {
  const q = useQuery({
    queryKey: ['sql-exercise', id],
    queryFn: () => api.sqlExercise(id),
  });

  if (q.isLoading) return <LoadingState label="正在加载题目…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <EmptyState title="题目不存在或已下线" icon="empty-search" />;

  return (
    <>
      <p className="nd-inline-prompt">{q.data.prompt}</p>
      <Suspense fallback={<LoadingState label="正在唤醒 SQL 沙盒…" />}>
        <SqlSandbox exercise={q.data} />
      </Suspense>
    </>
  );
}

function InlineQuiz({ id }: { id: number }) {
  const q = useQuery({
    queryKey: ['quiz-question', id],
    queryFn: () => api.quizQuestion(id),
  });

  if (q.isLoading) return <LoadingState label="加载题目…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <EmptyState title="题目不存在或已下线" icon="empty-search" />;

  return (
    <QuizDeck
      questions={[q.data]}
      title="随堂测验"
      progress={{ context: 'factory', key: id }}
      onComplete={() =>
        window.dispatchEvent(
          new CustomEvent(NODE_RESOURCE_DONE, { detail: { type: 'quiz', refId: id } }),
        )
      }
    />
  );
}

export interface InlinePracticeProps {
  /** 只接内联得下的两类；sim 走全屏接管，不进这里。 */
  type: 'sql' | 'quiz';
  refId: number;
}

export default function InlinePractice({ type, refId }: InlinePracticeProps) {
  return type === 'sql' ? <InlineSql id={refId} /> : <InlineQuiz id={refId} />;
}
