import type { SimNodeDef, SimCategory } from './simTypes';
import { NODE_LIBRARY } from './simTypes';
import { Icon } from '../../components/Icon';

interface Props {
  /** 点击工序项时，由父组件把对应类型的节点添加到画布 */
  onCreate: (type: string) => void;
}

interface CatGroup { cat: SimCategory; label: string; items: SimNodeDef[] }

const GROUPS: CatGroup[] = [
  { cat: 'endpoint', label: '起止', items: [] },
  { cat: 'process', label: '加工工序', items: [] },
  { cat: 'inspect', label: '检验节点', items: [] },
  { cat: 'storage', label: '仓储', items: [] },
];

for (const def of Object.values(NODE_LIBRARY)) {
  const g = GROUPS.find((g2) => g2.cat === def.category);
  if (g) g.items.push(def);
}

const SHAPE_PREVIEW: Record<string, string> = {
  rect: 'sim-shape-rect',
  diamond: 'sim-shape-diamond',
  oval: 'sim-shape-oval',
  storage: 'sim-shape-storage',
};

export default function SimPalette({ onCreate }: Props) {
  return (
    <aside className="sim-palette">
      <div className="sim-palette-title">工序库</div>
      <p className="sim-palette-hint">点击或拖拽到画布添加工序</p>
      {GROUPS.map((g) => {
        if (g.items.length === 0) return null;
        return (
          <div key={g.cat} className="sim-palette-group">
            <div className="sim-palette-grouplabel">{g.label}</div>
            {g.items.map((def) => (
              <button
                key={def.type}
                type="button"
                className="sim-palette-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', def.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onCreate(def.type)}
                title={`添加「${def.label}」到画布`}
              >
                <span className={SHAPE_PREVIEW[def.shape] ?? 'sim-shape-rect'} />
                <span className="sim-palette-name">{def.label}</span>
                {def.critical && <Icon name="quality" size={16} className="sim-critical-mark" />}
              </button>
            ))}
          </div>
        );
      })}
    </aside>
  );
}
