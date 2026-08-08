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
// v13 拆壳：搭建器恢复独立路由，课程/路径/职业各自成页，/factory 只画工厂全景。
const SimulatorPage = lazy(() => import('./features/simulator/SimulatorPage'));
const LearningPathsPage = lazy(() => import('./pages/LearningPathsPage'));
const CareerPage = lazy(() => import('./pages/CareerPage'));

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
                  {/* /factory 只干一件事：工厂全景。其余各自独立成页，不再塞进双层 Tab */}
                  <Route path="/" element={<Navigate to="/factory" replace />} />
                  <Route path="/factory" element={<FactoryPage />} />
                  <Route path="/engine" element={<Navigate to="/factory" replace />} />
                  <Route path="/simulator" element={<SimulatorPage />} />
                  <Route path="/learning-paths" element={<LearningPathsPage />} />
                  <Route path="/roadmap" element={<CareerPage />} />
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
