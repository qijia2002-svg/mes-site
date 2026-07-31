import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Topic } from '../api/endpoints';

export default function AdminPage() {
  const qc = useQueryClient();
  const topics = useQuery({ queryKey: ['admin-topics'], queryFn: api.adminTopics });
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createTopic({
        slug,
        title,
        description: desc,
        modules: ['theory', 'sql'],
        status: 'draft',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-topics'] });
      setSlug('');
      setTitle('');
      setDesc('');
    },
  });

  return (
    <section>
      <h2>后台（需管理员登录）</h2>
      <p className="hint">
        以下接口受 guardAdmin 保护；未登录会返回 401。请先在「登录」页用管理员凭证登录。
      </p>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="描述" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button className="btn primary" type="submit" disabled={create.isPending}>
          新建主题
        </button>
      </form>
      {create.isError && (
        <div className="sandbox-error">新建失败（需要有效的管理员登录态）。</div>
      )}

      <h3>现有主题</h3>
      <ul className="topic-list">
        {topics.data?.map((t: Topic) => (
          <li key={t.id} className="topic-card">
            <h3>{t.title}</h3>
            <p>状态：{t.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
