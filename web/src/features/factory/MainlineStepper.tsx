/**
 * 6 站主线阶梯（UIUX §2.2 / SPEC §5）——学员的唯一叙事轴。
 *
 * 三态口径（不新增任何色相，全走 --ml-* token）：
 *   done    --ml-done-bg  + --ml-done-ring 描边环 + success 图标
 *   current --ml-current-bg + 2px --ml-current-marker 指示条 + you-are-here 图标
 *   locked  --ml-locked-bg + lock 图标
 *
 * 两条不能破的规矩：
 *  1. **锁 = 软引导，不是硬锁**（ADR-018）。点锁定站不是死路：先给因果
 *     「先完成第 N 站，那一站的概念这里会用到」，再放一个「仍然去看看」放行。
 *     强制拦截会把零基础直接劝退，这正是本次重构要治的病。
 *  2. **锁定站的标题必须可读**。--state-disabled-opacity 只压图标与进度点，
 *     绝不压标题——可见不可入 = 方向感；标题也糊掉 = 焦虑感。
 *
 * P0：零硬编码色 · 图标全走 Icon.tsx 注册表 · 无 emoji · 无渐变 · 无弹跳缓动。
 */
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import type { StageStatus, StageView } from './useStageProgress';

const STATUS_ICON: Record<StageStatus, IconName> = {
  done: 'success',
  current: 'you-are-here',
  locked: 'lock',
};

const STATUS_TEXT: Record<StageStatus, string> = {
  done: '已完成',
  current: '进行中',
  locked: '未解锁',
};

export interface MainlineStepperProps {
  stages: StageView[];
  /** 跳到某个节点（打开它的抽屉）。 */
  onGoto: (nodeKey: string) => void;
}

export default function MainlineStepper({ stages, onGoto }: MainlineStepperProps) {
  // 展开软引导的站；null = 没有。只允许一个，避免整条阶梯被说明文字撑开。
  const [hintKey, setHintKey] = useState<string | null>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  // 移动端横向 chip 条：当前站自动滚入视野，别让人横着找自己在哪。
  useEffect(() => {
    const rail = railRef.current;
    const cur = currentRef.current;
    if (!rail || !cur) return;
    if (rail.scrollWidth <= rail.clientWidth) return;
    const target = cur.offsetLeft - (rail.clientWidth - cur.clientWidth) / 2;
    rail.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [stages]);

  if (stages.length === 0) return null;

  const go = (stage: StageView) => {
    if (!stage.entryKey) return;
    if (stage.status === 'locked') {
      // 不拦截，只是先把因果摆出来；真要去，点展开后的「仍然去看看」。
      setHintKey((k) => (k === stage.stageKey ? null : stage.stageKey));
      return;
    }
    setHintKey(null);
    onGoto(stage.entryKey);
  };

  return (
    <nav className="ml" aria-label="学习主线 6 站">
      <style>{`
        .ml{margin:0 0 var(--space-6)}
        .ml-head{display:flex;align-items:baseline;gap:var(--space-3);flex-wrap:wrap;
          margin-bottom:var(--space-3)}
        .ml-head h2{margin:0;font-size:var(--text-base);font-weight:var(--weight-emph-cjk);
          color:var(--fg)}
        .ml-head .sub{font-size:var(--text-xs);color:var(--meta)}

        .ml-rail{display:flex;gap:var(--ml-row-gap);list-style:none;margin:0;padding:0 0 var(--space-1);
          overflow-x:auto;scrollbar-width:thin}
        .ml-item{flex:1 1 0;min-width:132px}

        .ml-btn{position:relative;width:100%;min-height:var(--ml-row-h);display:flex;
          align-items:center;gap:var(--space-2);text-align:left;font-family:inherit;cursor:pointer;
          padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);
          background:var(--surface);border:1px solid var(--border);
          transition:background var(--motion-fast) var(--ease-standard),
            border-color var(--motion-fast) var(--ease-standard),
            box-shadow var(--motion-fast) var(--ease-standard)}
        .ml-btn:hover{border-color:var(--border-strong)}

        /* done：描边环表示「走过了」，不填色不抢注意力 */
        .ml-item[data-state="done"] .ml-btn{background:var(--ml-done-bg);
          border-color:var(--ml-done-ring);color:var(--ml-done-fg)}
        .ml-item[data-state="done"] .ml-ic{color:var(--ml-done-ring)}

        /* current：全页 accent 配额之一（另一处给主 CTA），左侧 2px 指示条 */
        .ml-item[data-state="current"] .ml-btn{background:var(--ml-current-bg);
          border-color:var(--accent-border);color:var(--ml-current-fg)}
        .ml-item[data-state="current"] .ml-btn::before{content:'';position:absolute;
          left:0;top:var(--space-2);bottom:var(--space-2);width:var(--ml-marker-w);
          border-radius:var(--radius-pill);background:var(--ml-current-marker)}
        .ml-item[data-state="current"] .ml-ic{color:var(--ml-current-marker)}
        .ml-item[data-state="current"] .ml-name{font-weight:var(--weight-emph-cjk)}

        /* locked：底色降一档 + 图标/进度点弱化。标题保持 --ml-locked-fg，绝不压 opacity */
        .ml-item[data-state="locked"] .ml-btn{background:var(--ml-locked-bg);
          border-color:var(--border-soft)}
        .ml-item[data-state="locked"] .ml-name{color:var(--ml-locked-fg)}
        .ml-item[data-state="locked"] .ml-ic,
        .ml-item[data-state="locked"] .ml-dots{opacity:var(--ml-locked-opacity)}

        .ml-ic{flex:none;display:flex;color:var(--muted);
          transition:color var(--motion-fast) var(--ease-standard)}
        .ml-tx{min-width:0;flex:1}
        .ml-no{font-size:var(--text-xs);color:var(--meta);font-variant-numeric:tabular-nums}
        .ml-name{display:block;font-size:var(--text-sm);line-height:var(--leading-snug);
          color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ml-dots{display:flex;gap:var(--ml-dot-gap);margin-top:var(--space-1);align-items:center}
        .ml-dot{width:var(--ml-dot-size);height:var(--ml-dot-size);border-radius:var(--radius-pill);
          background:var(--progress-track);flex:none}
        .ml-dot.is-on{background:var(--progress-fill-done)}
        .ml-soon{font-size:var(--text-xs);color:var(--meta)}

        /* 软引导：给因果 + 放行，不做死路 */
        .ml-hint{display:flex;align-items:flex-start;gap:var(--space-2);
          margin-top:var(--space-3);padding:var(--space-3);
          background:var(--surface-2);border:1px solid var(--border-soft);
          border-radius:var(--radius-sm)}
        .ml-hint p{margin:0;flex:1;font-size:var(--text-sm);color:var(--fg-2);
          line-height:var(--leading-body)}
        .ml-hint-ic{flex:none;display:flex;color:var(--muted);margin-top:1px}
        .ml-anyway{flex:none;display:inline-flex;align-items:center;gap:var(--space-1);
          padding:var(--space-1) var(--space-2);border-radius:var(--radius-xs);
          background:none;border:1px solid var(--border);color:var(--fg-2);
          font-family:inherit;font-size:var(--text-xs);cursor:pointer;
          transition:border-color var(--motion-fast) var(--ease-standard),
            color var(--motion-fast) var(--ease-standard)}
        .ml-anyway:hover{border-color:var(--accent-border);color:var(--accent-active)}

        @media(max-width:768px){
          .ml-item{flex:0 0 auto;min-width:148px}
        }
      `}</style>

      <div className="ml-head">
        <h2>跟一张订单走完工厂</h2>
        <span className="sub">6 站主线，按订单在厂里的真实流转顺序</span>
      </div>

      <ol className="ml-rail" ref={railRef}>
        {stages.map((s, i) => {
          const open = hintKey === s.stageKey;
          return (
            <li
              key={s.stageKey}
              className="ml-item"
              data-state={s.status}
              ref={s.status === 'current' ? currentRef : undefined}
            >
              <button
                type="button"
                className="ml-btn"
                onClick={() => go(s)}
                aria-current={s.status === 'current' ? 'step' : undefined}
                aria-expanded={s.status === 'locked' ? open : undefined}
                disabled={!s.entryKey}
              >
                <span className="ml-ic">
                  <Icon name={STATUS_ICON[s.status]} size={16} label={STATUS_TEXT[s.status]} />
                </span>
                <span className="ml-tx">
                  <span className="ml-no">第 {i + 1} 站</span>
                  <span className="ml-name">{s.title}</span>
                  {s.hasContent ? (
                    <span className="ml-dots">
                      {Array.from({ length: s.practicableNodes }, (_, d) => (
                        <span
                          key={d}
                          className={`ml-dot${d < s.practicedNodes ? ' is-on' : ''}`}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="ml-soon">内容待上线</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {stages.map((s) =>
        hintKey === s.stageKey ? (
          <div className="ml-hint" key={s.stageKey} role="status">
            <span className="ml-hint-ic"><Icon name="info" size={16} /></span>
            <p>{s.guidance}</p>
            <button
              type="button"
              className="ml-anyway"
              onClick={() => {
                setHintKey(null);
                if (s.entryKey) onGoto(s.entryKey);
              }}
            >
              <Icon name="arrow-right" size={16} />
              仍然去看看
            </button>
          </div>
        ) : null,
      )}
    </nav>
  );
}
