/**
 * 工具枢纽页 — 左侧「工具」一级 tab 的落地页。
 * 内含两个动手练习入口：SQL 沙盒（/sql-space）与 工厂模拟器（/simulator）。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

type ToolEntry = {
  to: string;
  icon: 'sql' | 'gauge';
  title: string;
  desc: string;
};

const TOOLS: ToolEntry[] = [
  {
    to: '/sql-space',
    icon: 'sql',
    title: 'SQL 沙盒',
    desc: '对着真实样例库写 SQL，即时看结果、对照参考解答、出错自动给出修改建议。',
  },
  {
    to: '/simulator',
    icon: 'gauge',
    title: '工厂模拟器',
    desc: '当一天厂长：看着下料→机加工→组装→检验四道工序，调一调机器和订单，整条线怎么转一目了然。',
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-hub">
      <header className="page-head">
        <div>
          <h1>工具</h1>
          <p className="page-sub">动手练习区：在 SQL 沙盒里跑通查询，用工厂模拟器调一调产线怎么转。</p>
        </div>
      </header>

      <div className="card-grid tools-grid">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="tools-card">
            <span className="tools-card-icon">
              <Icon name={t.icon} size={24} />
            </span>
            <span className="tools-card-title">{t.title}</span>
            <span className="tools-card-desc">{t.desc}</span>
            <span className="tools-card-go">
              进入 <Icon name="arrow-right" size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
