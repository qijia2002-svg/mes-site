/**
 * 左侧训练关卡面板：关卡选择 + 约束 + 实时验收。
 * 取代原先只列「软件操作步骤」的 SimTasks（那个组件从未挂载，是死代码）。
 */
import { Icon } from '../../components/Icon';
import { SIM_LEVELS, type LevelContext } from './simLevelDefs';

interface Props {
  activeLevelId: string;
  onSelect: (id: string) => void;
  ctx: LevelContext;
  onClear: () => void;
  nodeCount: number;
  edgeCount: number;
}

export default function SimLevels({ activeLevelId, onSelect, ctx, onClear, nodeCount, edgeCount }: Props) {
  const level = SIM_LEVELS.find((l) => l.id === activeLevelId) ?? SIM_LEVELS[0];
  const result = level.evaluate(ctx);

  return (
    <aside className="sim-levels">
      <div className="sim-levels-title">训练关卡</div>
      <ol className="sim-levels-list">
        {SIM_LEVELS.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className={`sim-level-tab${l.id === activeLevelId ? ' is-active' : ''}`}
              onClick={() => onSelect(l.id)}
            >
              {l.title}
            </button>
          </li>
        ))}
      </ol>

      <p className="sim-level-brief">{level.brief}</p>

      <ul className="sim-level-constraints">
        {level.constraints.map((c, i) => (
          <li key={i}>
            <Icon name="list" size={16} />
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <div className={`sim-level-checks${result.pass ? ' is-pass' : ''}`}>
        <div className="sim-level-checks-title">
          <Icon name={result.pass ? 'check-circle' : 'minus'} size={16} />
          <span>验收 {result.pass ? '已通过' : '未通过'}</span>
        </div>
        {result.checks.map((c, i) => (
          <div key={i} className={`sim-level-check${c.ok ? ' is-ok' : ''}`}>
            <Icon name={c.ok ? 'check-circle' : 'minus'} size={16} />
            <span className="sim-level-check-label">{c.label}</span>
            <span className="sim-level-detail">{c.detail}</span>
          </div>
        ))}
      </div>

      <div className="sim-tasks-stats">
        <div className="sim-tasks-stat">节点 <strong>{nodeCount}</strong></div>
        <div className="sim-tasks-stat">连线 <strong>{edgeCount}</strong></div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ width: '100%', marginTop: 'var(--space-3)' }}
        onClick={() => { if (nodeCount === 0 || confirm('确定清空画布，从零开始本关？')) onClear(); }}
      >
        <Icon name="reset" size={16} />
        清空画布
      </button>
    </aside>
  );
}
