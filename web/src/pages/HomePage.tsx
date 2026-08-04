/**
 * 首页（精简版，用户明确需求）：只保留「问候 + 进度表 + 学习情况分析」。
 * 移除课程网格 / 继续学习 Hero 等冗余内容。进度与学习分析全部由
 * ProgressDashboard 复用既有接口渲染，无新增后端端点。
 */
import { GreetingBar } from '../components/GreetingBar';
import ProgressDashboard from '../components/ProgressDashboard';
import HomeLearningPaths from '../components/HomeLearningPaths';
import HomeStudyInfo from '../components/HomeStudyInfo';

export default function HomePage() {
  return (
    <section className="dash-page">
      <GreetingBar />
      <HomeStudyInfo />
      <ProgressDashboard />
      <HomeLearningPaths />
    </section>
  );
}
