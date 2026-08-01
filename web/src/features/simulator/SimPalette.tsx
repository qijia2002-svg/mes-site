import type { SimNodeType } from './simTypes';
import { NODE_DEF } from './simTypes';
import { Icon, type IconName } from '../../components/Icon';

const NODE_TYPES: SimNodeType[] = ['raw_cut', 'machining', 'welding', 'inspection', 'assembly', 'warehouse'];

const COLOR_MAP: Record<SimNodeType, string> = {
  raw_cut: 'var(--accent-on-ink)',
  machining: 'var(--accent-on-ink)',
  welding: 'var(--warn)',
  inspection: 'var(--accent-on-ink)',
  assembly: 'var(--accent-on-ink)',
  warehouse: 'var(--success)',
};

export default function SimPalette() {
  return (
    <aside className="sim-palette">
      <div className="sim-palette-title">工序库</div>
      <p className="sim-palette-hint">拖拽到右侧画布</p>
      <div className="sim-palette-list">
        {NODE_TYPES.map((type) => {
          const def = NODE_DEF[type];
          return (
            <div
              key={type}
              className="sim-palette-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="sim-palette-dot" style={{ background: COLOR_MAP[type] }} />
              <Icon name={def.icon as IconName} size={16} />
              <span>{def.label}</span>
              <span className="sim-palette-ports">
                {def.ports.in > 0 && `IN×${def.ports.in}`}
                {def.ports.in > 0 && def.ports.out > 0 && ' '}
                {def.ports.out > 0 && `OUT×${def.ports.out}`}
                {def.ports.out === 0 && '终'}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
