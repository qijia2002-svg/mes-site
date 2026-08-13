/**
 * App Shell — 左侧常驻导航（5 个一级 tab），移动端切换为底部 tabbar。
 * 桌面端导航：工厂 / 知识图 / 课程 / 工具 / 我的。
 * 移动端底栏收为 3 项（工厂 / 知识图 / 课程）：「我的」走顶栏头像、
 * 「工具」含的模拟器与 SQL 沙盒在 /factory 页脚可达，故均不在底栏占位置。
 * 「词典」入口已于导航移除（直接 URL /dictionary 仍可访问）。
 */
import { useSyncExternalStore } from 'react';
import { NavLink, Link, useLocation, type To } from 'react-router-dom';
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

type NavDef = { to: To; label: string; icon: IconName; match?: (p: string) => boolean; hideOnMobile?: boolean };

// 一级 tab。工具含子页（/sql-space、/simulator），用 match 让子页也高亮「工具」。
// 模拟器归到「工具」枢纽（与 SQL 沙盒并列），不再单独占一级 tab，避免入口重复。
// 「我的」在移动端顶栏已有头像入口，故移动端底栏隐藏，避免项过挤。
const NAV: NavDef[] = [
  { to: '/factory', label: '工厂', icon: 'factory' },
  { to: '/knowledge-graph', label: '知识图', icon: 'network' },
  { to: '/courses', label: '课程', icon: 'courses' },
  {
    to: '/tools',
    label: '工具',
    icon: 'tools',
    // 移动端底栏现为 3 个主入口（工厂/知识图/课程）；工具含的模拟器与 SQL 沙盒
    // 在 /factory 页脚（FactoryExtras）均可达，故移动端底栏收起，避免项过挤。
    hideOnMobile: true,
    match: (p) => p.startsWith('/tools') || p.startsWith('/sql-space'),
  },
  { to: '/profile', label: '我的', icon: 'user', hideOnMobile: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  // 订阅资料变更：设置页保存昵称后，侧栏头像 / 名称即时刷新，无需刷新页面。
  const nickname = useSyncExternalStore(subscribeProfile, getNickname, getNickname);
  const userInitial = nickname ? nickname.charAt(0) : '学';
  const loc = useLocation();

  const isActive = (item: NavDef, navActive: boolean) =>
    navActive || (item.match ? item.match(loc.pathname) : false);

  return (
    <div className="shell">
      <ScrollProgress />
      <NetworkBanner />
      <a className="skip-link" href="#main">跳到主内容</a>

      {/* ═══ SIDEBAR（左侧常驻导航）═══ */}
      <aside className="sidebar" aria-label="主导航">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <img src="/favicon.svg" alt="工厂与 MES 入门" width={20} height={20} className="brand-logo-img" />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">工厂与 MES 入门</span>
            <span className="sidebar-brand-sub">从零看懂工厂</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          <ul className="nav-list">
            {NAV.map((item) => (
              <li key={String(item.to)}>
                <NavLink
                  to={item.to}
                  className={({ isActive: navActive }) =>
                    `nav-item${isActive(item, navActive) ? ' is-active' : ''}`
                  }
                >
                  <Icon name={item.icon} size={20} className="nav-glyph" />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

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

      {/* ═══ MAIN（桌面端在侧栏右侧，移动端全宽）═══ */}
      <div className="shell-main">
        <header className="topbar">
          <Breadcrumb />
          <TopbarSearch />
          <div className="topbar-right">
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

      {/* ═══ MOBILE TAB BAR（与左侧 5 tab 一致）═══ */}
      <nav className="mobile-tabbar only-mobile" aria-label="主导航">
        {NAV.filter((item) => !item.hideOnMobile).map((item) => (
          <NavLink
            key={String(item.to)}
            to={item.to}
            className={({ isActive: navActive }) =>
              `tab-item${isActive(item, navActive) ? ' is-active' : ''}`
            }
          >
            <Icon name={item.icon} size={20} />
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
