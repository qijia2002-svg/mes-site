/**
 * 工厂模拟器（方案 A · 抽象数字流）—— 重建自旧「工厂搭建」沙盒。
 * 形态：顶部 7 概念标签 + 中部 5 滑块 / 7 指标卡 + 底部大白话反馈。
 * 计算全部来自 simCalc.ts（产能限流模型），本文件只做呈现与交互。
 *
 * 铁律（零基础定位）：主界面禁止出现 MES / MRP / BOM / APS / OEE 缩写，
 * 专业术语只在「进阶」折叠面板里出现。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import {
  runSim,
  pickFeedback,
  FEEDBACK,
  DEFAULT_PARAMS,
  type SimParams,
  type SimResult,
} from './simCalc';
import './FactorySimPage.css';

type TagId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface TagDef {
  id: TagId;
  label: string;
  icon: IconName;
  kind: 'reveal' | 'switch';
  toggle?: 'swap' | 'shift';
  term: string;
  concept: string; // 知识图概念 key
  dict: string; // 词典搜索词
}

const TAGS: TagDef[] = [
  { id: 1, label: '哪道工序最卡', icon: 'cog', kind: 'reveal', term: '瓶颈 / 约束（TOC 约束理论）', concept: 'bottleneck', dict: 'CAPACITY' },
  { id: 2, label: '半成品堆成山', icon: 'boxes', kind: 'reveal', term: '在制品 WIP（Work In Process）', concept: 'wip', dict: 'WIP' },
  { id: 3, label: '说好的交货时间', icon: 'calendar', kind: 'reveal', term: '交期 / 提前期（Lead Time / Due Date）', concept: 'lead_time', dict: 'DUE DATE' },
  { id: 4, label: '机器在偷懒吗', icon: 'pause', kind: 'reveal', term: '设备闲置率 / 设备综合效率 OEE', concept: 'oee_idle', dict: 'OEE' },
  { id: 5, label: '做坏的那些', icon: 'warn', kind: 'reveal', term: '不良 / 返工 / 报废 / 良率', concept: 'defect', dict: 'DEFECT' },
  { id: 6, label: '一次做多少合适', icon: 'columns', kind: 'switch', toggle: 'swap', term: '批量 / 快速换型 SMED', concept: 'changeover', dict: 'BATCH' },
  { id: 7, label: '加人到底有没有用', icon: 'schedule', kind: 'switch', toggle: 'shift', term: '班次 / 产能 / 负荷', concept: 'work_order', dict: 'SHIFT' },
];

const SLIDERS: { key: 'Q' | 'kb' | 'kf' | 'p' | 'B'; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'Q', label: '这单要交多少货', min: 20, max: 500, step: 10, unit: '件' },
  { key: 'kb', label: '卡住那道工序加几台机器', min: 1, max: 4, step: 1, unit: '台' },
  { key: 'kf', label: '不卡那道工序加几台机器', min: 1, max: 3, step: 1, unit: '台' },
  { key: 'p', label: '做坏的比例', min: 0, max: 20, step: 1, unit: '%' },
  { key: 'B', label: '一次投多少件（批量）', min: 20, max: 400, step: 10, unit: '件' },
];

const METRICS: { key: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7'; label: string; unit: string; reveal: TagId; tone?: 'good' | 'warn' | 'danger' }[] = [
  { key: 'M1', label: '这班交出多少好货', unit: '件', reveal: 1, tone: 'good' },
  { key: 'M2', label: '产线最大能耐', unit: '件/班', reveal: 1 },
  { key: 'M3', label: '卡在半路的半成品', unit: '件', reveal: 2, tone: 'warn' },
  { key: 'M4', label: '真正要几天交完', unit: '天', reveal: 3, tone: 'warn' },
  { key: 'M5', label: '做坏扔掉的', unit: '件', reveal: 5, tone: 'danger' },
  { key: 'M6', label: '做坏返工的', unit: '件', reveal: 5 },
  { key: 'M7', label: '闲着没干的机器占比', unit: '%', reveal: 4, tone: 'warn' },
];

function RevealPanel({ tag, result }: { tag: TagDef; result: SimResult }) {
  switch (tag.id) {
    case 1:
      return (
        <div className="sim-reveal">
          <p className="sim-reveal-lead">
            整条线被 <strong>【{result.bottleneckLabel}】</strong> 卡在 <strong>{result.Tbase}</strong> 件/班。
          </p>
          <p>整条线能出多少，被最慢那道工序死死卡住，别的工序再快也没用。</p>
        </div>
      );
    case 2: {
      const pct = Math.min(100, Math.round((result.M3 / 500) * 100));
      return (
        <div className="sim-reveal">
          <p className="sim-reveal-lead">卡在半路的半成品：<strong>{result.M3}</strong> 件</p>
          <div className="sim-wip-bar" role="img" aria-label={`半成品堆积约 ${pct}%`}>
            <div className="sim-wip-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="sim-reveal-note">这些还没变成钱。</p>
        </div>
      );
    }
    case 3:
      return (
        <div className="sim-reveal">
          <p className="sim-reveal-lead">
            理论加工 <strong>{result.theoreticalMin}</strong> 分/件 ↔ 真实交期 <strong>{result.M4 ?? '交不完'}</strong> 天
          </p>
          <p className="sim-reveal-note">
            系统说每件只要 {result.theoreticalMin} 分钟加工，但你这单要 {result.M4 ?? '交不完'} 个班次才交完。
            中间的差距不是加工，是排队——真实工厂里排队常常占掉八成以上的时间，所以千万别拿理论工时当交期。
          </p>
        </div>
      );
    case 4: {
      const maxIdle = Math.max(...result.idleByNode.map((n) => n.idle));
      return (
        <div className="sim-reveal">
          <p className="sim-reveal-lead">各工序这班的闲置率</p>
          <ul className="sim-idle-list">
            {result.idleByNode.map((n) => (
              <li key={n.label} className={n.idle === maxIdle ? 'is-idle-most' : ''}>
                <span>{n.label}{n.isBottleneck ? '（瓶颈）' : ''}</span>
                <span className="sim-idle-num">{n.idle}%</span>
              </li>
            ))}
          </ul>
          <p className="sim-reveal-note">机器前面没活干只能干等，多半是因为上游或瓶颈没喂饱它，不是工人懒。</p>
        </div>
      );
    }
    case 5:
      return (
        <div className="sim-reveal">
          <div className="sim-quality">
            <span className="tone-good">合格发货 {result.M1} 件</span>
            <span className="tone-warn">返工 {result.M6} 件</span>
            <span className="tone-danger">报废 {result.M5} 件</span>
          </div>
          <p className="sim-reveal-note">返工能修好 92%，剩下的是真扔了。</p>
        </div>
      );
    default:
      return null;
  }
}

export default function FactorySimPage() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [reveal, setReveal] = useState<TagId | null>(null);
  const [adv, setAdv] = useState<TagId | null>(null);
  const [recent, setRecent] = useState<'swap' | 'shift' | null>(null);

  const result = useMemo(() => runSim(params), [params]);
  const feedback = useMemo(() => pickFeedback(params, result, recent), [params, result, recent]);

  function setNum(key: 'Q' | 'kb' | 'kf' | 'p' | 'B', v: number) {
    setParams((p) => ({ ...p, [key]: v }));
    setRecent(null);
  }
  function toggleTag(t: TagDef) {
    if (t.kind === 'switch' && t.toggle) {
      setParams((p) =>
        t.toggle === 'swap'
          ? { ...p, swapOn: !p.swapOn }
          : { ...p, shift: p.shift === 1 ? 2 : 1 },
      );
      setRecent(t.toggle);
      setReveal(null);
    } else {
      setReveal(reveal === t.id ? null : t.id);
      setRecent(null);
    }
  }

  const activeTag = TAGS.find((t) => t.id === reveal) ?? null;
  const advTag = adv !== null ? (TAGS.find((t) => t.id === adv) ?? null) : null;

  return (
    <section className="sim">
      <header className="sim-head">
        <h1 className="sim-title">工厂模拟器</h1>
        <p className="sim-sub">你当一天厂长：调几个数，看整条线怎么转。不用记任何术语，先玩起来。</p>
      </header>

      {/* 概念标签栏 */}
      <div className="sim-tags" aria-label="工厂运营概念">
        {TAGS.map((t) => {
          const on = t.kind === 'switch'
            ? (t.toggle === 'swap' ? params.swapOn : params.shift === 2)
            : reveal === t.id;
          return (
            <div key={t.id} className="sim-tag-wrap">
              <button
                type="button"
                className={`sim-tag${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => toggleTag(t)}
              >
                <Icon name={t.icon} size={20} />
                <span>{t.label}</span>
              </button>
              <button type="button" className="sim-tag-adv" onClick={() => setAdv(adv === t.id ? null : t.id)}>
                进阶 ›
              </button>
            </div>
          );
        })}
      </div>

      {/* 揭示面板（标签 1–5） */}
      {activeTag && <RevealPanel tag={activeTag} result={result} />}

      {/* 进阶面板 */}
      {advTag && (
        <div className="sim-adv">
          <button type="button" className="sim-adv-close" onClick={() => setAdv(null)} aria-label="关闭进阶说明">
            <Icon name="close" size={16} />
          </button>
          <p className="sim-adv-term">这事儿在工厂里叫：<strong>{advTag.term}</strong></p>
          <div className="sim-adv-links">
            <Link className="text-link" to={`/knowledge-graph/concept/${advTag.concept}`}>
              去知识图看看 <Icon name="arrow-right" size={16} />
            </Link>
            <Link className="text-link" to={`/dictionary?q=${encodeURIComponent(advTag.dict)}`}>
              去词典查「{advTag.dict}」 <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* 数字面板 */}
      <div className="sim-board">
        <div className="sim-controls">
          <h2 className="sim-board-title">你来定</h2>
          {SLIDERS.map((s) => (
            <label key={s.key} className="sim-slider">
              <span className="sim-slider-label">{s.label}</span>
              <span className="sim-slider-val">
                {params[s.key]}<span className="sim-slider-unit">{s.unit}</span>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={params[s.key]}
                onChange={(e) => setNum(s.key, Number(e.target.value))}
                aria-label={s.label}
              />
            </label>
          ))}
          <button
            type="button"
            className="sim-reset"
            onClick={() => {
              setParams(DEFAULT_PARAMS);
              setReveal(null);
              setRecent(null);
            }}
          >
            <Icon name="reset" size={16} /> 回到默认
          </button>
        </div>

        <div className="sim-metrics">
          <h2 className="sim-board-title">整条线现在这样</h2>
          <div className="sim-metric-grid">
            {METRICS.map((m) => {
              const v = m.key === 'M4' ? (result[m.key] ?? '交不完') : result[m.key];
              const hot = reveal === m.reveal;
              return (
                <div
                  key={m.key}
                  className={`sim-metric${hot ? ' is-hot' : ''}${m.tone ? ` tone-${m.tone}` : ''}`}
                >
                  <span className="sim-metric-label">{m.label}</span>
                  <span key={String(v)} className="sim-metric-value">
                    {v}<span className="sim-metric-unit">{m.unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 反馈条 */}
      <div className="sim-feedback">
        <Icon name="quote" size={20} />
        <p>{FEEDBACK[feedback]}</p>
      </div>

      {/* 简化假设 */}
      <details className="sim-assumptions">
        <summary>这个模拟为了简化，做了哪些假设？</summary>
        <ul>
          <li>产线固定为 4 道工序串行（下料 → 机加工 → 组装 → 检验），每道工序默认 1 台设备。</li>
          <li>换型只扣最慢那道工序的时间，真实工厂换型会影响整条线节拍。</li>
          <li>「卡在半路的半成品」是投了减流出的终态值，没演示它随时间慢慢堆起来的过程。</li>
          <li>本版只算「流不流得动」，不算「赚不赚钱」——工资、电费、设备折旧都没算进去。</li>
        </ul>
      </details>
    </section>
  );
}
