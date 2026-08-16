/**
 * 练习中心 — UX 重梳 Phase C 落地：把"做练习"的 4 处冗余入口合并为单一枢纽。
 * 子标签：章节测验 / 模块考试 / SQL 沙盒 / 测验 / 词典 / 错题本。
 *   - 章节测验 / 模块考试：在课程章节内联完成（体验好，保留），此处说明入口并链到课程；
 *   - SQL 沙盒 / 测验 / 词典：直达既有子页；
 *   - 错题本：当前前端无 wrong_questions 同步接口，如实展示空态，不做假数据。
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { usePracticeSummary } from '../lib/practiceStore';

type TabKey = 'chapter' | 'module' | 'sql' | 'quiz' | 'dict' | 'wrong';

const TABS: { key: TabKey; icon: IconName; label: string }[] = [
  { key: 'chapter', icon: 'chapter', label: '章节测验' },
  { key: 'module', icon: 'report', label: '模块考试' },
  { key: 'sql', icon: 'sql', label: 'SQL 沙盒' },
  { key: 'quiz', icon: 'quiz', label: '测验' },
  { key: 'dict', icon: 'dictionary', label: '词典' },
  { key: 'wrong', icon: 'history', label: '错题本' },
];

const SUBPAGE: Record<'sql' | 'quiz' | 'dict', { to: string; icon: IconName; title: string; desc: string }> = {
  sql: {
    to: '/sql-space',
    icon: 'sql',
    title: 'SQL 沙盒',
    desc: '对着真实样例库写 SQL，即时看结果、对照参考解答，出错时自动解析原因并给出修改建议。',
  },
  quiz: {
    to: '/quiz',
    icon: 'quiz',
    title: '测验',
    desc: '学完即测：选择题与判断题即时判分，巩固 MES / ERP 关键概念。',
  },
  dict: {
    to: '/dictionary',
    icon: 'dictionary',
    title: '词典',
    desc: 'MES / ERP 术语速查，点词即看释义与关联概念，配合 AI 导师随时追问。',
  },
};

export default function PracticePage() {
  const [tab, setTab] = useState<TabKey>('chapter');
  const progress = usePracticeSummary();

  return (
    <div className="tools-hub">
      <header className="page-head">
        <div>
          <h1>练习中心</h1>
          <p className="page-sub">
            动手练习都汇到这里：在课程里做章节测验与模块考试，到 SQL 沙盒里跑通查询，用测验检验掌握度，遇术语随时查词典。
          </p>
        </div>
      </header>

      <PracticeSummary progress={progress} />

      <div className="pc-tabs" role="tablist" aria-label="练习类型">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`pc-tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={16} className="pc-tab-ic" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="pc-panel">
        {tab === 'chapter' && (
          <div className="pc-stack">
            <p className="pc-note">
              <Icon name="hint" size={16} className="inline-glyph" />
              章节测验就在你学的<strong>每一章末尾</strong>——读完一章顺手测一下，立刻知道哪里没吃透。
            </p>
            <div className="card-grid tools-grid">
              <Link to="/courses" className="tools-card">
                <span className="tools-card-icon"><Icon name="courses" size={24} /></span>
                <span className="tools-card-title">去课程里做章节测验</span>
                <span className="tools-card-desc">选一门课，进入任意章节，章末即有测验入口。</span>
                <span className="tools-card-go">进入 <Icon name="arrow-right" size={16} /></span>
              </Link>
              <Link to="/learning-paths" className="tools-card">
                <span className="tools-card-icon"><Icon name="paths" size={24} /></span>
                <span className="tools-card-title">按学习路径系统推进</span>
                <span className="tools-card-desc">跟着主线走，章节测验会顺着你的进度自然出现。</span>
                <span className="tools-card-go">进入 <Icon name="arrow-right" size={16} /></span>
              </Link>
            </div>
          </div>
        )}

        {tab === 'module' && (
          <div className="pc-stack">
            <p className="pc-note">
              <Icon name="hint" size={16} className="inline-glyph" />
              模块考试在<strong>每门课结束时</strong>进行，综合检验整门课的掌握情况，通过后可解锁关联岗位路线。
            </p>
            <div className="card-grid tools-grid">
              <Link to="/courses" className="tools-card">
                <span className="tools-card-icon"><Icon name="courses" size={24} /></span>
                <span className="tools-card-title">去课程里做模块考试</span>
                <span className="tools-card-desc">进入一门课，完成后即可参加该课的模块考试。</span>
                <span className="tools-card-go">进入 <Icon name="arrow-right" size={16} /></span>
              </Link>
            </div>
          </div>
        )}

        {tab === 'sql' && <PracticeLink entry={SUBPAGE.sql} />}
        {tab === 'quiz' && <PracticeLink entry={SUBPAGE.quiz} />}
        {tab === 'dict' && <PracticeLink entry={SUBPAGE.dict} />}

        {tab === 'wrong' && (
          <div className="pc-empty">
            <Icon name="empty" size={24} />
            <p className="pc-empty-title">还没有错题记录</p>
            <p className="pc-empty-sub">
              在测验或 SQL 沙盒里答错的题会自动汇集到这里，方便你回头巩固薄弱点。先去上面任意一个练习入口试试看吧。
            </p>
            <Link to="/quiz" className="btn btn-primary"><Icon name="quiz" size={16} /> 去测验</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeLink({ entry }: { entry: { to: string; icon: IconName; title: string; desc: string } }) {
  return (
    <div className="card-grid tools-grid">
      <Link to={entry.to} className="tools-card">
        <span className="tools-card-icon"><Icon name={entry.icon} size={24} /></span>
        <span className="tools-card-title">{entry.title}</span>
        <span className="tools-card-desc">{entry.desc}</span>
        <span className="tools-card-go">进入 <Icon name="arrow-right" size={16} /></span>
      </Link>
    </div>
  );
}

/**
 * 全站练习进度汇总（UX 重梳 Phase C 验收 #3 · 收口 B4）。
 * 数据来自统一的 practiceStore：课程/工厂/随堂/SQL 各处完成都写同一份，这里聚合展示，
 * 不再有 4 套互不通联的入口。零值时不造假，只给一句引导。
 */
function PracticeSummary({ progress }: { progress: ReturnType<typeof usePracticeSummary> }) {
  const tiles: { icon: IconName; label: string; value: string }[] = [
    { icon: 'chapter', label: '章节测验', value: `${progress.chaptersQuiz.length} 章完成` },
    { icon: 'report', label: '模块考试', value: `${progress.modulesQuiz.length} 门通过` },
    { icon: 'workshop', label: '工厂内联自测', value: `${progress.factoryQuiz.length} 个节点` },
    { icon: 'sql', label: 'SQL 沙盒', value: `${progress.sqlPassed.length} 题通过` },
  ];
  const total =
    progress.chaptersQuiz.length +
    progress.modulesQuiz.length +
    progress.factoryQuiz.length +
    progress.sqlPassed.length;

  return (
    <section className="pc-summary" aria-label="全站练习进度汇总">
      <div className="pc-summary-head">
        <Icon name="dashboard" size={16} className="inline-glyph" />
        <span className="caps">我的练习进度</span>
        <span className="row-meta">全站各入口自动汇总</span>
      </div>
      <div className="pc-summary-grid">
        {tiles.map((t) => (
          <div className="pc-stat" key={t.label}>
            <span className="pc-stat-ic"><Icon name={t.icon} size={20} /></span>
            <span className="pc-stat-label">{t.label}</span>
            <span className="pc-stat-value">{t.value}</span>
          </div>
        ))}
      </div>
      {total === 0 && (
        <p className="pc-summary-empty">
          你还没有在任何入口完成练习。在课程章节末尾做测验、去 SQL 沙盒跑通一题，进度都会自动汇集到这里。
        </p>
      )}
    </section>
  );
}
