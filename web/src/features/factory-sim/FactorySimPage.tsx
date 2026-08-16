/**
 * 工厂模拟器（沉浸式动画叙事版）—— 重建自旧「工厂搭建」沙盒。
 *
 * 设计铁律（零基础定位）：主界面禁止出现 MES / MRP / BOM / APS / OEE 缩写，
 * 专业术语只在「这趟看懂的 7 件事」折叠面板里出现。
 *
 * 与旧版最大的不同：把 4 道工序（下料→机加工→组装→检验）画成一条「会呼吸的活体产线」：
 *  · 光点沿传送带流动 = 在制品在跑（流动快慢由真实产能 Tshift 驱动，不造假）；
 *  · 卡住的工序红色脉冲闪烁 = 瓶颈（bottleneckIndex 驱动）；
 *  · 产线末端一只会跳动的吞吐仪表 = 本单本班发出占比（M1 / Q 驱动）；
 *  · 在制品堆积块 + 报废红块 = M3 / M5 真实数值。
 * 机器台数贴到对应工序上、可加减；底部一座桥指向 /factory 完整 12 环节工厂全景。
 *
 * 计算全部来自 simCalc.ts（产能限流模型），本文件只做呈现与交互。
 */
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import {
  runSim,
  pickFeedback,
  FEEDBACK,
  DEFAULT_PARAMS,
  type SimParams,
} from './simCalc';
import './FactorySimPage.css';

/** 4 道工序（顺序、名称、标准工时与 simCalc 的 NODE_LABELS / BASE_TIME 完全一致）。 */
const STATIONS: { idx: number; name: string; icon: IconName; std: number }[] = [
  { idx: 0, name: '下料', icon: 'package', std: 2 },
  { idx: 1, name: '机加工', icon: 'cog', std: 9 },
  { idx: 2, name: '组装', icon: 'boxes', std: 3 },
  { idx: 3, name: '检验', icon: 'check-circle', std: 1.5 },
];

/** 哪些工序可以加机器：机加工=kb（1–4 台），组装=kf（1–3 台）；下料/检验固定 1 台。 */
const MACHINE_PARAM: Record<number, 'kb' | 'kf'> = { 1: 'kb', 2: 'kf' };
const MACHINE_RANGE: Record<'kb' | 'kf', { min: number; max: number }> = {
  kb: { min: 1, max: 4 },
  kf: { min: 1, max: 3 },
};

/** 跑班播放：把稳态产能展开成「一个班次内逐分钟累计」的活体模型（仅动画用，不动 simCalc 核心数学）。
 * 纯串联队列：第 i 道工序累计完成 = min(上游累计, 本工序单班产能×班次进度)。
 * 终态(t=480)收敛到 simCalc 的 produced，因此动画与右侧稳态读数完全一致、不造假。 */
const SHIFT_MIN = 480; // 单班分钟数（与 simCalc 保持一致）
const PLAY_SPEED = 34; // 播放速度：每真实秒推进的班次分钟数（约 14 秒跑完一班）

function cumAt(caps: number[], Q: number, t: number): number[] {
  const f = Math.max(0, Math.min(1, t / SHIFT_MIN));
  const c: number[] = [];
  for (let i = 0; i < caps.length; i++) {
    const input = i === 0 ? Q : c[i - 1];
    c[i] = Math.min(input, Math.floor(caps[i] * f));
  }
  return c;
}

/** 连接段样式：播放时，喂向瓶颈的段拥堵（前面积压）、瓶颈之后的段饥饿稀疏（等料）。 */
function connClass(upIdx: number, bn: number, playing: boolean): string {
  if (!playing) return upIdx === bn ? 'sim-conn from-bn' : 'sim-conn';
  if (upIdx === bn - 1) return 'sim-conn is-congested';
  if (upIdx >= bn) return 'sim-conn is-starved';
  return 'sim-conn';
}

const METRICS: { key: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7'; label: string; unit: string; tone?: 'good' | 'warn' | 'danger' }[] = [
  { key: 'M1', label: '这班交出多少好货', unit: '件', tone: 'good' },
  { key: 'M2', label: '产线最大能耐', unit: '件/班' },
  { key: 'M3', label: '卡在半路的半成品', unit: '件', tone: 'warn' },
  { key: 'M4', label: '真正要几天交完', unit: '天', tone: 'warn' },
  { key: 'M5', label: '做坏扔掉的', unit: '件', tone: 'danger' },
  { key: 'M6', label: '做坏返工的', unit: '件' },
  { key: 'M7', label: '闲着没干的机器占比', unit: '%', tone: 'warn' },
];

/** 这趟能看懂的 7 件事（进阶深链，只在折叠面板里暴露专业术语）。 */
const CONCEPTS: { label: string; term: string; concept: string; dict: string }[] = [
  { label: '哪道工序最卡', term: '瓶颈 / 约束（TOC 约束理论）', concept: 'bottleneck', dict: 'CAPACITY' },
  { label: '半成品堆成山', term: '在制品 WIP（Work In Process）', concept: 'wip', dict: 'WIP' },
  { label: '说好的交货时间', term: '交期 / 提前期（Lead Time / Due Date）', concept: 'lead_time', dict: 'DUE DATE' },
  { label: '机器在偷懒吗', term: '设备闲置率 / 设备综合效率 OEE', concept: 'oee_idle', dict: 'OEE' },
  { label: '做坏的那些', term: '不良 / 返工 / 报废 / 良率', concept: 'defect', dict: 'DEFECT' },
  { label: '一次做多少合适', term: '批量 / 快速换型 SMED', concept: 'changeover', dict: 'BATCH' },
  { label: '加人到底有没有用', term: '班次 / 产能 / 负荷', concept: 'work_order', dict: 'SHIFT' },
];

/** 末端吞吐仪表：本单本班发出占比（M1 / Q）。SVG 半圆，pathLength 归一 100。 */
function ThroughputGauge({ pct, value, unit, live }: { pct: number; value: number; unit: string; live?: boolean }) {
  const offset = 100 * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div className="sim-gauge" role="img" aria-label={`本单本班发出约 ${Math.round(pct * 100)}%`}>
      <svg viewBox="0 0 120 70" className="sim-gauge-svg">
        <path className="gauge-track" d="M10 60 A 50 50 0 0 1 110 60" pathLength={100} />
        <path
          className="gauge-fill"
          d="M10 60 A 50 50 0 0 1 110 60"
          pathLength={100}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="sim-gauge-num" key={live ? 'live' : value}>
        <b>{value}</b>
        <span>{unit}</span>
      </div>
      <span className="sim-gauge-cap">本单本班发出</span>
    </div>
  );
}

export default function FactorySimPage() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [recent, setRecent] = useState<'swap' | 'shift' | null>(null);

  const result = useMemo(() => runSim(params), [params]);
  const feedback = useMemo(() => pickFeedback(params, result, recent), [params, result, recent]);

  // ── 跑班动态播放（前端动画驱动，不动核心数学）──
  const [play, setPlay] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle');
  const [playT, setPlayT] = useState(0); // 当前班次已过分钟 0..480
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  // 改配置即重开这一班，保证动画与当前参数一致
  useEffect(() => { setPlay('idle'); setPlayT(0); }, [params]);

  // 播放循环：用 requestAnimationFrame 推进班次时间
  useEffect(() => {
    if (play !== 'playing') return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setPlayT((t) => Math.min(SHIFT_MIN, t + dt * PLAY_SPEED));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [play]);

  // 跑满一班自动停
  useEffect(() => {
    if (play === 'playing' && playT >= SHIFT_MIN) setPlay('done');
  }, [play, playT]);

  const isPlaying = play !== 'idle';
  function togglePlay() {
    if (play === 'idle' || play === 'done') { setPlayT(0); setPlay('playing'); }
    else if (play === 'playing') setPlay('paused');
    else setPlay('playing');
  }
  function resetPlay() { setPlay('idle'); setPlayT(0); }

  function setNum(key: 'Q' | 'p' | 'B', v: number) {
    setParams((p) => ({ ...p, [key]: v }));
    setRecent(null);
  }
  function changeMachine(idx: number, dir: 1 | -1) {
    const param = MACHINE_PARAM[idx];
    if (!param) return;
    const range = MACHINE_RANGE[param];
    setParams((p) => {
      const cur = p[param];
      const next = Math.min(range.max, Math.max(range.min, cur + dir));
      return param === 'kb' ? { ...p, kb: next } : { ...p, kf: next };
    });
    setRecent(null);
  }

  // ── 由真实模型字段驱动的视觉量（不造假）──
  const total = params.Q;
  const pct = total > 0 ? Math.min(1, result.M1 / total) : 0;
  // 流动快慢：产能越高，光点跑得越快（2.2s 最快 ~ 7s 最慢）
  const flowDur = Math.max(2.2, Math.min(7, 8 - result.Tshift / 45));
  // 在制品堆积块数（M3 占订单比例，封顶 16 块）
  const wipBlocks = total > 0 ? Math.min(16, Math.round((result.M3 / total) * 16)) : 0;
  // 报废红块（M5，封顶 12 块）
  const scrapBlocks = Math.min(12, result.M5);

  // 跑班时的活体读数：班次进度→累计产出/在制品，终态与稳态一致
  const live = useMemo(() => {
    if (!isPlaying) return null;
    const c = cumAt(result.capByNode, total, playT);
    const good = Math.floor(c[c.length - 1] * (1 - params.p / 100));
    const wip = Math.max(0, total - good);
    return { c, good, wip, pct: total > 0 ? Math.min(1, good / total) : 0 };
  }, [isPlaying, playT, result.capByNode, total, params.p]);

  const shownPct = live ? live.pct : pct;
  const shownM1 = live ? live.good : result.M1;
  const liveWipBlocks = live
    ? (total > 0 ? Math.min(16, Math.round((live.wip / total) * 16)) : 0)
    : wipBlocks;

  return (
    <section className="sim">
      <header className="sim-head">
        <h1 className="sim-title">工厂模拟器</h1>
        <p className="sim-sub">
          你当一天厂长：下面 4 道是「车间生产加工」的内部工序，调一调机器和订单，整条线怎么转一眼就懂。不用记任何术语，先玩起来。
        </p>
      </header>

      {/* 控制条：接单 + 全局参数 */}
      <div className="sim-controls">
        <div className="sim-order">
          <span className="sim-order-label">这单要交</span>
          <div className="sim-stepper">
            <button type="button" aria-label="少接一点" disabled={params.Q <= 20}
              onClick={() => setNum('Q', params.Q - 10)}><Icon name="minus" size={16} /></button>
            <span className="sim-stepper-val">{params.Q}<span className="sim-stepper-unit">件</span></span>
            <button type="button" aria-label="多接一点" disabled={params.Q >= 500}
              onClick={() => setNum('Q', params.Q + 10)}><Icon name="plus" size={16} /></button>
          </div>
        </div>

        <label className="sim-range">
          <span className="sim-range-label">做坏的比例 <b>{params.p}%</b></span>
          <input type="range" min={0} max={20} step={1} value={params.p}
            onChange={(e) => setNum('p', Number(e.target.value))} aria-label="做坏的比例" />
        </label>

        <label className="sim-range">
          <span className="sim-range-label">一次投多少件（批量） <b>{params.B}</b></span>
          <input type="range" min={20} max={400} step={10} value={params.B}
            onChange={(e) => setNum('B', Number(e.target.value))} aria-label="一次投多少件" />
        </label>

        <div className="sim-toggles">
          <button type="button" className={`sim-toggle${params.swapOn ? ' is-on' : ''}`}
            onClick={() => { setParams((p) => ({ ...p, swapOn: !p.swapOn })); setRecent('swap'); }}>
            <Icon name="repeat" size={16} /> 换型停机（每批停机调机）
          </button>
          <button type="button" className={`sim-toggle${params.shift === 2 ? ' is-on' : ''}`}
            onClick={() => { setParams((p) => ({ ...p, shift: p.shift === 1 ? 2 : 1 })); setRecent('shift'); }}>
            <Icon name="schedule" size={16} /> 加一班（两班倒）
          </button>
          <button type="button" className="sim-reset" onClick={() => { setParams(DEFAULT_PARAMS); setRecent(null); }}>
            <Icon name="reset" size={16} /> 回到默认
          </button>
        </div>
      </div>

      {/* ═══ 活体产线（hero）：光点流动 + 瓶颈闪红 + 仪表跳动 + 在制品堆积 ═══ */}
      <div className="sim-live">
        <div className="sim-live-head">
          <span className="sim-live-title"><Icon name="factory" size={20} /> 活体产线</span>
          <span className="sim-live-hint">光点 = 在制品流动 · 红色脉冲 = 卡住的工序</span>
        </div>

        {/* 跑班播放条：点播放后这班从头跑到尾，在制品随班次慢慢堆起来 */}
        <div className="sim-playbar">
          <button type="button" className="sim-play-btn" onClick={togglePlay}
            aria-label={play === 'playing' ? '暂停播放' : '播放这一班'}>
            <Icon name={play === 'playing' ? 'pause' : 'play'} size={20} />
            {play === 'playing' ? '暂停' : play === 'paused' ? '继续' : play === 'done' ? '重跑' : '跑班'}
          </button>
          <button type="button" className="sim-play-reset" onClick={resetPlay}
            aria-label="重置播放" disabled={play === 'idle'}>
            <Icon name="reset" size={16} /> 重置
          </button>
          <div className="sim-play-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round((playT / SHIFT_MIN) * 100)}>
            <div className="sim-play-fill" style={{ width: `${(playT / SHIFT_MIN) * 100}%` }} />
          </div>
          <span className="sim-play-time">
            {(playT / 60).toFixed(1)} / 8 小时
            {play === 'done' && <b className="sim-play-done">· 本班跑完</b>}
          </span>
        </div>

        <div className="sim-live-body">
          {/* 传送带：4 道工序 + 3 段流动的光点 */}
          <div className="sim-track" style={{ '--flow-dur': `${flowDur}s` } as CSSProperties}>
            {STATIONS.map((st) => {
              const isBn = result.bottleneckIndex === st.idx;
              const mparam = MACHINE_PARAM[st.idx];
              const count = mparam ? params[mparam] : 1;
              const cap = result.capByNode[st.idx];
              const idle = result.idleByNode[st.idx]?.idle ?? 0;
              const busy = 100 - idle;
              const range = mparam ? MACHINE_RANGE[mparam] : null;
              // 跑班实时状态：累计完成数 + 瓶颈拥堵 / 下游饥饿
              const liveCount = live ? live.c[st.idx] : null;
              let liveStatus: 'bn' | 'blocked' | 'starved' | null = null;
              if (live && play !== 'idle' && playT > 10) {
                if (isBn) liveStatus = 'bn';
                else if (st.idx < result.bottleneckIndex) {
                  if (live.c[st.idx] > live.c[st.idx + 1] && live.c[st.idx] < total) liveStatus = 'blocked';
                } else if (live.c[st.idx] >= live.c[st.idx - 1] && live.c[st.idx - 1] > 0) {
                  liveStatus = 'starved';
                }
              }
              return (
                <Fragment key={st.idx}>
                  <div className={`sim-cell${isBn ? ' is-bn' : ''}${live && play === 'playing' ? ' is-live' : ''}`}>
                    <div className="sim-cell-pulse" aria-hidden="true" />
                    <div className="sim-cell-head">
                      <span className="sim-cell-ic"><Icon name={st.icon} size={20} /></span>
                      <span className="sim-cell-name">{st.name}</span>
                      {isBn && <span className="sim-cell-badge">最卡</span>}
                      {live && (
                        <span className={`sim-cell-live${liveStatus ? ` is-${liveStatus}` : ''}`}>
                          {liveStatus === 'blocked' ? '干等料出不去' : liveStatus === 'starved' ? '等料停工' : liveStatus === 'bn' ? '前面积压' : '运转中'}
                        </span>
                      )}
                    </div>
                    <div className="sim-cell-std">{st.std} 分 / 件</div>
                    <div className="sim-cell-cap">产能 <b>{cap}</b> 件/班</div>
                    {live && <div className="sim-cell-livecount">本班已做 <b>{liveCount}</b> 件</div>}

                    <div className="sim-cell-machines">
                      <span className="sim-cell-ml">机台</span>
                      {mparam && range ? (
                        <div className="sim-stepper sim-stepper-sm">
                          <button type="button" aria-label={`${st.name}减一台`} disabled={count <= range.min}
                            onClick={() => changeMachine(st.idx, -1)}><Icon name="minus" size={16} /></button>
                          <span className="sim-stepper-val">{count}<span className="sim-stepper-unit">台</span></span>
                          <button type="button" aria-label={`${st.name}加一台`} disabled={count >= range.max}
                            onClick={() => changeMachine(st.idx, 1)}><Icon name="plus" size={16} /></button>
                        </div>
                      ) : (
                        <span className="sim-cell-fixed">1 台（固定）</span>
                      )}
                    </div>

                    <div className="sim-cell-util">
                      <div className="sim-cell-bar" role="img" aria-label={`${st.name}开工率约 ${busy}%`}>
                        <i style={{ width: `${busy}%` }} />
                      </div>
                      <span className="sim-cell-util-num">开工 {busy}%</span>
                    </div>
                  </div>

                  {st.idx < STATIONS.length - 1 && (
                    <div className={connClass(st.idx, result.bottleneckIndex, isPlaying)} aria-hidden="true">
                      <span className="sim-dot" />
                      <span className="sim-dot" />
                      <span className="sim-dot" />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* 末端读数：吞吐仪表 + 在制品堆积 + 报废红块 */}
          <aside className="sim-readout" aria-label="产线实时读数">
            <ThroughputGauge pct={shownPct} value={shownM1} unit="件" live={isPlaying} />

            <div className="sim-pile">
              <div className="sim-pile-head">
                <span><Icon name="boxes" size={16} /> 在制品堆积</span>
                <b>{result.M3}<span>件</span></b>
              </div>
              <div className="sim-pile-bed">
                {Array.from({ length: liveWipBlocks }).map((_, i) => (
                  <span className="sim-pile-blk" key={i} style={{ '--i': i } as CSSProperties} />
                ))}
                {wipBlocks === 0 && <span className="sim-pile-empty">半路没堆货</span>}
              </div>
            </div>

            <div className="sim-scrap">
              <div className="sim-scrap-head">
                <span><Icon name="warn" size={16} /> 做坏扔掉</span>
                <b>{result.M5}<span>件</span></b>
              </div>
              <div className="sim-scrap-bed">
                {Array.from({ length: scrapBlocks }).map((_, i) => (
                  <span className="sim-scrap-blk" key={i} />
                ))}
                {scrapBlocks === 0 && <span className="sim-scrap-empty">没报废</span>}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* 结果条 */}
      <div className="sim-result">
        这单 <b>{params.Q}</b> 件 → 每班最多流出 <b>{result.Tshift}</b> 件 → 合格发货 <b className="tone-good">{result.M1}</b> 件，
        卡在半路 <b className="tone-warn">{result.M3}</b> 件，要 <b>{result.M4 ?? '交不完'}</b> 天交完。
      </div>

      {/* 7 指标卡 */}
      <div className="sim-metrics">
        <h2 className="sim-board-title">整条线现在这样</h2>
        <div className="sim-metric-grid">
          {METRICS.map((m) => {
            const v = m.key === 'M4' ? (result[m.key] ?? '交不完') : result[m.key];
            return (
              <div key={m.key} className={`sim-metric${m.tone ? ` tone-${m.tone}` : ''}`}>
                <span className="sim-metric-label">{m.label}</span>
                <span key={String(v)} className="sim-metric-value">
                  {v}<span className="sim-metric-unit">{m.unit}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 大白话反馈 */}
      <div className="sim-feedback">
        <Icon name="quote" size={20} />
        <p>{FEEDBACK[feedback]}</p>
      </div>

      {/* 这趟看懂的 7 件事（进阶深链） */}
      <details className="sim-concepts">
        <summary>这趟能看懂的 7 件事（点开看原理，去知识图 / 词典深挖）</summary>
        <ul className="sim-concept-list">
          {CONCEPTS.map((c) => (
            <li key={c.label} className="sim-concept">
              <div className="sim-concept-main">
                <span className="sim-concept-label">{c.label}</span>
                <span className="sim-concept-term">在工厂里叫：{c.term}</span>
              </div>
              <div className="sim-concept-links">
                <Link className="text-link" to={`/knowledge-graph/concept/${c.concept}`}>
                  知识图 <Icon name="arrow-right" size={16} />
                </Link>
                <Link className="text-link" to={`/dictionary?q=${encodeURIComponent(c.dict)}`}>
                  词典「{c.dict}」 <Icon name="arrow-right" size={16} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </details>

      {/* 简化假设 */}
      <details className="sim-assumptions">
        <summary>这个模拟为了简化，做了哪些假设？</summary>
        <ul>
          <li>产线固定为 4 道工序串行（下料 → 机加工 → 组装 → 检验），每道工序默认 1 台设备。</li>
          <li>换型只扣最慢那道工序的时间，真实工厂换型会影响整条线节拍。</li>
          <li>「卡在半路的半成品」在「跑班」播放里会随班次一点点堆起来——点产线顶部的「跑班」，就能看见它从 0 涨到终态值，瓶颈前面越堆越高、下游在干等。</li>
          <li>本版只算「流不流得动」，不算「赚不赚钱」——工资、电费、设备折旧都没算进去。</li>
        </ul>
      </details>

      {/* 桥接完整工厂全景 */}
      <Link to="/order-to-delivery" className="sim-bridge">
        <span className="sim-bridge-ic"><Icon name="routing" size={24} /></span>
        <span className="sim-bridge-body">
          <span className="sim-bridge-title">这 4 道，是「车间生产加工」内部工序</span>
          <span className="sim-bridge-sub">
            它只是订单到交付 16 步里的第 9 步。看完整业务流、每步配什么单据 →
          </span>
        </span>
        <span className="sim-bridge-go">看订单到交付全景 <Icon name="arrow-right" size={16} /></span>
      </Link>
    </section>
  );
}
