import type { SimNode, SimNodeProps } from './simTypes';
import { NODE_LIBRARY } from './simTypes';
import { Icon } from '../../components/Icon';

interface Props {
  node: SimNode | null;
  onChange: (props: Partial<SimNodeProps>) => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
}

export default function SimProps({ node, onChange, onLabelChange, onDelete }: Props) {
  if (!node) return null;
  const def = node.def ?? NODE_LIBRARY[node.nodeType];
  const isInspect = def?.category === 'inspect';

  return (
    <div className="sim-props">
      <div className="sim-props-head">
        {def?.label ?? '工序'} · 属性
        <button type="button" className="sim-props-delete" onClick={onDelete} title="删除该工序节点">
          <Icon name="delete" size={16} />
          删除
        </button>
      </div>
      <div className="sim-props-body">
        <label className="sim-field">
          <span className="sim-field-label">名称</span>
          <input className="sim-input" value={node.label} onChange={(e) => onLabelChange(e.target.value)} />
        </label>
        {!isInspect && (
          <label className="sim-field">
            <span className="sim-field-label">标准工时(分)</span>
            <input className="sim-input" type="number" min={1} value={node.props.hours ?? ''} onChange={(e) => onChange({ hours: e.target.value ? Number(e.target.value) : undefined })} placeholder="30" />
          </label>
        )}
        {!isInspect && (
          <label className="sim-field">
            <span className="sim-field-label">产能(件/时)</span>
            <input className="sim-input" type="number" min={0} value={node.props.capacity ?? ''} onChange={(e) => onChange({ capacity: e.target.value ? Number(e.target.value) : undefined })} placeholder="留空按工时算" />
          </label>
        )}
        {isInspect && (
          <label className="sim-field">
            <span className="sim-field-label">不良率(%)</span>
            <input className="sim-input" type="number" min={0} max={100} step={0.1} value={node.props.defectRate ?? ''} onChange={(e) => onChange({ defectRate: e.target.value ? Number(e.target.value) : undefined })} placeholder="1.5" />
          </label>
        )}
        <label className="sim-field sim-field-row">
          <span className="sim-field-label">关键工序</span>
          <button type="button" className={`sim-toggle${node.props.forceInspect ? ' is-on' : ''}`} onClick={() => onChange({ forceInspect: !node.props.forceInspect })}>
            {node.props.forceInspect ? '是' : '否'}
          </button>
        </label>
      </div>
    </div>
  );
}
