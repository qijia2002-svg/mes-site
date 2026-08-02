import { createNode, createEdge } from './simReducer';
import { straightPath, reworkPath, edgePairs } from './simUtils';
import SimNodeComp from './SimNodeComp';

interface Props {
  state: { nodes: any[]; edges: any[]; selectedId: string | null; connectingFrom: string | null; connectingPort: 'out' | 'out2' | null };
  dispatch: React.Dispatch<any>;
  activeNodeId?: string | null;
}

export default function SimCanvas({ state, dispatch, activeNodeId }: Props) {
  const pairs = edgePairs(state);

  return (
    <div
      className="sim-canvas"
      tabIndex={0}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        if (!type) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const y = e.clientY - rect.top + e.currentTarget.scrollTop;
        const node = createNode(type, x, y);
        if (node) dispatch({ type: 'ADD_NODE', node });
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch({ type: 'SELECT', id: null });
          dispatch({ type: 'CANCEL_CONNECT' });
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
          dispatch({ type: 'DELETE_NODE', id: state.selectedId });
        }
        if (e.key === 'Escape') dispatch({ type: 'CANCEL_CONNECT' });
      }}
    >
      {/* 舞台：固定尺寸，画布可滚动，节点/连线超出视口也不丢失 */}
      <div className="sim-stage">
        {/* SVG 连线层 */}
        <svg className="sim-svg">
          {pairs.map(({ edge, from, to }) => {
            // 回流线（虚线）用底部折回路径，普通流转线用直连
            const d = edge.dashed ? reworkPath(from, to, 36) : straightPath(from, to);
            return (
              <path
                key={edge.id}
                d={d}
                className={`sim-edge${edge.dashed ? ' is-dashed' : ''}${activeNodeId === from.id || activeNodeId === to.id ? ' is-flowing' : ''}`}
                onDoubleClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_EDGE', id: edge.id }); }}
              />
            );
          })}
        </svg>

        {/* 节点层 */}
        {state.nodes.map((node) => {
          const isSelected = state.selectedId === node.id;
          const isConnecting = state.connectingFrom === node.id;
          const isActive = activeNodeId === node.id;
          return (
            <SimNodeComp
              key={node.id}
              node={node}
              isSelected={isSelected}
              isConnecting={isConnecting}
              isActive={isActive}
              onSelect={() => dispatch({ type: 'SELECT', id: node.id })}
              onMove={(x, y) => dispatch({ type: 'MOVE_NODE', id: node.id, x, y })}
              onPortClick={(side) => {
                if (state.connectingFrom) {
                  if ((side === 'in' || side === 'out2') && state.connectingFrom !== node.id) {
                    dispatch({ type: 'ADD_EDGE', edge: createEdge(state.connectingFrom, node.id) });
                  } else {
                    dispatch({ type: 'CANCEL_CONNECT' });
                  }
                } else if (side === 'out' || side === 'out2') {
                  dispatch({ type: 'START_CONNECT', fromId: node.id, port: side });
                }
              }}
            />
          );
        })}

        {state.nodes.length === 0 && (
          <div className="sim-empty-hint">从左侧拖拽工序到此处开始搭建工艺流程</div>
        )}
      </div>
    </div>
  );
}

