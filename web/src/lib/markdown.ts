/**
 * 章节正文渲染（F2 / AC-02）。
 * 双保险：markdown-it 关闭 html 直通（原始 HTML 被转义），再过一遍 DOMPurify 白名单。
 * 后台可编辑内容一律按不可信输入处理（openapi ChapterDetail.md 的显式要求）。
 */
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({
  html: false, // 原始 HTML 直接转义，不给 DOMPurify 兜底的机会
  linkify: true,
  breaks: false,
  typographer: false,
});

/** 允许的标签白名单——只放行正文排版需要的元素，无 form / iframe / svg / style。 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'del', 's', 'sup', 'sub', 'mark',
  'ul', 'ol', 'li',
  'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img',
];

/** 允许的属性白名单——不含任何 on* 事件、style、srcset。 */
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'id', 'class', 'target', 'rel', 'colspan', 'rowspan'];

/** 明确点名封杀，防白名单被后续改动误放开。 */
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'meta', 'base', 'svg', 'math'];
const FORBID_ATTR = ['style', 'srcset', 'formaction', 'xlink:href', 'action'];

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  // 外链一律 noopener/noreferrer + 新窗口，防 reverse tabnabbing。
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      } else {
        node.removeAttribute('target');
      }
    }
  });
}

export interface TocEntry {
  id: string;
  level: number;
  text: string;
}

function slugify(text: string, seen: Map<string, number>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[\s]+/g, '-')
      .replace(/[^\p{L}\p{N}-]/gu, '') || 'sec';
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

export interface RenderedChapter {
  html: string;
  toc: TocEntry[];
}

/** markdown → 消毒后的 HTML + 目录。空正文返回空 html，由调用方渲染空态。 */
export function renderChapterMarkdown(source: string): RenderedChapter {
  ensureHooks();
  const text = (source ?? '').trim();
  if (!text) return { html: '', toc: [] };

  const tokens = md.parse(text, {});
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type !== 'heading_open') continue;
    const level = Number(t.tag.slice(1));
    if (level > 3) continue;
    const inline = tokens[i + 1];
    const label = inline?.content?.trim() ?? '';
    if (!label) continue;
    const id = slugify(label, seen);
    t.attrSet('id', id);
    toc.push({ id, level, text: label });
  }

  const rawHtml = md.renderer.render(tokens, md.options, {});
  const html = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });

  return { html, toc };
}
