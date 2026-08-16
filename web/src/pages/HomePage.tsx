/**
 * / —— 真正独立的门户首页（v1）。
 *
 * 之前的「首页」其实是 /factory 直接重定向，平台已有 课程 / 知识图 / 练习 / 模拟器 /
 * 职业路线 等多个板块，却一进来就掉进工厂全景，新用户看不出平台能玩什么。
 * 本页把 / 做成一个轻量门户：欢迎英雄区 + 新手上路三步 + 全站功能导览卡，
 * 让新用户一眼看懂「这个平台有什么、从哪进」。/factory 继续做工厂深钻。
 *
 * 设计纪律：纯 design token；无 emoji 图标（走 Icon 语义名）；无紫粉渐变；
 * 无裸 hex；动效仅 hover + 轻量入场（≤420ms，无弹性缓动）。
 * 页面是「应用」不是「落地页」——节区纵向间距走 48px 档，不堆 80px 巨幅 hero。
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useLearningSpine } from '../lib/learningSpine';
import { NextActionCard } from '../components/NextAction';

type Feature = {
  to: string;
  icon: IconName;
  title: string;
  desc: string;
  featured?: boolean;
};

/* 全站功能导览：和 AppShell 的 5 个一级区 + 招牌子页对齐（避免和侧栏对不上）。 */
const FEATURES: Feature[] = [
  {
    to: '/factory',
    icon: 'factory',
    title: '工厂全景',
    desc: '12 环节系统视角，看清每一步归 MES / ERP / WMS / QMS 哪套系统管。',
    featured: true,
  },
  {
    to: '/simulator',
    icon: 'gauge',
    title: '工厂模拟器',
    desc: '调机器、加班次，看瓶颈怎么卡住整条产线——零基础看动画就懂。',
    featured: true,
  },
  {
    to: '/order-to-delivery',
    icon: 'truck',
    title: '订单到交付',
    desc: '16 步业务单据流，从客户下单到发货出库，每步配什么单据。',
  },
  {
    to: '/courses',
    icon: 'courses',
    title: '课程中心',
    desc: '体系化课程，从零基础到能上手，章节配知识卡与练习。',
  },
  {
    to: '/learning-paths',
    icon: 'paths',
    title: '学习路径',
    desc: '按你的目标，挑一条最合适的进阶路线，少走弯路。',
  },
  {
    to: '/roadmap',
    icon: 'stage',
    title: '岗位路线',
    desc: 'MES 实施 / 二开 / SCADA 的职业能力地图与成长阶段。',
  },
  {
    to: '/tools',
    icon: 'tools',
    title: '动手练习',
    desc: 'SQL 沙盒 + 测验 + 词典，边学边练，学了就能验。',
  },
];

/* 新手上路：三段式入口，指向三个招牌体验。 */
const STEPS: { to: string; icon: IconName; title: string; desc: string }[] = [
  { to: '/order-to-delivery', icon: 'routing', title: '看流程', desc: '先看懂订单到交付怎么走' },
  { to: '/simulator', icon: 'gauge', title: '玩模拟器', desc: '调机器看瓶颈怎么卡住产出' },
  { to: '/courses', icon: 'courses', title: '系统学课程', desc: '按路线从零到上岗' },
];

export default function HomePage() {
  const spine = useLearningSpine();

  return (
    <section className="hp">
      <style>{`
        .hp{max-width:var(--container-app);margin:0 auto;
          padding:var(--space-8) var(--space-6) var(--space-12)}
        @media(max-width:720px){.hp{padding:var(--space-5) var(--space-4) var(--space-10)}}

        /* ── 英雄区 ── */
        .hp-hero{position:relative;overflow:hidden;padding:var(--space-10) var(--space-8);
          background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg)}
        .hp-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
          background:var(--accent)}
        .hp-kicker{display:flex;align-items:center;gap:var(--space-2);margin:0 0 var(--space-3);
          color:var(--meta);font-size:var(--text-sm)}
        .hp-kicker .caps{color:var(--meta)}
        .hp-title{margin:0;font-size:var(--text-3xl);line-height:var(--leading-tight);
          font-weight:var(--weight-announce-cjk);color:var(--brand-ink);
          letter-spacing:var(--tracking-title);max-width:18ch}
        .hp-sub{margin:var(--space-3) 0 0;max-width:56ch;font-size:var(--text-base);
          line-height:var(--leading-body);color:var(--fg-2)}
        .hp-cta{display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-5);flex-wrap:wrap}
        .hp-cta .btn{display:inline-flex;align-items:center;gap:var(--space-2);
          padding:var(--space-3) var(--space-5);font-size:var(--text-sm);font-weight:var(--weight-emph-cjk);
          text-decoration:none;border-radius:var(--radius-md);cursor:pointer;
          transition:background var(--motion-fast) var(--ease-standard),
            border-color var(--motion-fast) var(--ease-standard),
            transform var(--motion-fast) var(--ease-standard)}
        .hp-cta .btn-primary{background:var(--btn-primary-bg);color:var(--btn-primary-fg);border:1px solid transparent}
        .hp-cta .btn-primary:hover{background:var(--btn-primary-bg-hover);transform:translateY(-1px)}
        .hp-cta .btn-secondary{background:var(--btn-secondary-bg);color:var(--btn-secondary-fg);
          border:1px solid var(--btn-secondary-border)}
        .hp-cta .btn-secondary:hover{background:var(--btn-secondary-bg-hover);transform:translateY(-1px)}
        .hp-pills{display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-5)}
        .hp-pill{display:inline-flex;align-items:center;padding:var(--space-1) var(--space-3);
          background:var(--accent-soft);color:var(--accent);border-radius:var(--radius-pill);
          font-size:var(--text-xs);font-weight:var(--weight-emph-cjk)}
        @media(max-width:720px){
          .hp-hero{padding:var(--space-6) var(--space-4)}
          .hp-title{font-size:var(--text-2xl)}
          .hp-cta{flex-direction:column;align-items:stretch}
          .hp-cta .btn{justify-content:center}
        }

        /* ── 新手上路三步 ── */
        .hp-steps{display:flex;align-items:stretch;gap:var(--space-3);margin-top:var(--space-6);
          flex-wrap:wrap}
        .hp-step{flex:1 1 200px;display:flex;align-items:center;gap:var(--space-3);
          padding:var(--space-4);background:var(--surface);border:1px solid var(--border);
          border-radius:var(--radius-md);text-decoration:none;color:var(--fg);
          transition:border-color var(--motion-fast) var(--ease-standard),
            box-shadow var(--motion-fast) var(--ease-standard)}
        .hp-step:hover{border-color:var(--accent-border);box-shadow:var(--elev-card-hover)}
        .hp-step-ic{display:inline-flex;align-items:center;justify-content:center;flex:none;
          width:40px;height:40px;border-radius:var(--radius-md);background:var(--accent-soft);
          color:var(--accent)}
        .hp-step-body{display:flex;flex-direction:column;gap:2px;min-width:0}
        .hp-step-title{font-size:var(--text-base);font-weight:var(--weight-announce-cjk);color:var(--brand-ink)}
        .hp-step-desc{font-size:var(--text-xs);color:var(--muted);line-height:var(--leading-snug)}
        .hp-step-arrow{display:flex;align-items:center;color:var(--border-strong);flex:none}
        @media(max-width:720px){
          .hp-step{flex:1 1 100%}
          .hp-step-arrow{display:none}
        }

        /* ── 功能导览 ── */
        .hp-section{margin-top:var(--space-10)}
        .hp-section-head{margin-bottom:var(--space-5)}
        .hp-section-title{margin:0;font-size:var(--text-xl);font-weight:var(--weight-announce-cjk);
          color:var(--brand-ink);letter-spacing:var(--tracking-title)}
        .hp-section-sub{margin:var(--space-2) 0 0;font-size:var(--text-sm);color:var(--muted)}
        .hp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:var(--space-4)}
        .hp-card{position:relative;display:flex;flex-direction:column;gap:var(--space-2);
          padding:var(--space-5);background:var(--surface);border:1px solid var(--border);
          border-radius:var(--radius-md);text-decoration:none;color:var(--fg);
          transition:border-color var(--motion-fast) var(--ease-standard),
            box-shadow var(--motion-fast) var(--ease-standard),transform var(--motion-fast) var(--ease-standard);
          animation:hp-rise .42s var(--ease-out) both}
        .hp-card:hover{border-color:var(--accent-border);box-shadow:var(--elev-card-hover);transform:translateY(-2px)}
        .hp-card.is-featured{background:var(--accent-soft);border-color:var(--accent-border)}
        .hp-card-ic{display:inline-flex;align-items:center;justify-content:center;flex:none;
          width:44px;height:44px;border-radius:var(--radius-md);background:var(--surface);
          color:var(--accent);border:1px solid var(--border)}
        .hp-card.is-featured .hp-card-ic{background:var(--surface);color:var(--accent)}
        .hp-card-title{font-size:var(--text-lg);font-weight:var(--weight-announce-cjk);color:var(--brand-ink)}
        .hp-card-desc{font-size:var(--text-sm);color:var(--muted);line-height:var(--leading-body);flex:1}
        .hp-card-go{display:inline-flex;align-items:center;gap:var(--space-1);margin-top:var(--space-1);
          font-size:var(--text-sm);color:var(--accent);font-weight:var(--weight-emph-cjk);
          transition:gap var(--motion-fast) var(--ease-standard)}
        .hp-card:hover .hp-card-go{gap:var(--space-2)}
        .hp-card-badge{position:absolute;top:var(--space-4);right:var(--space-4);
          padding:2px var(--space-2);border-radius:var(--radius-pill);background:var(--accent);
          color:var(--accent-on);font-size:var(--text-xs);font-weight:var(--weight-emph-cjk);
          letter-spacing:.02em}
        .hp-card:nth-child(1){animation-delay:.02s}
        .hp-card:nth-child(2){animation-delay:.06s}
        .hp-card:nth-child(3){animation-delay:.10s}
        .hp-card:nth-child(4){animation-delay:.14s}
        .hp-card:nth-child(5){animation-delay:.18s}
        .hp-card:nth-child(6){animation-delay:.22s}
        .hp-card:nth-child(7){animation-delay:.26s}
        .hp-card:nth-child(8){animation-delay:.30s}
        @keyframes hp-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @media(max-width:720px){
          .hp-section{margin-top:var(--space-8)}
          .hp-grid{grid-template-columns:1fr;gap:var(--space-3)}
        }

        /* ── 首页脊柱仪表盘 ── */
        .hp-spine{margin-top:var(--space-6);padding:var(--space-6);
          background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg)}
        .hp-spine-empty{background:var(--accent-soft);border-color:var(--accent-border)}
        .hp-spine-head{display:flex;justify-content:space-between;align-items:baseline;
          margin-bottom:var(--space-4)}
        .hp-spine-label{font-size:var(--text-xs);color:var(--meta);
          text-transform:uppercase;letter-spacing:var(--tracking-caps);font-weight:var(--weight-emph-cjk)}
        .hp-spine-switch{font-size:var(--text-xs);color:var(--accent);
          text-decoration:none;font-weight:var(--weight-emph-cjk)}
        .hp-spine-switch:hover{text-decoration:underline}
        .hp-spine-body{display:flex;align-items:center;gap:var(--space-6);
          flex-wrap:wrap}
        .hp-spine-path{font-size:var(--text-xl);font-weight:var(--weight-announce-cjk);
          color:var(--brand-ink);letter-spacing:var(--tracking-title)}
        .hp-spine-metrics{display:flex;align-items:center;gap:var(--space-5);flex:1;
          flex-wrap:wrap}
        .hp-spine-metric{display:flex;flex-direction:column;gap:2px}
        .hp-spine-num{font-family:var(--font-mono);font-size:var(--text-3xl);
          font-weight:var(--weight-announce);color:var(--fg);line-height:1}
        .hp-spine-num span{font-size:var(--text-base);color:var(--meta);margin-left:2px}
        .hp-spine-cap{font-size:var(--text-xs);color:var(--meta)}
        /* 覆盖 next-card 默认样式以适配首页宽屏 */
        .hp-spine .next-card{flex:1 1 280px;border-left-width:3px;
          padding:var(--space-4) var(--space-5)}
        .hp-spine-empty-text{margin:0 0 var(--space-4);font-size:var(--text-sm);
          color:var(--fg-2);line-height:var(--leading-relaxed);max-width:48ch}
        .hp-spine-factory{display:inline-flex;align-items:center;gap:var(--space-2);
          margin-top:var(--space-4);padding:var(--space-2) var(--space-4);
          background:var(--surface-2);border-radius:var(--radius-md);
          font-size:var(--text-sm);color:var(--accent);text-decoration:none;
          transition:background var(--motion-fast) var(--ease-standard)}
        .hp-spine-factory:hover{background:var(--accent-soft)}
        @media(max-width:720px){
          .hp-spine{padding:var(--space-4)}
          .hp-spine-body{flex-direction:column;align-items:stretch;gap:var(--space-3)}
          .hp-spine-metrics{gap:var(--space-3)}
          .hp-spine-num{font-size:var(--text-2xl)}
        }
      `}</style>

      {/* ═══ 英雄区：身份 + 价值主张 + 主入口 ═══ */}
      <header className="hp-hero">
        <p className="hp-kicker">
          <Icon name="factory" size={16} />
          <span className="caps">MES 实训平台</span>
        </p>
        <h1 className="hp-title">零基础，把工厂和 MES 一次看明白</h1>
        <p className="hp-sub">
          课程 + 模拟器 + 练习，边看边玩边练。先看懂工厂怎么转，再动手调产线、跑流程。
        </p>
        <div className="hp-cta">
          <Link to="/factory" className="btn btn-primary">
            <Icon name="factory" size={20} /> 进入工厂全景
          </Link>
          <Link to="/courses" className="btn btn-secondary">
            <Icon name="courses" size={20} /> 浏览课程
          </Link>
        </div>
        <div className="hp-pills">
          <span className="hp-pill">12 环节工厂全景</span>
          <span className="hp-pill">会动的产线模拟器</span>
          <span className="hp-pill">订单到交付全流</span>
          <span className="hp-pill">AI 导师随时问</span>
        </div>
      </header>

      {/* ═══ 学习脊柱仪表盘（首页专属，侧栏不再放） ═══ */}
      {spine.activePath != null ? (
        <section className="hp-spine" aria-label="学习进度">
          <div className="hp-spine-head">
            <span className="hp-spine-label">我的学习主线</span>
            <Link to="/learning-paths" className="hp-spine-switch">切换路径</Link>
          </div>
          <div className="hp-spine-body">
            <div className="hp-spine-path">{spine.pathName}</div>
            <div className="hp-spine-metrics">
              <div className="hp-spine-metric">
                <span className="hp-spine-num">{spine.completion}<span>%</span></span>
                <span className="hp-spine-cap">主线进度</span>
              </div>
              {spine.nextCourseId != null && (
                <NextActionCard
                  action={{
                    to: `/courses/${spine.nextCourseId}`,
                    label: `继续学：${spine.nextCourseName ?? '下一门课'}`,
                    hint: '主线推荐的下一步',
                    icon: 'courses',
                    kind: 'learn',
                  }}
                />
              )}
            </div>
          </div>
          <Link to="/factory" className="hp-spine-factory">
            <Icon name="factory" size={16} />
            进工厂全景看看走到哪了
            <Icon name="arrow-right" size={16} />
          </Link>
        </section>
      ) : (
        <section className="hp-spine hp-spine-empty" aria-label="学习进度">
          <div className="hp-spine-head">
            <span className="hp-spine-label">我的学习主线</span>
          </div>
          <p className="hp-spine-empty-text">
            还没设定学习路线。选一条路径，平台会替你记着学到哪、下一步去哪。
          </p>
          <Link to="/learning-paths" className="btn btn-primary">
            <Icon name="paths" size={16} /> 选一条学习路径
          </Link>
        </section>
      )}

      {/* ═══ 新手上路：三段式入口 ═══ */}
      <nav className="hp-steps" aria-label="新手上路">
        {STEPS.map((s, i) => (
          <FragmentStep key={s.to + s.title} step={s} showArrow={i < STEPS.length - 1} />
        ))}
      </nav>

      {/* ═══ 全站功能导览 ═══ */}
      <section className="hp-section" aria-label="探索平台">
        <div className="hp-section-head">
          <h2 className="hp-section-title">探索平台</h2>
          <p className="hp-section-sub">挑一个入口，从看流程、玩模拟器到系统学课程。</p>
        </div>
        <div className="hp-grid">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className={`hp-card${f.featured ? ' is-featured' : ''}`}>
              {f.featured && <span className="hp-card-badge">招牌</span>}
              <span className="hp-card-ic"><Icon name={f.icon} size={24} /></span>
              <span className="hp-card-title">{f.title}</span>
              <span className="hp-card-desc">{f.desc}</span>
              <span className="hp-card-go">
                进入 <Icon name="arrow-right" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}

/* 一步卡片 + 箭头连接（步骤间用 chevron 暗示顺序）。 */
function FragmentStep({ step, showArrow }: { step: { to: string; icon: IconName; title: string; desc: string }; showArrow: boolean }) {
  return (
    <>
      <Link to={step.to} className="hp-step">
        <span className="hp-step-ic"><Icon name={step.icon} size={20} /></span>
        <span className="hp-step-body">
          <span className="hp-step-title">{step.title}</span>
          <span className="hp-step-desc">{step.desc}</span>
        </span>
      </Link>
      {showArrow && (
        <span className="hp-step-arrow" aria-hidden="true">
          <Icon name="chevron-right" size={20} />
        </span>
      )}
    </>
  );
}
