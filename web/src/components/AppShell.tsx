/**
 * App Shell — 左侧常驻分组导航（4 个一级区，按学习意图分组，桌面端子页平铺），移动端切换为底部 4 tab。
 * 导航按「学习意图」分组：
 *   看 · 工厂（全景 / 模拟器 / 订单到交付）· 学 · 课程（课程 / 学习路径 / 岗位路线）
 *   练 · 练习（SQL 沙盒 / 测验 / 词典 / 练习中心）· 我的（个人中心 / 作品集）
 * 学习主线（Spine）常驻首页英雄区下方，不占一级导航。知识图已降级为页内/搜索可达，不在主导航。
 * 移动端底栏只显示 4 个一级区，子页在各落地页内进入；桌面端侧栏直接平铺子页，一屏可达。
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
import { TopbarSearch } from './TopbarSearch';
import { TutorFab } from '../features/tutor/TutorFab';
import { TutorWorkspace } from '../features/tutor/TutorWorkspace';

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

type NavChild = { to: To; label: string; icon: IconName };
type NavDef = {
  to: To;
  label: string;
  icon: IconName;
  /** 子页：桌面侧栏平铺，移动端由各落地页进入。 */
  children?: NavChild[];
  /** 命中任一子路由时，该一级区高亮。 */
  match?: (p: string) => boolean;
};

// 导航按学习意图重组（UX 重梳 Phase D）：看·工厂 / 学·课程 / 练·练习 / 我的。
// 学习主线（Spine）已移至首页英雄区下方常驻，不单独占一级导航。
// 模拟器/订单到交付归「看·工厂」（本质是工厂下钻）；SQL 沙盒/测验/词典归「练·练习」，练习中心 /practice 为枢纽落地页。
const NAV: NavDef[] = [
  {
    to: '/factory',
    label: '看 · 工厂',
    icon: 'factory',
    match: (p) => p === '/factory' || p.startsWith('/simulator') || p.startsWith('/order-to-delivery'),
    children: [
      { to: '/simulator', label: '模拟器', icon: 'gauge' },
      { to: '/order-to-delivery', label: '订单到交付', icon: 'truck' },
    ],
  },
  {
    to: '/courses',
    label: '学 · 课程',
    icon: 'courses',
    match: (p) =>
      p.startsWith('/courses') || p.startsWith('/learning-paths') || p.startsWith('/roadmap') || p.startsWith('/tracks'),
    children: [
      { to: '/learning-paths', label: '学习路径', icon: 'paths' },
      { to: '/roadmap', label: '岗位路线', icon: 'stage' },
    ],
  },
  {
    to: '/practice',
    label: '练 · 练习',
    icon: 'tools',
    match: (p) => p.startsWith('/practice') || p.startsWith('/sql-space') || p.startsWith('/quiz') || p.startsWith('/dictionary'),
    children: [
      { to: '/sql-space', label: 'SQL 沙盒', icon: 'sql' },
      { to: '/quiz', label: '测验', icon: 'quiz' },
      { to: '/dictionary', label: '词典', icon: 'dictionary' },
    ],
  },
  {
    to: '/profile',
    label: '我的',
    icon: 'user',
    match: (p) => p.startsWith('/profile') || p.startsWith('/portfolio'),
    children: [{ to: '/portfolio', label: '作品集', icon: 'portfolio' }],
  },
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
          {NAV.map((section) => (
            <div className="nav-group" key={String(section.to)}>
              <NavLink
                to={section.to}
                className={({ isActive: navActive }) =>
                  `nav-item${isActive(section, navActive) ? ' is-active' : ''}`
                }
              >
                <Icon name={section.icon} size={20} className="nav-glyph" />
                <span className="nav-label">{section.label}</span>
              </NavLink>
              {section.children && (
                <ul className="nav-sublist">
                  {section.children.map((c) => {
                    const childActive =
                      loc.pathname === String(c.to) || loc.pathname.startsWith(`${String(c.to)}/`);
                    return (
                      <li key={String(c.to)}>
                        <NavLink to={c.to} className={`nav-subitem${childActive ? ' is-active' : ''}`}>
                          <Icon name={c.icon} size={16} className="nav-subglyph" />
                          <span>{c.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
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
        {NAV.map((item) => (
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

      {/* ═══ AI 课程导师 · 移动端浮动入口 + 桌面端常驻工作台 ═══ */}
      <TutorFab />
      <TutorWorkspace />
    </div>
  );
}
