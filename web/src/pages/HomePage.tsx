/**
 * 首页驾驶舱（v3.1）。
 * 布局参考用户提供的 Manufacturing OS 原型，内容只用平台实际有的数据。
 * 红线：没有的内容不添加（不编造 BOM/工序/案例/求职等数据）。
 *
 * 结构：统计卡 → 下一站学习（深色锚点区）→ 路径进度 → 快速入口 → 课程列表
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { GreetingBar } from '../components/GreetingBar';
import { api, type TodayProgress } from '../api/endpoints';
import ProgressDashboard from '../components/ProgressDashboard';

function readCount(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function TodayPanel() {
  const today = useQuery({
    queryKey: ['progress-today'],
    queryFn: api.progressToday,
    retry: 1,
  });

  if (today.isLoading) return <LoadingState label="正在统计今日进度…" />;

  if (today.isError || !today.data) {
    return (
      <p className="alert alert-warn" role="status">
        <Icon name="warn" size={16} className="alert-glyph" />
        <span>今日进度暂时取不到，学习功能不受影响。</span>
      </p>
    );
  }

  const d: TodayProgress = today.data;
  const chapters = readCount(d.chapterRead);
  const passed = readCount(d.sqlPassed);
  const total = readCount(d.total) || chapters + passed;

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{chapters}</span>
          <span className="stat-label">章节已读</span>
        </div>
        <div className="stat">
          <span className="stat-value">{passed}</span>
          <span className="stat-label">SQL 判题通过</span>
        </div>
        <div className="stat">
          <span className="stat-value">{total}</span>
          <span className="stat-label">今日完成条目</span>
        </div>
      </div>
      <p className="stat-note">
        进度按浏览器匿名标识记录，不需要注册；换浏览器或清除站点数据会重新开始。
      </p>
    </>
  );
}

/** 四大模块快速入口 */
const QUICK_ACTIONS = [
  { to: '/courses', label: '学习中心', desc: 'ERP / MES / SQL 理论章节', icon: 'courses' as const },
  { to: '/sql-space', label: '模拟台', desc: '浏览器内 SQLite 实操判题', icon: 'sql' as const },
  { to: '/simulator', label: '工厂模拟', desc: '工艺路线搭建与仿真（即将上线）', icon: 'routing' as const },
];

export default function HomePage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  return (
    <section className="dash-page">
      {/* 打招呼 */}
      <GreetingBar />

      <header className="page-head">
        <div>
          <h1 className="page-title">学习驾驶舱</h1>
          <p className="page-sub">
            制造执行系统的理论章节 + 浏览器内 SQLite 实操判题。SQL 在你本机的
            WebAssembly 里跑，不上传、不排队、可离线。
          </p>
        </div>
        <Link className="btn btn-primary" to="/sql-space">
          <Icon name="sql" size={16} />
          打开模拟台
        </Link>
      </header>

      {/* 统计卡 + 下一站学习 + 路径进度 */}
      <ProgressDashboard />

      {/* 今日完成 */}
      <div className="section">
        <h2 className="section-title">今日完成</h2>
        <TodayPanel />
      </div>

      {/* 快速入口 */}
      <div className="section">
        <h2 className="section-title">快速入口</h2>
        <div className="quick-grid">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} className="quick-card" to={a.to}>
              <span className="quick-glyph">
                <Icon name={a.icon} size={24} />
              </span>
              <span className="quick-body">
                <span className="quick-label">{a.label}</span>
                <span className="quick-desc">{a.desc}</span>
              </span>
              <Icon name="arrow-right" size={16} className="quick-arrow" />
            </Link>
          ))}
        </div>
      </div>

      {/* 课程列表 */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title">课程</h2>
          <Link className="text-link" to="/courses">
            查看全部
          </Link>
        </div>

        {topics.isLoading && <LoadingState label="正在加载课程…" />}
        {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
        {topics.data?.length === 0 && (
          <EmptyState title="还没有课程" hint="内容由后台导入，导入后会出现在这里。" icon="courses" />
        )}
        {topics.data && topics.data.length > 0 && (
          <ul className="card-grid">
            {topics.data.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link className="card" to={`/courses/${t.id}`}>
                  <h3 className="card-title">{t.title}</h3>
                  <p className="card-desc">{t.description || '暂无课程简介。'}</p>
                  <div className="tag-row">
                    {t.modules.map((m) => (
                      <span key={m} className="tag">
                        {m}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
