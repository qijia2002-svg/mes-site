/**
 * 车间仿真沙盒 · 三栏布局：任务指引 | 画布 | 运行日志
 */
import { useReducer } from 'react';
import { simReducer, initialSimState } from './simReducer';
import { loadFromStorage } from './simStorage';
import SimToolbar from './SimToolbar';
import SimTasks from './SimTasks';
import SimCanvas from './SimCanvas';
import SimProps from './SimProps';
import SimLog from './SimLog';
import './SimulatorPage.css';

export default function SimulatorPage() {
  const [state, dispatch] = useReducer(simReducer, null, () => {
    const saved = loadFromStorage();
    if (saved) {
      const s = initialSimState();
      return { ...s, projectName: saved.name || '车间仿真沙盒', nodes: saved.nodes, edges: saved.edges };
    }
    return { ...initialSimState(), projectName: '车间仿真沙盒' };
  });

  const selectedNode = state.nodes.find((n) => n.id === state.selectedId) ?? null;

  return (
    <section className="sim-page">
      <SimToolbar state={state} dispatch={dispatch} />
      <div className="sim-body">
        <SimTasks
          nodeCount={state.nodes.length}
          edgeCount={state.edges.length}
          onClear={() => dispatch({ type: 'CLEAR' })}
        />
        <div className="sim-main">
          <SimCanvas state={state} dispatch={dispatch} />
          <SimProps
            node={selectedNode}
            onChange={(props) => { if (state.selectedId) dispatch({ type: 'UPDATE_PROPS', id: state.selectedId, props }); }}
            onLabelChange={(label) => { if (state.selectedId) dispatch({ type: 'UPDATE_LABEL', id: state.selectedId, label }); }}
          />
        </div>
        <SimLog
          nodes={state.nodes.map((n) => ({ id: n.id, label: n.label, nodeType: n.nodeType }))}
          edges={state.edges}
        />
      </div>
    </section>
  );
}
