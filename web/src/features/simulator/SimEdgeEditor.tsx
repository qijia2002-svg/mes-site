import type { SimEdge } from './simTypes';

interface Props {
  edge: SimEdge;
  fromLabel: string;
  toLabel: string;
  onChange: (patch: Partial<Pick<SimEdge, 'ratio' | 'label' | 'dashed'>>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function SimEdgeEditor({ edge, fromLabel, toLabel, onChange, onDelete, onClose }: Props) {
  return (
    <div className="sim-edge-editor">
      <div className="sim-props-head">
        <span className="sim-props-title">连线</span>
        <button className="btn-ghost btn-xs" onClick={onClose}>收起</button>
      </div>
      <div className="sim-edge-route">
        <span className="sim-chip">{fromLabel}</span>
        <span className="sim-chip-arrow">→</span>
        <span className="sim-chip">{toLabel}</span>
      </div>

      <label className="sim-field">
        <span className="sim-field-label">标签</span>
        <input
          className="sim-input"
          value={edge.label ?? ''}
          placeholder="如：良率 95%"
          maxLength={20}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>

      <label className="sim-field">
        <span className="sim-field-label">分流比率</span>
        <input
          className="sim-input"
          type="number"
          min={0}
          step={0.5}
          value={edge.ratio ?? ''}
          placeholder="默认等权"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Number(e.target.value);
            onChange({ ratio: v && v > 0 ? v : undefined });
          }}
        />
      </label>

      <label className="sim-check">
        <input type="checkbox" checked={edge.dashed} onChange={(e) => onChange({ dashed: e.target.checked })} />
        <span>回流返工（虚线）</span>
      </label>

      <button className="btn btn-danger btn-sm sim-edge-del" onClick={onDelete}>删除连线</button>
    </div>
  );
}
