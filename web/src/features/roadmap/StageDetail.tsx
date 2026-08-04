/**
 * 阶段验收信息：里程碑 / 交付物 / 面试考点。
 * 默认折叠 —— 首屏要先让人看清"学哪几条线到第几级"，验收细节是第二层需求。
 * 桌面挂在矩阵每一行下方，手机挂在 accordion 内，同一组件不分叉。
 */
import { Icon } from '../../components/Icon';
import type { CareerStage } from '../../api/roadmap';

function Block({ title, icon, items }: { title: string; icon: 'work-order' | 'help'; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rm-detail-block">
      <p className="rm-caps">
        <Icon name={icon} size={16} className="rm-detail-glyph" />
        {title}
      </p>
      <ul className="rm-detail-list">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

export function StageDetail({ stage }: { stage?: CareerStage }) {
  if (!stage) return null;
  const deliverables = stage.deliverables ?? [];
  const interviewPoints = stage.interviewPoints ?? [];
  if (!stage.milestone && deliverables.length === 0 && interviewPoints.length === 0) return null;

  return (
    <details className="rm-detail">
      <summary className="rm-detail-summary">
        <Icon name="chevron-right" size={16} className="rm-detail-arrow" />
        这个阶段的验收标准
        <span className="rm-detail-count">
          {deliverables.length} 项交付物 · {interviewPoints.length} 个面试考点
        </span>
      </summary>
      <div className="rm-detail-body">
        {stage.milestone && (
          <p className="rm-milestone">
            <Icon name="process" size={16} className="rm-detail-glyph" />
            <span>{stage.milestone}</span>
          </p>
        )}
        <Block title="交付物" icon="work-order" items={deliverables} />
        <Block title="面试考点" icon="help" items={interviewPoints} />
      </div>
    </details>
  );
}
