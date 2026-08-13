/**
 * AI 课程导师 · 全局浮动入口。
 *
 * 为什么是浮动按钮：后端 /api/v1/ai/tutor 早已上线（第七轮只落地了端点，前端对话面板
 * 当时按设计留到后续）。本组件补齐唯一缺失的「能跟导师说话的界面」——右下角常驻按钮，
 * 任何页面可唤起，桌面端右侧抽屉、移动端全屏 sheet。
 *
 * 规范：图标走 Icon 体系（tutor=MessageCircle，禁 emoji）；token 化样式（TutorFab.css）；
 * 不引第二个图标库、不硬编码颜色（仅 #fff 作按钮文字例外）；无紫粉渐变、无弹性缓动。
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon';
import { api } from '../../api/endpoints';
import type { TutorMsg } from './tutor.types';
import './TutorFab.css';

const STORAGE_KEY = 'mes-tutor-conv';

function loadHistory(): TutorMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TutorMsg[]).slice(-20) : [];
  } catch {
    return [];
  }
}

/** 先转义再处理 **粗体** / `代码`，杜绝 XSS；换行交给 CSS white-space:pre-wrap。 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderRich(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}

export function TutorFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TutorMsg[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // 对话持久化（跨刷新保留，让「老师记得」）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* 隐私模式写入失败不阻断使用 */
    }
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

  // 移动端软键盘遮挡：用 visualViewport 把面板整体抬到键盘上方（仅移动端生效，
  // 桌面无软键盘且为右侧抽屉，不注入内联 top/height）
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!panel || !vv) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => {
      if (!mq.matches) {
        panel.style.removeProperty('top');
        panel.style.removeProperty('height');
        return;
      }
      // iOS：vv.offsetTop≈键盘高度、vv.height≈可视高度（不含键盘）
      // Android：vv.offsetTop=0、vv.height≈可视高度
      // 两者都令面板精确落在可视区（其下沿即键盘上沿），输入框浮于键盘之上
      panel.style.top = `${vv.offsetTop}px`;
      panel.style.height = `${vv.height}px`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      panel.style.removeProperty('top');
      panel.style.removeProperty('height');
    };
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
      const res = await api.tutor({ message: text, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败，请稍后重试';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function clearConv() {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  function onInputKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  }

  const disabled = busy || input.trim().length === 0;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="tutor-fab"
          onClick={() => setOpen(true)}
          aria-label="打开 AI 课程老师"
        >
          <Icon name="tutor" size={24} />
        </button>
      )}

      {open && (
        <section ref={panelRef} className="tutor-panel" role="dialog" aria-label="AI 课程老师" aria-modal="false">
          <header className="tutor-head">
            <div className="tutor-head-title">
              <Icon name="tutor" size={20} />
              <span>AI 课程老师</span>
            </div>
            <div className="tutor-head-actions">
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

          <div className="tutor-list" ref={listRef}>
            {messages.length === 0 && (
              <div className="tutor-empty">
                <p>我是你的 MES 课程老师。可以问我：</p>
                <ul>
                  <li>工单的生命周期是怎样的？</li>
                  <li>MRP 和 MES 有什么区别？</li>
                  <li>输入 /plan 给我一份零基础学习路线</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`tutor-msg tutor-msg-${m.role}`}>
                <div
                  className="tutor-bubble"
                  dangerouslySetInnerHTML={{ __html: renderRich(m.content) }}
                />
              </div>
            ))}
            {busy && (
              <div className="tutor-msg tutor-msg-assistant">
                <div className="tutor-bubble tutor-typing">
                  <Icon name="loading" size={16} className="spin" />
                </div>
              </div>
            )}
          </div>

          {error && <div className="tutor-error" role="alert">{error}</div>}

          <form className="tutor-input" onSubmit={send}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="问点什么，或输入 /plan /test /example…"
              rows={1}
            />
            <button type="submit" className="tutor-send" disabled={disabled} aria-label="发送">
              <Icon name="send" size={20} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
