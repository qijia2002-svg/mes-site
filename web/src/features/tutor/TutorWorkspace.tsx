/**
 * AI 课程导师 · 桌面专属工作台（常驻右栏）。
 *
 * 与移动端 TutorFab（only-mobile）互补：桌面端（≥1024px）用本组件，根容器带 only-desktop
 * 故移动端自动隐藏。形态为右侧常驻面板——未展开时是一条右边缘竖排「AI 导师」标签，
 * 展开后是「对话 + 来源面板」工作台：每次回复若命中站内知识（术语/概念/讲解），
 * 来源面板会列出引用条目，点击可联动跳转到对应页面（词典 / 知识图 / 课程）。
 *
 * 规范：图标走 Icon 体系（禁 emoji）；token 化样式（TutorWorkspace.css）；不硬编码颜色
 * （仅 #fff 作按钮文字例外）；无紫粉渐变、无弹性缓动。对话逻辑与 FAB 共用 tutor.shared。
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { api } from '../../api/endpoints';
import type { TutorMsg } from './tutor.types';
import type { TutorSource } from '../../api/endpoints';
import { NextActionCard } from '../../components/NextAction';
import { useTutorContext } from './useTutorContext';
import {
  loadTutorHistory,
  saveTutorHistory,
  clearTutorHistory,
  renderRich,
} from './tutor.shared';
import { useDraggable } from './useDraggable';
import './TutorWorkspace.css';

/** 桌面端竖排标签默认落点：右边缘、垂直居中。 */
function wsTabDefaultPos() {
  const w = 40;
  const h = 92;
  const x = window.innerWidth - w - 4;
  const y = Math.max(8, window.innerHeight / 2 - h / 2);
  return { x, y };
}

function sourceIcon(type: TutorSource['type']): IconName {
  switch (type) {
    case 'glossary':
      return 'book';
    case 'concept':
      return 'network';
    case 'explainer':
      return 'courses';
    default:
      return 'tutor';
  }
}

export function TutorWorkspace() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TutorMsg[]>(() => loadTutorHistory());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // v2.1：接入 Spine 总线 —— 感知当前课程/章节 + 同步脊柱下一步
  const ctx = useTutorContext();

  // 桌面端收起态标签可拖动，落点持久化（用户要求）
  const drag = useDraggable({ storageKey: 'tutor.ws.pos', defaultPos: wsTabDefaultPos });

  // 对话持久化（与移动端共用同一 localStorage key，跨端续接）
  useEffect(() => {
    saveTutorHistory(messages);
  }, [messages]);

  // 新消息自动滚到底
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, busy]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: TutorMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    const history = next.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await api.tutor({
        message: text,
        history,
        topic: ctx.topic ?? undefined,
        chapter: ctx.chapter ?? undefined,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, sources: res.sources }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败，请稍后重试';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function clearConv() {
    setMessages([]);
    clearTutorHistory();
  }

  function onInputKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  }

  // 来源面板：取最后一条带 sources 的助手消息，展示其引用条目
  let lastSources: TutorSource[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.sources && m.sources.length) {
      lastSources = m.sources;
      break;
    }
  }

  const disabled = busy || input.trim().length === 0;

  // 未展开：右边缘常驻竖排标签（桌面专属入口，可拖动）
  if (!open) {
    return (
      <button
        type="button"
        ref={drag.ref as Ref<HTMLButtonElement>}
        className="tutor-ws-tab only-desktop"
        style={drag.style}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onClick={() => {
          if (drag.consumeDrag()) return; // 刚拖动过，不触发展开
          setOpen(true);
        }}
        aria-label="打开 AI 课程老师工作台（可拖动位置）"
      >
        <Icon name="tutor" size={20} />
        <span>AI 导师</span>
      </button>
    );
  }

  return (
    <aside className="tutor-ws only-desktop" role="complementary" aria-label="AI 课程老师工作台">
      <header className="tutor-ws-head">
        <div className="tutor-ws-title">
          <Icon name="tutor" size={20} />
          <span>AI 课程老师</span>
        </div>
        <div className="tutor-ws-actions">
          {messages.length > 0 && (
            <button type="button" className="icon-btn" onClick={clearConv} aria-label="清空对话">
              <Icon name="trash" size={16} />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="关闭">
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>

      <div className="tutor-ctx">
        {ctx.topic && (
          <p className="tutor-ctx-where">
            {ctx.scope === 'chapter' ? '所属课程' : '正在看'}：<strong>{ctx.topic}</strong>
          </p>
        )}
        {ctx.chapter && (
          <p className="tutor-ctx-where">
            在章节：<strong>{ctx.chapter}</strong>
          </p>
        )}
        {ctx.spineAction && <NextActionCard action={ctx.spineAction} />}
      </div>

      {lastSources.length > 0 && (
        <div className="tutor-ws-sources">
          <div className="tutor-ws-sources-head">
            本次引用 · 已接入站内知识库 {lastSources.length} 条
          </div>
          <ul className="tutor-ws-source-list">
            {lastSources.map((s, i) => (
              <li key={`${s.type}-${s.id}-${i}`}>
                {s.href ? (
                  <Link className={`tutor-ws-source tutor-ws-source-${s.type}`} to={s.href}>
                    <Icon name={sourceIcon(s.type)} size={16} />
                    <span className="tutor-ws-source-label">{s.label}</span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                ) : (
                  <span className={`tutor-ws-source tutor-ws-source-${s.type}`}>
                    <Icon name={sourceIcon(s.type)} size={16} />
                    <span className="tutor-ws-source-label">{s.label}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tutor-ws-list" ref={listRef}>
        {messages.length === 0 && (
          <div className="tutor-ws-empty">
            <p>我是你的 MES 课程老师，已接入站内知识库。可以问我：</p>
            <ul>
              <li>工单的生命周期是怎样的？</li>
              <li>MRP 和 MES 有什么区别？</li>
              <li>输入 /plan 给我一份零基础学习路线</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`tutor-ws-msg tutor-ws-msg-${m.role}`}>
            <div
              className="tutor-ws-bubble"
              dangerouslySetInnerHTML={{ __html: renderRich(m.content) }}
            />
            {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
              <div className="tutor-ws-msg-sources">
                {m.sources.map((s, j) => (
                  <span key={`${s.type}-${s.id}-${j}`} className={`tutor-ws-chip tutor-ws-chip-${s.type}`}>
                    <Icon name={sourceIcon(s.type)} size={16} />
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="tutor-ws-msg tutor-ws-msg-assistant">
            <div className="tutor-ws-bubble tutor-ws-typing">
              <Icon name="loading" size={16} className="spin" />
            </div>
          </div>
        )}
      </div>

      {error && <div className="tutor-ws-error" role="alert">{error}</div>}

      <form className="tutor-ws-input" onSubmit={send}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="问点什么，或输入 /plan /test /example…"
          rows={2}
        />
        <button type="submit" className="tutor-ws-send" disabled={disabled} aria-label="发送">
          <Icon name="send" size={20} />
        </button>
      </form>
    </aside>
  );
}
