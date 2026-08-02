/** 左侧任务面板：操作指引 + 重置按钮 */
import { Icon } from '../../components/Icon';

const STEPS = [
  { step: 1, label: '拖拽工序到画布', icon: 'routing' as const, desc: '从工序库拖拽节点到右侧画布' },
  { step: 2, label: '连接工艺流程', icon: 'chapter' as const, desc: '点击 OUT 端口再点 IN 端口连线' },
  { step: 3, label: '配置工序属性', icon: 'add' as const, desc: '选中节点，下方编辑工时/不良率等' },
  { step: 4, label: '添加检验节点', icon: 'report' as const, desc: '菱形检验节点可设置不合格回流' },
  { step: 5, label: '保存工艺方案', icon: 'confirm' as const, desc: '工具栏点击保存到本地' },
];

interface Props {
  onClear: () => void;
  nodeCount: number;
  edgeCount: number;
}

export default function SimTasks({ onClear, nodeCount, edgeCount }: Props) {
  return (
    <aside className="sim-tasks">
      <div className="sim-tasks-title">操作指引</div>
      <ol className="sim-tasks-list">
        {STEPS.map((s) => (
          <li key={s.step} className="sim-task-item">
            <span className="sim-task-num">{s.step}</span>
            <div className="sim-task-body">
              <span className="sim-task-label"><Icon name={s.icon} size={16} />{s.label}</span>
              <span className="sim-task-desc">{s.desc}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="sim-tasks-stats">
        <div className="sim-tasks-stat">节点 <strong>{nodeCount}</strong></div>
        <div className="sim-tasks-stat">连线 <strong>{edgeCount}</strong></div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ width: '100%', marginTop: 'var(--space-3)' }}
        onClick={() => { if (nodeCount === 0 || confirm('确定清空画布？')) onClear(); }}
      >
        <Icon name="reset" size={16} />
        重置画布
      </button>
    </aside>
  );
}
