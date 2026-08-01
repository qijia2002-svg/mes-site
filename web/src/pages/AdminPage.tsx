/**
 * 最小后台：查看主题、新建主题。MVP 内容走 seed.sql，这里只保留兜底能力。
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type Topic } from '../api/endpoints';

export default function AdminPage() {
  const qc = useQueryClient();
  const topics = useQuery({ queryKey: ['admin-topics'], queryFn: api.adminTopics, retry: 0 });
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createTopic({
        slug: slug.trim(),
        title: title.trim(),
        description: desc.trim(),
        modules: ['theory', 'sql'],
        status: 'draft',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-topics'] });
      setSlug('');
      setTitle('');
      setDesc('');
    },
  });

  const disabled = create.isPending || !slug.trim() || !title.trim();

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">内容后台</h1>
          <p className="page-sub">受 guardAdmin 保护，未登录会返回 401。新建的主题默认是草稿。</p>
        </div>
      </header>

      <section className="panel">
        <header className="panel-head">
          <h2>
            <Icon name="add" size={20} className="panel-glyph" />
            新建主题
          </h2>
        </header>
        <form
          className="form form-inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled) create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="topic-slug">标识 slug</label>
            <input
              id="topic-slug"
              className="input"
              value={slug}
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="topic-title">标题</label>
            <input
              id="topic-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="topic-desc">简介</label>
            <input
              id="topic-desc"
              className="input"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={disabled}>
            <Icon name="add" size={16} />
            {create.isPending ? '提交中…' : '新建'}
          </button>
        </form>
        {create.isError && <ErrorState error={create.error} title="新建失败" />}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>
            <Icon name="courses" size={20} className="panel-glyph" />
            现有主题
          </h2>
        </header>
        {topics.isLoading && <LoadingState label="正在加载…" />}
        {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
        {topics.data && topics.data.length === 0 && <EmptyState title="还没有主题" />}
        {topics.data && topics.data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">标题</th>
                <th scope="col">slug</th>
                <th scope="col">状态</th>
              </tr>
            </thead>
            <tbody>
              {topics.data.map((t: Topic) => (
                <tr key={t.id}>
                  <td className="tabular">{t.id}</td>
                  <td>{t.title}</td>
                  <td>
                    <code>{t.slug}</code>
                  </td>
                  <td>
                    <span className={t.status === 'published' ? 'pill pill-ok' : 'pill pill-idle'}>
                      <Icon name={t.status === 'published' ? 'show' : 'hide'} size={16} />
                      {t.status === 'published' ? '已发布' : '草稿'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
