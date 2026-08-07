import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CrumbProvider } from './components/Breadcrumb';
import { RequireAuth } from './components/AuthGuard';
import { LoadingState } from './components/StateBlock';
import CoursesPage from './pages/CoursesPage';
import EnginePage from './pages/EnginePage';
import LoginPage from './pages/LoginPage';

// 路由级代码分割（优化：首屏只加载 Login/Engine，其余页面按需拆成独立 chunk，
// 降低主包体积、加快首屏）。sql.js 本身由 /vendor/sql-wasm.js 运行时加载，不在主包内。
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const ChapterPage = lazy(() => import('./pages/ChapterPage'));
const LearningPathsPage = lazy(() => import('./pages/LearningPathsPage'));
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'));
const TrackDetailPage = lazy(() => import('./pages/TrackDetailPage'));
const SqlSpacePage = lazy(() => import('./pages/SqlSpacePage'));
const ExercisePage = lazy(() => import('./pages/ExercisePage'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
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
                  {/* ADR-013: / 和 /roadmap 重定向到学习中心，四视图融合 */}
                  <Route path="/" element={<Navigate to="/engine?tab=factory" replace />} />
                  <Route path="/roadmap" element={<Navigate to="/engine?tab=career" replace />} />
                  <Route path="/tracks/:slug" element={<TrackDetailPage />} />
                  <Route path="/engine" element={<EnginePage />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/courses/:topicId" element={<CourseDetailPage />} />
                  <Route path="/chapters/:chapterId" element={<ChapterPage />} />
                  <Route path="/learning-paths" element={<LearningPathsPage />} />
                  <Route path="/sql-space" element={<SqlSpacePage />} />
                  <Route path="/sql-space/:exerciseId" element={<ExercisePage />} />
                  <Route path="/simulator" element={<SimulatorPage />} />
                  <Route path="/quiz" element={<QuizPage />} />
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
