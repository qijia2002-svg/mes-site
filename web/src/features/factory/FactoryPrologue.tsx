/**
 * 工厂一日游 · 零基础序章（P0，来自专家评审结论）。
 *
 * 为什么存在：专家 PM + 架构师评审一致判定，平台对「零基础理解工厂」是 partial——
 * 缺一个"什么是工厂"的入门坡道（全库 grep "序章/什么是工厂" = 0 命中），首屏直接是
 * 客户下单→MPS→MRP→BOM 的 12 环节，门外汉被专业术语劝退。
 *
 * 做法：纯前端首访弹层 + localStorage 记忆。不改后端、不碰 D1、不引入新依赖。
 * 内容全程不出现 MPS/MRP/BOM，只建立"工厂=一群人按计划把物料变成产品发出去"的朴素心智，
 * 把"理解工厂"和"成为实施工程师"两条目标解耦（专家 P0 建议）。
 *
 * 设计纪律（P0 硬规则）：令牌配色（零裸 hex）、语义图标（无 emoji）、无紫粉渐变、
 * 无弹性缓动（只用 --ease-standard）。
 */
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';

type Slide = { icon: IconName; title: string; body: string };

const SLIDES: Slide[] = [
  {
    icon: 'factory',
    title: '工厂，其实很简单',
    body: '一群人，按计划，把买来的物料，变成能卖的产品，再发出去。就这几件事：来料、做活、出货、对账。',
  },
  {
    icon: 'compass',
    title: '工厂里都有谁',
    body: '计划（排活）、采购（买料）、车间（做活）、质检（把关）、仓库（收发）。每人管一段，串成一条线。',
  },
  {
    icon: 'paths',
    title: '工厂一天在干嘛',
    body: '客户下单 → 计划排产 → 采购备料 → 车间生产 → 质检 → 入库发货。一张订单走完这趟，产品就出门了。',
  },
  {
    icon: 'show',
    title: '为什么你会需要 MES',
    body: '人少活少，脑子记记就行；人多了、活多了，靠脑子记不过来。MES 就是把这套流程搬上电脑，让每个环节可追溯、可对账。',
  },
  {
    icon: 'courses',
    title: '接下来怎么学',
    body: '点「开始逛工厂」，我们带你按一张真实订单，走完 12 个环节。碰到不懂的词，随时点开看大白话。',
  },
];

const STORAGE_KEY = 'factory_prologue_seen_v1';

export function markPrologueSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

export function hasSeenPrologue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true; // 读取失败时不强制弹窗
  }
}

export default function FactoryPrologue({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = SLIDES.length - 1;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const s = SLIDES[step];
  const goNext = () => (step < last ? setStep(step + 1) : onClose());

  return (
    <div className="prologue" role="dialog" aria-modal="true" aria-label="工厂一日游">
      <style>{`
        .prologue{position:fixed;inset:0;z-index:var(--z-modal);display:grid;place-items:center;
          padding:var(--space-4);background:var(--app-scrim);
          animation:prologue-in var(--motion-slow) var(--ease-standard)}
        @keyframes prologue-in{from{opacity:0}to{opacity:1}}
        .prologue-card{width:min(560px,100%);max-height:90vh;overflow:auto;background:var(--surface);
          border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--elev-modal);
          display:flex;flex-direction:column}
        .prologue-head{display:flex;align-items:flex-start;gap:var(--space-3);
          padding:var(--space-5) var(--space-5) var(--space-3)}
        .prologue-mark{flex:none;display:inline-flex;align-items:center;justify-content:center;
          width:40px;height:40px;border-radius:var(--radius-md);
          background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)}
        .prologue-titles{flex:1;min-width:0}
        .prologue-kicker{margin:0 0 2px;font-size:var(--text-xs);letter-spacing:.08em;
          color:var(--meta);text-transform:uppercase}
        .prologue-title{margin:0;font-size:var(--text-lg);font-weight:var(--weight-announce-cjk);
          color:var(--fg);line-height:1.3}
        .prologue-x{flex:none;display:inline-flex;padding:4px;border:0;background:transparent;
          color:var(--muted);border-radius:var(--radius-md);cursor:pointer}
        .prologue-x:hover{color:var(--fg);background:var(--border-soft)}
        .prologue-body{padding:0 var(--space-5) var(--space-4)}
        .prologue-body p{margin:0;font-size:var(--text-base);line-height:1.75;color:var(--fg-2)}
        .prologue-foot{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);
          padding:var(--space-4) var(--space-5);border-top:1px solid var(--border-soft)}
        .prologue-dots{display:flex;gap:6px}
        .prologue-dot{width:8px;height:8px;border-radius:50%;background:var(--border);
          transition:background var(--motion-fast) var(--ease-standard)}
        .prologue-dot.is-active{background:var(--accent)}
        .prologue-actions{display:flex;align-items:center;gap:var(--space-2)}
      `}</style>

      <div className="prologue-card">
        <header className="prologue-head">
          <span className="prologue-mark">
            <Icon name={s.icon} size={20} />
          </span>
          <div className="prologue-titles">
            <p className="prologue-kicker">工厂一日游</p>
            <h2 className="prologue-title">{s.title}</h2>
          </div>
          <button type="button" className="prologue-x" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="prologue-body">
          <p>{s.body}</p>
        </div>

        <footer className="prologue-foot">
          <div className="prologue-dots" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span key={i} className={`prologue-dot${i === step ? ' is-active' : ''}`} />
            ))}
          </div>
          <div className="prologue-actions">
            {step > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}>
                <Icon name="arrow-left" size={16} /> 上一屏
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={goNext}>
              {step < last ? '下一屏' : '开始逛工厂'} <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
