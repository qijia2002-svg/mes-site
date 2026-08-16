/**
 * 练习枢纽页 — 左侧「练习」一级区（原「工具」）的落地页。
 * 内含三个动手/自测入口：SQL 沙盒（/sql-space）、测验（/quiz）、词典（/dictionary）。
 * 工厂模拟器已归「工厂」分组（/simulator），不再出现在这里，避免入口重复。
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';

type ToolEntry = {
  to: string;
  icon: IconName;
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
    to: '/quiz',
    icon: 'quiz',
    title: '测验',
    desc: '学完即测：选择题与判断题即时判分，巩固 MES / ERP 关键概念。',
  },
  {
    to: '/dictionary',
    icon: 'dictionary',
    title: '词典',
    desc: 'MES / ERP 术语速查，点词即看释义与关联概念，配合 AI 导师随时追问。',
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-hub">
      <header className="page-head">
        <div>
          <h1>练习</h1>
          <p className="page-sub">动手练习区：在 SQL 沙盒里跑通查询，用测验检验掌握度，遇术语随时查词典。</p>
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
