/**
 * 订单到交付全景（Order-to-Delivery）独立页 · 实用参考版（v2 重做）。
 *
 * v1 是「价值流河流 + 4 阶段流动色带 + 弹窗」的沉浸式叙事版，用户反馈：
 *   "太花哨、没有实用价值、流向也不对"。本版据此重做 ——
 *   · 砍掉所有装饰性流动动画（河流 / 阶段色带 / 重复的流程总览条）；
 *   · 改为一张可直接读的「价值流参考表」：4 个阶段顺序展开，每步编号、说明、
 *     配套单据、归属系统全部**内联可见**，不用逐个点弹窗；
 *   · 顺序严格 1→16（接单备料 → 生产执行 → 质检包装 → 入库交付），流向一目了然；
 *   · 第 9 步「车间生产加工」内联指向 /simulator，承接工厂全景的「业务单据视角」。
 *
 * 纯 design token；无 emoji 图标、无渐变、无裸 hex、无弹性缓动。
 */
import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { NextActionGroup } from '../../components/NextAction';
import { otdNextActions } from '../../lib/nextAction';
import { OD_BANDS } from './orderToDelivery.data';
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
  const total = OD_BANDS.reduce((n, b) => n + b.steps.length, 0);

  return (
    <section className="od">
      <header className="od-head">
        <p className="od-kicker">
          <Icon name="routing" size={16} />
          <span className="caps">Order to Delivery</span>
        </p>
        <h1 className="od-title">订单到交付全流程</h1>
        <p className="od-sub">
          真实离散制造厂从客户下单到发货出库的 <b>{total}</b> 步业务流。每步配什么单据、归哪套系统，一目了然；
          想看「归哪套系统」的俯瞰视角，去 <Link to="/factory">工厂全景</Link>。
        </p>
      </header>

      {/* 阶段速览：4 个阶段顺序 + 步数，给整体方向感（非装饰动画） */}
      <ol className="od-phases" aria-label="四个阶段顺序">
        {OD_BANDS.map((b, i) => (
          <li
            className="od-phase"
            key={b.key}
            style={{ '--ph': PHASE_VAR[b.key], '--ph-soft': PHASE_SOFT[b.key] } as CSSProperties}
          >
            <span className="od-phase-dot" aria-hidden="true" />
            <span className="od-phase-label">{b.label}</span>
            <span className="od-phase-count">{b.steps.length} 步</span>
            {i < OD_BANDS.length - 1 && (
              <Icon name="chevron-right" size={16} className="od-phase-arrow" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      {/* 4 个阶段，依次展开；每步内联说明 + 单据 + 系统 */}
      {OD_BANDS.map((band) => (
        <section
          className="od-band"
          key={band.key}
          style={{ '--ph': PHASE_VAR[band.key], '--ph-soft': PHASE_SOFT[band.key] } as CSSProperties}
          aria-label={band.label}
        >
          <div className="od-band-head">
            <span className="od-band-tag">{band.label}</span>
            <span className="od-band-count">
              第 {band.steps[0].seq}–{band.steps[band.steps.length - 1].seq} 步
            </span>
          </div>

          <ol className="od-chain">
            {band.steps.map((st) => (
              <li className="od-step" key={st.key}>
                <span className="od-marker" aria-hidden="true">{st.seq}</span>
                <div className="od-body">
                  <div className="od-name-row">
                    <span className="od-name">{st.name}</span>
                    {st.key === 'shopfloor' && (
                      <Link to="/simulator" className="od-inline-cta">
                        动手调这道工序的机器 <Icon name="arrow-right" size={16} />
                      </Link>
                    )}
                  </div>
                  <p className="od-desc">{st.desc}</p>
                  <div className="od-chips">
                    <span className="od-chip-group">
                      <Icon name="chapter" size={16} className="od-chip-ic" aria-hidden="true" />
                      {st.docs.length > 0 ? (
                        st.docs.map((d) => (
                          <span className="od-chip" key={d}>{d}</span>
                        ))
                      ) : (
                        <span className="od-chip od-chip-none">无独立业务单据</span>
                      )}
                    </span>
                    <span className="od-chip-group">
                      <Icon name="boxes" size={16} className="od-chip-ic" aria-hidden="true" />
                      {st.systems.map((s) => (
                        <span className="od-chip od-chip-sys" key={s}>{s}</span>
                      ))}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {/* 桥接工厂模拟器：第 9 步「车间生产加工」的内部四道工序可在模拟器动手玩 */}
      <Link to="/simulator" className="od-bridge">
        <span className="od-bridge-ic"><Icon name="gauge" size={24} /></span>
        <span className="od-bridge-body">
          <span className="od-bridge-title">第 9 步「车间生产加工」内部长什么样？</span>
          <span className="od-bridge-sub">
            下料 → 机加工 → 组装 → 检验，瓶颈卡在哪台机器，动手调一调就懂 →
          </span>
        </span>
        <span className="od-bridge-go">玩工厂模拟器 <Icon name="arrow-right" size={16} /></span>
      </Link>

      {/* 跨模式下一步：16 步看完了，从「看」回到「学」——修复 B2 断链 */}
      <NextActionGroup title="这 16 步看完了，下一步：" actions={otdNextActions()} />
    </section>
  );
}
