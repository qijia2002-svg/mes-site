/**
 * 侧栏「我的学习主线」卡片 —— 取代原来的「工厂进度」卡，成为产品脊柱的常驻入口。
 *
 * 设计取舍（避免回归）：不简单删掉工厂进度，而是把工厂进度作为副指标保留，
 * 主线进度（engine/status.completion）作为主指标；未设定主线时引导去选路径。
 * 全部走 design token，无 emoji / 渐变 / 裸 hex / 弹性缓动。
 */
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useLearningSpine } from '../lib/learningSpine';
import { useFactorySummary } from '../features/factory/useFactorySummary';
import { NextActionCard } from './NextAction';

export function LearningSpine() {
  const spine = useLearningSpine();
  const factory = useFactorySummary();

  if (spine.activePath == null) {
    return (
      <div className="spine">
        <div className="spine-head">
          <span className="spine-label">我的学习主线</span>
        </div>
        <p className="spine-empty-text">
          还没设定学习主线。选一条路径，平台会替你记着学到哪、下一步去哪。
        </p>
        <Link className="spine-cta" to="/learning-paths">
          选一条学习路径 <Icon name="arrow-right" size={16} />
        </Link>
        <div className="spine-factory">
          <span className="spine-factory-meta">
            工厂：走过 {factory.touched} / {factory.total} 环节
          </span>
          <Link to="/factory" className="spine-factory-go">
            进工厂全景 <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="spine">
      <div className="spine-head">
        <span className="spine-label">我的学习主线</span>
        <Link to="/learning-paths" className="spine-switch">
          切换
        </Link>
      </div>

      <div className="spine-path">{spine.pathName}</div>

      <div className="spine-stats">
        <div className="spine-stat">
          <span className="spine-stat-num">
            {spine.completion}
            <span>%</span>
          </span>
          <span className="spine-stat-cap">主线进度</span>
        </div>
        <div className="spine-stat">
          <span className="spine-stat-num">
            {factory.pct}
            <span>%</span>
          </span>
          <span className="spine-stat-cap">工厂进度</span>
        </div>
      </div>

      {spine.nextCourseId != null && (
        <NextActionCard
          action={{
            to: `/courses/${spine.nextCourseId}`,
            label: `继续学：${spine.nextCourseName ?? '下一门课'}`,
            hint: '主线推荐的下一门课',
            icon: 'courses',
            kind: 'learn',
          }}
        />
      )}

      <div className="spine-factory">
        <span className="spine-factory-meta">
          工厂：走过 {factory.touched} / {factory.total} 环节
        </span>
        <Link to="/factory" className="spine-factory-go">
          进工厂全景 <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
