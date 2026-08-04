/**
 * 卡片式学习组件：把 Markdown 长文按 ## 标题拆成知识卡片。
 * 每张卡片 = 一个知识点（标题 + 正文）。
 * 支持翻页导航、标记已掌握/需复习、键盘快捷键。
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { renderChapterMarkdown } from '../lib/markdown';
import { Icon } from './Icon';
import { VoiceButton } from './VoiceButton';
import './FlashCardDeck.css';

interface Card {
  title: string;
  html: string;
}

interface FlashCardDeckProps {
  mdText: string;
  chapterTitle: string;
}

/** 把 Markdown 按 ## 标题拆成卡片。没有 ## 就按 ### 拆，再没有就整篇一张。 */
function parseCards(mdText: string): Card[] {
  const text = mdText.trim();
  if (!text) return [];

  // 去掉开头的 # 标题（章节标题，不是知识点）
  const withoutH1 = text.replace(/^#\s+.+\n?/, '').trim();
  if (!withoutH1) return [];

  // 按 ## 拆
  let blocks = withoutH1.split(/^## /m).filter((s) => s.trim());
  if (blocks.length <= 1) {
    // 没有 ##，按 ### 拆
    blocks = withoutH1.split(/^### /m).filter((s) => s.trim());
  }
  if (blocks.length === 0) return [{ title: '内容', html: renderChapterMarkdown(withoutH1).html }];

  return blocks.map((block) => {
    const lines = block.trim().split('\n');
    const title = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();
    const html = renderChapterMarkdown(content).html;
    return { title, html };
  });
}

type CardStatus = 'unseen' | 'mastered' | 'review';

export function FlashCardDeck({ mdText, chapterTitle }: FlashCardDeckProps) {
  const cards = useMemo(() => parseCards(mdText), [mdText]);
  const [current, setCurrent] = useState(0);
  const [statuses, setStatuses] = useState<CardStatus[]>(() => cards.map(() => 'unseen' as CardStatus));

  // 重置状态当 cards 变化
  useEffect(() => {
    setStatuses(cards.map(() => 'unseen' as CardStatus));
    setCurrent(0);
  }, [cards]);

  const next = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, cards.length - 1));
  }, [cards.length]);
  const prev = useCallback(() => {
    setCurrent((c) => Math.max(c - 1, 0));
  }, []);

  const mark = useCallback((status: CardStatus) => {
    setStatuses((prev) => {
      const next = [...prev];
      next[current] = status;
      return next;
    });
    // 标记后自动翻到下一张
    setTimeout(() => setCurrent((c) => Math.min(c + 1, cards.length - 1)), 200);
  }, [current, cards.length]);

  // 键盘快捷键：← → 翻页，1 已掌握，2 需复习
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === '1') mark('mastered');
      else if (e.key === '2') mark('review');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, mark]);

  if (cards.length === 0) {
    return <p className="flash-empty">这一章没有可拆分的知识点。</p>;
  }

  const card = cards[current];
  const cardText = `${card.title}。${card.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`;
  const masteredCount = statuses.filter((s) => s === 'mastered').length;
  const reviewCount = statuses.filter((s) => s === 'review').length;
  const pct = Math.round(((current + 1) / cards.length) * 100);

  return (
    <div className="flash-deck">
      {/* 顶部进度条 */}
      <div className="flash-progress-bar">
        <div className="flash-progress-track">
          <div className="flash-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="flash-progress-text">
          {current + 1} / {cards.length}
        </span>
      </div>

      {/* 统计标记 */}
      <div className="flash-stats">
        <span className="flash-stat flash-stat-mastered">
          <Icon name="success" size={16} />
          已掌握 {masteredCount}
        </span>
        <span className="flash-stat flash-stat-review">
          <Icon name="warn" size={16} />
          需复习 {reviewCount}
        </span>
      </div>

      {/* 卡片主体 */}
      <div className="flash-card" key={current}>
        <div className="flash-card-head">
          <span className="flash-card-index">卡片 {current + 1}</span>
          <h3 className="flash-card-title">{card.title}</h3>
          <VoiceButton text={cardText} className="flash-card-voice" lang="auto" />
        </div>
        <div
          className="flash-card-body prose"
          dangerouslySetInnerHTML={{ __html: card.html }}
        />
      </div>

      {/* 底部操作栏 */}
      <div className="flash-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={prev}
          disabled={current === 0}
        >
          <Icon name="arrow-left" size={16} />
          上一张
        </button>

        <div className="flash-mark-group">
          <button
            type="button"
            className={`flash-mark ${statuses[current] === 'mastered' ? 'is-active is-mastered' : ''}`}
            onClick={() => mark('mastered')}
          >
            <Icon name="success" size={16} />
            已掌握
          </button>
          <button
            type="button"
            className={`flash-mark ${statuses[current] === 'review' ? 'is-active is-review' : ''}`}
            onClick={() => mark('review')}
          >
            <Icon name="warn" size={16} />
            需复习
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={next}
          disabled={current === cards.length - 1}
        >
          下一张
          <Icon name="arrow-right" size={16} />
        </button>
      </div>

      {/* 完成提示 */}
      {current === cards.length - 1 && masteredCount + reviewCount >= cards.length - 1 && (
        <div className="flash-complete">
          <Icon name="success" size={20} />
          <span>{chapterTitle} 全部卡片已过一遍！</span>
          <span className="flash-complete-stats">
            掌握 {masteredCount} · 需复习 {reviewCount}
          </span>
        </div>
      )}

      {/* 键盘提示 */}
      <p className="flash-hint">
        键盘：← → 翻页 · 1 已掌握 · 2 需复习
      </p>
    </div>
  );
}
