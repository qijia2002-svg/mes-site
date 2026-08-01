/**
 * 工作台首页（F5）。
 * 首屏不挂 SQL 沙箱——640KB WASM 不该为了看一眼进度就下载。
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type TodayProgress } from '../api/endpoints';

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

  // 进度是辅助信息，拉不到不该把首页变成错误页——降级成一句提示。
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

export default function HomePage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">今天先把一章理论读完，再把对应的 SQL 写一遍</h1>
          <p className="page-sub">
            MES 实训平台：制造执行系统的理论章节 + 浏览器内 SQLite 实操判题。SQL 在你本机的
            WebAssembly 里跑，不上传、不排队、可离线。
          </p>
        </div>
        <Link className="btn btn-primary" to="/sql-space">
          <Icon name="sql" size={16} />
          打开 SQL 工作台
        </Link>
      </header>

      <div className="section">
        <h2 className="section-title">今日完成</h2>
        <TodayPanel />
      </div>

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
