/**
 * App Shell v4 — 智造学院风格重设计。
 * 白侧栏 + 分组标签 + 更新圆点 + 用户卡片 + 玻璃顶栏搜索/通知/头像。
 */
import { useCallback, useEffect, useState, useMemo } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon, type IconName } from './Icon';
import { Breadcrumb } from './Breadcrumb';
import { api } from '../api/endpoints';
import { ScrollProgress } from './ScrollProgress';
import { getNickname } from './GreetingBar';

const COLLAPSE_KEY = 'mes.sidebar_collapsed';

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

function SidebarProgress() {
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, staleTime: 60_000 });
  const chapterQs = useQueries({
    queries: (topicsQ.data ?? []).map((t) => ({
      queryKey: ['chapters', t.id],
      queryFn: () => api.chapters(t.id),
      staleTime: 5 * 60_000,
    })),
  });
  const { doneChapters, totalChapters, pct } = useMemo(() => {
    const completedSet = new Set((progressQ.data?.completedChapterIds ?? []).map(String));
    const total = chapterQs.reduce((sum, q) => sum + (q.data?.length ?? 0), 0);
    const done = completedSet.size;
    return { doneChapters: done, totalChapters: total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
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
      <div className="sidebar-progress-meta">已读 {doneChapters} / {totalChapters} 章</div>
      <Link className="sidebar-progress-cta" to="/courses">
        继续学习 <Icon name="run" size={16} />
      </Link>
    </div>
  );
}

function HealthPill() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 60_000, retry: 1 });
  if (health.isLoading) return <span className="pill pill-idle"><Icon name="loading" size={16} className="spin" /> 连接中</span>;
  if (health.isError || !health.data) return <span className="pill pill-danger"><Icon name="error" size={16} /> API 不可用</span>;
  const degraded = health.data.degrade && health.data.degrade !== 'L0';
  return (
    <span className={degraded ? 'pill pill-warn' : 'pill pill-ok'}>
      <Icon name={degraded ? 'warn' : 'success'} size={16} />
      {degraded ? `服务降级 ${health.data.degrade}` : 'API 正常'}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nickname = getNickname();
  const userInitial = nickname ? nickname.charAt(0) : '学';

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <ScrollProgress />
      <a className="skip-link" href="#main">跳到主内容</a>

      {/* 移动端遮罩 */}
      <div className={`drawer-scrim${mobileOpen ? ' show' : ''}`} aria-hidden="true" onClick={closeMobile} />

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`sidebar${mobileOpen ? ' open' : ''}`} aria-label="主导航">
        {/* Logo */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <Icon name="workshop" size={20} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">MES 实训平台</span>
            <span className="sidebar-brand-sub">Manufacturing Academy</span>
          </div>
        </div>

        {/* 导航滚动区 */}
        <div className="sidebar-nav">
          <div className="nav-section-label">学习</div>
          <ul className="nav-list">
            <li>
              <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="dashboard" size={20} className="nav-glyph" />
                <span className="nav-label">首页</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/engine" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="courses" size={20} className="nav-glyph" />
                <span className="nav-label">学习中心</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/courses" end className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="chapter" size={20} className="nav-glyph" />
                <span className="nav-label">课程体系</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/learning-paths" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="paths" size={20} className="nav-glyph" />
                <span className="nav-label">学习路径</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-section-label">工具</div>
          <ul className="nav-list">
            <li>
              <NavLink to="/sql-space" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="sql" size={20} className="nav-glyph" />
                <span className="nav-label">SQL 沙盒</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/simulator" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="routing" size={20} className="nav-glyph" />
                <span className="nav-label">工厂仿真</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/dictionary" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="dictionary" size={20} className="nav-glyph" />
                <span className="nav-label">英文词典</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-section-label">成长</div>
          <ul className="nav-list">
            <li>
              <NavLink to="/roadmap" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                <Icon name="stage" size={20} className="nav-glyph" />
                <span className="nav-label">职业路径</span>
              </NavLink>
            </li>
          </ul>
        </div>

        {/* 底部：用户 + 进度 */}
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <Link to="/profile" className="sidebar-user-avatar" aria-label="个人中心">
              <span>{userInitial}</span>
            </Link>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{nickname || '学习者'}</span>
              <span className="sidebar-user-role">MES 学员</span>
            </div>
            <Link to="/profile" className="icon-btn" aria-label="设置">
              <Icon name="admin" size={16} />
            </Link>
          </div>
          <SidebarProgress />
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="shell-main">
        {/* TOPBAR */}
        <header className="topbar">
          <button type="button" className="icon-btn only-mobile" aria-label="菜单" onClick={() => setMobileOpen(true)}>
            <Icon name="menu" size={20} />
          </button>

          <button type="button" className="icon-btn only-desktop" aria-label={collapsed ? '展开侧栏' : '收起侧栏'} onClick={toggleCollapsed}>
            <Icon name={collapsed ? 'sidebar-open' : 'sidebar-close'} size={20} />
          </button>

          <Breadcrumb />

          {/* 搜索框 */}
          <div className="topbar-search">
            <div className="topbar-search-wrap">
              <span className="topbar-search-icon"><Icon name="search" size={16} /></span>
              <input type="text" placeholder="搜索课程、章节…" />
            </div>
          </div>

          <div className="topbar-right">
            {/* 通知铃铛 */}
            <button className="topbar-notify" aria-label="通知">
              <Icon name="warn" size={20} />
              <span className="topbar-notify-dot" />
            </button>

            {/* 头像 */}
            <Link to="/profile" className="topbar-avatar" aria-label="个人中心">
              <span>{userInitial}</span>
            </Link>

            <HealthPill />
          </div>
        </header>

        <main id="main" className="content">
          {children}
        </main>
      </div>

      {/* ═══ MOBILE TAB BAR ═══ */}
      <nav className="mobile-tabbar only-mobile" aria-label="主导航">
        {[
          { to: '/', label: '首页', icon: 'dashboard' as IconName, end: true },
          { to: '/engine', label: '学习', icon: 'courses' as IconName },
          { to: '/sql-space', label: 'SQL', icon: 'sql' as IconName },
          { to: '/simulator', label: '工厂', icon: 'routing' as IconName },
          { to: '/profile', label: '我的', icon: 'user' as IconName },
        ].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `tab-item${isActive ? ' is-active' : ''}`}>
            <Icon name={item.icon} size={20} />
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
