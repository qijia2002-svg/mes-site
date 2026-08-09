/**
 * 工厂全景地图 v13 —— 只画流程图，别的什么都不干。
 *
 * 相对 v12 砍掉的视觉家具：步骤编号、节点间 chevron、四色图例块、底部提示行、
 * 内联详情面板（改右侧抽屉）、逐个入场动画、横切系统四张卡（挪进 FactoryExtras）。
 *
 * 保留的骨架：buildSteps 拓扑分层（mrp → purchase / bom-route 是真并行）给出流程顺序，
 * 再按四阶段收成泳道；列数仍由 ResizeObserver 实测容器宽度决定，不写死断点。
 * 横切系统降为节点第二行文字 + 顶部「按系统看」筛选。
 *
 * P0：零硬编码色（全 var(--token)）· 图标全走 Icon.tsx 注册表 · 无 emoji · 无弹跳缓动。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, isIconName, type IconName } from '../../components/Icon';
import type { NodeResourceDTO } from '../../api/endpoints';
import {
  PHASES,
  PHASE_LABEL,
  SYSTEMS,
  SYSTEM_HINTS,
  type LaidNode,
  type Phase,
} from './factoryFlow.data';
import type { NodeStatusApi } from './useNodeStatus';
import NodeDrawer from './NodeDrawer';

/** 单条泳道的最小可读宽度与泳道间距 —— 决定折行断点。 */
const LANE_MIN = 236;
const LANE_GAP = 20;
/** 环节多于这个数的泳道（实际就是「计划/仓储」）占双倍宽，如实反映它半个工厂的体量。 */
const WIDE_LANE_AT = 3;

export interface FactoryFlowProps {
  /** 流程顺序（buildSteps 拍平），泳道内相对顺序沿用它。 */
  nodes: LaidNode[];
  resourcesByNode: Map<number, NodeResourceDTO[]>;
  isDone: (type: string, refId: number) => boolean;
  status: NodeStatusApi;
  selectedKey: string | null;
  /** 传 null 关闭抽屉；传同一个 key 由父级决定 toggle。 */
  onSelect: (key: string | null) => void;
}

export default function FactoryFlow({
  nodes, resourcesByNode, isDone, status, selectedKey, onSelect,
}: FactoryFlowProps) {
  const [activeSys, setActiveSys] = useState<string | null>(null);
  // 「再点同一个节点」= 关闭。交给抽屉自己走退场动画，父级只发信号。
  const [closeSignal, setCloseSignal] = useState(0);
  const pick = (key: string) => {
    if (key === selectedKey) setCloseSignal((c) => c + 1);
    else onSelect(key);
  };

  const lanes = useMemo(
    () =>
      PHASES.map((phase: Phase) => ({ phase, items: nodes.filter((n) => n.phase === phase) }))
        .filter((l) => l.items.length > 0),
    [nodes],
  );

  // 只列出这张流程图里真的出现过的系统，不给用户空筛选。
  const sysFilters = useMemo(() => {
    const present = new Set<string>();
    for (const n of nodes) for (const s of SYSTEM_HINTS[n.key] ?? []) present.add(s);
    return SYSTEMS.map((s) => ({ id: s.id.toUpperCase(), icon: s.icon }))
      .filter((s) => present.has(s.id));
  }, [nodes]);

  // 列数：按容器实测宽度算，宽屏四条泳道并排，手机一条。
  const mapRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.clientWidth;
      if (!w) return;
      const fit = Math.floor((w + LANE_GAP) / (LANE_MIN + LANE_GAP));
      setCols(Math.max(1, Math.min(lanes.length, fit)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lanes.length]);

  const isWide = (count: number) => count > WIDE_LANE_AT && cols > 1;
  const template =
    cols >= lanes.length
      ? lanes.map((l) => (isWide(l.items.length) ? '2fr' : '1fr')).join(' ')
      : `repeat(${cols}, minmax(0, 1fr))`;

  const selected = selectedKey ? nodes.find((n) => n.key === selectedKey) ?? null : null;
  const selectedIndex = selected ? nodes.indexOf(selected) : -1;

  return (
    <div className="ff">
      <style>{`
        .ff{color:var(--fg)}
        .ff *{box-sizing:border-box}

        .ff-head{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--space-4);
          flex-wrap:wrap;margin:0 0 var(--space-4)}
        .ff-head h2{margin:0;font-size:var(--text-xl);font-weight:var(--weight-announce-cjk);
          letter-spacing:var(--tracking-title)}
        .ff-head .sub{margin:2px 0 0;color:var(--muted);font-size:var(--text-sm)}
        .ff-sys{display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap}
        .ff-sys .lbl{font-size:var(--text-xs);color:var(--meta)}
        .ff-sys button{display:inline-flex;align-items:center;gap:var(--space-1);min-height:28px;
          padding:2px var(--space-2);border-radius:var(--radius-xs);font-size:var(--text-xs);
          font-family:inherit;background:var(--tag-bg);color:var(--tag-fg);
          border:1px solid var(--tag-border);cursor:pointer;
          transition:background var(--motion-fast) var(--ease-standard),
            border-color var(--motion-fast) var(--ease-standard),
            color var(--motion-fast) var(--ease-standard)}
        .ff-sys button:hover{border-color:var(--border-strong);color:var(--fg-2)}
        .ff-sys button[aria-pressed="true"]{background:var(--accent-soft);
          border-color:var(--accent-border);color:var(--accent-active)}

        .ff-map{display:grid;gap:var(--space-6) ${LANE_GAP}px;align-items:start}
        .ff-lane{min-width:0;display:flex;flex-direction:column}
        .ff-lane[data-phase="plan"]{--ph:var(--phase-plan)}
        .ff-lane[data-phase="production"]{--ph:var(--phase-production)}
        .ff-lane[data-phase="qc"]{--ph:var(--phase-qc)}
        .ff-lane[data-phase="logistics"]{--ph:var(--phase-logistics)}
        .ff-lane-head{display:flex;align-items:center;gap:var(--space-2);
          padding:0 var(--space-1) var(--space-2);border-bottom:1px solid var(--border-soft);
          margin-bottom:var(--space-3)}
        .ff-lane-dot{width:8px;height:8px;border-radius:var(--radius-pill);background:var(--ph);flex:none}
        .ff-lane-name{font-size:var(--text-sm);font-weight:var(--weight-emph-cjk);color:var(--fg-2)}
        .ff-lane-count{margin-left:auto;font-size:var(--text-xs);color:var(--meta)}
        .ff-lane-body{display:grid;gap:var(--space-2)}

        .ff-node{position:relative;width:100%;text-align:left;font-family:inherit;cursor:pointer;
          display:flex;align-items:center;gap:var(--space-3);overflow:hidden;min-height:62px;
          background:var(--card-bg);border:1px solid var(--card-border);
          border-radius:var(--radius-md);padding:var(--space-3) var(--space-3) var(--space-3) var(--space-4);
          transition:border-color var(--motion-fast) var(--ease-standard),
            background var(--motion-fast) var(--ease-standard),
            box-shadow var(--motion-fast) var(--ease-standard),
            opacity var(--motion-base) var(--ease-standard)}
        .ff-node::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
          background:var(--ph);opacity:.75}
        .ff-node:hover{border-color:var(--card-border-hover);background:var(--surface-2)}
        .ff-node[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .ff-node.is-next{border-color:var(--accent-border);box-shadow:0 0 0 3px var(--accent-soft)}
        .ff-node .nic{color:var(--muted);display:flex;flex:none;
          transition:color var(--motion-fast) var(--ease-standard)}
        .ff-node:hover .nic,.ff-node[aria-pressed="true"] .nic{color:var(--accent)}
        .ff-node .ntx{min-width:0;flex:1}
        .ff-node .ntitle{display:block;font-size:var(--text-base);
          font-weight:var(--weight-emph-cjk);line-height:var(--leading-snug);color:var(--fg);
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ff-node .nmeta{display:block;margin-top:2px;font-size:var(--text-xs);color:var(--meta);
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ff-node .nmeta .here{color:var(--accent);font-weight:var(--weight-emph-cjk)}
        .ff-node .nstate{flex:none;display:flex}
        .ff-node .nstate.is-practiced{color:var(--success)}
        .ff-node .nstate.is-touched{color:var(--border-strong)}
        .ff-map.is-filtered .ff-node:not(.is-hit){opacity:.34}
        .ff-map.is-filtered .ff-node:not(.is-hit)::before{opacity:.25}

        @media(max-width:640px){
          .ff-node{min-height:58px;padding:var(--space-3)}
          .ff-node .ntitle{white-space:normal}
          /* 系统筛选在窄屏改为横向滚动，避免按钮挤成两行难点 */
          .ff-sys{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:thin;
            -webkit-overflow-scrolling:touch;padding-bottom:var(--space-1)}
          .ff-sys .lbl{flex:none}
          .ff-sys button{flex:none;min-height:36px}
        }
      `}</style>

      <div className="ff-head">
        <div>
          <h2>工厂全景地图</h2>
          <p className="sub">从左到右就是物料与信息的流向：计划 → 生产 → 质检 → 出库</p>
        </div>
        {sysFilters.length > 0 && (
          <div className="ff-sys">
            <span className="lbl">按系统看：</span>
            {sysFilters.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={activeSys === s.id}
                onClick={() => setActiveSys((cur) => (cur === s.id ? null : s.id))}
              >
                <Icon name={s.icon} size={16} />
                {s.id}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`ff-map${activeSys ? ' is-filtered' : ''}`}
        ref={mapRef}
        style={{ gridTemplateColumns: template }}
      >
        {lanes.map((lane) => {
          const wide = isWide(lane.items.length);
          const doneInLane = lane.items.filter((n) => status.statusOf(n) === 'practiced').length;
          return (
            <section
              key={lane.phase}
              className="ff-lane"
              data-phase={lane.phase}
              style={wide && cols < lanes.length ? { gridColumn: 'span 2' } : undefined}
            >
              <header className="ff-lane-head">
                <span className="ff-lane-dot" />
                <span className="ff-lane-name">{PHASE_LABEL[lane.phase]}</span>
                <span className="ff-lane-count tabular">{doneInLane}/{lane.items.length}</span>
              </header>
              <div
                className="ff-lane-body"
                style={{ gridTemplateColumns: `repeat(${wide ? 2 : 1}, minmax(0, 1fr))` }}
              >
                {lane.items.map((n) => {
                  const st = status.statusOf(n);
                  const hints = SYSTEM_HINTS[n.key] ?? [];
                  const hit = !!activeSys && hints.includes(activeSys);
                  const isNext = n.key === status.nextKey;
                  return (
                    <button
                      key={n.key}
                      type="button"
                      className={`ff-node${isNext ? ' is-next' : ''}${hit ? ' is-hit' : ''}`}
                      aria-pressed={selectedKey === n.key}
                      onClick={() => pick(n.key)}
                    >
                      <span className="nic">
                        <Icon name={isIconName(n.icon) ? (n.icon as IconName) : 'process'} size={20} />
                      </span>
                      <span className="ntx">
                        <span className="ntitle">{n.label}</span>
                        <span className="nmeta">
                          {hints.length > 0 ? hints.join(' · ') : PHASE_LABEL[n.phase]}
                          {isNext && <span className="here"> · 从这里继续</span>}
                        </span>
                      </span>
                      {st === 'practiced' && (
                        <span className="nstate is-practiced">
                          <Icon name="check-circle" size={16} label="已练过" />
                        </span>
                      )}
                      {st === 'touched' && (
                        <span className="nstate is-touched">
                          <Icon name="confirm" size={16} label="已了解" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

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
