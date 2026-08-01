import { createNode, createEdge } from './simReducer';
import { outPort, inPort, outPort2, straightPath, reworkPath, edgePairs } from './simUtils';
import SimNodeComp from './SimNodeComp';

interface Props {
  state: { nodes: any[]; edges: any[]; selectedId: string | null; connectingFrom: string | null };
  dispatch: React.Dispatch<any>;
}

export default function SimCanvas({ state, dispatch }: Props) {
  const pairs = edgePairs(state);
  let reworkY = 0;

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
        const node = createNode(type, e.clientX - rect.left, e.clientY - rect.top);
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
      {/* SVG 连线层 */}
      <svg className="sim-svg">
        {pairs.map(({ edge, from, to }) => {
          // OUT→IN 为正常流转线，OUT2→IN 为不合格回流线
          const isRework = from.nodeType === edge.from && false; // TODO: detect out2 port usage
          const d = straightPath(from, to);
          return (
            <path
              key={edge.id}
              d={d}
              className={`sim-edge${edge.dashed ? ' is-dashed' : ''}`}
              onDoubleClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_EDGE', id: edge.id }); }}
            />
          );
        })}
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
                dispatch({ type: 'START_CONNECT', fromId: node.id });
              }
            }}
          />
        );
      })}

      {state.nodes.length === 0 && (
        <div className="sim-empty-hint">从左侧拖拽工序到此处开始搭建工艺流程</div>
      )}
    </div>
  );
}
