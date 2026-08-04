import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CrumbProvider } from './components/Breadcrumb';
import { RequireAuth } from './components/AuthGuard';
import HomePage from './pages/HomePage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import ChapterPage from './pages/ChapterPage';
import LearningPathsPage from './pages/LearningPathsPage';
import RoadmapPage from './pages/RoadmapPage';
import TrackDetailPage from './pages/TrackDetailPage';
import SqlSpacePage from './pages/SqlSpacePage';
import ExercisePage from './pages/ExercisePage';
import SimulatorPage from './pages/SimulatorPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import EnginePage from './pages/EnginePage';
import DictionaryPage from './pages/DictionaryPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <CrumbProvider>
      <Routes>
        {/* 登录页不需要壳，也不需要登录态 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 所有其他页面：需要登录 + AppShell */}
        <Route
          path="*"
          element={
            <RequireAuth>
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/courses/:topicId" element={<CourseDetailPage />} />
                  <Route path="/chapters/:chapterId" element={<ChapterPage />} />
                  <Route path="/learning-paths" element={<LearningPathsPage />} />
                  <Route path="/roadmap" element={<RoadmapPage />} />
                  <Route path="/tracks/:slug" element={<TrackDetailPage />} />
                  <Route path="/sql-space" element={<SqlSpacePage />} />
                  <Route path="/sql-space/:exerciseId" element={<ExercisePage />} />
                  <Route path="/simulator" element={<SimulatorPage />} />
                  <Route path="/quiz" element={<QuizPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/engine" element={<EnginePage />} />
                  <Route path="/dictionary" element={<DictionaryPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
    </CrumbProvider>
  );
}
