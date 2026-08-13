/**
 * 订单到交付全景（Order-to-Delivery）独立页 · 沉浸式动画叙事版。
 *
 * 与工厂页现有 12 环节「系统视角」互补：本页只讲业务怎么走、每步配什么单据。
 * 是用户提供的 16 步价值流的教学化呈现。纯 design token，零裸 hex / 零渐变 / 零弹性缓动。
 *
 * 视觉叙事（用户要的「价值流河流」）：
 *  · 顶部一条「价值流河」——订单 token 从「客户下单」一路流到「发货出库」；
 *  · 4 个阶段各有一条按系统色（--phase-*）流动的高亮色带，把每步归哪套系统讲清楚；
 *  · 每步仍是可点击按钮，点开弹窗看配套单据 / 归属系统（修过的「点了没反应」保留）。
 *  · 底部一座桥指回 /simulator，标明「车间生产加工」内部四道工序可在模拟器动手玩。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OD_BANDS, type ODStep } from './orderToDelivery.data';
import './OrderToDeliveryFlow.css';

const PHASE_VAR: Record<string, string> = {
  plan: 'var(--phase-plan)',
  production: 'var(--phase-production)',
  qc: 'var(--phase-qc)',
  logistics: 'var(--phase-logistics)',
};
const PHASE_SOFT: Record<string, string> = {
  plan: 'var(--phase-plan-soft)',
  production: 'var(--phase-production-soft)',
  qc: 'var(--phase-qc-soft)',
  logistics: 'var(--phase-logistics-soft)',
};

export default function OrderToDeliveryFlow() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const allSteps = useMemo(() => OD_BANDS.flatMap((b) => b.steps), []);
  const bandLabelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of OD_BANDS) for (const s of b.steps) m.set(s.key, b.label);
    return (key: string) => m.get(key) ?? '';
  }, []);
  const active: ODStep | null = activeKey ? allSteps.find((s) => s.key === activeKey) ?? null : null;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveKey(null);
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  const open = (k: string) => setActiveKey(k);

  return (
    <section className="od">
      <header className="od-head">
        <p className="od-kicker">
          <Icon name="routing" size={16} />
          <span className="caps">Order to Delivery</span>
        </p>
        <h1 className="od-title">订单到交付全流程</h1>
        <p className="od-sub">
          从客户下单到发货出库，真实离散制造厂 16 步业务流。点任意一步，看它配什么单据、归哪套系统。
          想看「归哪套系统」的俯瞰视角，去 <Link to="/factory">工厂全景</Link>。
        </p>
      </header>

      {/* ═══ 价值流河：订单 token 从源头流到发货 ═══ */}
      <div className="od-river" aria-hidden="true">
        <div className="od-river-end od-river-src">
          <Icon name="shopping-cart" size={20} />
          <span>客户下单</span>
        </div>
        <div className="od-river-bed">
          <div className="od-river-stream">
            <span className="od-river-dot" />
            <span className="od-river-dot" />
            <span className="od-river-dot" />
            <span className="od-river-dot" />
            <span className="od-river-dot" />
          </div>
          <div className="od-river-token">
            <Icon name="package" size={16} />
          </div>
        </div>
        <div className="od-river-end od-river-dst">
          <Icon name="truck" size={20} />
          <span>发货出库</span>
        </div>
      </div>
      <div className="od-river-legend">
        {OD_BANDS.map((b) => (
          <span className="od-legend-item" key={b.key} style={{ '--ph': PHASE_VAR[b.key] } as CSSProperties}>
            <i className="od-legend-dot" />
            {b.label}
          </span>
        ))}
      </div>

      {/* 一行紧凑总览：客户下单→订单审核→…→发货出库 连线形态 */}
      <div className="od-overview" role="group" aria-label="全流程一览（可点击查看任一步）">
        {allSteps.map((st, i) => (
          <Fragment key={st.key}>
            <button type="button" className="od-ov-node" onClick={() => open(st.key)}>
              <span className="od-ov-seq">{st.seq}</span>
              <span className="od-ov-name">{st.name}</span>
            </button>
            {i < allSteps.length - 1 && (
              <span className="od-ov-arrow" aria-hidden="true"><Icon name="chevron-right" size={16} /></span>
            )}
          </Fragment>
        ))}
      </div>

      {OD_BANDS.map((band) => (
        <section
          className="od-band"
          key={band.key}
          style={{ '--ph': PHASE_VAR[band.key], '--ph-soft': PHASE_SOFT[band.key] } as CSSProperties}
        >
          <div className="od-band-head">
            <span className="od-band-tag">{band.label}</span>
            <span className="od-band-count">{band.steps.length} 步</span>
          </div>

          {/* 系统色带高亮：按阶段色流动，把「归哪套系统」讲清楚 */}
          <div className="od-band-flow" aria-hidden="true">
            <span className="od-band-dot" />
            <span className="od-band-dot" />
            <span className="od-band-dot" />
          </div>

          <ol className="od-chain">
            {band.steps.map((st) => (
              <li className="od-step" key={st.key}>
                <button type="button" className="od-node" onClick={() => open(st.key)} aria-haspopup="dialog">
                  <span className="od-seq">{st.seq}</span>
                  <span className="od-node-name">{st.name}</span>
                  <span className="od-node-cue">
                    看单据 <Icon name="chevron-down" size={16} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <Link to="/simulator" className="od-bridge">
        <span className="od-bridge-ic"><Icon name="routing" size={24} /></span>
        <span className="od-bridge-body">
          <span className="od-bridge-title">第 9 步「车间生产加工」内部长什么样？</span>
          <span className="od-bridge-sub">
            下料 → 机加工 → 组装 → 检验，瓶颈卡在哪台机器，动手调一调就懂 →
          </span>
        </span>
        <span className="od-bridge-go">玩工厂模拟器 <Icon name="arrow-right" size={16} /></span>
      </Link>

      {active && (
        <div
          className="od-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="od-modal-title"
          onClick={() => setActiveKey(null)}
        >
          <div className="od-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="od-modal-close"
              aria-label="关闭"
              ref={closeRef}
              onClick={() => setActiveKey(null)}
            >
              <Icon name="close" size={20} />
            </button>

            <div className="od-modal-head">
              <span className="od-modal-seq">{active.seq}</span>
              <div>
                <h2 id="od-modal-title" className="od-modal-title">{active.name}</h2>
                <p className="od-modal-phase">{bandLabelOf(active.key)}</p>
              </div>
            </div>

            <p className="od-modal-desc">{active.desc}</p>

            <div className="od-modal-rows">
              <div className="od-modal-row">
                <span className="od-modal-lbl"><Icon name="chapter" size={16} /> 配套单据</span>
                {active.docs.length > 0 ? (
                  <span className="od-docs">
                    {active.docs.map((d) => (
                      <span className="od-doc" key={d}>{d}</span>
                    ))}
                  </span>
                ) : (
                  <span className="od-doc-none">此步为计划 / 评审类，无独立业务单据</span>
                )}
              </div>
              <div className="od-modal-row">
                <span className="od-modal-lbl"><Icon name="boxes" size={16} /> 归属系统</span>
                <span className="od-sys">
                  {active.systems.map((s) => (
                    <span className="od-sys-tag" key={s}>{s}</span>
                  ))}
                </span>
              </div>
            </div>

            {active.key === 'shopfloor' && (
              <Link to="/simulator" className="od-modal-cta">
                动手调这道工序的机器 <Icon name="arrow-right" size={16} />
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
