/**
 * 工厂 · 统一主壳（融合「学习」与「工厂」）
 *
 * 设计：单一「工厂」作为主壳。
 *  - 模式：全景(panorama) | 搭建(build)
 *      · 全景 = FactoryFlow 学习地图（工位挂 chapter/sql/quiz 资源）
 *      · 搭建 = Simulator 工艺路线搭建器（拖拽产线 + 仿真），原独立 /simulator 收进此模式
 *  - 全景内子视图：全景 | 课程 | 路径 | 职业（原「学习中心」四 tab 全部折进工厂）
 *  - 概览(续学 CTA + 完成度 + 当前进度) 作为全景视图头部仪表盘
 *
 * URL: /factory?mode=panorama|build&view=panorama|courses|paths|career
 * 兼容：/engine、/roadmap、/learning-paths、/simulator 均在路由层重定向到此。
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';
import { roadmapApi } from '../api/roadmap';
import { peek, write } from '../lib/userData';
import FactoryFlow from '../features/factory/FactoryFlow';

const Simulator = lazy(() => import('../features/simulator/SimulatorPage'));

type Mode = 'panorama' | 'build';
type View = 'panorama' | 'courses' | 'paths' | 'career';

const MODE_TABS: { key: Mode; label: string; icon: IconName }[] = [
  { key: 'panorama', label: '全景', icon: 'factory' },
  { key: 'build', label: '搭建', icon: 'routing' },
];

const VIEW_TABS: { key: View; label: string; icon: IconName }[] = [
  { key: 'panorama', label: '全景', icon: 'factory' },
  { key: 'courses', label: '课程', icon: 'courses' },
  { key: 'paths', label: '路径', icon: 'paths' },
  { key: 'career', label: '职业', icon: 'stage' },
];

// ═══ 通用分段控制器 ═══
function Segments<T extends string>({
  items, active, onChange,
}: { items: { key: T; label: string; icon: IconName }[]; active: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: 4 }}>
      {items.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: active === t.key ? 600 : 500,
            color: active === t.key ? 'var(--fg)' : 'var(--muted)',
            background: active === t.key ? 'var(--surface)' : 'transparent',
            boxShadow: active === t.key ? 'var(--elev-ring)' : 'none',
            transition: 'all 0.15s ease',
          }}>
          <Icon name={t.icon} size={16} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ═══ 学习工具卡片（作品集 / SQL 沙盒 / 搭建）═══
function ToolCard({ to, icon, title, desc }: { to: string; icon: IconName; title: string; desc: string }) {
  return (
    <Link to={to} className="card tool-card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-3)' }}>
      <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={20} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 'var(--weight-announce-cjk)', fontSize: 'var(--text-base)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 2, lineHeight: 'var(--leading-body)' }}>{desc}</span>
      </span>
    </Link>
  );
}

// ═══ 全景仪表盘（原概览：续学 CTA + 完成度 + 当前进度）═══
function PanoramaDashboard() {
  const engineQ = useQuery({
    queryKey: ['engine-status', undefined],
    queryFn: () => api.engineStatus({ selectedPaths: [1, 2, 3, 4, 5] }),
    staleTime: 30_000, retry: 1,
  });
  const [activePath, setActivePath] = useState<number | undefined>(peek<number | undefined>('engine.activePath', undefined));
  const data = engineQ.data;

  useEffect(() => {
    if (!activePath && data?.paths.length) {
      setActivePath(data.paths[0].pathId);
      void write('engine.activePath', data.paths[0].pathId);
    }
  }, [data, activePath]);

  if (engineQ.isLoading) return <LoadingState label="加载学习数据…" />;
  if (engineQ.isError) return <ErrorState error={engineQ.error} onRetry={() => engineQ.refetch()} />;
  if (!data) return null;

  const next = data.nextCourse;
  const active = data.paths.find((p) => p.pathId === activePath);
  const resumeTo = next?.currentChapterId
    ? `/chapters/${next.currentChapterId}`
    : (next ? `/courses/${next.courseId}` : '/courses');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {next && (
        <div style={{ background: 'var(--ink-solid)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta-on-ink)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', marginBottom: 4 }}>
              {next.status === 'doing' ? '继续学习' : '下一门课'}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-announce-cjk)', marginBottom: 4 }}>{next.name}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-2-on-ink)' }}>
              {next.status === 'doing' ? `${next.chapterDone ?? 0}/${next.totalChapters} 章 · ${next.percent}%` : `${next.totalChapters} 章 · ${next.estimatedHours}h`}
            </div>
          </div>
          <Link to={resumeTo} style={{ background: '#fff', color: 'var(--ink-solid)', padding: 'var(--space-3) var(--space-5)', borderRadius: 'var(--radius-sm)', fontWeight: 'var(--weight-announce-cjk)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {next?.status === 'doing' ? '继续学习' : '开始学习'} <Icon name="arrow-right" size={16} style={{ marginLeft: 8 }} />
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', lineHeight: 1 }}>{data.completion}%</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 4 }}>总完成度</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {data.paths.map((p) => (
            <button key={p.pathId} className={`btn btn-sm ${p.pathId === activePath ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActivePath(p.pathId); void write('engine.activePath', p.pathId); }}>
              {p.name} ({p.completion}%)
            </button>
          ))}
        </div>
      </div>

      {data.banner.show && (
        <div className="alert alert-ok">
          <Icon name="info" size={16} className="alert-glyph" />
          <div>
            <strong>已继承 {data.banner.inheritedCount} 门课程</strong>
            <span className="alert-sub">可节省约 {data.banner.savedHours} 小时</span>
          </div>
        </div>
      )}

      <div className="panel">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>学习工具</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <ToolCard to="/portfolio" icon="portfolio" title="作品集" desc="沉淀 MES 需求文档、实施笔记、方案" />
          <ToolCard to="/sql-space" icon="sql" title="SQL 沙盒" desc="浏览器内跑 SQL，练完整写操作" />
          <ToolCard to="/factory?mode=build" icon="routing" title="工厂搭建" desc="拖拽搭建产线，理解 MES 流转" />
        </div>
      </div>

      {active && (
        <div className="panel">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>当前进度</h2>
          <div className="progress-track" style={{ height: 6, marginBottom: 'var(--space-3)' }}>
            <div className="progress-fill" style={{ width: `${active.completion}%` }} />
          </div>
          {data.courses.slice(0, 10).map((c, i) => {
            const rowTo = c.currentChapterId ? `/chapters/${c.currentChapterId}` : `/courses/${c.courseId}`;
            return (
              <div key={c.courseId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-soft)', opacity: c.status === 'locked' ? 0.4 : 1 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--meta)', width: 20 }}>{i + 1}</span>
                <Icon name={c.status === 'completed' || c.status === 'inherited' ? 'success' : c.status === 'doing' ? 'run' : 'chapter'} size={16}
                  style={{ color: c.status === 'completed' || c.status === 'inherited' ? 'var(--success)' : c.status === 'doing' ? 'var(--warn)' : 'var(--muted)' }} />
                <Link to={rowTo} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)', textDecoration: 'none', fontWeight: 'var(--weight-announce-cjk)', fontSize: 'var(--text-base)' }}>{c.name}</Link>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', fontFamily: 'var(--font-mono)' }}>{c.percent}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ 课程视图 ═══
function CoursesView() {
  const q = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  if (q.isLoading) return <LoadingState label="加载课程…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
      {(q.data ?? []).map((t) => (
        <Link key={t.id} to={`/courses/${t.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 className="card-title">{t.title}</h3>
          <p className="card-desc">{t.description?.split('\n')[0] || '暂无简介'}</p>
          <div className="tag-row">{t.modules.map((m) => <span key={m} className="tag">{m}</span>)}</div>
        </Link>
      ))}
    </div>
  );
}

// ═══ 路径视图 ═══
function PathsView() {
  const pathsQ = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  if (pathsQ.isLoading) return <LoadingState label="加载路径…" />;
  if (pathsQ.isError) return <ErrorState error={pathsQ.error} onRetry={() => pathsQ.refetch()} />;
  const titleOf = (id: number) => topicsQ.data?.find((t) => t.id === id)?.title ?? `#${id}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
      {(pathsQ.data ?? []).map((p) => (
        <div key={p.id} className="card">
          <h3 className="card-title">{p.title}</h3>
          <p className="card-desc">{p.description}</p>
          <ol style={{ margin: 0, padding: '0 0 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
            {p.topicIds.map((tid, i) => <li key={tid} style={{ marginBottom: 2 }}><Link to={`/courses/${tid}`} style={{ color: 'var(--accent)' }}>{titleOf(tid)}</Link></li>)}
          </ol>
          <span className="tag" style={{ marginTop: 'auto' }}>{p.topicIds.length} 门课</span>
        </div>
      ))}
    </div>
  );
}

// ═══ 职业视图（roadmap 内嵌）═══
function CareerView() {
  const q = useQuery({ queryKey: ['tracks'], queryFn: roadmapApi.tracks });
  if (q.isLoading) return <LoadingState label="加载职业路径…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
      {(q.data?.items ?? []).map((tr) => (
        <Link key={tr.slug} to={`/tracks/${tr.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name="workshop" size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div><h3 className="card-title">{tr.title}</h3><p style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', margin: 0 }}>{tr.subtitle}</p></div>
          </div>
          <p className="card-desc">{tr.summary}</p>
          <div className="tag-row">
            <span className="tag">{tr.kind === 'core' ? '核心' : '选修'}</span>
            <span className="tag">{tr.chapterTotal} 章</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ═══ 搭建视图（Simulator 懒加载）═══
function BuildView() {
  return (
    <Suspense fallback={<LoadingState label="加载模拟台…" />}>
      <Simulator />
    </Suspense>
  );
}

// ═══ 页头（标题 + 模式/视图切换）═══
function FactoryHeader({ mode, view, setMode, setView }: {
  mode: Mode; view: View; setMode: (m: Mode) => void; setView: (v: View) => void;
}) {
  const title =
    mode === 'build' ? '工厂搭建'
      : view === 'courses' ? '课程'
        : view === 'paths' ? '学习路径'
          : view === 'career' ? '职业路线'
            : '工厂全景';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      <div>
        <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
          <Link to="/dictionary" className="text-link" style={{ fontSize: 'var(--text-xs)' }}><Icon name="dictionary" size={16} /> 名称翻译</Link>
          <Link to="/portfolio" className="text-link" style={{ fontSize: 'var(--text-xs)' }}><Icon name="chapter" size={16} /> 作品集</Link>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Segments items={MODE_TABS} active={mode} onChange={setMode} />
        {mode === 'panorama' && <Segments items={VIEW_TABS} active={view} onChange={setView} />}
      </div>
    </div>
  );
}

// ═══ 主组件 ═══
export default function FactoryPage() {
  const [sp, setSp] = useSearchParams();
  const modeParam = sp.get('mode');
  const mode: Mode = modeParam === 'build' ? 'build' : 'panorama';
  const viewParam = sp.get('view');
  const view: View = (['panorama', 'courses', 'paths', 'career'].includes(viewParam ?? '')
    ? viewParam
    : 'panorama') as View;

  const setMode = useCallback((m: Mode) => {
    const next = new URLSearchParams(sp);
    next.set('mode', m);
    if (m === 'panorama' && !next.get('view')) next.set('view', 'panorama');
    setSp(next, { replace: true });
  }, [sp, setSp]);

  const setView = useCallback((v: View) => {
    const next = new URLSearchParams(sp);
    next.set('view', v);
    setSp(next, { replace: true });
  }, [sp, setSp]);

  const wide = mode === 'build' || (mode === 'panorama' && view === 'panorama');

  return (
    <>
      <section style={{ maxWidth: 920, margin: '0 auto' }}>
        <FactoryHeader mode={mode} view={view} setMode={setMode} setView={setView} />
      </section>
      <div style={{ maxWidth: wide ? 'none' : 920, margin: '0 auto' }}>
        {mode === 'build' ? (
          <BuildView />
        ) : view === 'panorama' ? (
          <>
            <PanoramaDashboard />
            <div style={{ height: 'var(--space-6)' }} />
            <FactoryFlow />
          </>
        ) : view === 'courses' ? (
          <CoursesView />
        ) : view === 'paths' ? (
          <PathsView />
        ) : (
          <CareerView />
        )}
      </div>
    </>
  );
}
