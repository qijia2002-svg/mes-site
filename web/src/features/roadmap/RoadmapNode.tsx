/**
 * 路径图节点（UIUX §4.1 / §4.3）。桌面 88px 卡片、手机 64px 全宽行共用一套语义，
 * 只换 variant 类名 —— 两套 DOM 会让"已完成/规划中"的判定在两处漂移。
 *
 * 三通道正交：等级=中性明度徽章、重要度=角标形状、完成度=进度环颜色。
 * 「已完成」不整卡染绿：12 个节点学到后期会变成一锅绿汤，且违反 accent 块面 ≤2。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import type { LevelProgress } from '../../api/roadmap';
import { ProgressRing, PlannedMark } from './ProgressRing';
import { trackIcon } from './trackIcons';
import type { PlacedNode } from './roadmapLayout';
import {
  importanceLabel,
  importanceHint,
  isPlanned,
  levelCn,
  levelTone,
  stateLabel,
} from './roadmapLabels';

const PLANNED_FALLBACK: LevelProgress = { done: 0, total: 0, percent: 0, state: 'planned' };

export function levelAnchor(level: number): string {
  return `level-l${level}`;
}

export function RoadmapNode({
  placed,
  isCurrent,
  variant = 'matrix',
}: {
  placed: PlacedNode;
  isCurrent: boolean;
  variant?: 'matrix' | 'stair';
}) {
  const { node, importance, note } = placed;
  const progress = node.progress ?? PLANNED_FALLBACK;
  const planned = isPlanned(progress);
  const levelName = levelCn(node.level, node.levelName);
  const stateText = planned ? '内容规划中' : `${stateLabel(progress.state)} ${progress.percent}%`;

  const className = [
    'rm-node',
    `rm-node-${variant}`,
    `is-${importance}`,
    planned ? 'is-planned' : `is-${progress.state.replace('_', '-')}`,
    isCurrent && !planned ? 'is-here' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <span className="rm-node-head">
        <Icon name={trackIcon(node.trackSlug, node.trackIcon)} size={20} className="rm-node-icon" />
        <span className="rm-node-track">{node.trackTitle}</span>
        <span className={`rm-mark is-${importance}`} aria-hidden="true" />
      </span>
      <span className="rm-node-foot">
        <span className={`rm-level ${levelTone(node.level)}`} aria-hidden="true">
          {node.level}
        </span>
        <span className="rm-node-level">{levelName}</span>
        {variant === 'stair' && (
          <span className="rm-node-imp">{importanceLabel(importance)}</span>
        )}
        {planned ? <PlannedMark /> : <ProgressRing progress={progress} />}
      </span>
      {variant === 'stair' && note && <span className="rm-node-note">{note}</span>}
    </>
  );

  if (planned) {
    // 不可点：无 hover 位移（有位移就等于承诺可点）、tabindex -1 让键盘直接跳过
    return (
      <div
        className={className}
        data-node-id={node.id}
        aria-disabled="true"
        tabIndex={-1}
        title="这一级的内容还在编排，路线详情页能看到已排的章节大纲"
      >
        {inner}
        <span className="rm-node-plan">规划中</span>
      </div>
    );
  }

  return (
    <Link
      className={className}
      data-node-id={node.id}
      to={`/tracks/${node.trackSlug}#${levelAnchor(node.level)}`}
      aria-label={`${node.trackTitle} 路线 · ${levelName} · ${importanceHint(importance)} · ${stateText}`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      {inner}
      {isCurrent && <span className="rm-node-here">你在这里</span>}
    </Link>
  );
}
