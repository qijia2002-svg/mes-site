import { createNode, createEdge } from './simReducer';
import { straightPath, reworkPath, edgePairs, edgeLabelPos } from './simUtils';
import SimNodeComp from './SimNodeComp';
import type { SimNode, SimEdge } from './simTypes';

interface Props {
  nodes: SimNode[];
  edges: SimEdge[];
  selectedId: string | null;
  selectedEdgeId: string | null;
  connectingFrom: string | null;
  connectingPort: 'out' | 'out2' | null;
  dispatch: React.Dispatch<any>;
  activeNodeId?: string | null;
  bottleneckId?: string | null;
  edgeFlow?: Record<string, number>;
}

export default function SimCanvas({ nodes, edges, selectedId, selectedEdgeId, connectingFrom, connectingPort, dispatch, activeNodeId, bottleneckId, edgeFlow }: Props) {
  // edgePairs 需要带节点的边对象，构造临时 state 形状（仅取用到字段）
  const pairs = edgePairs({ nodes, edges } as any);

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
          dispatch({ type: 'SELECT_EDGE', id: null });
          dispatch({ type: 'CANCEL_CONNECT' });
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
          dispatch({ type: 'DELETE_NODE', id: selectedId });
        }
        if (e.key === 'Escape') dispatch({ type: 'CANCEL_CONNECT' });
      }}
    >
      {/* 舞台：固定尺寸，画布可滚动，节点/连线超出视口也不丢失 */}
      <div className="sim-stage">
        {/* SVG 连线层 */}
        <svg className="sim-svg">
          <defs>
            <marker id="sim-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1 L9 5 L1 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {pairs.map(({ edge, from, to }) => {
            const d = edge.dashed ? reworkPath(from, to, 36) : straightPath(from, to);
            const isSel = selectedEdgeId === edge.id;
            const flow = edgeFlow?.[edge.id];
            const labelText = flow && flow > 0.5 ? String(Math.round(flow)) : edge.label ?? '';
            const lp = edgeLabelPos(from, to);
            return (
              <g key={edge.id} className="sim-edge-g">
                <path
                  d={d}
                  className={`sim-edge${edge.dashed ? ' is-dashed' : ''}${activeNodeId === from.id || activeNodeId === to.id ? ' is-flowing' : ''}${isSel ? ' is-selected' : ''}`}
                  markerEnd="url(#sim-arrow)"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_EDGE', id: edge.id }); }}
                />
                {labelText && (
                  <text x={lp.x} y={lp.y} className="sim-edge-label" textAnchor="middle" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_EDGE', id: edge.id }); }}>
                    {labelText}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 节点层 */}
        {nodes.map((node) => {
          const isSelected = selectedId === node.id;
          const isConnecting = connectingFrom === node.id;
          const isActive = activeNodeId === node.id;
          const isBottleneck = bottleneckId === node.id;
          return (
            <SimNodeComp
              key={node.id}
              node={node}
              isSelected={isSelected}
              isConnecting={isConnecting}
              isActive={isActive}
              isBottleneck={isBottleneck}
              onSelect={() => dispatch({ type: 'SELECT', id: node.id })}
              onMove={(x, y) => dispatch({ type: 'MOVE_NODE', id: node.id, x, y })}
              onPortClick={(side) => {
                if (connectingFrom) {
                  if ((side === 'in' || side === 'out2') && connectingFrom !== node.id) {
                    dispatch({ type: 'ADD_EDGE', edge: createEdge(connectingFrom, node.id) });
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

        {nodes.length === 0 && (
          <div className="sim-empty-hint">从左侧拖拽工序到此处开始搭建工艺流程</div>
        )}
      </div>
    </div>
  );
}
