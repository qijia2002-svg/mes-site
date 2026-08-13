/**
 * 订单到交付全景（Order-to-Delivery）独立页。
 *
 * 与工厂页现有 12 环节「系统视角」互补：本页只讲业务怎么走、每步配什么单据，
 * 是用户提供的 16 步价值流的教学化呈现。纯 design token，零裸 hex / 零渐变 / 零弹性缓动。
 * 底部一座桥指回 /simulator，标明「车间生产加工」的内部四道工序可在模拟器动手玩。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OD_BANDS } from './orderToDelivery.data';
import './OrderToDeliveryFlow.css';

export default function OrderToDeliveryFlow() {
  return (
    <section className="od">
      <header className="od-head">
        <p className="od-kicker">
          <Icon name="routing" size={16} />
          <span className="caps">Order to Delivery</span>
        </p>
        <h1 className="od-title">订单到交付全流程</h1>
        <p className="od-sub">
          从客户下单到发货出库，真实离散制造厂 16 步业务流。每步配什么单据、归哪套系统管，一一列清。
          想看「归哪套系统」的俯瞰视角，去 <Link to="/factory">工厂全景</Link>。
        </p>
      </header>

      {OD_BANDS.map((band) => (
        <div className="od-band" key={band.key}>
          <div className="od-band-head">
            <span className="od-band-tag">{band.label}</span>
          </div>
          <ol className="od-list">
            {band.steps.map((st) => (
              <li className="od-item" key={st.key}>
                <span className="od-seq" aria-hidden="true">{st.seq}</span>
                <div className="od-card">
                  <div className="od-card-top">
                    <h2 className="od-name">{st.name}</h2>
                    {st.docs.length > 0 && (
                      <span className="od-docs">
                        {st.docs.map((d) => (
                          <span className="od-doc" key={d}>{d}</span>
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="od-desc">{st.desc}</p>
                  <div className="od-sys">
                    {st.systems.map((s) => (
                      <span className="od-sys-tag" key={s}>{s}</span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
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
    </section>
  );
}
