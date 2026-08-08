import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CrumbProvider } from './components/Breadcrumb';
import { RequireAuth } from './components/AuthGuard';
import { LoadingState } from './components/StateBlock';
import CoursesPage from './pages/CoursesPage';
import FactoryPage from './pages/FactoryPage';
import LoginPage from './pages/LoginPage';

// 路由级代码分割（优化：首屏只加载 Login/Factory，其余页面按需拆成独立 chunk，
// 降低主包体积、加快首屏）。sql.js 本身由 /vendor/sql-wasm.js 运行时加载，不在主包内。
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const ChapterPage = lazy(() => import('./pages/ChapterPage'));
const TrackDetailPage = lazy(() => import('./pages/TrackDetailPage'));
const SqlSpacePage = lazy(() => import('./pages/SqlSpacePage'));
const ExercisePage = lazy(() => import('./pages/ExercisePage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const QuizQuestionPage = lazy(() => import('./pages/QuizQuestionPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const DictionaryPage = lazy(() => import('./pages/DictionaryPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <CrumbProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="*" element={
          <RequireAuth>
            <AppShell>
              <Suspense fallback={<LoadingState label="加载页面…" />}>
                <Routes>
                  {/* 融合重构：单一「工厂」主壳。旧入口重定向兼容 */}
                  <Route path="/" element={<Navigate to="/factory" replace />} />
                  <Route path="/factory" element={<FactoryPage />} />
                  <Route path="/engine" element={<Navigate to="/factory" replace />} />
                  <Route path="/roadmap" element={<Navigate to="/factory?view=career" replace />} />
                  <Route path="/learning-paths" element={<Navigate to="/factory?view=paths" replace />} />
                  <Route path="/simulator" element={<Navigate to="/factory?mode=build" replace />} />
                  <Route path="/tracks/:slug" element={<TrackDetailPage />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/courses/:topicId" element={<CourseDetailPage />} />
                  <Route path="/chapters/:chapterId" element={<ChapterPage />} />
                  <Route path="/sql-space" element={<SqlSpacePage />} />
                  <Route path="/sql-space/:exerciseId" element={<ExercisePage />} />
                  <Route path="/quiz" element={<QuizPage />} />
                  <Route path="/quiz/q/:questionId" element={<QuizQuestionPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/dictionary" element={<DictionaryPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AppShell>
          </RequireAuth>
        } />
      </Routes>
    </CrumbProvider>
  );
}
