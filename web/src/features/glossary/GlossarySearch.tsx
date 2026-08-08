/**
 * GlossarySearch —— 学习页内联名词搜索（不离开页面）。
 *
 * 放在章节页工具栏，输入中文术语或英文单词，回车即原地弹出解释卡（TermPopover 居中模态）。
 * 命中词典直接出，未命中走 AI explain-word 兜底；全程不跳转、不新开页。
 */
import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { useGlossary } from './glossary.context';
import { TermPopover } from './TermPopover';

export function GlossarySearch({ className }: { className?: string }) {
  const { ready } = useGlossary();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setTerm(v.toLowerCase());
  };

  return (
    <div className={`glossary-search${className ? ` ${className}` : ''}`}>
      <form onSubmit={onSubmit} className="glossary-search-form" role="search">
        <span className="glossary-search-icon">
          <Icon name="search" size={16} />
        </span>
        <input
          type="text"
          className="glossary-search-input"
          placeholder={ready ? '搜名词 / 单词，原地看解释' : '词典加载中…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="搜索名词解释"
        />
      </form>
      {term && <TermPopover term={term} anchor={null} centered onClose={() => setTerm(null)} />}
    </div>
  );
}
