/**
 * / —— 门户首页（v2：工业运维控制台 R3「首页即工厂全景」）。
 *
 * v1 是「欢迎英雄卡 + 功能导览」，一进来像网课平台首页。R3 按设计方向 P3 改口径：
 * **首屏第一眼是「产线走到哪、哪里堵、你学到哪」，不是推荐课程。**
 * 首屏因此改成一条深色工厂全景条（全站两处深色锚点之一，另一处是 SQL 沙箱），
 * 把身份 / 价值主张 / 主 CTA 全部并进控制室面板，下面接学情仪表网格。
 *
 * 数据纪律（关键）：全景条上每个环节点的颜色、三项计数、四个仪表读数，
 * **全部来自 useFactorySummary + useLearningSpine + practiceStore 的真实进度**，
 * 没有一个演示用的假设备遥测。本平台是实训平台，不是真 MES——
 * 编造「12 在产工单 / 2 告警」既没有信息量，也会教坏学员对 MES 数据的直觉。
 * 流程图接口没下发时 useFactorySummary 回落静态 DEFAULT_FLOW，此时状态灯诚实显示
 * 「离线兜底」而不是假装已连线。
 *
 * 设计纪律：纯 design token；无 emoji 图标（走 Icon 语义名）；无紫粉渐变；
 * 无裸 hex（深色面板一律 --console-*）；动效仅 hover + 轻量入场，无弹性缓动；
 * 全局 prefers-reduced-motion 兜底已在 design-tokens.css 关掉动画。
 * 页面是「应用」不是「落地页」——节区纵向间距走 48px 档。
 */
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useLearningSpine } from '../lib/learningSpine';
import { NextActionCard } from '../components/NextAction';
import { useFactorySummary } from '../features/factory/useFactorySummary';
import type { NodeStatus } from '../features/factory/useNodeStatus';
import { usePracticeSummary } from '../lib/practiceStore';
import './HomePage.css';

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
    to: '/practice',
    icon: 'tools',
    title: '练习中心',
    desc: 'SQL 沙盒 + 测验 + 词典，边学边练，学了就能验。',
  },
];

/* 新手上路：三段式入口，指向三个招牌体验。 */
const STEPS: { to: string; icon: IconName; title: string; desc: string }[] = [
  { to: '/order-to-delivery', icon: 'routing', title: '看流程', desc: '先看懂订单到交付怎么走' },
  { to: '/simulator', icon: 'gauge', title: '玩模拟器', desc: '调机器看瓶颈怎么卡住产出' },
  { to: '/courses', icon: 'courses', title: '系统学课程', desc: '按路线从零到上岗' },
];

/**
 * 环节状态 → 控制室状态语义。三档而已，不要再加：
 * practiced=已练通（绿灯）/ touched=进行中（琥珀）/ plain=未开工（钢灰）。
 */
const TONE_BY_STATUS: Record<NodeStatus, 'run' | 'wip' | 'idle'> = {
  practiced: 'run',
  touched: 'wip',
  plain: 'idle',
};
const TONE_TEXT: Record<'run' | 'wip' | 'idle', string> = {
  run: '已练通',
  wip: '进行中',
  idle: '未开工',
};

export default function HomePage() {
  const spine = useLearningSpine();
  const factory = useFactorySummary();
  const practice = usePracticeSummary();

  /* ── 全景条计数：三档互斥，加起来等于总环节数 ── */
  const runCount = factory.practiced;
  const wipCount = Math.max(0, factory.touched - factory.practiced);
  const idleCount = Math.max(0, factory.total - factory.touched);

  /* ── 主 CTA 绑真实下一环节，没有就回落全景页 ── */
  const nextIndex = factory.nextKey
    ? factory.nodes.findIndex((n) => n.key === factory.nextKey)
    : -1;
  const nextNode = nextIndex >= 0 ? factory.nodes[nextIndex] : null;
  const primaryTo = nextNode
    ? `/factory?node=${encodeURIComponent(nextNode.key)}`
    : '/factory';
  const primaryLabel = nextNode
    ? `继续第 ${nextIndex + 1} 环节 · ${nextNode.label}`
    : '进入工厂全景';

  /* ── 学情仪表：分母全部有真实来源，凑不出分母的改用计数卡 ── */
  const drillPct =
    factory.practicableTotal > 0
      ? Math.round((factory.practiced / factory.practicableTotal) * 100)
      : 0;
  const quizCount =
    practice.chaptersQuiz.length +
    practice.modulesQuiz.length +
    practice.factoryQuiz.length +
    practice.standaloneQuiz;

  const live = factory.source === 'api';

  return (
    <section className="hp">

      {/* ═══ 工厂全景条：身份 + 真实产线态势 + 主入口（深色控制室锚点） ═══ */}
      <header className="hp-pano">
        <div className="hp-pano-head">
          <div className="hp-pano-id">
            <p className="hp-kicker">
              <Icon name="factory" size={16} />
              <span className="caps">MES 实训平台</span>
              <span className={`hp-lamp ${live ? 'is-live' : 'is-fallback'}`}>
                <span className="hp-lamp-dot" aria-hidden="true" />
                {live ? '流程已连线' : '离线兜底流程'}
              </span>
            </p>
            <h1 className="hp-title">零基础，把工厂和 MES 一次看明白</h1>
            <p className="hp-sub">
              下面这条线就是一张订单进厂到发货的 {factory.total} 个环节。
              绿灯是你已经练通的，琥珀是正在做的——点任意一环直接进去看。
            </p>
            <div className="hp-pano-pills">
              <span className="hp-pano-pill">会动的产线模拟器</span>
              <span className="hp-pano-pill">订单到交付全流</span>
              <span className="hp-pano-pill">AI 导师随时问</span>
            </div>
          </div>
          <dl className="hp-counts">
            <div className="hp-count">
              <dt>已练通</dt>
              <dd className="is-run">{runCount}</dd>
            </div>
            <div className="hp-count">
              <dt>进行中</dt>
              <dd className="is-wip">{wipCount}</dd>
            </div>
            <div className="hp-count">
              <dt>未开工</dt>
              <dd className="is-idle">{idleCount}</dd>
            </div>
          </dl>
        </div>

        <ol className="hp-flow" aria-label={`工厂 ${factory.total} 环节进度`}>
          {factory.nodes.map((n, i) => {
            const tone = TONE_BY_STATUS[n.status];
            const isNext = n.key === factory.nextKey;
            return (
              <li key={n.key} className="hp-flow-item">
                <Link
                  to={`/factory?node=${encodeURIComponent(n.key)}`}
                  className={`hp-flow-node is-${tone}${isNext ? ' is-next' : ''}`}
                  aria-label={`第 ${i + 1} 环节 ${n.label}：${TONE_TEXT[tone]}${isNext ? '（建议从这里继续）' : ''}`}
                  title={`${n.label} · ${TONE_TEXT[tone]}`}
                >
                  <span className="hp-flow-idx" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </Link>
                <span className="hp-flow-label">{n.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="hp-pano-foot">
          <Link to={primaryTo} className="hp-btn hp-btn-primary">
            <Icon name="factory" size={20} /> {primaryLabel}
          </Link>
          <Link to="/courses" className="hp-btn hp-btn-ghost">
            <Icon name="courses" size={20} /> 系统学课程
          </Link>
          <ul className="hp-legend">
            <li>
              <span className="hp-dot is-run" aria-hidden="true" />
              已练通
            </li>
            <li>
              <span className="hp-dot is-wip" aria-hidden="true" />
              进行中
            </li>
            <li>
              <span className="hp-dot is-idle" aria-hidden="true" />
              未开工
            </li>
          </ul>
        </div>
      </header>

      {/* ═══ 学情仪表：四个读数全部有真实来源 ═══ */}
      <section className="hp-section hp-section-tight" aria-label="学情仪表">
        <div className="hp-section-head">
          <h2 className="hp-section-title">你的现场态势</h2>
          <p className="hp-section-sub">
            读数来自你自己的学习与练习记录，不是演示数据。
          </p>
        </div>
        <div className="hp-gauges">
          <GaugeCard
            pct={factory.pct}
            stroke="var(--accent)"
            label="环节覆盖"
            hint={`${factory.touched} / ${factory.total} 个环节走过`}
          />
          <GaugeCard
            pct={drillPct}
            stroke="var(--success)"
            label="实战完成"
            hint={
              factory.practicableTotal > 0
                ? `${factory.practiced} / ${factory.practicableTotal} 个环节练通`
                : '实战内容还在播种中'
            }
          />
          <GaugeCard
            pct={spine.activePath != null ? spine.completion : 0}
            stroke="var(--phase-production)"
            label="主线进度"
            hint={spine.activePath != null ? (spine.pathName ?? '已选路径') : '还没选学习路径'}
          />
          <div className="hp-gauge-card">
            <div className="hp-gauge-body">
              <div className="hp-tally">
                <span className="hp-tally-item">
                  <span className="hp-tally-n">{quizCount}</span>
                  <span className="hp-tally-l">测验</span>
                </span>
                <span className="hp-tally-item">
                  <span className="hp-tally-n">{practice.sqlPassed.length}</span>
                  <span className="hp-tally-l">SQL</span>
                </span>
                <span className="hp-tally-item">
                  <span className="hp-tally-n">{practice.sims.length}</span>
                  <span className="hp-tally-l">演练</span>
                </span>
              </div>
              <div className="hp-gauge-k">练习记录 · 累计通过数</div>
            </div>
          </div>
        </div>
      </section>

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

/**
 * 仪表环卡片。r 取 15.9155 是为了让周长正好等于 100，
 * 这样 strokeDasharray 可以直接写百分数，不用再换算——避免「85% 画出来像 87%」。
 */
function GaugeCard({
  pct,
  stroke,
  label,
  hint,
}: {
  pct: number;
  stroke: string;
  label: string;
  hint: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="hp-gauge-card">
      <svg className="hp-gauge" viewBox="0 0 36 36" role="img" aria-label={`${label} ${safe}%`}>
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--progress-track)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${safe} 100`}
          transform="rotate(-90 18 18)"
        />
        <text
          x="18"
          y="21.5"
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill="var(--fg)"
          fontFamily="var(--font-mono)"
        >
          {safe}%
        </text>
      </svg>
      <div className="hp-gauge-body">
        <div className="hp-gauge-v">{label}</div>
        <div className="hp-gauge-k">{hint}</div>
      </div>
    </div>
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
