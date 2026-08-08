/**
 * TermAwareHtml —— 行内术语高亮 + 点击弹解释。
 *
 * 输入是已经过 renderChapterMarkdown（markdown-it html:false + DOMPurify）净化后的 HTML。
 * 本组件在净化之后、由前端 JS 遍历文本节点，把命名词典的术语包成
 * <span class="term-link" data-term="...">，点击时弹出解释卡（TermPopover）。
 *
 * 安全边界：我们只对「已净化的文本节点」做子串包裹，注入的 span 文本来自原 DOM 文本，
 * 不引入任何外部输入；data-term 仅作查询键，由 GlossaryProvider 的 lookup 以受控词典查表。
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useGlossarySafe } from './glossary.context';
import { TermPopover } from './TermPopover';

interface TermAwareHtmlProps {
  html: string;
  className?: string;
}

export function TermAwareHtml({ html, className }: TermAwareHtmlProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useGlossarySafe();
  const termPattern = ctx?.termPattern ?? null;
  const lookup = ctx?.lookup ?? ((_: string) => undefined);
  const [active, setActive] = useState<{ term: string; rect: DOMRect } | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !termPattern) return;

    // 先拆掉上一次注入的高亮，避免重复包裹（html 变化重渲染时）。
    root.querySelectorAll('span.term-link').forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent ?? ''), el);
        parent.normalize();
      }
    });

    // 收集需要处理的文本节点（含词典词）。
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      const v = t.nodeValue ?? '';
      if (!v.trim()) continue;
      termPattern.lastIndex = 0;
      if (termPattern.test(v)) textNodes.push(t);
    }

    for (const node of textNodes) {
      const text = node.nodeValue ?? '';
      termPattern.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let matched = false;
      let m: RegExpExecArray | null;
      while ((m = termPattern.exec(text))) {
        const term = m[0];
        const lower = term.toLowerCase();
        if (!lookup(lower)) {
          // 命中正则但不收录（如英文词未进词典且不想走 AI 的），跳过。
          last = m.index + term.length;
          continue;
        }
        matched = true;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement('span');
        span.className = 'term-link';
        span.setAttribute('data-term', lower);
        span.textContent = term;
        frag.appendChild(span);
        last = m.index + term.length;
      }
      if (matched) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode?.replaceChild(frag, node);
      }
    }
  }, [html, termPattern, lookup]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.term-link') as HTMLElement | null;
    if (!target) return;
    const term = target.getAttribute('data-term') ?? '';
    if (!term) return;
    setActive({ term, rect: target.getBoundingClientRect() });
  };

  if (!ctx) {
    // 无 Provider 时降级为纯净化 HTML，不挂载弹卡。
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <>
      <div
        ref={ref}
        className={className}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {active && (
        <TermPopover term={active.term} anchor={active.rect} onClose={() => setActive(null)} />
      )}
    </>
  );
}
