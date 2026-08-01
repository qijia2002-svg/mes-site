/**
 * 章节阅读页（F2 / AC-02）。
 * 正文来自后台可编辑的 markdown = 不可信输入，一律经 renderChapterMarkdown
 * （markdown-it html:false + DOMPurify 白名单）后再注入。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useCrumbTail } from '../components/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { renderChapterMarkdown } from '../lib/markdown';
import { api } from '../api/endpoints';

/** 停留满这个时长才算"读过"，避免误点一下就记完成。 */
const READ_DWELL_MS = 6000;

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
    <article>
      <header className="page-head">
        <div>
          <h1 className="page-title">{chapter.data.title}</h1>
          <p className="page-sub">
            所属课程 #{chapter.data.topicId}
            {chapter.data.updatedAt
              ? ` · 更新于 ${new Date(chapter.data.updatedAt * 1000).toLocaleDateString('zh-CN')}`
              : ''}
          </p>
        </div>
        <ReadBadge state={readState} />
      </header>

      <div className="chapter-layout">
        <div className="chapter-main">
          {rendered.html ? (
            // 已过 markdown-it(html:false) + DOMPurify 白名单，见 lib/markdown.ts
            <div className="prose" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          ) : (
            <EmptyState title="正文为空" hint="这一章只有标题，内容待补充。" icon="chapter" />
          )}

          <footer className="chapter-foot">
            <Link className="btn btn-secondary btn-sm" to={`/courses/${chapter.data.topicId}`}>
              <Icon name="arrow-left" size={16} />
              返回章节列表
            </Link>
            <Link className="btn btn-primary btn-sm" to="/sql-space">
              <Icon name="sql" size={16} />
              到 SQL 工作台动手练
            </Link>
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
