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
import QuizPage from './pages/QuizPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <CrumbProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* 课程 → 章节列表 → 章节正文（F2 主链路） */}
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:topicId" element={<CourseDetailPage />} />
          <Route path="/chapters/:chapterId" element={<ChapterPage />} />

          <Route path="/learning-paths" element={<LearningPathsPage />} />

          {/* SQL 工作台：自由练习 + 单题判题（F3） */}
          <Route path="/sql-space" element={<SqlSpacePage />} />
          <Route path="/sql-space/:exerciseId" element={<ExercisePage />} />

          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* 兜底 404：SPA 深链拼错时不能白屏 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </CrumbProvider>
  );
}
