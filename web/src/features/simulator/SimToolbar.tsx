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

  const handleExport = () => {
    const json = exportJSON(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.projectName.replace(/\s/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const project = importJSON(reader.result as string);
      if (project) dispatch({ type: 'LOAD_PROJECT', project });
      else alert('文件格式不正确');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="sim-toolbar">
      {/* 方案名 */}
      <input
        className="sim-toolbar-name"
        value={state.projectName}
        onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
      />

      <div className="sim-toolbar-actions">
        {/* 撤销/重做/清空 */}
        <button className="sim-toolbar-btn" title="清空画布" onClick={() => {
          if (state.nodes.length === 0 || confirm('确定清空画布？此操作不可恢复。')) {
            dispatch({ type: 'CLEAR_ALL' });
          }
        }}>
          <Icon name="reset" size={16} />
        </button>

        {/* 保存 */}
        <button className="sim-toolbar-btn sim-toolbar-btn-primary" title="保存到本地" onClick={() => saveToStorage(state)}>
          <Icon name="confirm" size={16} />
          <span className="sim-toolbar-label">保存</span>
        </button>

        {/* 导出 JSON */}
        <button className="sim-toolbar-btn" title="导出 JSON" onClick={handleExport}>
          <Icon name="copy" size={16} />
          <span className="sim-toolbar-label">导出</span>
        </button>

        {/* 导入 JSON */}
        <button className="sim-toolbar-btn" title="导入 JSON" onClick={() => fileRef.current?.click()}>
          <Icon name="arrow-right" size={16} />
          <span className="sim-toolbar-label">导入</span>
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>
    </div>
  );
}
