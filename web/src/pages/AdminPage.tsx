/**
 * 内容后台：主题 CRUD + 章节管理 + Markdown/JSON 导入。
 * 零后端改动——全部 API 已就绪（updateTopic/deleteTopic/adminChapters/updateChapter/deleteChapter）。
 */
import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type Topic, type Chapter } from '../api/endpoints';

/* ===================== 工具组件 ===================== */

function Btn({ onClick, children, ...rest }: any) {
  return <button type="button" className="btn btn-xs btn-ghost" onClick={onClick} {...rest}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

/* ===================== Markdown 导入 ===================== */

function MdImportPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: (b: unknown) => api.importContent(b),
    onSuccess: (d) => { setResult(`${d.topicsCreated}主题, ${d.chaptersCreated}章`); void qc.invalidateQueries({ queryKey: ['admin-topics'] }); },
    onError: () => setResult('导入失败'),
  });

  const parse = (t: string) => {
    const meta: any = {}; let body = t;
    if (t.startsWith('---')) { const end = t.indexOf('---', 3); if (end !== -1) { const fm = t.slice(3, end); body = t.slice(end + 3).trim(); for (const l of fm.split('\n')) { const m2 = l.match(/^(\w+):\s*(.+)$/); if (m2) { let v: any = m2[2].trim(); if (v.startsWith('[')) v = v.slice(1, -1).split(',').map((s: string) => s.trim()); meta[m2[1]] = v; } } } }
    const h = body.match(/^#\s+(.+)/m);
    return { meta, body, title: h ? h[1].trim() : '' };
  };

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []); if (!fs.length) return;
    const chs: any[] = []; const tags = new Set<string>(); let tt = '';
    Promise.all(fs.map((f) => f.text())).then((ts) => {
      ts.forEach((t, i) => { const { meta, body, title } = parse(t); if (!title) return; const sm = fs[i].name.match(/^(\d+)/); chs.push({ title, sort: sm ? +sm[1] : i + 1, md: body }); if (meta.topic) tt = meta.topic; if (Array.isArray(meta.tags)) meta.tags.forEach((x: string) => tags.add(x)); });
      if (!chs.length) { setResult('无有效章节'); return; }
      if (!tt) tt = fs[0].name.replace(/^\d+_?|\.md$/g, '');
      m.mutate({ topics: [{ slug: tt.replace(/\s+/g, '-').toLowerCase(), title: tt, description: chs.map((c: any) => c.title).join(' / '), modules: [...tags], chapters: chs }] });
    });
    e.target.value = '';
  };

  return (
    <section className="panel">
      <div className="panel-head"><h2><Icon name="chapter" size={20} className="panel-glyph" />Markdown 导入</h2><span className="panel-note">上传 .md（含 --- frontmatter），自动解析</span></div>
      <div className="btn-row"><button className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Icon name="copy" size={16} />选择 .md（可多选）</button><input ref={fileRef} type="file" multiple accept=".md" style={{ display: 'none' }} onChange={handle} /></div>
      {m.isPending && <LoadingState label="导入中…" />}
      {result && <p className="alert alert-info">{result}</p>}
    </section>
  );
}

function JsonImportPanel() {
  const qc = useQueryClient(); const fr = useRef<HTMLInputElement>(null); const [r, setR] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (b: unknown) => api.importContent(b),
    onSuccess: (d) => { setR(`${d.topicsCreated}主题, ${d.chaptersCreated}章`); void qc.invalidateQueries({ queryKey: ['admin-topics'] }); },
    onError: () => setR('导入失败'),
  });
  return (
    <section className="panel">
      <div className="panel-head"><h2><Icon name="copy" size={20} className="panel-glyph" />JSON 导入</h2></div>
      <div className="btn-row"><button className="btn btn-secondary" onClick={() => fr.current?.click()}><Icon name="copy" size={16} />选择 JSON</button><input ref={fr} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { m.mutate(JSON.parse(rd.result as string)); } catch { setR('JSON 解析失败'); } }; rd.readAsText(f); e.target.value = ''; }} /></div>
      {m.isPending && <LoadingState label="导入中…" />}
      {r && <p className="alert alert-info">{r}</p>}
    </section>
  );
}

/* ===================== 主题编辑 ===================== */

function TopicEditForm({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(topic.title);
  const [desc, setDesc] = useState(topic.description ?? '');
  const [modules, setModules] = useState((topic.modules ?? []).join(', '));
  const [status, setStatus] = useState(topic.status ?? 'draft');

  const m = useMutation({
    mutationFn: () => api.updateTopic(topic.id, { slug: topic.slug, title, description: desc, modules: modules.split(',').map((s) => s.trim()).filter(Boolean), sort: 0, status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-topics'] }); onClose(); },
  });

  return (
    <div className="panel" style={{ marginBottom: 'var(--space-3)' }}>
      <div className="panel-head"><h3>编辑：{topic.title}</h3></div>
      <form className="form form-inline" onSubmit={(e) => { e.preventDefault(); if (!m.isPending) m.mutate(); }}>
        <Field label="标题"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="简介"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label="模块（逗号分隔）"><input className="input" value={modules} onChange={(e) => setModules(e.target.value)} /></Field>
        <Field label="状态"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="published">已发布</option><option value="draft">草稿</option></select></Field>
        <div className="btn-row"><button className="btn btn-primary btn-sm" type="submit" disabled={m.isPending}>{m.isPending ? '保存中' : '保存'}</button><button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>取消</button></div>
      </form>
      {m.isError && <ErrorState error={m.error} />}
    </div>
  );
}

/* ===================== 章节管理 ===================== */

function ChapterPanel({ topicId }: { topicId: number }) {
  const qc = useQueryClient();
  const chQ = useQuery({ queryKey: ['admin-chapters', topicId], queryFn: () => api.adminChapters(topicId) });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  const delMut = useMutation({
    mutationFn: (id: number) => api.deleteTopic(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-chapters', topicId] }),
  });

  if (chQ.isLoading) return <LoadingState label="加载章节…" />;

  return (
    <div className="panel" style={{ marginBottom: 'var(--space-3)' }}>
      <div className="panel-head">
        <h3>章节（{chQ.data?.length ?? 0} 章）</h3>
        <button className="btn btn-primary btn-xs" onClick={() => setShowNew(true)}><Icon name="add" size={16} />新增</button>
      </div>

      {showNew && (
        <ChapterEditForm topicId={topicId} onClose={() => setShowNew(false)} />
      )}

      {chQ.data?.length === 0 && <p className="panel-fallback">还没有章节</p>}
      {chQ.data?.map((ch: Chapter & { status?: string }) => (
        <div key={ch.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) 0', borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--meta)', width: 30 }}>{ch.sort}</span>
            <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{ch.title}</span>
            <Btn onClick={() => setEditingId(editingId === ch.id ? null : ch.id)}>编辑</Btn>
            <Btn onClick={() => { if (confirm(`删除「${ch.title}」？`)) delMut.mutate(ch.id); }} style={{ color: 'var(--danger)' }}>删除</Btn>
          </div>
          {editingId === ch.id && (
            <ChapterEditForm topicId={topicId} chapter={ch} onClose={() => setEditingId(null)} />
          )}
        </div>
      ))}
    </div>
  );
}

function ChapterEditForm({ topicId, chapter, onClose }: { topicId: number; chapter?: Chapter & { status?: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [md, setMd] = useState(chapter ? '' : ''); // need to load detail

  // load full chapter detail for edit
  const detailQ = chapter ? useQuery({ queryKey: ['chapter', chapter.id], queryFn: () => api.chapter(chapter.id), enabled: !!chapter }) : null;
  const [mdLoaded, setMdLoaded] = useState(false);
  if (detailQ?.data && !mdLoaded) { setMd(detailQ.data.md); setMdLoaded(true); }

  const saveMut = useMutation({
    mutationFn: () => {
      if (chapter) return api.updateChapter(chapter.id, { topic_id: topicId, title, sort: chapter.sort, status: 'published', md_text: md, schema_version: 1 });
      return api.createChapter({ topic_id: topicId, title, sort: 99, status: 'published', md_text: md, schema_version: 1 });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-chapters', topicId] }); onClose(); },
  });

  return (
    <div style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)' }}>
      <Field label="标题"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Markdown 正文"><textarea className="input sql-editor" rows={8} value={md} onChange={(e) => setMd(e.target.value)} style={{ minHeight: 160, width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }} /></Field>
      <div className="btn-row" style={{ marginTop: 'var(--space-2)' }}>
        <button className="btn btn-primary btn-sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? '保存中' : '保存'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
      </div>
      {saveMut.isError && <ErrorState error={saveMut.error} />}
    </div>
  );
}

/* ===================== 主题列表 ===================== */

function TopicRow({ topic }: { topic: Topic }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showChapters, setShowChapters] = useState(false);

  const delMut = useMutation({
    mutationFn: () => api.deleteTopic(topic.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-topics'] }),
  });

  return (
    <>
      <tr>
        <td className="tabular">{topic.id}</td>
        <td>{topic.title}</td>
        <td><code>{topic.slug}</code></td>
        <td>
          <span className={topic.status === 'published' ? 'pill pill-ok' : 'pill pill-idle'}>
            {topic.status === 'published' ? '已发布' : '草稿'}
          </span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <Btn onClick={() => setEditing(!editing)}><Icon name="add" size={16} />编辑</Btn>
          <Btn onClick={() => setShowChapters(!showChapters)}><Icon name="chapter" size={16} />章节</Btn>
          <Btn onClick={() => { if (confirm(`删除「${topic.title}」及所有章节？`)) delMut.mutate(); }} style={{ color: 'var(--danger)' }}><Icon name="error" size={16} />删除</Btn>
        </td>
      </tr>
      {editing && (
        <tr><td colSpan={5} style={{ padding: 0 }}>
          <TopicEditForm topic={topic} onClose={() => setEditing(false)} />
        </td></tr>
      )}
      {showChapters && (
        <tr><td colSpan={5} style={{ padding: 0 }}>
          <ChapterPanel topicId={topic.id} />
        </td></tr>
      )}
    </>
  );
}

/* ===================== 主页 ===================== */

export default function AdminPage() {
  const qc = useQueryClient();
  const topics = useQuery({ queryKey: ['admin-topics'], queryFn: api.adminTopics, retry: 0 });
  const [slug, setSlug] = useState(''); const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');

  const create = useMutation({
    mutationFn: () => api.createTopic({ slug: slug.trim(), title: title.trim(), description: desc.trim(), modules: ['theory'], status: 'draft' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-topics'] }); setSlug(''); setTitle(''); setDesc(''); },
  });

  return (
    <>
      <header className="page-head"><div><h1 className="page-title">内容后台</h1><p className="page-sub">低代码管理：主题/章节 CRUD + Markdown 导入</p></div></header>

      <section className="panel">
        <div className="panel-head"><h2><Icon name="add" size={20} className="panel-glyph" />新建主题</h2></div>
        <form className="form form-inline" onSubmit={(e) => { e.preventDefault(); if (!create.isPending && slug && title) create.mutate(); }}>
          <Field label="slug"><input className="input" value={slug} spellCheck={false} onChange={(e) => setSlug(e.target.value)} placeholder="my-topic" /></Field>
          <Field label="标题"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="简介"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <button className="btn btn-primary" type="submit" disabled={create.isPending || !slug || !title}>{create.isPending ? '提交中' : '新建'}</button>
        </form>
        {create.isError && <ErrorState error={create.error} title="新建失败" />}
      </section>

      <MdImportPanel />
      <JsonImportPanel />

      <section className="panel">
        <div className="panel-head"><h2><Icon name="courses" size={20} className="panel-glyph" />主题列表</h2><span className="panel-note">共 {topics.data?.length ?? 0} 个</span></div>
        {topics.isLoading && <LoadingState label="加载中…" />}
        {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
        {topics.data?.length === 0 && <EmptyState title="还没有主题" />}
        {topics.data && topics.data.length > 0 && (
          <table className="data-table">
            <thead><tr><th>ID</th><th>标题</th><th>slug</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>{topics.data.map((t: Topic) => <TopicRow key={t.id} topic={t} />)}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
