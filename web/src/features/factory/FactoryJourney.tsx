/**
 * 工厂全景 · 手机纵向旅程视图（双模式之一）。
 *
 * 与 FactoryFlow（桌面四泳道全景）共用同一批真实节点数据、同一套阶段配色（--phase-*）、
 * 同一个 NodeDrawer（窄屏自动变底部 sheet）。差异只在排版：这里按「6 站主线」竖向分组，
 * 更贴合竖屏单手浏览；FactoryFlow 按「四阶段」横向分泳道，更适合宽屏。
 *
 * 数据零硬编码：节点来自 FactoryPage 的 buildSteps 结果，分组键来自 stageKeyOf()，
 * 一句话来自 oneLinerOf()，阶段元信息来自 FlowStageDTO（后端优先，缺则 DEFAULT_STAGES）。
 *
 * P0：零硬编码色（全 var(--token)）· 图标全走 Icon.tsx 注册表 · 无 emoji · 无弹跳缓动。
 */
import { useState, type CSSProperties } from 'react';
import { Icon, isIconName, type IconName } from '../../components/Icon';
import type { NodeResourceDTO, FlowStageDTO } from '../../api/endpoints';
import type { LaidNode, Phase } from './factoryFlow.data';
import { PHASE_LABEL } from './factoryFlow.data';
import { stageKeyOf, oneLinerOf } from './factoryStages.data';
import type { NodeStatusApi } from './useNodeStatus';
import NodeDrawer from './NodeDrawer';

/** 站 → 代表阶段配色（用于站头左侧色点）。取该站首个节点的 phase。 */
function stagePhaseOf(stageKey: string, nodes: LaidNode[]): Phase {
  const n = nodes.find((x) => stageKeyOf(x) === stageKey);
  return n?.phase ?? 'plan';
}

export interface FactoryJourneyProps {
  nodes: LaidNode[];
  stages: FlowStageDTO[];
  isDone: (type: string, refId: number) => boolean;
  status: NodeStatusApi;
  resourcesByNode: Map<number, NodeResourceDTO[]>;
  selectedKey: string | null;
  /** 传 null 关闭抽屉；传同一 key 由父级决定 toggle（这里走 closeSignal）。 */
  onSelect: (key: string | null) => void;
}

export default function FactoryJourney({
  nodes, stages, isDone, status, resourcesByNode, selectedKey, onSelect,
}: FactoryJourneyProps) {
  // 「再点同一个节点」= 关闭。交给抽屉自己走退场动画，父级只发信号。
  const [closeSignal, setCloseSignal] = useState(0);
  const pick = (key: string) => {
    if (key === selectedKey) setCloseSignal((c) => c + 1);
    else onSelect(key);
  };

  // 按站排序后逐站分组节点；某站后端没下发节点时这一站不渲染（不打空骨架）。
  const orderedStages = [...stages].sort((a, b) => a.sort - b.sort);
  const groups = orderedStages
    .map((stage) => ({
      stage,
      items: nodes.filter((n) => stageKeyOf(n) === stage.stageKey),
    }))
    .filter((g) => g.items.length > 0);

  const selected = selectedKey ? nodes.find((n) => n.key === selectedKey) ?? null : null;
  const selectedIndex = selected ? nodes.indexOf(selected) : -1;

  return (
    <div className="fj">
      <style>{`
        .fj{color:var(--fg)}
        .fj *{box-sizing:border-box}
        .fj-intro{margin:0 0 var(--space-5);color:var(--muted);font-size:var(--text-sm)}
        .fj-stage{position:relative;padding-left:var(--space-5);margin-bottom:var(--space-7)}
        .fj-stage::before{content:'';position:absolute;left:5px;top:6px;bottom:0;width:2px;
          background:color-mix(in srgb, var(--ph) 28%, transparent);border-radius:2px}
        .fj-stage:last-child::before{display:none}
        .fj-stage-dot{position:absolute;left:0;top:4px;width:12px;height:12px;border-radius:50%;
          background:var(--ph);box-shadow:0 0 0 4px var(--surface)}
        .fj-stage-head{display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)}
        .fj-stage-ic{color:var(--ph);display:flex;flex:none}
        .fj-stage-t{font-size:var(--text-base);font-weight:var(--weight-emph-cjk);color:var(--fg-2)}
        .fj-stage-c{margin-left:auto;font-size:var(--text-xs);color:var(--meta);
          font-variant-numeric:tabular-nums}
        .fj-stage-sub{margin:2px 0 0;font-size:var(--text-xs);color:var(--muted)}

        .fj-node{position:relative;width:100%;text-align:left;font-family:inherit;cursor:pointer;
          display:flex;align-items:center;gap:var(--space-3);overflow:hidden;min-height:60px;
          background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius-md);
          padding:var(--space-3) var(--space-3) var(--space-3) var(--space-4);margin-bottom:var(--space-2);
          transition:border-color var(--motion-fast) var(--ease-standard),
            background var(--motion-fast) var(--ease-standard),
            box-shadow var(--motion-fast) var(--ease-standard)}
        .fj-node::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
          background:var(--ph);opacity:.75}
        .fj-node:active{border-color:var(--card-border-hover);background:var(--surface-2)}
        .fj-node[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .fj-node.is-next{border-color:var(--accent-border);box-shadow:0 0 0 3px var(--accent-soft)}
        .fj-node .fic{color:var(--muted);display:flex;flex:none;
          transition:color var(--motion-fast) var(--ease-standard)}
        .fj-node[aria-pressed="true"] .fic{color:var(--accent)}
        .fj-node .ftx{min-width:0;flex:1}
        .fj-node .ftitle{display:block;font-size:var(--text-base);font-weight:var(--weight-emph-cjk);
          line-height:var(--leading-snug);color:var(--fg);
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .fj-node .fone{display:block;margin-top:2px;font-size:var(--text-xs);color:var(--meta);
          line-height:var(--leading-snug);overflow:hidden;text-overflow:ellipsis;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .fj-node .fone .here{color:var(--accent);font-weight:var(--weight-emph-cjk)}
        .fj-node .fstate{flex:none;display:flex}
        .fj-node .fstate.is-practiced{color:var(--success)}
        .fj-node .fstate.is-touched{color:var(--border-strong)}
        .fj-node .fchev{flex:none;color:var(--muted)}
        @media(min-width:640px){
          .fj{max-width:680px}
          .fj-stage{max-width:680px}
        }
      `}</style>

      <p className="fj-intro">顺着订单走一遍：先接单、再备料、上线生产、质检、发货。点任意环节看它管什么、就地动手练。</p>

      {groups.map(({ stage, items }) => {
        const ph = stagePhaseOf(stage.stageKey, nodes);
        const doneInStage = items.filter((n) => status.statusOf(n) === 'practiced').length;
        return (
          <section key={stage.stageKey} className="fj-stage" style={{ '--ph': `var(--phase-${ph})` } as CSSProperties}>
            <span className="fj-stage-dot" />
            <header>
              <div className="fj-stage-head">
                <span className="fj-stage-ic">
                  <Icon name={isIconName(stage.icon) ? (stage.icon as IconName) : 'compass'} size={20} />
                </span>
                <span className="fj-stage-t">{stage.title}</span>
                <span className="fj-stage-c tabular">{doneInStage}/{items.length}</span>
              </div>
              {stage.subtitle && <p className="fj-stage-sub">{stage.subtitle}</p>}
            </header>

            {items.map((n) => {
              const st = status.statusOf(n);
              const isNext = n.key === status.nextKey;
              const one = oneLinerOf(n) || n.description || '';
              return (
                <button
                  key={n.key}
                  type="button"
                  className={`fj-node${isNext ? ' is-next' : ''}`}
                  style={{ '--ph': `var(--phase-${n.phase})` } as CSSProperties}
                  aria-pressed={selectedKey === n.key}
                  onClick={() => pick(n.key)}
                >
                  <span className="fic">
                    <Icon name={isIconName(n.icon) ? (n.icon as IconName) : 'process'} size={20} />
                  </span>
                  <span className="ftx">
                    <span className="ftitle">{n.label}</span>
                    <span className="fone">
                      {one}
                      {isNext && <span className="here"> · 从这里继续</span>}
                    </span>
                  </span>
                  {st === 'practiced' && (
                    <span className="fstate is-practiced"><Icon name="check-circle" size={16} label="已练过" /></span>
                  )}
                  {st === 'touched' && (
                    <span className="fstate is-touched"><Icon name="confirm" size={16} label="已了解" /></span>
                  )}
                  <span className="fchev"><Icon name="chevron-right" size={20} /></span>
                </button>
              );
            })}
          </section>
        );
      })}

      {selected && (
        <NodeDrawer
          node={selected}
          resources={resourcesByNode.get(selected.id) ?? []}
          isDone={isDone}
          practiced={status.statusOf(selected) === 'practiced'}
          prev={selectedIndex > 0 ? nodes[selectedIndex - 1] : null}
          next={selectedIndex >= 0 && selectedIndex < nodes.length - 1 ? nodes[selectedIndex + 1] : null}
          closeSignal={closeSignal}
          onNavigate={onSelect}
          onClose={() => onSelect(null)}
        />
      )}
    </div>
  );
}
