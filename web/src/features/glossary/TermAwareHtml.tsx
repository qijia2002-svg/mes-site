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
    if (!root) return;
    // 每个实例克隆独立正则（用 source 重建），杜绝 g 标志 lastIndex 跨实例污染；
    // 这是"点一次后高亮消失"的根因之一：原本 termPattern 是 context 共享的同一 RegExp 对象。
    const re = termPattern ? new RegExp(termPattern.source, termPattern.flags) : null;
    if (!re) return; // 词典未就绪：保留当前 DOM（不拆已有高亮）

    try {
      // 在离屏克隆上处理：处理中途任何异常都不会破坏线上已渲染的高亮，
      // 只有处理成功才整体换上带高亮的新结构（避免"拆了又没装上"导致正文空白）。
      const work = root.cloneNode(true) as HTMLDivElement;

      // 还原克隆里已有的 term-link，避免重复包裹（html 变化重渲染时）。
      work.querySelectorAll('span.term-link').forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent ?? ''), el);
          parent.normalize();
        }
      });

      // 收集需要处理的文本节点（含词典词）。
      const walker = document.createTreeWalker(work, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = n as Text;
        const v = t.nodeValue ?? '';
        if (!v.trim()) continue;
        re.lastIndex = 0;
        if (re.test(v)) textNodes.push(t);
      }

      for (const node of textNodes) {
        const text = node.nodeValue ?? '';
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0;
        let matched = false;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
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

      // 处理成功，整体换上带高亮的新结构。
      root.replaceChildren(...Array.from(work.childNodes));
    } catch {
      // 任何异常都保持原样（原高亮仍在），不把正文拆没。
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
