import { useRef } from 'react';
import type { SimState, SimRunState } from './simTypes';
import { getActiveLine } from './simReducer';
import { Icon } from '../../components/Icon';
import { saveToStorage, exportJSON, importJSON } from './simStorage';

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
}

const SPEEDS = [1, 2, 4];

export default function SimToolbar({ state, dispatch, run, speed, onSpeedChange, onRun, onStop, isFullscreen, onToggleFullscreen }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const activeLine = getActiveLine(state);

  return (
    <div className="sim-toolbar">
      <span className="sim-toolbar-title">
        <Icon name="routing" size={20} />
        车间仿真沙盒
      </span>

      <span className="sim-toolbar-stats">
        {activeLine?.nodes.length ?? 0} 节点 · {activeLine?.edges.length ?? 0} 连线
      </span>

      {/* 速度选择 */}
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
        <button className="sim-toolbar-btn" title="保存到本地" onClick={() => saveToStorage(state)}>
          <Icon name="confirm" size={16} />
          <span className="sim-toolbar-label">保存</span>
        </button>
        <button className="sim-toolbar-btn" title="清空当前产线画布" onClick={() => { if ((activeLine?.nodes.length ?? 0) === 0 || confirm('确定清空当前产线？此操作不可撤销')) dispatch({ type: 'CLEAR' }); }}>
          <Icon name="delete" size={16} />
          <span className="sim-toolbar-label">清空</span>
        </button>
        <button className="sim-toolbar-btn" title="导出 JSON" onClick={() => {
          const json = exportJSON(state);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${(activeLine?.name ?? '工艺路线').replace(/\s/g, '_')}.json`;
          a.click(); URL.revokeObjectURL(url);
        }}>
          <Icon name="copy" size={16} />
          <span className="sim-toolbar-label">导出</span>
        </button>
        <button className="sim-toolbar-btn" title="导入 JSON" onClick={() => fileRef.current?.click()}>
          <Icon name="arrow-right" size={16} />
          <span className="sim-toolbar-label">导入</span>
        </button>
        <button className="sim-toolbar-btn" title={isFullscreen ? '退出全屏' : '全屏编辑'} onClick={onToggleFullscreen}>
          <Icon name={isFullscreen ? 'minimize' : 'expand'} size={16} />
          <span className="sim-toolbar-label">{isFullscreen ? '退出全屏' : '全屏'}</span>
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const rd = new FileReader();
          rd.onload = () => { const p = importJSON(rd.result as string); if (p) dispatch({ type: 'LOAD_PROJECT', project: p }); };
          rd.readAsText(f); e.target.value = '';
        }} />
      </div>
    </div>
  );
}
