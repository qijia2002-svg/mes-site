import { useReducer, useEffect } from 'react';
import { simReducer, initialSimState } from './simReducer';
import { loadFromStorage } from './simStorage';
import SimToolbar from './SimToolbar';
import SimPalette from './SimPalette';
import SimCanvas from './SimCanvas';
import SimProps from './SimProps';
import './SimulatorPage.css';

export default function SimulatorPage() {
  const [state, dispatch] = useReducer(simReducer, null, () => {
    const saved = loadFromStorage();
    if (saved) {
      const s = initialSimState();
      return {
        ...s,
        projectName: saved.name,
        nodes: saved.nodes,
        edges: saved.edges,
      };
    }
    return initialSimState();
  });

  // 选中节点
  const selectedNode = state.nodes.find((n) => n.id === state.selectedId) ?? null;

  return (
    <section className="sim-page">
      <SimToolbar state={state} dispatch={dispatch} />

      <div className="sim-body">
        <SimPalette />

        <div className="sim-main">
          <SimCanvas state={state} dispatch={dispatch} />

          <SimProps
            node={selectedNode}
            onChange={(props) => {
              if (state.selectedId) {
                dispatch({ type: 'UPDATE_NODE_PROPS', id: state.selectedId, props });
              }
            }}
            onLabelChange={(label) => {
              if (state.selectedId) {
                dispatch({ type: 'UPDATE_NODE_LABEL', id: state.selectedId, label });
              }
            }}
          />
        </div>
      </div>
    </section>
  );
}
