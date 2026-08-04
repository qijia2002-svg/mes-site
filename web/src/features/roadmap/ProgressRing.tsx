/**
 * 进度环（UIUX §4.1）：32px SVG / r=14 / stroke 3 / rotate(-90deg) / linecap round。
 *
 * 完成度是本页**唯一**动用颜色的通道，所以环同时承担形状（角度）与颜色两个信号，
 * 已完成再叠一个对勾图标 —— 三重编码，色觉障碍下也读得出。
 * 未开始不写 `0%` 而写 `—`：0% 读起来像失败，`—` 读起来像还没开始。
 */
import { Icon } from '../../components/Icon';
import type { LevelProgress } from '../../api/roadmap';
import { ringDash, ringTone } from './roadmapLabels';

const RADIUS = 14;
const VIEWBOX = 32;

export function ProgressRing({
  progress,
  size = 32,
}: {
  progress: LevelProgress;
  size?: number;
}) {
  const { circumference, offset } = ringDash(progress.percent, RADIUS);
  const done = progress.state === 'completed';
  const center = VIEWBOX / 2;

  return (
    <span className="rm-ring" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} focusable="false">
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            className="rm-ring-track"
            cx={center}
            cy={center}
            r={RADIUS}
            fill="none"
            strokeWidth={3}
          />
          {progress.percent > 0 && (
            <circle
              className="rm-ring-fill"
              cx={center}
              cy={center}
              r={RADIUS}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              stroke={ringTone(progress.state)}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          )}
        </g>
      </svg>
      <span className="rm-ring-core">
        {done ? (
          <Icon name="success" size={16} className="rm-ring-check" />
        ) : (
          <span className="rm-ring-num">{progress.percent > 0 ? progress.percent : '—'}</span>
        )}
      </span>
    </span>
  );
}

/** 「规划中」节点用日历替代环：不是 0%，是还没排到（UIUX §4.3 明令不得用 warn 上色）。 */
export function PlannedMark() {
  return (
    <span className="rm-ring rm-ring-planned" aria-hidden="true">
      <Icon name="schedule" size={16} />
    </span>
  );
}
