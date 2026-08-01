import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CrumbProvider } from './components/Breadcrumb';
import HomePage from './pages/HomePage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import ChapterPage from './pages/ChapterPage';
import LearningPathsPage from './pages/LearningPathsPage';
import SqlSpacePage from './pages/SqlSpacePage';
import ExercisePage from './pages/ExercisePage';
import SimulatorPage from './pages/SimulatorPage';
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <CrumbProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* 学习中心：课程 → 章节列表 → 章节正文 */}
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:topicId" element={<CourseDetailPage />} />
          <Route path="/chapters/:chapterId" element={<ChapterPage />} />

          {/* 学习路径（导航合并到学习中心，路由保留） */}
          <Route path="/learning-paths" element={<LearningPathsPage />} />

          {/* 模拟台：SQL 工作台 */}
          <Route path="/sql-space" element={<SqlSpacePage />} />
          <Route path="/sql-space/:exerciseId" element={<ExercisePage />} />

          {/* 工厂模拟：工艺路线搭建器（占位） */}
          <Route path="/simulator" element={<SimulatorPage />} />

          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* 兜底 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </CrumbProvider>
  );
}
