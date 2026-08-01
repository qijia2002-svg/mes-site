import type { SimNode, SimShape } from './simTypes';
import { NODE_LIBRARY } from './simTypes';

interface Props {
  node: SimNode;
  isSelected: boolean;
  isConnecting: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onPortClick: (side: 'in' | 'out' | 'out2') => void;
}

const SHAPE_CLS: Record<SimShape, string> = {
  rect: 'sim-node-rect',
  diamond: 'sim-node-diamond',
  oval: 'sim-node-oval',
  storage: 'sim-node-storage',
};

export default function SimNodeComp({ node, isSelected, isConnecting, onSelect, onMove, onPortClick }: Props) {
  const def = NODE_LIBRARY[node.nodeType];
  if (!def) return null;

  const cls = [
    'sim-node',
    SHAPE_CLS[def.shape],
    isSelected && 'is-selected',
    isConnecting && 'is-connecting',
  ].filter(Boolean).join(' ');

  const dragRef = { ox: 0, oy: 0 };

  return (
    <div
      className={cls}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
        dragRef.ox = e.clientX - node.x;
        dragRef.oy = e.clientY - node.y;
        const mm = (ev: MouseEvent) => onMove(ev.clientX - dragRef.ox, ev.clientY - dragRef.oy);
        const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
        window.addEventListener('mousemove', mm);
        window.addEventListener('mouseup', mu);
      }}
    >
      {/* 菱形内部文字需反旋转 */}
      <span className={def.shape === 'diamond' ? 'sim-node-label diamond-inner' : 'sim-node-label'}>
        {node.label}
        {def.critical && <span className="sim-critical-mark">⭐</span>}
      </span>

      {/* IN ports */}
      {def.ports.in > 0 && (
        <button className="sim-port sim-port-in" style={{ left: -5, top: '50%' }}
          onClick={(e) => { e.stopPropagation(); onPortClick('in'); }} title="输入" />
      )}
      {def.ports.in > 1 && (
        <button className="sim-port sim-port-in" style={{ left: -5, top: '30%' }}
          onClick={(e) => { e.stopPropagation(); onPortClick('in'); }} title="输入2" />
      )}

      {/* OUT port */}
      {def.ports.out > 0 && (
        <button className="sim-port sim-port-out" style={{ right: -5, top: '50%' }}
          onClick={(e) => { e.stopPropagation(); onPortClick('out'); }} title="输出" />
      )}

      {/* OUT2 port（检验节点底部，不合格回流用） */}
      {def.ports.out > 1 && (
        <button className="sim-port sim-port-out2" style={{ left: '50%', bottom: -5 }}
          onClick={(e) => { e.stopPropagation(); onPortClick('out2'); }} title="不合格" />
      )}
    </div>
  );
}
