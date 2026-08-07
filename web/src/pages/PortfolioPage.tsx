/**
 * 作品集 / 求职素材 — 模块 v3。
 * v2→v3 升级：富字段（岗位 / 技能标签 / 外链 / 置顶）+ 导出导入备份 + 求职简历式视图。
 * 数据存本机 localStorage（portfolioStore v2）。
 */
import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import {
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  removePortfolioItem,
  setStarred,
  exportPortfolioString,
  importPortfolioString,
  type PortfolioItem,
  type PortfolioCategory,
} from '../lib/portfolioStore';

const CATS: (PortfolioCategory | 'all')[] = ['all', '需求文档', '实施笔记', '方案', '其他'];

function sortItems(items: PortfolioItem[]): PortfolioItem[] {
  return [...items].sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
    return (b.date || '').localeCompare(a.date || '');
  });
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>(() => getPortfolio());
  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<PortfolioCategory>('需求文档');
  const [role, setRole] = useState('');
  const [skills, setSkills] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startEdit = (item: PortfolioItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCat(item.category);
    setRole(item.role ?? '');
    setSkills((item.skills ?? []).join('、'));
    setDate(item.date);
    setLink(item.link ?? '');
    setNote(item.note);
    setShowForm(true);
    setResumeMode(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCat('需求文档');
    setRole('');
    setSkills('');
    setDate(new Date().toISOString().slice(0, 10));
    setLink('');
    setNote('');
    setShowForm(false);
  };

  const saveItem = () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      category: cat,
      role: role.trim(),
      skills: skills
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      date: date || new Date().toISOString().slice(0, 10),
      link: link.trim(),
      note: note.trim(),
    };
    const r = editingId ? updatePortfolioItem(editingId, payload) : addPortfolioItem(payload);
    if (!r.ok) {
      setErr(true);
      return;
    }
    setErr(false);
    setItems(r.items);
    resetForm();
  };

  const del = (id: string) => {
    if (!confirm('确定删除这条作品？')) return;
    const r = removePortfolioItem(id);
    if (!r.ok) {
      setErr(true);
      return;
    }
    setErr(false);
    setItems(r.items);
  };

  const toggleStar = (id: string, starred?: boolean) => {
    const r = setStarred(id, !starred);
    if (r.ok) setItems(r.items);
  };

  const doExport = () => {
    const text = exportPortfolioString();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mes-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    setImportErr(null);
    const reader = new FileReader();
    reader.onload = () => {
      const r = importPortfolioString(String(reader.result));
      if (!r.ok) {
        setImportErr(r.error ?? '导入失败');
        return;
      }
      setItems(r.items);
    };
    reader.onerror = () => setImportErr('读取文件失败');
    reader.readAsText(file);
  };

  const sorted = sortItems(items);
  const filtered = filter === 'all' ? sorted : sorted.filter((i) => i.category === filter);

  // ═══ 求职简历式视图（可打印 / 分享）═══
  if (resumeMode) {
    return (
      <section style={{ maxWidth: 820, margin: '0 auto' }}>
        <style>{`@media print { .sidebar,.topbar,.mobile-tabbar,.net-banner{display:none!important} .content{padding:0!important} body{background:#fff!important} }`}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <h1 className="page-title">求职作品集</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResumeMode(false)}>
              <Icon name="chevron-left" size={16} /> 返回
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Icon name="download" size={16} /> 打印 / 分享
            </button>
          </div>
        </div>
        {sorted.length === 0 ? (
          <p style={{ color: 'var(--meta)' }}>还没有作品，先去添加几条吧。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {sorted.map((it) => (
              <div key={it.id} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 'var(--weight-announce-cjk)', fontSize: 'var(--text-lg)' }}>{it.title}</span>
                  <span className="tag tag-soft">{it.category}</span>
                  {it.date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>{it.date}</span>}
                </div>
                {it.role && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', marginTop: 4 }}>{it.role}</div>}
                {it.skills && it.skills.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {it.skills.map((s) => (
                      <span key={s} className="tag">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {it.link && (
                  <div style={{ marginTop: 4 }}>
                    <a className="text-link" href={it.link} target="_blank" rel="noreferrer">
                      <Icon name="external-link" size={16} /> {it.link}
                    </a>
                  </div>
                )}
                {it.note && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 'var(--space-2)', lineHeight: 'var(--leading-body)', whiteSpace: 'pre-wrap' }}>
                    {it.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-head" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">作品集 / 求职素材</h1>
          <p className="page-sub">沉淀 MES 需求文档、实施笔记、方案，数据仅存本机浏览器。建议定期导出备份。</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm((s) => !s); }}>
            <Icon name="add" size={16} /> 添加作品
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={doExport}>
            <Icon name="download" size={16} /> 导出
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> 导入
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResumeMode(true)}>
            <Icon name="portfolio" size={16} /> 简历视图
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {importErr && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          导入失败：{importErr}
        </p>
      )}

      {/* 添加 / 编辑表单 */}
      {showForm && (
        <form className="panel" style={{ marginBottom: 'var(--space-5)' }} onSubmit={(e) => { e.preventDefault(); saveItem(); }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-announce-cjk)', marginBottom: 'var(--space-3)' }}>
            {editingId ? '编辑作品' : '添加作品'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <label className="field">
              <span>标题</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：XX 工厂 MES 需求调研" maxLength={60} />
            </label>
            <label className="field">
              <span>分类</span>
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value as PortfolioCategory)}>
                {(['需求文档', '实施笔记', '方案', '其他'] as PortfolioCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <label className="field">
              <span>岗位 / 角色</span>
              <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="如：MES 实施顾问" maxLength={40} />
            </label>
            <label className="field">
              <span>日期</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <label className="field">
              <span>技能标签（用、或逗号分隔）</span>
              <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="如：需求调研、蓝图设计、UAT" />
            </label>
            <label className="field">
              <span>外链</span>
              <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" maxLength={500} />
            </label>
          </div>
          <label className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <span>备注</span>
            <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={800} placeholder="简述背景与价值" />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}>
              保存
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>
              取消
            </button>
            {err && <span style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>保存失败：浏览器存储不可用</span>}
          </div>
        </form>
      )}

      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            className={`btn btn-xs ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(c)}
          >
            {c === 'all' ? '全部' : c}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--meta)' }}>
          <Icon name="empty" size={24} style={{ opacity: 0.5, marginBottom: 'var(--space-3)' }} />
          <p style={{ fontSize: 'var(--text-sm)' }}>还没有作品，点击右上角「添加作品」开始沉淀求职素材。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4) 0', borderTop: '1px solid var(--border-soft)' }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flex: 'none', marginTop: 7 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 'var(--weight-announce-cjk)', fontSize: 'var(--text-base)' }}>{item.title}</span>
                  {item.starred && <span className="tag tag-soft" style={{ color: 'var(--accent)' }}>置顶</span>}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 'var(--radius-pill)', padding: '2px 10px', fontWeight: 'var(--weight-emph-cjk)' }}>{item.category}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginLeft: 'auto' }}>{item.date}</span>
                </div>
                {item.role && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', marginTop: 2 }}>{item.role}</div>}
                {item.skills && item.skills.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {item.skills.map((s) => (
                      <span key={s} className="tag">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {item.link && (
                  <div style={{ marginTop: 4 }}>
                    <a className="text-link" href={item.link} target="_blank" rel="noreferrer">
                      <Icon name="external-link" size={16} /> {item.link}
                    </a>
                  </div>
                )}
                {item.note && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 'var(--space-2)', lineHeight: 'var(--leading-body)', whiteSpace: 'pre-wrap' }}>
                    {item.note}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                  <button type="button" className="btn btn-xs btn-ghost" onClick={() => toggleStar(item.id, item.starred)}>
                    <Icon name={item.starred ? 'confirm' : 'add'} size={16} /> {item.starred ? '取消置顶' : '置顶'}
                  </button>
                  <button type="button" className="btn btn-xs btn-ghost" onClick={() => startEdit(item)}>
                    编辑
                  </button>
                  <button type="button" className="btn btn-xs btn-ghost" onClick={() => del(item.id)} style={{ color: 'var(--danger)' }}>
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
