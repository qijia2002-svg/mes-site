/**
 * 工厂模拟·工艺路线搭建器。
 * 深色画布驾驶舱风格，零新增运行时依赖。
 * 按 ADR-010 走 React.lazy 路由级懒加载。
 */
import { Suspense, lazy } from 'react';
import { LoadingState } from '../components/StateBlock';

const Sim = lazy(() => import('../features/simulator/SimulatorPage'));

export default function SimulatorPage() {
  return (
    <Suspense fallback={<LoadingState label="加载模拟台…" />}>
      <Sim />
    </Suspense>
  );
}
