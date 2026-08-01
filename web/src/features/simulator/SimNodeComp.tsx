import type { SimNode, SimNodeType } from './simTypes';
import { NODE_DEF } from './simTypes';
import { Icon } from '../../components/Icon';

interface Props {
  node: SimNode;
  isSelected: boolean;
  isConnecting: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onPortClick: (side: 'in' | 'out') => void;
}

export default function SimNodeComp({ node, isSelected, isConnecting, onSelect, onMove, onPortClick }: Props) {
  const def = NODE_DEF[node.type];
  const dragRef = { ox: 0, oy: 0 };

  const cls = [
    'sim-node',
    isSelected && 'is-selected',
    isConnecting && 'is-connecting',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
        dragRef.ox = e.clientX - node.x;
        dragRef.oy = e.clientY - node.y;
        const handleMove = (ev: MouseEvent) => {
          onMove(ev.clientX - dragRef.ox, ev.clientY - dragRef.oy);
        };
        const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
      }}
    >
      {/* IN port(s) */}
      {def.ports.in > 0 && (
        <button
          className="sim-port sim-port-in"
          style={{ left: -5, top: '50%' }}
          onClick={(e) => { e.stopPropagation(); onPortClick('in'); }}
          title="输入端口"
        />
      )}
      {def.ports.in > 1 && (
        <button
          className="sim-port sim-port-in"
          style={{ left: -5, top: '30%' }}
          onClick={(e) => { e.stopPropagation(); onPortClick('in'); }}
          title="输入端口 2"
        />
      )}

      {/* 图标 */}
      <Icon name={def.icon as any} size={20} className="sim-node-glyph" />

      {/* 标签 */}
      <span className="sim-node-label">{node.label}</span>

      {/* OUT port */}
      {def.ports.out > 0 && (
        <button
          className="sim-port sim-port-out"
          style={{ right: -5, top: '50%' }}
          onClick={(e) => { e.stopPropagation(); onPortClick('out'); }}
          title="输出端口"
        />
      )}
    </div>
  );
}
