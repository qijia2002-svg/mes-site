import type { SimState, SimNodeType } from './simTypes';
import { createNode, createEdge } from './simReducer';
import { edgePath, edgeNodes } from './simUtils';
import SimNodeComp from './SimNodeComp';

interface Props {
  state: SimState;
  dispatch: React.Dispatch<any>;
}

export default function SimCanvas({ state, dispatch }: Props) {
  const connections = edgeNodes(state);

  return (
    <div
      className="sim-canvas"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain') as SimNodeType;
        if (!type) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const node = createNode(type, e.clientX - rect.left, e.clientY - rect.top);
        dispatch({ type: 'ADD_NODE', node });
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch({ type: 'SELECT_NODE', id: null });
          dispatch({ type: 'CANCEL_CONNECT' });
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (state.selectedId) dispatch({ type: 'DELETE_NODE', id: state.selectedId });
        }
        if (e.key === 'Escape') dispatch({ type: 'CANCEL_CONNECT' });
      }}
      tabIndex={0}
    >
      {/* SVG 连线层 */}
      <svg className="sim-svg" style={{ width: '100%', height: '100%' }}>
        {connections.map(({ edge, from, to }) => (
          <path
            key={edge.id}
            d={edgePath(from, to)}
            className="sim-edge"
          />
        ))}
      </svg>

      {/* 节点层 */}
      {state.nodes.map((node) => {
        const isSelected = state.selectedId === node.id;
        const isConnecting = state.connectingFrom === node.id;
        return (
          <SimNodeComp
            key={node.id}
            node={node}
            isSelected={isSelected}
            isConnecting={isConnecting}
            onSelect={() => dispatch({ type: 'SELECT_NODE', id: node.id })}
            onMove={(x, y) => dispatch({ type: 'MOVE_NODE', id: node.id, x, y })}
            onPortClick={(side) => {
              if (state.connectingFrom) {
                // 已完成连线：来源端口 + 当前节点 IN 端口
                if (side === 'in' && state.connectingFrom !== node.id) {
                  dispatch({ type: 'ADD_EDGE', edge: createEdge(state.connectingFrom, node.id) });
                } else {
                  dispatch({ type: 'CANCEL_CONNECT' });
                }
              } else if (side === 'out') {
                dispatch({ type: 'START_CONNECT', fromId: node.id });
              }
            }}
          />
        );
      })}

      {/* 空画布提示 */}
      {state.nodes.length === 0 && (
        <div className="sim-empty-hint">
          从左侧拖拽工序到此处开始搭建工艺路线
        </div>
      )}
    </div>
  );
}
