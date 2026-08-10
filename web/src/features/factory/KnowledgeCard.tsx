/**
 * 初级知识卡（Zero-baseline v3）。
 *
 * 把 beginnerPath.data.ts 的 KnowledgeBlock[] 渲染成一组语义卡片。
 * bodyMd 一律过 renderChapterMarkdown（markdown-it html:false + DOMPurify），
 * 绝不直接 dangerouslySetInnerHTML 原始字符串。
 * 四种块型各用语义图标 + 左侧色条编码类型，颜色只走 design token，无 bounce 动效。
 */
import { Icon, type IconName } from '../../components/Icon';
import { renderChapterMarkdown } from '../../lib/markdown';
import type { KnowledgeBlock, KnowledgeKind } from './beginnerPath.data';

const KIND_META: Record<KnowledgeKind, { icon: IconName; label: string; tone: string }> = {
  plain: { icon: 'info', label: '概念', tone: 'kc-plain' },
  example: { icon: 'example', label: '样例数据', tone: 'kc-example' },
  mapping: { icon: 'mapping', label: '动作对照', tone: 'kc-mapping' },
  misconception: { icon: 'warn', label: '常见误区', tone: 'kc-misconception' },
};

export interface KnowledgeCardProps {
  blocks: KnowledgeBlock[];
}

export default function KnowledgeCard({ blocks }: KnowledgeCardProps) {
  if (!blocks || blocks.length === 0) {
    return <p className="kc-empty">这一节还没准备好知识卡，先往后走。</p>;
  }
  return (
    <div className="kc">
      {blocks.map((b, i) => {
        const meta = KIND_META[b.kind];
        const { html } = renderChapterMarkdown(b.bodyMd);
        return (
          <article key={i} className={`kc-block ${meta.tone}`}>
            <header className="kc-head">
              <span className="kc-ic"><Icon name={meta.icon} size={16} /></span>
              <span className="caps kc-k">{meta.label}</span>
              <h3 className="kc-t">{b.title}</h3>
            </header>
            <div className="kc-body prose" dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        );
      })}
    </div>
  );
}
