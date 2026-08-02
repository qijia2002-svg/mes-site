/**
 * 课程详情：章节列表 + 模块考试 + SQL 实训题。
 * 读理论 → 卡片学习 → 章节测试 → 模块汇总考试 → SQL 实操，全链路闭环。
 */
import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useCrumbTail } from '../components/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { QuizDeck } from '../components/QuizDeck';
import { api } from '../api/endpoints';

export default function CourseDetailPage() {
  const { topicId } = useParams();
  const id = Number(topicId);
  const valid = Number.isInteger(id) && id > 0;

  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics, enabled: valid });
  const chapters = useQuery({
    queryKey: ['chapters', id],
    queryFn: () => api.chapters(id),
    enabled: valid,
  });
  const progress = useQuery({ queryKey: ['progress'], queryFn: api.progress, enabled: valid });
  const exercises = useQuery({
    queryKey: ['sql-exercises', id],
    queryFn: () => api.sqlExercises(id),
    enabled: valid,
  });

  const completedSet = useMemo(
    () => new Set((progress.data?.completedChapterIds ?? []).map(String)),
    [progress.data],
  );
  const doneCount = useMemo(
    () => (chapters.data ?? []).filter((c) => completedSet.has(String(c.id))).length,
    [chapters.data, completedSet],
  );
  const totalCount = chapters.data?.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // 模块汇总考试
  const [showExam, setShowExam] = useState(false);
  const topicQuiz = useQuery({
    queryKey: ['topic-quiz', id],
    queryFn: () => api.topicQuestions(id),
    enabled: valid && showExam,
  });

  const topic = topics.data?.find((t) => t.id === id);
  useCrumbTail(topic?.title);

  if (!valid) {
    return <EmptyState title="课程地址无效" hint="URL 里的课程编号不是正整数。" icon="empty-search" />;
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">{topic?.title ?? `课程 #${id}`}</h1>
          <p className="page-sub">{topic?.description || '先按顺序读完章节，再到 SQL 工作台把语句写一遍。'}</p>
        </div>
        {topic && topic.modules.length > 0 && (
          <div className="tag-row">
            {topic.modules.map((m) => (
              <span key={m} className="tag">{m}</span>
            ))}
          </div>
        )}
      </header>

      {/* 学习目标（ABCD 格式） */}
      {chapters.data && chapters.data.length > 0 && (
        <div className="alert alert-info" role="note">
          <Icon name="chapter" size={16} className="alert-glyph" />
          <div>
            <strong>学完本课程后，你将能够：</strong>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-2)', display: 'block', marginTop: 2 }}>
              在实际 MES 实施场景中，{topic?.slug?.includes('sql') ? '编写并执行 SQL 查询，分析生产和质量数据' :
              topic?.slug?.includes('erp') ? '理解企业资源计划的核心流程，说明 ERP 与 MES 的数据交互关系' :
              topic?.slug?.includes('mes') ? '说明 MES 核心模块的功能和数据流转，诊断常见车间执行问题' :
              topic?.slug?.includes('plc') ? '理解 PLC 工作原理和梯形图基础，说明设备层与 MES 的数据采集链路' :
              topic?.slug?.includes('quality') ? '执行质量追溯分析，定位生产批次问题根因' :
              '掌握相关理论知识，为后续实战模块打好基础'}。
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', display: 'block', marginTop: 4 }}>
              {totalCount} 章 · 预计 {Math.max(1, Math.round(totalCount * 0.25))} 小时 · 布鲁姆 {progressPct > 50 ? 'L3 应用' : 'L2 理解'}
            </span>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">章节</h2>
          {chapters.data && chapters.data.length > 0 && (
            <span className="row-meta">
              已学 {doneCount} / {totalCount} 章
              {progressPct > 0 && ` · ${progressPct}%`}
            </span>
          )}
        </div>
        {chapters.isLoading && <LoadingState label="正在加载章节…" />}
        {chapters.isError && (
          <ErrorState error={chapters.error} onRetry={() => void chapters.refetch()} />
        )}
        {chapters.data?.length === 0 && (
          <EmptyState title="这门课还没有章节" hint="后台导入内容后会出现在这里。" icon="chapter" />
        )}
        {chapters.data && chapters.data.length > 0 && (
          <ul className="row-list">
            {chapters.data.map((c, i) => {
              const isDone = completedSet.has(String(c.id));
              return (
                <li key={c.id}>
                  <Link className="row-link" to={`/chapters/${c.id}`}>
                    <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                    <Icon name={isDone ? 'success' : 'chapter'} size={16} className="row-glyph" />
                    <span className="row-title" style={isDone ? { color: 'var(--success)' } : undefined}>{c.title}</span>
                    {c.status !== 'published' && <span className="row-meta">{c.status}</span>}
                    {isDone ? (
                      <span className="pill pill-ok" style={{ marginLeft: 'auto', flex: 'none' }}>已读</span>
                    ) : (
                      <Icon name="chevron-right" size={16} className="row-arrow" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 模块汇总考试 */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title">模块考试</h2>
        </div>
        {!showExam ? (
          <p className="stat-note">
            学完全部章节后，来这里做汇总测试，检验整个模块的掌握情况。
            <br />
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-3)' }}
              onClick={() => setShowExam(true)}
            >
              <Icon name="quiz" size={16} />
              开始模块考试
            </button>
          </p>
        ) : topicQuiz.isLoading ? (
          <LoadingState label="正在加载考题…" />
        ) : topicQuiz.isError ? (
          <ErrorState error={topicQuiz.error} onRetry={() => void topicQuiz.refetch()} />
        ) : topicQuiz.data && topicQuiz.data.length > 0 ? (
          <QuizDeck questions={topicQuiz.data} title={topic?.title ?? '模块'} />
        ) : (
          <EmptyState title="这个模块还没有考题" hint="考题由后台导入后会出现在这里。" icon="quiz" />
        )}
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">实训题</h2>
          <Link className="text-link" to="/sql-space">
            打开自由练习沙箱
          </Link>
        </div>
        {exercises.isLoading && <LoadingState label="正在加载题目…" />}
        {exercises.isError && (
          <ErrorState error={exercises.error} onRetry={() => void exercises.refetch()} />
        )}
        {exercises.data?.length === 0 && (
          <EmptyState title="这门课暂无实训题" hint="可以先到 SQL 工作台自由练习样例库。" icon="sql" />
        )}
        {exercises.data && exercises.data.length > 0 && (
          <ul className="row-list">
            {exercises.data.map((e) => (
              <li key={e.id}>
                <Link className="row-link" to={`/sql-space/${e.id}`}>
                  <Icon name="sql" size={16} className="row-glyph" />
                  <span className="row-title">{e.title}</span>
                  <Icon name="chevron-right" size={16} className="row-glyph" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
