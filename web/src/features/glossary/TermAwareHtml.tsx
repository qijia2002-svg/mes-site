/**
 * TermAwareHtml —— 行内术语高亮 + 点击弹解释。
 *
 * 输入是已经过 renderChapterMarkdown（markdown-it html:false + DOMPurify）净化后的 HTML。
 * 本组件在净化之后、由前端 JS 遍历文本节点，把命名词典的术语包成
 * <span class="term-link" data-term="...">，点击时弹出解释卡（TermPopover）。
 *
 * 关键架构决策（修复"高亮用一次就消失"）：
 *  - 旧实现用 dangerouslySetInnerHTML 渲染原文，再在 useEffect 里手动 replaceChildren 注入 span。
 *    这会让 React 记录的 __html 与真实 DOM 失同步：任何把 html 引用换掉的重渲染都会把 innerHTML
 *    复位成原始 HTML，高亮被拆掉且不再回来。
 *  - 新实现：在同一 effect 里计算出"已注入高亮的 HTML 字符串"，存进 state（highlighted），
 *    由 React 通过 dangerouslySetInnerHTML 渲染这个 state。这样 React 真正拥有带 span 的 DOM，
 *    重渲染永远不会把高亮拆没；词典未就绪时回落原始 html，就绪后自动出高亮。
 *
 * 安全边界：我们只对"已净化的文本节点"做子串包裹，注入的 span 文本来自原 DOM 文本，
 * 不引入任何外部输入；data-term 仅作查询键，由 GlossaryProvider 的 lookup 以受控词典查表。
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { useGlossarySafe } from './glossary.context';
import { TermPopover } from './TermPopover';

interface TermAwareHtmlProps {
  html: string;
  className?: string;
}

export function TermAwareHtml({ html, className }: TermAwareHtmlProps) {
  const ctx = useGlossarySafe();
  const termPattern = ctx?.termPattern ?? null;
  const lookup = ctx?.lookup ?? ((_: string) => undefined);
  const [active, setActive] = useState<{ term: string; rect: DOMRect } | null>(null);
  // 已注入高亮的 HTML 存进 state，让 React 真正拥有带 span 的 DOM（重渲染不会拆没）。
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    const re = termPattern ? new RegExp(termPattern.source, termPattern.flags) : null;
    if (!re) {
      // 词典未就绪：回落原始 HTML（不渲染高亮，也不丢已有高亮）。
      setHighlighted(null);
      return;
    }
    try {
      const host = document.createElement('div');
      host.innerHTML = html;

      // 先还原已有 term-link（避免重复包裹 / 二次注入）。
      host.querySelectorAll('span.term-link').forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent ?? ''), el);
          parent.normalize();
        }
      });

      // 收集需要处理的文本节点（含词典词）。
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
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

      setHighlighted(host.innerHTML);
    } catch {
      // 任何异常都回落原始 HTML（至少正文可见）。
      setHighlighted(null);
    }
  }, [html, termPattern, lookup]);

  const display = highlighted ?? html;

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
        className={className}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: display }}
      />
      {active && (
        <TermPopover term={active.term} anchor={active.rect} onClose={() => setActive(null)} />
      )}
    </>
  );
}
