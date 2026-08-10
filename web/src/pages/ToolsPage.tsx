/**
 * 工具枢纽页 — 左侧「工具」一级 tab 的落地页。
 * 内含两个动手练习入口：SQL 沙盒（/sql-space）与 工厂搭建（/simulator）。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

type ToolEntry = {
  to: string;
  icon: 'sql' | 'routing';
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
    icon: 'routing',
    title: '工厂搭建',
    desc: '把原料、工位、工序连成一条产线，看工单如何在各道工序之间流动。',
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-hub">
      <header className="page-head">
        <div>
          <h1>工具</h1>
          <p className="page-sub">动手练习区：在 SQL 沙盒里跑通查询，用工厂搭建模拟产线运转。</p>
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
