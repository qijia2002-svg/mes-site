/**
 * /factory —— 首页 v14：模拟器为英雄特色 + 订单到交付价值流河流。
 *
 * v13 的 12 环节工厂全景（FactoryFlow/FactoryJourney）已移至独立深链（保留路由，
 *   FactoryExtras 可达）。首页不再画四泳道/旅程视图，改为：
 *
 *   ① 工厂模拟器英雄卡（紧凑预览 + CTA 进 /simulator 动手玩）
 *   ② 订单到交付价值流河流（OrderToDeliveryFlow 内嵌，用户最满意的视觉）
 *   ③ 进度卡 + Prologue + FactoryExtras 保留
 *
 * 纯 design token，P0 合规。
 */
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LoadingState } from '../components/StateBlock';
import { api } from '../api/endpoints';
import type { FlowNodeDTO } from '../api/endpoints';
import FactoryExtras from '../features/factory/FactoryExtras';
import FactoryPrologue, { hasSeenPrologue, markPrologueSeen } from '../features/factory/FactoryPrologue';
import OrderToDeliveryFlow from '../features/factory/OrderToDeliveryFlow';
import { DEFAULT_FLOW, PHASE_BY_KEY, buildSteps, type LaidNode, type Phase } from '../features/factory/factoryFlow.data';
import { useNodeProgress } from '../features/factory/useNodeProgress';
import { useNodeStatus, type NodeStatusApi } from '../features/factory/useNodeStatus';

const SLUG = 'generic-factory';

/* ═══ 页头：身份 + 进度 + CTA ═══ */
function HomeHeader({ title, total, status, nextNode, onResume, onOpenPrologue }: {
  title: string;
  total: number;
  status: NodeStatusApi;
  nextNode: FlowNodeDTO | null;
  onResume: () => void;
  onOpenPrologue: () => void;
}) {
  const { practicedCount, touchedCount, practicableTotal } = status;
  const pct = practicableTotal > 0 ? (practicedCount / practicableTotal) * 100 : 0;

  return (
    <>
      <style>{`
        .hh-kicker{display:flex;align-items:center;gap:var(--space-2);color:var(--meta);
          margin:0 0 var(--space-2);font-size:var(--text-sm)}
        .hh-prog{margin-top:var(--space-4);padding:var(--space-4) var(--space-5);
          background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md)}
        .hh-prog-head{display:flex;align-items:baseline;gap:var(--space-3);flex-wrap:wrap}
        .hh-prog-num{font-size:var(--text-lg);font-weight:var(--weight-announce-cjk)}
        .hh-prog-num em{font-style:normal;color:var(--meta);font-weight:var(--weight-read);
          font-size:var(--text-sm)}
        .hh-prog-note{font-size:var(--text-sm);color:var(--muted)}
        .hh-bar{margin-top:var(--space-3);height:6px;border-radius:var(--radius-pill);
          background:var(--progress-track);overflow:hidden}
        .hh-bar i{display:block;height:100%;border-radius:var(--radius-pill);
          background:var(--progress-fill);transition:width var(--motion-slow) var(--ease-standard)}
        .hh-sub{margin-top:var(--space-2);font-size:var(--text-xs);color:var(--meta)}
        @media(max-width:720px){
          .hh-prog{margin-top:var(--space-3);padding:var(--space-3) var(--space-4)}
          .hh-prog-num{font-size:var(--text-base)}
          .hh-bar{margin-top:var(--space-2);height:4px}
        }
      `}</style>

      <header className="page-head hh-head">
        <div>
          <p className="hh-kicker">
            <Icon name="factory" size={16} />
            <span className="caps">MES 实训平台</span>
          </p>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">
            <span className="pill pill-ok" style={{ marginRight: 'var(--space-2)' }}>L1 实操</span>
            从客户下单到发货出库的完整价值流。先看流程怎么走，再进模拟器动手玩。
          </p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenPrologue}>
            <Icon name="compass" size={16} /> 工厂一日游
          </button>
          {nextNode ? (
            <button type="button" className="btn btn-primary" onClick={onResume}>
              <Icon name="arrow-right" size={16} />
              {status.practicedCount === 0 ? '从这里开始' : '从这里继续'}
            </button>
          ) : (
            <span className="btn btn-secondary" aria-live="polite">
              <Icon name="check-circle" size={16} /> 全部环节都练过了
            </span>
          )}
        </div>
      </header>

      <div className="card hh-prog">
        {practicableTotal > 0 ? (
          <>
            <div className="hh-prog-head">
              <span className="hh-prog-num tabular">
                已练 {practicedCount} / {practicableTotal} <em>个环节</em>
              </span>
              <span className="hh-prog-note">练过 = 在这个环节做完了 SQL 或测验，只看不算</span>
            </div>
            <div className="hh-bar"><i style={{ width: `${pct}%` }} /></div>
          </>
        ) : (
          <div className="hh-prog-head">
            <span className="hh-prog-num tabular">共 {total} 个环节 <em>· 内容陆续上线</em></span>
          </div>
        )}
        <div className="hh-sub tabular">已了解 {touchedCount} / {total} 个环节（读过知识卡也算）</div>
      </div>
    </>
  );
}

/* ═══ 模拟器英雄卡：首页特色功能 ═══ */
function SimulatorHero() {
  return (
    <>
      <style>{`
        .sim-hero{position:relative;overflow:hidden;border-radius:var(--radius-lg);
          border:1px solid var(--border);background:linear-gradient(135deg,
            var(--surface) 0%,var(--accent-soft) 100%);padding:var(--space-6);
          display:flex;flex-direction:column;gap:var(--space-4)}
        .sim-hero-badge{display:inline-flex;align-items:center;gap:var(--space-2);
          width:fit-content;padding:var(--space-1) var(--space-3);border-radius:var(--radius-pill);
          background:var(--accent);color:var(--accent-on);font-size:var(--text-xs);
          font-weight:var(--weight-emph-cjk);letter-spacing:.03em}
        .sim-hero-title{font-size:var(--text-xl);font-weight:var(--weight-announce-cjk);
          color:var(--brand-ink);margin:0;line-height:var(--leading-snug)}
        .sim-hero-desc{font-size:var(--text-base);color:var(--fg-2);max-width:52ch;
          line-height:var(--leading-body);margin:0}
        .sim-hero-steps{display:flex;align-items:center;gap:var(--space-3);
          flex-wrap:wrap;margin-top:var(--space-2)}
        .sim-hero-step{display:flex;align-items:center;gap:var(--space-2);
          padding:var(--space-2) var(--space-3);background:var(--bg);border:1px solid var(--border);
          border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--fg-2)}
        .sim-hero-step .step-num{display:inline-flex;align-items:center;justify-content:center;
          width:22px;height:22px;border-radius:50%;background:var(--accent);color:var(--accent-on);
          font-size:var(--text-xs);font-weight:700;flex-shrink:0}
        .sim-hero-arrow{color:var(--border-strong);flex-shrink:0}
        .sim-hero-actions{display:flex;align-items:center;gap:var(--space-3);
          margin-top:var(--space-2);flex-wrap:wrap}
        .sim-hero-cta{display:inline-flex;align-items:center;gap:var(--space-2);
          padding:var(--space-3) var(--space-5);background:var(--accent);color:var(--accent-on);
          border-radius:var(--radius-md);font-size:var(--text-sm);font-weight:600;
          text-decoration:none;transition:opacity var(--motion-fast) var(--ease-standard)}
        .sim-hero-cta:hover{opacity:.88}
        .sim-hero-cta-secondary{display:inline-flex;align-items:center;gap:var(--space-2);
          padding:var(--space-3) var(--space-4);background:var(--bg);color:var(--fg-2);
          border:1px solid var(--border);border-radius:var(--radius-md);font-size:var(--text-sm);
          text-decoration:none;transition:background var(--motion-fast) var(--ease-standard)}
        .sim-hero-cta-secondary:hover{background:var(--surface-2)}
        @media(max-width:720px){
          .sim-hero{padding:var(--space-4)}
          .sim-hero-title{font-size:var(--text-lg)}
          .sim-hero-steps{gap:var(--space-2)}
          .sim-hero-step{padding:var(--space-1) var(--space-2);font-size:var(--text-xs)}
          .sim-hero-actions{flex-direction:column;align-items:stretch}
          .sim-hero-cta,.sim-hero-cta-secondary{justify-content:center;text-align:center}
        }
      `}</style>

      <section className="sim-hero" aria-label="工厂模拟器">
        <span className="sim-hero-badge">
          <Icon name="gauge" size={16} /> 首页特色功能
        </span>
        <h2 className="sim-hero-title">工厂模拟器 · 会动的产线</h2>
        <p className="sim-hero-desc">
          调机器、加班次、看瓶颈——光点沿传送带流动，仪表实时跳动。
          零基础看动画就懂产能约束是怎么回事。
        </p>

        {/* 四道工序迷你流程条 */}
        <div className="sim-hero-steps" aria-hidden="true">
          {['下料', '机加工', '组装', '检验'].map((label, i) => (
            <Fragment key={label}>
              {i > 0 && <Icon name="chevron-right" size={16} className="sim-hero-arrow" />}
              <span className="sim-hero-step">
                <span className="step-num">{i + 1}</span>
                {label}
              </span>
            </Fragment>
          ))}
        </div>

        <div className="sim-hero-actions">
          <Link to="/simulator" className="sim-hero-cta">
            <Icon name="gauge" size={20} /> 进模拟器动手玩
          </Link>
          <Link to="/order-to-delivery" className="sim-hero-cta-secondary">
            <Icon name="routing" size={16} /> 看订单交付全流程
          </Link>
        </div>
      </section>
    </>
  );
}

/* ═══ 主壳 ═══ */
export default function FactoryPage() {
  const q = useQuery({
    queryKey: ['flowchart', SLUG],
    queryFn: () => api.flowchart(SLUG),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { isDone } = useNodeProgress(SLUG);

  // 后端无数据 → 兜底，进度卡永远能渲染。
  const flow = q.data && q.data.nodes?.length ? q.data : DEFAULT_FLOW;

  const nodes = useMemo(() => {
    const raw = flow.nodes as (FlowNodeDTO & { phase?: Phase })[];
    const laid: LaidNode[] = raw.map((n) => ({
      ...n,
      phase: (n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan') as Phase,
    }));
    return buildSteps(laid, flow.edges).flat();
  }, [flow.nodes, flow.edges]);

  const status = useNodeStatus(nodes, new Map(), isDone);

  // 零基础序章
  const [prologueOpen, setPrologueOpen] = useState(false);
  useEffect(() => {
    if (!hasSeenPrologue()) setPrologueOpen(true);
  }, []);

  const nextNode = status.nextKey
    ? nodes.find((n) => n.key === status.nextKey) ?? null
    : null;

  if (q.isLoading) return <LoadingState label="加载首页…" />;

  return (
    <section style={{ maxWidth: 'var(--container-app)', margin: '0 auto' }}>
      <FactoryPrologue
        open={prologueOpen}
        onClose={() => {
          setPrologueOpen(false);
          markPrologueSeen();
        }}
      />

      <HomeHeader
        title={q.data?.flow?.title ?? '通用离散制造厂'}
        total={nodes.length}
        status={status}
        nextNode={nextNode}
        onResume={() => nextNode && null /* 首页 CTA 改为指向模拟器 */}
        onOpenPrologue={() => setPrologueOpen(true)}
      />

      {/* ★ 英雄特色：工厂模拟器 */}
      <SimulatorHero />

      {/* ★ 核心视觉：订单到交付价值流河流（用户最满意的页面） */}
      <OrderToDeliveryFlow />

      {/* 底部入口导航 */}
      <FactoryExtras />
    </section>
  );
}
