import type { SimNode, SimNodeProps } from './simTypes';
import { Icon } from '../../components/Icon';

interface Props {
  node: SimNode | null;
  onChange: (props: Partial<SimNodeProps>) => void;
  onLabelChange: (label: string) => void;
}

export default function SimProps({ node, onChange, onLabelChange }: Props) {
  if (!node) return null;

  return (
    <div className="sim-props">
      <div className="sim-props-head">
        <Icon name="workshop" size={16} />
        <span>工序属性</span>
      </div>
      <div className="sim-props-body">
        <label className="sim-field">
          <span className="sim-field-label">名称</span>
          <input
            className="sim-input"
            value={node.label}
            onChange={(e) => onLabelChange(e.target.value)}
          />
        </label>
        <label className="sim-field">
          <span className="sim-field-label">标准工时（分钟）</span>
          <input
            className="sim-input"
            type="number"
            min={1}
            value={node.props.hours ?? ''}
            onChange={(e) => onChange({ hours: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="例如 30"
          />
        </label>
        <label className="sim-field">
          <span className="sim-field-label">不良品概率（%）</span>
          <input
            className="sim-input"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={node.props.defectRate ?? ''}
            onChange={(e) => onChange({ defectRate: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="例如 1.5"
          />
        </label>
        <label className="sim-field sim-field-row">
          <span className="sim-field-label">强制质检</span>
          <button
            type="button"
            className={`sim-toggle${node.props.forceInspect ? ' is-on' : ''}`}
            onClick={() => onChange({ forceInspect: !node.props.forceInspect })}
          >
            {node.props.forceInspect ? 'ON' : 'OFF'}
          </button>
        </label>
      </div>
    </div>
  );
}
