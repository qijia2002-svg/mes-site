import { useRef } from 'react';
import type { SimState } from './simTypes';
import { Icon } from '../../components/Icon';
import { saveToStorage, exportJSON, importJSON } from './simStorage';

interface Props {
  state: SimState;
  dispatch: React.Dispatch<any>;
}

export default function SimToolbar({ state, dispatch }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sim-toolbar">
      <span className="sim-toolbar-title">
        <Icon name="routing" size={20} />
        车间仿真沙盒
      </span>

      <span className="sim-toolbar-stats">
        {state.nodes.length} 节点 · {state.edges.length} 连线
      </span>

      <div className="sim-toolbar-actions">
        <button className="sim-toolbar-btn" title="保存到本地" onClick={() => saveToStorage(state)}>
          <Icon name="confirm" size={16} />
          <span className="sim-toolbar-label">保存</span>
        </button>
        <button className="sim-toolbar-btn" title="导出 JSON" onClick={() => {
          const json = exportJSON(state);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${state.projectName.replace(/\s/g, '_')}.json`;
          a.click(); URL.revokeObjectURL(url);
        }}>
          <Icon name="copy" size={16} />
          <span className="sim-toolbar-label">导出</span>
        </button>
        <button className="sim-toolbar-btn" title="导入 JSON" onClick={() => fileRef.current?.click()}>
          <Icon name="arrow-right" size={16} />
          <span className="sim-toolbar-label">导入</span>
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
