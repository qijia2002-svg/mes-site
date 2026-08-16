/**
 * 跨模式「下一步」卡片 —— 修复 UX 重梳文档 B2（看→玩→练 在首页之外断裂）。
 *
 * 三种模式用统一卡片呈现：看·工厂（play）/ 学·课程（learn）/ 练·练习（practice）。
 * 有 to 的走 Link，有 onClick 的走 button（例如「做章节测试」就地展开测验）。
 * 全部走 design token；icon 用项目锁定的语义 SVG，杜绝 emoji。
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export type NextKind = 'learn' | 'play' | 'practice';

export interface NextAction {
  /** 跳转目标；与 onClick 二选一。 */
  to?: string;
  /** 就地动作（如展开章节测试）；优先级高于 to。 */
  onClick?: () => void;
  label: string;
  hint?: string;
  icon: IconName;
  kind: NextKind;
}

export function NextActionCard({ action }: { action: NextAction }) {
  const inner = (
    <>
      <span className="next-ic">
        <Icon name={action.icon} size={20} />
      </span>
      <span className="next-body">
        <span className="next-label">{action.label}</span>
        {action.hint && <span className="next-hint">{action.hint}</span>}
      </span>
      <Icon name="arrow-right" size={16} className="next-go" />
    </>
  );

  const cls = `next-card next-${action.kind}`;

  if (action.onClick) {
    return (
      <button type="button" className={cls} onClick={action.onClick}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={action.to ?? '#'} className={cls}>
      {inner}
    </Link>
  );
}

export function NextActionGroup({
  title,
  actions,
}: {
  title?: string;
  actions: NextAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <div className="next-group">
      {title && <p className="next-group-title">{title}</p>}
      <div className="next-list">
        {actions.map((a, i) => (
          <NextActionCard key={i} action={a} />
        ))}
      </div>
    </div>
  );
}
