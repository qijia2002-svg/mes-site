/**
 * App Shell：Sidebar 240 + Topbar 52 + 面包屑（Spec §7）。
 * 这是杠杆最高的一层——一改全站变样，页面只管内容区。
 */
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from './Icon';
import { Breadcrumb } from './Breadcrumb';
import { api } from '../api/endpoints';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

// 主导航 4 项 + 底部 1 项 = 5 项上限（Spec §7）。后台不进导航，登录成功后直达。
const PRIMARY_NAV: NavEntry[] = [
  { to: '/', label: '工作台', icon: 'dashboard', end: true },
  { to: '/courses', label: '课程', icon: 'courses' },
  { to: '/learning-paths', label: '学习路径', icon: 'paths' },
  { to: '/sql-space', label: 'SQL 工作台', icon: 'sql' },
];
const FOOTER_NAV: NavEntry[] = [{ to: '/login', label: '登录', icon: 'login' }];

const COLLAPSE_KEY = 'mes.sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
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

function NavList({ items, onNavigate }: { items: NavEntry[]; onNavigate: () => void }) {
  return (
    <ul className="nav-list">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  // 路由变化关抽屉，否则移动端点完导航抽屉赖着不走。
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      <a className="skip-link" href="#main">
        跳到主内容
      </a>

      <aside className="sidebar" aria-label="主导航">
        <div className="sidebar-brand">
          <Icon name="workshop" size={20} className="brand-glyph" />
          <span className="brand-text">MES 实训平台</span>
        </div>
        <NavList items={PRIMARY_NAV} onNavigate={closeDrawer} />
        <div className="sidebar-foot">
          <NavList items={FOOTER_NAV} onNavigate={closeDrawer} />
        </div>
      </aside>

      <button
        type="button"
        className="drawer-scrim"
        aria-label="关闭导航"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={closeDrawer}
      />

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn only-mobile"
            aria-label="打开导航"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" size={20} />
          </button>
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
    </div>
  );
}
