import { NavLink, Routes, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type Health } from './api/endpoints';
import HomePage from './pages/HomePage';
import SqlSpacePage from './pages/SqlSpacePage';
import CoursesPage from './pages/CoursesPage';
import LearningPathsPage from './pages/LearningPathsPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';

const navItems = [
  { to: '/', label: '首页' },
  { to: '/sql-space', label: 'SQL 沙箱' },
  { to: '/courses', label: '课程' },
  { to: '/learning-paths', label: '学习路径' },
  { to: '/quiz', label: '题库' },
  { to: '/admin', label: '后台' },
  { to: '/login', label: '登录' },
];

export default function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">MES 实训平台</div>
        <nav className="nav">
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className={`health-pill ${health.data?.status === 'ok' ? 'ok' : ''}`}>
          {health.isLoading
            ? '连接中…'
            : health.data
              ? `API 正常 · 降级 ${health.data.degrade}`
              : 'API 不可用'}
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sql-space" element={<SqlSpacePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/learning-paths" element={<LearningPathsPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>

      <footer className="footer">
        Phase 0+ · Cloudflare Workers + D1 + DO · 浏览器端 sql.js 沙箱
      </footer>
    </div>
  );
}
