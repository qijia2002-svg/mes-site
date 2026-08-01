import type { SimNodeDef, SimCategory } from './simTypes';
import { NODE_LIBRARY } from './simTypes';

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

export default function SimPalette() {
  return (
    <aside className="sim-palette">
      <div className="sim-palette-title">工序库</div>
      <p className="sim-palette-hint">拖拽到右侧画布</p>
      {GROUPS.map((g) => {
        if (g.items.length === 0) return null;
        return (
          <div key={g.cat} className="sim-palette-group">
            <div className="sim-palette-grouplabel">{g.label}</div>
            {g.items.map((def) => (
              <div
                key={def.type}
                className="sim-palette-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', def.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <span className={SHAPE_PREVIEW[def.shape] ?? 'sim-shape-rect'} />
                <span className="sim-palette-name">{def.label}</span>
                {def.critical && <span className="sim-critical-mark">⭐</span>}
              </div>
            ))}
          </div>
        );
      })}
    </aside>
  );
}
