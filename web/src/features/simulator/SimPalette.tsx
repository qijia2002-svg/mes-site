import { useState } from 'react';
import type { SimNodeDef, SimShape, SimCategory } from './simTypes';
import { NODE_LIBRARY } from './simTypes';
import { Icon } from '../../components/Icon';

interface Props {
  onCreate: (type: string) => void;
  onCustomNode?: (def: SimNodeDef) => void;
  scene?: string;
}

interface CatGroup { cat: SimCategory; label: string; items: SimNodeDef[] }

const GROUPS: CatGroup[] = [
  { cat: 'endpoint', label: '起止节点', items: [] },
  { cat: 'process', label: '通用加工', items: [] },
  { cat: 'inspect', label: '通用检验', items: [] },
  { cat: 'storage', label: '仓储物流', items: [] },
];

// 分场景的节点 key
const SCENE_KEYS: Record<string, { label: string; keys: string[] }> = {
  auto: { label: '汽车零部件', keys: ['casting','forging','cnc','heat_treat','surface','i_dim','i_hardness'] },
  electronics: { label: '电子产品', keys: ['smt','reflow','wave','i_aoi','i_ict','i_fct'] },
  pharma: { label: '医药制剂', keys: ['weighing','mixing','tableting','coating','filling','sterilize','i_visual'] },
  food: { label: '食品饮料', keys: ['raw_mat','blending','pasteur','capping','labeling','i_metal','i_seal'] },
};

// 初始：只填通用节点
for (const def of Object.values(NODE_LIBRARY)) {
  const g = GROUPS.find((g2) => g2.cat === def.category);
  if (g) g.items.push(def);
}

const SHAPE_PREVIEW: Record<string, string> = {
  rect: 'sim-shape-rect', diamond: 'sim-shape-diamond',
  oval: 'sim-shape-oval', storage: 'sim-shape-storage',
};

const SHAPES: { key: SimShape; label: string }[] = [
  { key: 'rect', label: '矩形(加工)' }, { key: 'diamond', label: '菱形(检验)' },
  { key: 'oval', label: '椭圆(起止)' }, { key: 'storage', label: '圆角(仓储)' },
];

export default function SimPalette({ onCreate, onCustomNode, scene }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customShape, setCustomShape] = useState<SimShape>('rect');

  // 场景专属节点
  const sceneDefs = scene && SCENE_KEYS[scene]
    ? SCENE_KEYS[scene].keys.map(k => NODE_LIBRARY[k]).filter(Boolean)
    : [];

  const addCustom = () => {
    if (!customLabel.trim()) return;
    const def: SimNodeDef = {
      type: 'custom_' + Date.now(),
      label: customLabel.trim(),
      shape: customShape,
      category: customShape === 'diamond' ? 'inspect' : customShape === 'storage' ? 'storage' : customShape === 'oval' ? 'endpoint' : 'process',
      ports: { in: 1, out: customShape === 'diamond' ? 2 : 1 },
    };
    onCustomNode?.(def);
    onCreate(def.type);
    setCustomLabel('');
    setShowCustom(false);
  };

  return (
    <aside className="sim-palette">
      <div className="sim-palette-title">工序库</div>
      <p className="sim-palette-hint">点击或拖拽到画布添加工序</p>

      {/* 场景专属工序 */}
      {sceneDefs.length > 0 && (
        <div className="sim-palette-group">
          <div className="sim-palette-grouplabel" style={{ color: 'var(--accent)' }}>
            {SCENE_KEYS[scene!]?.label ?? '场景工序'}
          </div>
          {sceneDefs.map((def) => (
            <button key={def.type} type="button" className="sim-palette-item" draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', def.type); e.dataTransfer.effectAllowed = 'copy'; }}
              onClick={() => onCreate(def.type)} title={`添加「${def.label}」到画布`}>
              <span className={SHAPE_PREVIEW[def.shape] ?? 'sim-shape-rect'} />
              <span className="sim-palette-name">{def.label}</span>
              {def.critical && <Icon name="quality" size={16} className="sim-critical-mark" />}
            </button>
          ))}
        </div>
      )}

      {/* 通用分组 */}
      {GROUPS.map((g) => {
        if (g.items.length === 0) return null;
        return (
          <div key={g.cat} className="sim-palette-group">
            <div className="sim-palette-grouplabel">{g.label}</div>
            {g.items.map((def) => (
              <button key={def.type} type="button" className="sim-palette-item" draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', def.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onCreate(def.type)}
                title={`添加「${def.label}」到画布`}>
                <span className={SHAPE_PREVIEW[def.shape] ?? 'sim-shape-rect'} />
                <span className="sim-palette-name">{def.label}</span>
                {def.critical && <Icon name="quality" size={16} className="sim-critical-mark" />}
              </button>
            ))}
          </div>
        );
      })}

      {/* 自定义工序 */}
      <button type="button" className="sim-palette-item" style={{ marginTop: 'var(--space-3)', justifyContent: 'center', color: 'var(--accent)' }}
        onClick={() => setShowCustom(!showCustom)}>
        <Icon name="add" size={16} /> 自定义工序
      </button>

      {showCustom && (
        <div style={{ padding: 'var(--space-2)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
          <input type="text" className="input" placeholder="工序名称" value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            style={{ width: '100%', marginBottom: 4, fontSize: 'var(--text-sm)', padding: 4 }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {SHAPES.map(s => (
              <button key={s.key} type="button" className="btn btn-xs"
                style={{
                  background: customShape === s.key ? 'var(--accent)' : 'var(--surface-2)',
                  color: customShape === s.key ? '#fff' : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => setCustomShape(s.key)}>{s.label}</button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-xs" style={{ width: '100%' }}
            onClick={addCustom} disabled={!customLabel.trim()}>
            <Icon name="add" size={16} /> 添加工序
          </button>
        </div>
      )}
    </aside>
  );
}
