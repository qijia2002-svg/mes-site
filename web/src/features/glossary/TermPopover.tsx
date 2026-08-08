/**
 * TermPopover —— 名词解释弹卡（点击行内术语 / 内联搜索共用）。
 *
 * - 本地词典命中：直接渲染 DictData 字段（中文术语 + 英文 + 详解 + 例句）。
 * - 本地未命中：调 explain() → AI explain-word 兜底（英文单词翻译场景）。
 * - centered：搜索框结果为屏幕居中模态；否则锚定到被点术语的位置。
 *
 * 样式全部 token 驱动；图标走 Icon 体系；TTS 朗读复用既有 VoiceButton。
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { VoiceButton } from '../../components/VoiceButton';
import { useGlossary, type GlossaryEntry } from './glossary.context';
import './glossary.css';

interface TermPopoverProps {
  term: string;
  /** 锚点（行内点击时传入）；centered 模式下可传 null。 */
  anchor?: DOMRect | null;
  onClose: () => void;
  /** 居中模态（搜索结果）还是锚定气泡（点击术语）。 */
  centered?: boolean;
}

export function TermPopover({ term, anchor, onClose, centered = false }: TermPopoverProps) {
  const { lookup, explain } = useGlossary();
  const local = useMemo(() => lookup(term), [lookup, term]);
  const [entry, setEntry] = useState<GlossaryEntry | null>(local ?? null);
  const [loading, setLoading] = useState<boolean>(!local);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (local) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    explain(term)
      .then((r) => {
        if (!alive) return;
        setEntry(r);
        setFailed(!r);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [local, explain, term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const style = useMemo<CSSProperties>(() => {
    if (centered) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxHeight: '80vh',
      };
    }
    const W = 320;
    let top = (anchor?.bottom ?? 0) + 8;
    let left = anchor?.left ?? 12;
    if (left + W > window.innerWidth - 12) left = Math.max(12, window.innerWidth - 12 - W);
    if (left < 12) left = 12;
    // 贴近底部时翻到锚点上方，避免溢出视口。
    if (top + 260 > window.innerHeight) {
      top = Math.max(12, (anchor?.top ?? window.innerHeight) - 8 - 260);
    }
    return { top, left, width: W, maxHeight: '60vh' };
  }, [anchor, centered]);

  return (
    <>
      <div className="term-popover-scrim" onClick={onClose} aria-hidden="true" />
      <div className="term-popover" role="dialog" aria-label="名词解释" style={style}>
        <button type="button" className="term-popover-close" onClick={onClose} aria-label="关闭">
          <Icon name="close" size={16} />
        </button>

        {loading && (
          <div className="term-popover-loading">
            <Icon name="loading" size={16} className="spin" />
            正在查询解释…
          </div>
        )}

        {!loading && failed && (
          <div className="term-popover-empty">没找到「{term}」的解释。</div>
        )}

        {!loading && entry && (
          <div className="term-popover-body">
            <div className="term-popover-head">
              <span className="term-popover-word">{entry.value}</span>
              {entry.pos && <span className="term-popover-pos">{entry.pos}</span>}
              <VoiceButton text={entry.value} className="term-popover-speak" lang="zh-CN" />
            </div>

            {entry.zh && <div className="term-popover-zh">{entry.zh}</div>}
            {entry.detail && <p className="term-popover-detail">{entry.detail}</p>}

            {entry.example && (
              <div className="term-popover-example">
                <div className="term-popover-example-en">{entry.example}</div>
                {entry.exampleZh && (
                  <div className="term-popover-example-zh">{entry.exampleZh}</div>
                )}
              </div>
            )}

            {entry.category && (
              <div className="term-popover-cat">
                <span className="tag">{entry.category}</span>
                {entry.fromAi && <span className="tag term-popover-ai">AI 生成</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
