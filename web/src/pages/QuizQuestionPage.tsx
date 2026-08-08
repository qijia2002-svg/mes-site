/**
 * 单题测验页（工厂全景节点的 quiz 资源深链终点）。
 * 复用 QuizDeck 渲染与判题逻辑（样式一致、支持单/多/判断/理解题型），
 * 完成时通过 onComplete 派发 factory:resource-done，让工厂全景即时标记该节点测验已完成。
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useCrumbTail } from '../components/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { QuizDeck } from '../components/QuizDeck';
import { api } from '../api/endpoints';
import { NODE_RESOURCE_DONE } from '../features/factory/useNodeProgress';

export default function QuizQuestionPage() {
  const { questionId } = useParams();
  const id = Number(questionId);
  const valid = Number.isInteger(id) && id > 0;

  const q = useQuery({
    queryKey: ['quiz-question', id],
    queryFn: () => api.quizQuestion(id),
    enabled: valid,
  });

  useCrumbTail(q.data?.stem?.slice(0, 24));

  if (!valid) {
    return (
      <EmptyState
        title="题目地址无效"
        hint="URL 里的题目编号不是正整数。"
        icon="empty-search"
        action={
          <Link className="btn btn-secondary btn-sm" to="/quiz">
            <Icon name="arrow-left" size={16} />
            返回题库
          </Link>
        }
      />
    );
  }
  if (q.isLoading) return <LoadingState label="加载题目…" />;
  if (q.isError) {
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }
  if (!q.data) {
    return (
      <EmptyState
        title="题目不存在或已下线"
        icon="empty-search"
        action={
          <Link className="btn btn-secondary btn-sm" to="/quiz">
            <Icon name="arrow-left" size={16} />
            返回题库
          </Link>
        }
      />
    );
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">随堂测验</h1>
          <p className="page-sub">{q.data.stem}</p>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/quiz">
          <Icon name="arrow-left" size={16} />
          返回题库
        </Link>
      </header>

      <QuizDeck
        questions={[q.data]}
        title="随堂测验"
        onComplete={() =>
          window.dispatchEvent(
            new CustomEvent(NODE_RESOURCE_DONE, { detail: { type: 'quiz', refId: id } }),
          )
        }
      />
    </section>
  );
}
