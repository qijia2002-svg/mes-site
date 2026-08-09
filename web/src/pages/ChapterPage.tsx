/**
 * 章节阅读页（F2 / AC-02）。
 * v3：删掉卡片模式，只保留文档阅读。卡片把长文切成碎片，读者拿不到上下文，
 * 反而比顺着读更累；正文里的内联实战锚点才是"看练同屏"的正解。
 * 正文来自后台可编辑的 markdown = 不可信输入，一律经 renderChapterMarkdown
 * （markdown-it html:false + DOMPurify 白名单）后再注入。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useCrumbTail } from '../components/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { QuizDeck } from '../components/QuizDeck';
import { renderChapterMarkdown } from '../lib/markdown';
import { api } from '../api/endpoints';
import { NODE_RESOURCE_DONE } from '../features/factory/useNodeProgress';
import { GlossaryProvider } from '../features/glossary/glossary.context';
import { TermAwareHtml } from '../features/glossary/TermAwareHtml';
import { GlossarySearch } from '../features/glossary/GlossarySearch';

/** 停留满这个时长才算"读过"，避免误点一下就记完成。 */
const READ_DWELL_MS = 2000;

export default function ChapterPage() {
  const { chapterId } = useParams();
  const id = Number(chapterId);
  const valid = Number.isInteger(id) && id > 0;

  const chapter = useQuery({
    queryKey: ['chapter', id],
    queryFn: () => api.chapter(id),
    enabled: valid,
  });

  useCrumbTail(chapter.data?.title);

  // 拉章节测试题 + 同课程章节列表（用于下一章导航）
  const quizQ = useQuery({
    queryKey: ['quiz', id],
    queryFn: () => api.quizQuestions(id),
    enabled: valid && !!chapter.data,
  });
  const chaptersQ = useQuery({
    queryKey: ['chapters', chapter.data?.topicId],
    queryFn: () => api.chapters(chapter.data?.topicId ?? 0),
    enabled: valid && !!chapter.data?.topicId,
  });

  const [showQuiz, setShowQuiz] = useState(false);

  const rendered = useMemo(
    () => renderChapterMarkdown(chapter.data?.md ?? ''),
    [chapter.data?.md],
  );

  const [readState, setReadState] = useState<'idle' | 'done' | 'failed'>('idle');
  // StrictMode 双挂载 + 重渲染都可能重复上报，用 ref 锁死"每章一次"。
  const reportedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!valid || !chapter.data) return;
    if (reportedRef.current === id) return;

    const timer = window.setTimeout(() => {
      reportedRef.current = id;
      api
        .recordProgress({ item_type: 'chapter', item_id: String(id), status: 'read' })
        .then(() => setReadState('done'))
        .catch(() => {
          // 上报失败不阻断阅读，但要让用户知道进度没记上，而不是假装成功。
          reportedRef.current = null;
          setReadState('failed');
        });
      // 通知工厂全景：该节点的知识卡片已读（仅作卡片勾选，不影响节点完成——C1 只认实战）。
      window.dispatchEvent(
        new CustomEvent(NODE_RESOURCE_DONE, { detail: { type: 'chapter', refId: id } }),
      );
    }, READ_DWELL_MS);

    return () => window.clearTimeout(timer);
  }, [valid, chapter.data, id]);

  if (!valid) {
    return (
      <EmptyState
        title="章节地址无效"
        hint="URL 里的章节编号不是正整数。"
        icon="empty-search"
        action={
          <Link className="btn btn-secondary btn-sm" to="/courses">
            <Icon name="courses" size={16} />
            回课程列表
          </Link>
        }
      />
    );
  }

  if (chapter.isLoading) return <LoadingState label="正在加载章节正文…" />;
  if (chapter.isError) {
    return <ErrorState error={chapter.error} onRetry={() => void chapter.refetch()} />;
  }
  if (!chapter.data) {
    return <EmptyState title="这一章还没有内容" hint="后台尚未发布正文。" icon="chapter" />;
  }

  return (
    <GlossaryProvider>
      <article>
      <header className="page-head">
        <div>
          <h1 className="page-title">{chapter.data.title}</h1>
          <p className="page-sub">
            <span className="pill pill-ok" style={{ marginRight: 'var(--space-2)' }}>L2 理解</span>
            约 {Math.max(1, Math.round((chapter.data.md?.length ?? 0) / 900))} 分钟阅读
            {chapter.data.updatedAt
              ? ` · 更新于 ${new Date(chapter.data.updatedAt * 1000).toLocaleDateString('zh-CN')}`
              : ''}
          </p>
        </div>
        <div className="page-head-actions">
          <GlossarySearch />
          <ReadBadge state={readState} />
        </div>
      </header>

      <div className="chapter-layout">
        <div className="chapter-main">
          {rendered.html ? (
            <TermAwareHtml html={rendered.html} className="prose" />
          ) : (
            <EmptyState title="正文为空" hint="这一章只有标题，内容待补充。" icon="chapter" />
          )}

          {/* 章节测试：正文读完后按需展开，不默认占位 */}
          {quizQ.data && quizQ.data.length > 0 && (
            <div className="section" style={{ marginTop: 'var(--space-8)' }}>
              <div className="section-head">
                <h2 className="section-title">章节测试</h2>
                <span className="row-meta">{quizQ.data.length} 道题</span>
              </div>
              {!showQuiz ? (
                <button type="button" className="btn btn-primary" onClick={() => setShowQuiz(true)}>
                  <Icon name="quiz" size={16} />
                  开始测试
                </button>
              ) : (
                <QuizDeck questions={quizQ.data} title={chapter.data.title} />
              )}
            </div>
          )}

          <footer className="chapter-foot">
            <Link className="btn btn-secondary btn-sm" to={`/courses/${chapter.data.topicId}`}>
              <Icon name="arrow-left" size={16} />
              返回章节列表
            </Link>
            {(() => {
              const chs = (chaptersQ.data ?? []).slice().sort((a, b) => a.sort - b.sort);
              const idx = chs.findIndex((c) => c.id === id);
              const next = idx >= 0 && idx < chs.length - 1 ? chs[idx + 1] : null;
              return next ? (
                <Link className="btn btn-primary btn-sm" to={`/chapters/${next.id}`}>
                  下一章：{next.title}
                  <Icon name="arrow-right" size={16} />
                </Link>
              ) : null;
            })()}
          </footer>
        </div>

        {rendered.toc.length > 1 && (
          <nav className="chapter-aside" aria-label="本章目录">
            <p className="toc-title">
              <Icon name="toc" size={16} />
              目录
            </p>
            <ul className="toc-list">
              {rendered.toc.map((t) => (
                <li key={t.id} className={t.level >= 3 ? 'toc-l3' : undefined}>
                  <a href={`#${t.id}`}>{t.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      </article>
    </GlossaryProvider>
  );
}

function ReadBadge({ state }: { state: 'idle' | 'done' | 'failed' }) {
  if (state === 'done') {
    return (
      <span className="pill pill-ok">
        <Icon name="success" size={16} />
        已记入今日阅读
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="pill pill-warn">
        <Icon name="warn" size={16} />
        进度未同步
      </span>
    );
  }
  return null;
}
