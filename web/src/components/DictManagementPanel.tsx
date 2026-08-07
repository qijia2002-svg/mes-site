/**
 * 词典管理后台（借鉴 RuoYi 字典管理的「字典类型 + 字典数据」双表思路）。
 *
 * 能力：字典类型 CRUD（typeKey / name / sort / status / remark）+ 词条 CRUD
 *   （value / pos / zh / example / exampleZh / category / detail / sort / status）。
 * 读取复用公开 GET /api/v1/dict（与「名称翻译」页同一份全量缓存），降低请求量。
 *
 * 约定（与 worker dict.routes.ts 对齐）：
 *   - 响应 DTO 为 camelCase（DictType / DictData）；
 *   - 请求体为 snake_case（type_key / example_zh ...），与章节接口保持一致。
 *
 * P0：图标走 Icon 体系、颜色用 design token（禁硬编码 hex）、零 emoji、单文件 ≤300 行。
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from './Icon';
import { EmptyState, ErrorState, LoadingState } from './StateBlock';
import { api, type DictType, type DictData } from '../api/endpoints';
import { useDict } from '../lib/dict';

/* 本地小组件（与 AdminPage 同名 helper 解耦，避免跨文件耦合） */
function Btn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      className="btn btn-xs btn-ghost"
      onClick={onClick}
      style={danger ? { color: 'var(--danger)' } : undefined}
    >
      {children}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

/* ===================== 类型编辑 ===================== */

function TypeEditForm({ type, onClose }: { type?: DictType; onClose: () => void }) {
  const qc = useQueryClient();
  const [typeKey, setTypeKey] = useState(type?.typeKey ?? '');
  const [name, setName] = useState(type?.name ?? '');
  const [sort, setSort] = useState(type?.sort ?? 0);
  const [status, setStatus] = useState(type?.status ?? 1);
  const [remark, setRemark] = useState(type?.remark ?? '');

  const m = useMutation({
    mutationFn: () => {
      // 请求体 snake_case（与 worker 约定一致）
      const body = { type_key: typeKey, name, sort: Number(sort), status, remark: remark || null };
      return type ? api.dictTypeUpdate(type.id, body) : api.dictTypeCreate(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dict'] });
      onClose();
    },
  });

  return (
    <div className="panel" style={{ marginBottom: 'var(--space-3)' }}>
      <div className="panel-head"><h3>{type ? `编辑类型：${type.name}` : '新增字典类型'}</h3></div>
      <form className="form form-inline" onSubmit={(e) => { e.preventDefault(); if (!m.isPending) m.mutate(); }}>
        <Field label="类型 key"><input className="input" value={typeKey} disabled={!!type} onChange={(e) => setTypeKey(e.target.value)} placeholder="如 sql_basic" /></Field>
        <Field label="名称"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 SQL 基础" /></Field>
        <Field label="排序"><input className="input" type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} /></Field>
        <Field label="状态">
          <select className="select" value={status} onChange={(e) => setStatus(Number(e.target.value))}>
            <option value={1}>启用</option>
            <option value={0}>停用</option>
          </select>
        </Field>
        <Field label="备注"><input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} /></Field>
        <div className="btn-row">
          <button className="btn btn-primary btn-sm" type="submit" disabled={m.isPending || !typeKey || !name}>{m.isPending ? '保存中' : '保存'}</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>取消</button>
        </div>
      </form>
      {m.isError && <ErrorState error={m.error} />}
    </div>
  );
}

/* ===================== 词条编辑 ===================== */

function DataEditForm({ typeKey, data, onClose }: { typeKey: string; data?: DictData; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(data?.value ?? '');
  const [pos, setPos] = useState(data?.pos ?? '');
  const [zh, setZh] = useState(data?.zh ?? '');
  const [example, setExample] = useState(data?.example ?? '');
  const [exampleZh, setExampleZh] = useState(data?.exampleZh ?? '');
  const [category, setCategory] = useState(data?.category ?? '');
  const [detail, setDetail] = useState(data?.detail ?? '');
  const [sort, setSort] = useState(data?.sort ?? 0);
  const [status, setStatus] = useState(data?.status ?? 1);

  const m = useMutation({
    mutationFn: () => {
      // 请求体 snake_case（与 worker 约定一致；value 后端统一转大写）
      const body = {
        type_key: typeKey, value, pos, zh, example,
        example_zh: exampleZh, category, detail, sort: Number(sort), status,
      };
      return data ? api.dictDataUpdate(data.id, body) : api.dictDataCreate(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dict'] });
      onClose();
    },
  });

  return (
    <div style={{ padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)' }}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!m.isPending) m.mutate(); }}>
        <div className="form-inline" style={{ gap: 'var(--space-3)' }}>
          <Field label="英文词条"><input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="SELECT" style={{ fontFamily: 'var(--font-mono)' }} /></Field>
          <Field label="词性"><input className="input" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="pron./n./v." /></Field>
          <Field label="中文"><input className="input" value={zh} onChange={(e) => setZh(e.target.value)} /></Field>
          <Field label="分类"><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如 SQL 关键字" /></Field>
          <Field label="排序"><input className="input" type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} /></Field>
          <Field label="状态">
            <select className="select" value={status} onChange={(e) => setStatus(Number(e.target.value))}>
              <option value={1}>启用</option>
              <option value={0}>停用</option>
            </select>
          </Field>
        </div>
        <Field label="英文例句"><textarea className="input" rows={2} value={example} onChange={(e) => setExample(e.target.value)} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }} /></Field>
        <Field label="中文译文"><textarea className="input" rows={2} value={exampleZh} onChange={(e) => setExampleZh(e.target.value)} style={{ width: '100%' }} /></Field>
        <Field label="一句话详解"><textarea className="input" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} style={{ width: '100%' }} /></Field>
        <div className="btn-row" style={{ marginTop: 'var(--space-2)' }}>
          <button className="btn btn-primary btn-sm" type="submit" disabled={m.isPending || !value || !zh}>{m.isPending ? '保存中' : '保存'}</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>取消</button>
        </div>
      </form>
      {m.isError && <ErrorState error={m.error} />}
    </div>
  );
}

/* ===================== 主面板 ===================== */

export default function DictManagementPanel() {
  const qc = useQueryClient();
  const dictQ = useDict();
  const types = dictQ.data?.types ?? [];
  const data = dictQ.data?.data ?? [];

  const [showNewType, setShowNewType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [newDataFor, setNewDataFor] = useState<string | null>(null);
  const [editingDataId, setEditingDataId] = useState<number | null>(null);

  const delTypeMut = useMutation({
    mutationFn: (id: number) => api.dictTypeDelete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dict'] }),
  });
  const delDataMut = useMutation({
    mutationFn: (id: number) => api.dictDataDelete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dict'] }),
  });

  if (dictQ.isLoading) return <LoadingState label="加载词典…" />;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2><Icon name="dictionary" size={20} className="panel-glyph" />词典管理</h2>
        <span className="panel-note">共 {types.length} 类 / {data.length} 条</span>
        <button className="btn btn-primary btn-xs" onClick={() => setShowNewType(true)}><Icon name="add" size={16} />新增类型</button>
      </div>

      {dictQ.isError && <ErrorState error={dictQ.error} onRetry={() => void dictQ.refetch()} />}
      {!dictQ.isError && types.length === 0 && <EmptyState title="还没有字典类型" />}

      {showNewType && <TypeEditForm onClose={() => setShowNewType(false)} />}
      {editingTypeId !== null && (() => {
        const t = types.find((x) => x.id === editingTypeId);
        return t ? <TypeEditForm type={t} onClose={() => setEditingTypeId(null)} /> : null;
      })()}

      {!dictQ.isError && types.map((t) => {
        const items = data.filter((d) => d.typeKey === t.typeKey);
        const open = expandedKey === t.typeKey;
        return (
          <div key={t.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setExpandedKey(open ? null : t.typeKey)} aria-label="展开">
                <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} />
              </button>
              <span style={{ fontWeight: 'var(--weight-announce-cjk)', fontSize: 'var(--text-sm)' }}>{t.name}</span>
              <code style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>{t.typeKey}</code>
              <span className={t.status === 1 ? 'pill pill-ok' : 'pill pill-idle'}>{t.status === 1 ? '启用' : '停用'}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>{items.length} 条</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-1)' }}>
                <Btn onClick={() => setEditingTypeId(editingTypeId === t.id ? null : t.id)}><Icon name="edit" size={16} />编辑</Btn>
                <Btn onClick={() => { setNewDataFor(t.typeKey); setExpandedKey(t.typeKey); }}><Icon name="add" size={16} />词条</Btn>
                <Btn danger onClick={() => { if (confirm(`删除类型「${t.name}」及其 ${items.length} 条词条？`)) delTypeMut.mutate(t.id); }}><Icon name="delete" size={16} />删除</Btn>
              </span>
            </div>

            {open && (
              <div style={{ paddingLeft: 'var(--space-5)', paddingBottom: 'var(--space-3)' }}>
                {newDataFor === t.typeKey && (
                  <DataEditForm typeKey={t.typeKey} onClose={() => setNewDataFor(null)} />
                )}
                {items.length === 0 && newDataFor !== t.typeKey && (
                  <p className="panel-fallback">该类型下还没有词条</p>
                )}
                {items.map((d) => (
                  <div key={d.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) 0', flexWrap: 'wrap' }}>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--accent)', minWidth: 100 }}>{d.value}</code>
                      <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--fg)' }}>{d.zh}{d.pos ? ` · ${d.pos}` : ''}</span>
                      {d.category && <span className="pill pill-idle">{d.category}</span>}
                      <Btn onClick={() => setEditingDataId(editingDataId === d.id ? null : d.id)}><Icon name="edit" size={16} />编辑</Btn>
                      <Btn danger onClick={() => { if (confirm(`删除词条「${d.value}」？`)) delDataMut.mutate(d.id); }}><Icon name="delete" size={16} />删除</Btn>
                    </div>
                    {editingDataId === d.id && (
                      <DataEditForm typeKey={t.typeKey} data={d} onClose={() => setEditingDataId(null)} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
