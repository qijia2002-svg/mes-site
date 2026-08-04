/**
 * 工厂 / 产线侧边栏：用户自行管理多个工厂与多条产线。
 * 点击产线即切换当前编辑对象；当前激活产线的工序在右侧画布编辑。
 */
import { useState } from 'react';
import type { SimState } from './simTypes';
import { Icon } from '../../components/Icon';

interface Props {
  state: SimState;
  dispatch: React.Dispatch<any>;
}

export default function SimFactoryPanel({ state, dispatch }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // 折叠态：只留一根可点击展开的窄条，画布区自动占满
  if (collapsed) {
    return (
      <div className="sim-factory-rail">
        <button
          className="sim-fab-btn"
          title="展开工厂 / 产线"
          onClick={() => setCollapsed(false)}
        >
          <Icon name="sidebar-open" size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="sim-factory-panel">
      <div className="sim-factory-head">
        <span>工厂 / 产线</span>
        <div className="sim-factory-head-ops">
          <button
            className="sim-fab-btn"
            title="折叠侧栏"
            onClick={() => setCollapsed(true)}
          >
            <Icon name="sidebar-close" size={16} />
          </button>
          <button
            className="sim-fab-btn"
            title="新增工厂"
            onClick={() => {
              const name = prompt('工厂名称', `工厂 ${state.factories.length + 1}`);
              dispatch({
                type: 'ADD_FACTORY',
                name: name !== null ? name.trim() || `工厂 ${state.factories.length + 1}` : `工厂 ${state.factories.length + 1}`,
              });
            }}
          >
            <Icon name="add" size={16} />
          </button>
        </div>
      </div>

      <div className="sim-factory-list">
        {state.factories.map((f) => (
          <div key={f.id} className="sim-factory-group">
            <div className="sim-factory-row">
              <span className="sim-factory-name" title={f.name}>{f.name}</span>
              <div className="sim-factory-ops">
                <button
                  title="重命名工厂"
                  onClick={() => {
                    const n = prompt('工厂名称', f.name);
                    if (n !== null) dispatch({ type: 'RENAME_FACTORY', id: f.id, name: n.trim() || f.name });
                  }}
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  title="删除工厂"
                  disabled={state.factories.length <= 1}
                  onClick={() => {
                    if (confirm(`删除工厂「${f.name}」及其下所有产线？`)) dispatch({ type: 'DELETE_FACTORY', id: f.id });
                  }}
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>

            <div className="sim-line-list">
              {f.lines.map((l) => {
                const isActive = f.id === state.activeFactoryId && l.id === state.activeLineId;
                return (
                  <div key={l.id} className={`sim-line-item${isActive ? ' is-active' : ''}`}>
                    <button
                      className="sim-line-btn"
                      onClick={() => dispatch({ type: 'SWITCH_LINE', factoryId: f.id, lineId: l.id })}
                    >
                      <Icon name="routing" size={16} />
                      <span className="sim-line-name">{l.name}</span>
                      <span className="sim-line-count">{l.nodes.length}</span>
                    </button>
                    <div className="sim-line-ops">
                      <button
                        title="重命名产线"
                        onClick={() => {
                          const n = prompt('产线名称', l.name);
                          if (n !== null) dispatch({ type: 'RENAME_LINE', id: l.id, name: n.trim() || l.name });
                        }}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        title="删除产线"
                        disabled={f.lines.length <= 1}
                        onClick={() => {
                          if (confirm(`删除产线「${l.name}」？`)) dispatch({ type: 'DELETE_LINE', id: l.id });
                        }}
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                className="sim-line-add"
                onClick={() => {
                  const n = prompt('产线名称', `产线 ${f.lines.length + 1}`);
                  dispatch({
                    type: 'ADD_LINE',
                    factoryId: f.id,
                    name: n !== null ? n.trim() || `产线 ${f.lines.length + 1}` : `产线 ${f.lines.length + 1}`,
                  });
                }}
              >
                <Icon name="add" size={16} /> 新增产线
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
