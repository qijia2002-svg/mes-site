/**
 * App Shell：深色侧栏 + Topbar 52 + 面包屑。
 * v3.1：侧栏改深色（--surface-ink），导航精简为四项（首页/学习中心/模拟台/工厂模拟）。
 * 底部加学习进度条（复用 api.progress + api.topics，不新增后端端点）。
 */
import { useCallback, useState, useMemo } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon, type IconName } from './Icon';
import { Breadcrumb } from './Breadcrumb';
import { useAuth, useLogout } from './AuthGuard';
import { api } from '../api/endpoints';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

// 四大模块导航（用户指令：首页 / 学习中心 / 模拟台 / 工厂模拟）
// 学习中心改为可展开分组，子项直达各知识模块
const PRIMARY_NAV: NavEntry[] = [
  { to: '/', label: '首页', icon: 'dashboard', end: true },
  { to: '/courses', label: '学习中心', icon: 'courses' },
  { to: '/sql-space', label: '模拟台', icon: 'sql' },
  { to: '/simulator', label: '工厂模拟', icon: 'routing' },
];

// 学习中心子模块（可展开的二级导航）
const LEARN_SUB: NavEntry[] = [
  { to: '/courses/4', label: 'ERP', icon: 'report' },
  { to: '/courses/5', label: 'MES', icon: 'workshop' },
  { to: '/courses/6', label: 'SQL', icon: 'sql' },
  { to: '/courses/7', label: 'PLC', icon: 'equipment' },
];

const COLLAPSE_KEY = 'mes.sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 侧栏底部学习进度条：复用 React Query 缓存（与 ProgressDashboard 共享），不重复请求。 */
function SidebarProgress() {
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, staleTime: 60_000 });

  // 拉每个 topic 的 chapters 算总数——数据会被首页 ProgressDashboard 复用缓存
  const chapterQs = useQueries({
    queries: (topicsQ.data ?? []).map((t) => ({
      queryKey: ['chapters', t.id],
      queryFn: () => api.chapters(t.id),
      staleTime: 5 * 60_000,
    })),
  });

  const { doneChapters, totalChapters, pct } = useMemo(() => {
    const completedSet = new Set(
      (progressQ.data?.completedChapterIds ?? []).map((s) => String(s)),
    );
    const total = chapterQs.reduce((sum, q) => sum + (q.data?.length ?? 0), 0);
    const done = completedSet.size;
    const p = total > 0 ? Math.round((done / total) * 100) : 0;
    return { doneChapters: done, totalChapters: total, pct: p };
  }, [progressQ.data, chapterQs]);

  return (
    <div className="sidebar-progress">
      <div className="sidebar-progress-head">
        <span className="sidebar-progress-label">学习进度</span>
        <span className="sidebar-progress-pct">{pct}%</span>
      </div>
      <div className="sidebar-progress-track">
        <div className="sidebar-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sidebar-progress-meta">
        已读 {doneChapters} / {totalChapters} 章
      </div>
      <Link className="sidebar-progress-cta" to="/courses">
        继续学习
        <Icon name="run" size={16} />
      </Link>
    </div>
  );
}

function HealthPill() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 60_000,
    retry: 1,
  });

  if (health.isLoading) {
    return (
      <span className="pill pill-idle">
        <Icon name="loading" size={16} className="spin" />
        连接中
      </span>
    );
  }
  if (health.isError || !health.data) {
    return (
      <span className="pill pill-danger">
        <Icon name="error" size={16} />
        API 不可用
      </span>
    );
  }
  const degraded = health.data.degrade && health.data.degrade !== 'L0';
  return (
    <span className={degraded ? 'pill pill-warn' : 'pill pill-ok'}>
      <Icon name={degraded ? 'warn' : 'success'} size={16} />
      {degraded ? `服务降级 ${health.data.degrade}` : 'API 正常'}
    </span>
  );
}

/** 侧栏底部：已登录显示用户名+退出，否则淡隐（RequireAuth 已兜底，这里只是信息展示） */
function AuthFooterLink() {
  const { data } = useAuth();
  const { logout } = useLogout();
  if (!data?.sub) return null;
  return (
    <>
      <span className="nav-subitem" style={{ color: 'var(--meta-on-ink)', cursor: 'default' }}>
        <Icon name="user" size={16} className="nav-subglyph" />
        <span>{data.sub}</span>
      </span>
      <button
        type="button"
        className="nav-subitem"
        style={{ background: 'transparent', border: 0, fontFamily: 'inherit', cursor: 'pointer' }}
        onClick={() => { logout().catch(() => {}); }}
      >
        <Icon name="login" size={16} className="nav-subglyph" />
        <span>退出登录</span>
      </button>
    </>
  );
}

function NavList({ items }: { items: NavEntry[] }) {
  return (
    <ul className="nav-list">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}
          >
            <Icon name={item.icon} size={20} className="nav-glyph" />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [learnOpen, setLearnOpen] = useState(true);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // 存储不可用时只影响记忆，不影响本次交互
      }
      return next;
    });
  }, []);

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        跳到主内容
      </a>

      <aside className="sidebar" aria-label="主导航">
        <div className="sidebar-brand">
          <Icon name="workshop" size={20} className="brand-glyph" />
          <span className="brand-text">MES 实训平台</span>
        </div>

        {/* 主导航：首页 + 模拟台 + 工厂模拟（学习中心单独渲染为可展开分组） */}
        <ul className="nav-list">
          <li>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}>
              <Icon name="dashboard" size={20} className="nav-glyph" />
              <span className="nav-label">首页</span>
            </NavLink>
          </li>
        </ul>

        {/* 学习中心：可展开的分组导航 */}
        <div className="nav-group">
          <button
            type="button"
            className="nav-group-head"
            onClick={() => setLearnOpen((v) => !v)}
            aria-expanded={learnOpen}
          >
            <Icon name="courses" size={20} className="nav-glyph" />
            <span className="nav-label">学习中心</span>
            <Icon name={learnOpen ? 'close' : 'menu'} size={16} className="nav-group-arrow" />
          </button>
          {learnOpen && (
            <ul className="nav-sublist">
              {LEARN_SUB.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => (isActive ? 'nav-subitem is-active' : 'nav-subitem')}
                  >
                    <Icon name={item.icon} size={16} className="nav-subglyph" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/courses" end className={({ isActive }) => (isActive ? 'nav-subitem is-active' : 'nav-subitem')}>
                  <Icon name="paths" size={16} className="nav-subglyph" />
                  <span>全部课程</span>
                </NavLink>
              </li>
            </ul>
          )}
        </div>

        <ul className="nav-list">
          <li>
            <NavLink to="/sql-space" className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}>
              <Icon name="sql" size={20} className="nav-glyph" />
              <span className="nav-label">模拟台</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/simulator" className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}>
              <Icon name="routing" size={20} className="nav-glyph" />
              <span className="nav-label">工厂模拟</span>
            </NavLink>
          </li>
        </ul>

        <div className="sidebar-foot">
          <SidebarProgress />
          <div className="sidebar-links">
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-subitem is-active' : 'nav-subitem')}>
              <Icon name="user" size={16} className="nav-subglyph" />
              <span>个人中心</span>
            </NavLink>
            <AuthFooterLink />
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn only-desktop"
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            onClick={toggleCollapsed}
          >
            <Icon name={collapsed ? 'sidebar-open' : 'sidebar-close'} size={20} />
          </button>
          <Breadcrumb />
          <div className="topbar-right">
            <HealthPill />
          </div>
        </header>

        <main id="main" className="content">
          {children}
        </main>
      </div>

      {/* 移动端底部 Tab（框架范式，≤768px 显示） */}
      <nav className="mobile-tabbar only-mobile" aria-label="主导航">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'tab-item is-active' : 'tab-item')}
          >
            <Icon name={item.icon} size={20} className="tab-glyph" />
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
