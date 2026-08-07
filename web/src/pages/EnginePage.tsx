/**
 * 智造学院 · 学习中心 v5（ADR-013/015 落地：单页四视图融合）
 * /engine?tab=overview|courses|paths|career
 *
 * 概览 = nextCourse CTA + 进度环 + 继承横幅
 * 课程 = 全部课程卡片
 * 路径 = 学习路径列表
 * 职业 = 职业路线图（roadmap 内嵌）
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon, type IconName } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { SpinnerIcon } from '../components/Icon';
import { api } from '../api/endpoints';
import { roadmapApi } from '../api/roadmap';
import { peek, write } from '../lib/userData';
import FactoryFlow from '../features/factory/FactoryFlow';

type View = 'factory' | 'overview' | 'courses' | 'paths' | 'career';

const TABS: { key: View; label: string; icon: IconName }[] = [
  { key: 'factory', label: '工厂', icon: 'factory' },
  { key: 'overview', label: '概览', icon: 'dashboard' },
  { key: 'courses', label: '课程', icon: 'courses' },
  { key: 'paths', label: '路径', icon: 'paths' },
  { key: 'career', label: '职业', icon: 'stage' },
];

// 学习引擎状态（当前激活路径）走云端镜像 userData，跨设备一致（见 lib/userData.ts）

// ═══ 分段控制器 ═══
function Segments({ active, onChange }: { active: View; onChange: (v: View) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: 4 }}>
      {TABS.map(t => (
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
          <Icon name={t.icon as any} size={16} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ═══ 学习工具卡片（把词典 / 沙盒 / 仿真收进学习中心）═══
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

// ═══ 概览视图 ═══
function OverviewView() {
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
  const active = data.paths.find(p => p.pathId === activePath);
  // 续学锚点：优先跳到当前课程第一个未完成章；无锚点（或未登录）则回退课程页
  const resumeTo = next?.currentChapterId
    ? `/chapters/${next.currentChapterId}`
    : (next ? `/courses/${next.courseId}` : '/courses');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* nextCourse 深色 CTA */}
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

      {/* 完成度环 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', lineHeight: 1 }}>{data.completion}%</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--meta)', marginTop: 4 }}>总完成度</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {data.paths.map(p => (
            <button key={p.pathId} className={`btn btn-sm ${p.pathId === activePath ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActivePath(p.pathId); void write('engine.activePath', p.pathId); }}>
              {p.name} ({p.completion}%)
            </button>
          ))}
        </div>
      </div>

      {/* 继承横幅 */}
      {data.banner.show && (
        <div className="alert alert-ok">
          <Icon name="info" size={16} className="alert-glyph" />
          <div>
            <strong>已继承 {data.banner.inheritedCount} 门课程</strong>
            <span className="alert-sub">可节省约 {data.banner.savedHours} 小时</span>
          </div>
        </div>
      )}

      {/* 学习工具：把作品集 / SQL 沙盒 / 工厂仿真收进学习中心（名称翻译已移至首页+底部栏） */}
      <div className="panel">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>学习工具</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <ToolCard to="/portfolio" icon="portfolio" title="作品集" desc="沉淀 MES 需求文档、实施笔记、方案" />
          <ToolCard to="/sql-space" icon="sql" title="SQL 沙盒" desc="浏览器内跑 SQL，练完整写操作" />
          <ToolCard to="/simulator" icon="routing" title="工厂仿真" desc="拖拽搭建产线，理解 MES 流转" />
        </div>
      </div>

      {/* 当前路径课程进度 */}
      <div className="panel">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>当前进度</h2>
        {active && (
          <div className="progress-track" style={{ height: 6, marginBottom: 'var(--space-3)' }}>
            <div className="progress-fill" style={{ width: `${active.completion}%` }} />
          </div>
        )}
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
      {(q.data ?? []).map(t => (
        <Link key={t.id} to={`/courses/${t.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 className="card-title">{t.title}</h3>
          <p className="card-desc">{t.description?.split('\n')[0] || '暂无简介'}</p>
          <div className="tag-row">{t.modules.map(m => <span key={m} className="tag">{m}</span>)}</div>
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
  const titleOf = (id: number) => topicsQ.data?.find(t => t.id === id)?.title ?? `#${id}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
      {(pathsQ.data ?? []).map(p => (
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
      {(q.data?.items ?? []).map(tr => (
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

// ═══ 工厂全景视图（factory-first 导航主干）═══
function FactoryView() {
  return <FactoryFlow />;
}

// ═══ 页头（标题 + 分段控制器）═══
function EngineHeader({ tab, setTab }: { tab: View; setTab: (v: View) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      <div>
        <h1 className="page-title" style={{ margin: 0 }}>{tab === 'factory' ? '工厂全景' : '学习中心'}</h1>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
          <Link to="/dictionary" className="text-link" style={{ fontSize: 'var(--text-xs)' }}><Icon name="dictionary" size={16} /> 名称翻译</Link>
          <Link to="/portfolio" className="text-link" style={{ fontSize: 'var(--text-xs)' }}><Icon name="chapter" size={16} /> 作品集</Link>
        </div>
      </div>
      <Segments active={tab} onChange={setTab} />
    </div>
  );
}

// ═══ 主组件 ═══
export default function EnginePage() {
  const [sp, setSp] = useSearchParams();
  const VALID_TABS: View[] = ['factory', 'overview', 'courses', 'paths', 'career'];
  const tabParam = sp.get('tab');
  const tab = (VALID_TABS.includes(tabParam as View) ? tabParam : 'overview') as View;
  const setTab = useCallback((v: View) => { sp.set('tab', v); setSp(sp, { replace: true }); }, [sp, setSp]);
  const isFactory = tab === 'factory';

  return (
    <>
      {/* 页头：保持常规宽度，不抢工厂全景 */}
      <section style={{ maxWidth: 920, margin: '0 auto' }}>
        <EngineHeader tab={tab} setTab={setTab} />
      </section>
      {/* 主体：工厂视图全宽铺满，其余视图保持 920 */}
      <div style={{ maxWidth: isFactory ? 'none' : 920, margin: '0 auto' }}>
        {isFactory && <FactoryView />}
        {tab === 'overview' && <OverviewView />}
        {tab === 'courses' && <CoursesView />}
        {tab === 'paths' && <PathsView />}
        {tab === 'career' && <CareerView />}
      </div>
    </>
  );
}
