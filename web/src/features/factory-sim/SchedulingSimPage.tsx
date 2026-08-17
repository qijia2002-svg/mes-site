/**
 * 生产排产模拟器（路线图 P0-1 · APS 排产教学化）。
 *
 * 教学定位：计划层。复用 simCalc 的四道工序产能模型，但把镜头从「产线产出」转到
 * 「计划排程」——让用户亲手排三张工单、给瓶颈加机器，亲眼看：
 *   · 哪道工序是瓶颈（负荷最高）
 *   · 调换工单顺序对总工期几乎没用
 *   · 给瓶颈加机器，总工期立刻塌下来（呼应产线模拟器「加瓶颈机器发货翻倍」）
 *
 * 纯前端、零后端依赖；概念已写入知识图种子（seed-scheduling-concepts.sql），可反链。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { NextActionGroup } from '../../components/NextAction';
import { useLearningSpine } from '../../lib/learningSpine';
import { schedulingNextActions } from '../../lib/nextAction';
import { recordSim } from '../../lib/practiceStore';
import { runSched, DEFAULT_CENTERS, DEFAULT_ORDERS, type SchedOrder, type SchedCenter } from './simSched';
import './SchedulingSimPage.css';

type FeedbackKey = 'resource' | 'sequence' | 'default';

function pickSchedFeedback(k: {
  machUnits: number;
  orderChanged: boolean;
  base: number;
  now: number;
}): { key: FeedbackKey; text: string } {
  if (k.machUnits > 1) {
    return {
      key: 'resource',
      text: `你给机加工加了机器，总工期立刻从 ${k.base} 分钟塌到 ${k.now} 分钟——瓶颈一通，全线都通。这和产线模拟器里「加瓶颈机器发货翻倍」是同一个道理：杠杆永远在瓶颈上，不在顺序上。`,
    };
  }
  if (k.orderChanged) {
    return {
      key: 'sequence',
      text: `你调换了工单顺序，总工期只从 ${k.base} 变成 ${k.now} 分钟，几乎没救回来——因为卡住全线的不是顺序，是机加工这道瓶颈。排产能调的是「先干哪张单」，改不了「哪台机器最慢」。`,
    };
  }
  return {
    key: 'default',
    text: '机加工负荷最高（红条），是全线瓶颈。排产的本质不是把工单排得漂亮，而是别让负荷全堵在一道工序上——要么给它加资源，要么把活分流到别的工作中心。',
  };
}

export function SchedulingSimPage() {
  const [orders, setOrders] = useState<SchedOrder[]>(DEFAULT_ORDERS);
  const [centers, setCenters] = useState<SchedCenter[]>(DEFAULT_CENTERS);

  const result = useMemo(() => runSched(orders, centers), [orders, centers]);
  const baseline = useMemo(() => runSched(DEFAULT_ORDERS, DEFAULT_CENTERS), []);

  const machUnits = centers.find((c) => c.key === 'mach')?.units ?? 1;
  const orderChanged = orders.some((o, i) => o.id !== DEFAULT_ORDERS[i].id);

  const moveUp = (i: number) => {
    if (i <= 0) return;
    setOrders((o) => {
      const n = [...o];
      [n[i - 1], n[i]] = [n[i], n[i - 1]];
      return n;
    });
  };
  const moveDown = (i: number) => {
    if (i >= orders.length - 1) return;
    setOrders((o) => {
      const n = [...o];
      [n[i + 1], n[i]] = [n[i], n[i + 1]];
      return n;
    });
  };
  const setMachUnits = (u: number) =>
    setCenters((cs) => cs.map((c) => (c.key === 'mach' ? { ...c, units: Math.max(1, Math.min(4, u)) } : c)));

  const fb = pickSchedFeedback({ machUnits, orderChanged, base: baseline.makespan, now: result.makespan });

  // 学习脊柱：排产演练完成后上报进度，并给出跨模式「下一步」（v2 · 治 N4 漏计脊柱 + 断点）
  const spine = useLearningSpine();
  const [recorded, setRecorded] = useState(false);
  const completeSim = () => {
    recordSim('scheduling');
    setRecorded(true);
  };

  return (
    <div className="sched-page">
      <header className="sched-head">
        <div className="sched-head-icon">
          <Icon name="schedule" size={24} />
        </div>
        <div>
          <h1 className="sched-title">生产排产模拟器</h1>
          <p className="sched-sub">
            MRP 算完「要造多少」，接下来就得排产：把工单排到各工作中心，决定谁先谁后。动手排一遍，你立刻懂什么叫瓶颈。
          </p>
        </div>
      </header>

      {/* 动机前置 */}
      <section className="sched-moti">
        <Icon name="warn" size={20} className="sched-moti-ic" />
        <div>
          <p className="sched-moti-pain">
            不懂排产，计划员只能拍脑袋：「这三张单先干哪张？」——结果机加工堆成山，交期全黄。
          </p>
          <p className="sched-moti-gain">
            学完这一节，你看任何一排工单，都能先算出每道工序的负荷、一眼揪出瓶颈，再决定加机器还是调顺序。
          </p>
        </div>
      </section>

      <div className="sched-grid">
        {/* 左：控制面板 */}
        <section className="sched-panel">
          <h2 className="sched-panel-title">
            <Icon name="work-order" size={20} /> 工单排产顺序
          </h2>
          <p className="sched-panel-hint">上下调顺序，看右侧总工期怎么变。</p>
          <ol className="sched-order-list">
            {orders.map((o, i) => (
              <li key={o.id} className="sched-order-row">
                <span className="sched-order-no">{i + 1}</span>
                <span className="sched-order-label">{o.label}</span>
                <span className="sched-order-qty">{o.qty} 件</span>
                <span className="sched-order-ops">
                  <button
                    type="button"
                    className="sched-mini-btn"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    aria-label={`${o.label} 上移`}
                  >
                    <Icon name="chevron-up" size={16} />
                  </button>
                  <button
                    type="button"
                    className="sched-mini-btn"
                    onClick={() => moveDown(i)}
                    disabled={i === orders.length - 1}
                    aria-label={`${o.label} 下移`}
                  >
                    <Icon name="chevron-down" size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ol>

          <h2 className="sched-panel-title sched-panel-title-2">
            <Icon name="equipment" size={20} /> 机加工资源（瓶颈工序）
          </h2>
          <p className="sched-panel-hint">这道最慢，加机器看总工期怎么塌。</p>
          <div className="sched-res-control">
            <button
              type="button"
              className="sched-mini-btn"
              onClick={() => setMachUnits(machUnits - 1)}
              disabled={machUnits <= 1}
              aria-label="机加工减一台"
            >
              <Icon name="minus" size={16} />
            </button>
            <span className="sched-res-count">机加工 ×{machUnits} 台</span>
            <button
              type="button"
              className="sched-mini-btn"
              onClick={() => setMachUnits(machUnits + 1)}
              disabled={machUnits >= 4}
              aria-label="机加工加一台"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </section>

        {/* 右：结果 */}
        <section className="sched-result">
          <div className="sched-makespan">
            <div>
              <span className="sched-makespan-label">总工期</span>
              <span className="sched-makespan-value">{result.makespan}</span>
              <span className="sched-makespan-unit">分钟</span>
            </div>
            <div className="sched-makespan-shift">≈ {result.shifts} 个班次（480 分/班）</div>
          </div>

          <div className="sched-tracks">
            {result.centers.map((c) => (
              <div key={c.key} className={`sched-track${c.isBottleneck ? ' is-bottleneck' : ''}`}>
                <div className="sched-track-head">
                  <span className="sched-track-label">
                    <Icon name={c.isBottleneck ? 'warn' : 'cog'} size={16} />
                    {c.label}
                  </span>
                  <span className="sched-track-meta">
                    {c.isBottleneck && <span className="sched-bn-tag">瓶颈</span>}
                    负荷 {Math.round(c.machineMinutes)} 分 · 利用率 {c.utilization}%
                  </span>
                </div>
                <div className="sched-track-bar">
                  {c.blocks.map((b, bi) => {
                    const left = (b.start / result.makespan) * 100;
                    const width = ((b.end - b.start) / result.makespan) * 100;
                    return (
                      <span
                        key={b.orderId + bi}
                        className={`sched-block blk-${bi % 3}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${b.orderLabel}：${Math.round(b.start)}–${Math.round(b.end)} 分`}
                      >
                        {b.orderLabel.replace('工单 ', '')}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className={`sched-fb tone-${fb.key === 'resource' ? 'good' : 'warn'}`}>
            <Icon name={fb.key === 'resource' ? 'check-circle' : 'warn'} size={20} />
            <p>{fb.text}</p>
          </div>
        </section>
      </div>

      {/* 教学知识块 */}
      <section className="sched-kc">
        <h2 className="sched-kc-title">排产三句话</h2>
        <div className="sched-kc-grid">
          <div className="sched-kc-card">
            <span className="sched-kc-kind">大白话</span>
            <p>
              排产 = 把工单排到各工作中心，决定谁先谁后。它接在 MRP 之后，是把「计划」真正落成「车间动作」的那一步。
            </p>
          </div>
          <div className="sched-kc-card">
            <span className="sched-kc-kind">看数据</span>
            <p>
              工序负荷 = 件数 × 单件工时。机加工单件 9 分钟，是下料的 4.5 倍、组装的 3 倍——所以三张单调来调去，机加工永远最忙。
            </p>
          </div>
          <div className="sched-kc-card">
            <span className="sched-kc-kind">破误区</span>
            <p>
              别以为「排得巧」就能救交期。顺序只能挪动排队，救不了最慢那道工序。真要缩短交期，得给瓶颈加资源或分流。
            </p>
          </div>
        </div>
      </section>

      <div className="sched-foot-cta">
        <Link to="/knowledge-graph" className="sched-cta">
          <Icon name="network" size={20} /> 去知识图看「排产 / 负荷 / APS」概念
        </Link>
        <Link to="/simulator" className="sched-cta-secondary">
          <Icon name="gauge" size={16} /> 回到产线模拟器
        </Link>
        <button type="button" className="sched-cta-primary" onClick={completeSim} disabled={recorded}>
          <Icon name={recorded ? 'check-circle' : 'target'} size={16} />
          {recorded ? '已记入学习进度' : '完成演练，记入进度'}
        </button>
      </div>

      {/* 跨模式下一步：演练完回到「学」与「练」，并回链脊柱（治 N4 断点） */}
      <NextActionGroup title="这趟排产演练后，下一步：" actions={schedulingNextActions(spine)} />
    </div>
  );
}

export default SchedulingSimPage;
