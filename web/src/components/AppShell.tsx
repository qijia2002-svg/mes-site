/**
 * App Shell v5 — 智造学院风格重设计。
 * 白侧栏改为「右上角浮动按钮 + 左侧滑出抽屉」，默认不占横向空间，内容全宽。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from './Icon';
import { Breadcrumb } from './Breadcrumb';
import { NetworkBanner } from './NetworkBanner';
import { api } from '../api/endpoints';
import { ScrollProgress } from './ScrollProgress';
import { getNickname, subscribeProfile } from '../lib/profileStore';
import { useFactorySummary } from '../features/factory/useFactorySummary';
import { TopbarSearch } from './TopbarSearch';

function SidebarProgress() {
  const { total, touched, pct } = useFactorySummary();

  return (
    <div className="sidebar-progress">
      <div className="sidebar-progress-head">
        <span className="sidebar-progress-label">工厂进度</span>
        <span className="sidebar-progress-pct">{pct}%</span>
      </div>
      <div className="sidebar-progress-track">
        <div className="sidebar-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sidebar-progress-meta">走过 {touched} / {total} 个环节</div>
      <Link className="sidebar-progress-cta" to="/factory">
        进入工厂全景 <Icon name="arrow-right" size={16} />
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
  const [navOpen, setNavOpen] = useState(false);
  // 订阅资料变更：设置页保存昵称后，侧栏头像 / 名称即时刷新，无需刷新页面。
  const nickname = useSyncExternalStore(subscribeProfile, getNickname, getNickname);
  const userInitial = nickname ? nickname.charAt(0) : '学';
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (navOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  return (
    <div className="shell">
      <ScrollProgress />
      <NetworkBanner />
      <a className="skip-link" href="#main">跳到主内容</a>

      {/* 抽屉遮罩 */}
      <div className={`drawer-scrim${navOpen ? ' show' : ''}`} aria-hidden="true" onClick={closeNav} />

      {/* ═══ SIDEBAR（左侧滑出抽屉）═══ */}
      <aside className={`sidebar${navOpen ? ' open' : ''}`} aria-label="主导航" aria-hidden={!navOpen}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <Icon name="workshop" size={20} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">MES 实训平台</span>
            <span className="sidebar-brand-sub">Manufacturing Academy</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <ul className="nav-list">
            <li>
              <NavLink to="/factory" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeNav}>
                <Icon name="factory" size={20} className="nav-glyph" />
                <span className="nav-label">工厂</span>
              </NavLink>
            </li>
          </ul>

          <div className="nav-section-label">工具</div>
          <ul className="nav-list">
            <li>
              <NavLink to="/sql-space" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeNav}>
                <Icon name="sql" size={20} className="nav-glyph" />
                <span className="nav-label">SQL 沙盒</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/simulator" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeNav}>
                <Icon name="routing" size={20} className="nav-glyph" />
                <span className="nav-label">工厂搭建</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/portfolio" className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} onClick={closeNav}>
                <Icon name="portfolio" size={20} className="nav-glyph" />
                <span className="nav-label">作品集</span>
              </NavLink>
            </li>
          </ul>
        </div>

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

      {/* ═══ MAIN（全宽）═══ */}
      <div className="shell-main">
        <header className="topbar">
          <Breadcrumb />

          <TopbarSearch />

          <div className="topbar-right">
            <Link to="/profile" className="topbar-avatar" aria-label="个人中心">
              <span>{userInitial}</span>
            </Link>

            <HealthPill />

            {/* 右上角：侧边栏开关（默认收起，点开为左侧抽屉） */}
            <button type="button" className="sidebar-toggle" aria-label="打开导航菜单" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
              <Icon name="menu" size={20} />
              <span className="sidebar-toggle-label">菜单</span>
            </button>
          </div>
        </header>

        <main id="main" className="content">
          {children}
        </main>
      </div>

      {/* ═══ MOBILE TAB BAR ═══ */}
      <nav className="mobile-tabbar only-mobile" aria-label="主导航">
        {[
          { to: '/factory', label: '工厂', icon: 'factory' as IconName },
          { to: '/simulator', label: '搭建', icon: 'routing' as IconName },
          { to: '/sql-space', label: 'SQL', icon: 'sql' as IconName },
          { to: '/profile', label: '我的', icon: 'user' as IconName },
        ].map((item) => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => `tab-item${isActive ? ' is-active' : ''}`}>
            <Icon name={item.icon} size={20} />
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
