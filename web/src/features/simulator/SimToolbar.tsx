import type { SimState, SimRunState } from './simTypes';
import { getActiveLine } from './simReducer';
import { Icon } from '../../components/Icon';

interface Props {
  state: SimState;
  dispatch: React.Dispatch<any>;
  run: SimRunState;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onRun: () => void;
  onStop: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** 重置本环节：把沙盒恢复到来源节点对应的通用工厂默认（替代旧「清空」）。 */
  onReset?: () => void;
}

const SPEEDS = [1, 2, 4];

export default function SimToolbar({ state, dispatch, run, speed, onSpeedChange, onRun, onStop, isFullscreen, onToggleFullscreen, onReset }: Props) {
  const activeLine = getActiveLine(state);

  return (
    <div className="sim-toolbar">
      <span className="sim-toolbar-title">
        <Icon name="routing" size={20} />
        通用工厂 · 仿真沙盒
      </span>

      <span className="sim-toolbar-stats">
        {activeLine?.nodes.length ?? 0} 节点 · {activeLine?.edges.length ?? 0} 连线
      </span>

      {/* 速度选择：控制工单流转动画节奏 */}
      <div className="sim-speed-group">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`sim-speed-btn${speed === s ? ' is-active' : ''}`}
            onClick={() => onSpeedChange(s)}
            disabled={run.active}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="sim-toolbar-actions">
        {run.active ? (
          <button className="sim-toolbar-btn sim-run-btn is-running" onClick={onStop} title="停止仿真">
            <Icon name="reset" size={16} />
            <span className="sim-toolbar-label">停止</span>
          </button>
        ) : (
          <button className="sim-toolbar-btn sim-run-btn" onClick={onRun} title="运行仿真（工单流转）" disabled={(activeLine?.nodes.length ?? 0) === 0}>
            <Icon name="run" size={16} />
            <span className="sim-toolbar-label">运行仿真</span>
          </button>
        )}
        {onReset && (
          <button className="sim-toolbar-btn" title="重置为本环节默认工厂" onClick={onReset}>
            <Icon name="history" size={16} />
            <span className="sim-toolbar-label">重置本环节</span>
          </button>
        )}
        <button className="sim-toolbar-btn" title={isFullscreen ? '退出全屏' : '全屏编辑'} onClick={onToggleFullscreen}>
          <Icon name={isFullscreen ? 'minimize' : 'expand'} size={16} />
          <span className="sim-toolbar-label">{isFullscreen ? '退出全屏' : '全屏'}</span>
        </button>
      </div>
    </div>
  );
}
