/**
 * 工厂模拟（工艺路线搭建器）占位页。
 * 这是后续 P0 任务，当前只留导航入口，点击后展示「即将上线」。
 * 红线：没有的内容不添加——不编造功能预览。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export default function SimulatorPage() {
  return (
    <section className="page-head">
      <div>
        <h1 className="page-title">工厂模拟</h1>
        <p className="page-sub">
          工艺路线搭建器：拖拽工序块搭建产线 → 仿真运行 → 即时错误反馈。
          基于通用离散示例数据，后续可切换真实工厂数据。
        </p>
      </div>
      <div className="state-block state-empty" style={{ marginTop: 'var(--space-10)' }}>
        <Icon name="routing" size={24} className="state-glyph" />
        <h2 className="state-title">即将上线</h2>
        <p className="state-hint">
          工艺路线搭建器正在开发中。完成后你可以：
          拖拽工序块（下料 → 机加工 → 焊接 → 质检 → 装配）搭建产线，
          运行仿真观察工单流动，并即时获得齐套校验和不良分支反馈。
        </p>
        <Link className="btn btn-primary" to="/courses">
          <Icon name="courses" size={16} />
          先去学习理论
        </Link>
      </div>
    </section>
  );
}
