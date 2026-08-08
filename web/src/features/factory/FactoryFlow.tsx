/**
 * 工厂全景（factory-first 导航主干）—— v12「消费节点专属资源」。
 *
 * v11 折行布局保留；本版把详情面板从写死的 DRILLS（跳通用页）换成后端下发的
 * node_resources：每个节点挂的是祈使句标题的实战入口（C2），按类型跳对应路由
 * （chapter/sql/quiz），没有内容就不出行（C3）。
 *
 * 完成度（C1）：节点「做过实战」才算完成——所有非 chapter 的实战资源都标记为 done，
 * 知识卡片读完不算。进度落在云端 KV 的 factory.progress（useNodeProgress），跨设备一致；
 * 旧的 factory.visited（点开即标记）正式废弃。
 *
 * 视觉：白底 hairline 卡片 · 3px 左色条表阶段 · check-circle 表已实战 · 无脉冲无渐变。
 * P0：零硬编码色（全部 var(--token)）· 图标全走 Icon.tsx 注册表 · 无 emoji · 无弹跳缓动。
 */
import { useEffect, Fragment, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, isIconName, type IconName } from '../../components/Icon';
import { LoadingState } from '../../components/StateBlock';
import { api } from '../../api/endpoints';
import type { FlowNodeDTO, FlowEdgeDTO, NodeResourceDTO } from '../../api/endpoints';
import {
  PHASES,
  PHASE_LABEL,
  DEFAULT_FLOW,
  PHASE_BY_KEY,
  SYSTEMS,
  buildSteps,
  type Phase,
  type LaidNode,
} from './factoryFlow.data';
import { useNodeProgress } from './useNodeProgress';
import NodeStation from './NodeStation';

/** 单列最小宽度与列间距 —— 决定折行断点。 */
const MIN_COL = 168;
const COL_GAP = 26;

export default function FactoryFlow({ slug = 'generic-factory' }: { slug?: string }) {
  const q = useQuery({
    queryKey: ['flowchart', slug],
    queryFn: () => api.flowchart(slug),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { isDone } = useNodeProgress(slug);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [openSys, setOpenSys] = useState<Set<string>>(new Set());

  // 后端无数据/出错 → 用兜底工厂流。
  const flow = q.data && q.data.nodes?.length ? q.data : DEFAULT_FLOW;
  const rawNodes = flow.nodes as (FlowNodeDTO & { phase?: Phase })[];
  const edges = flow.edges;
  const resourcesByNode = useMemo(() => {
    const m = new Map<number, NodeResourceDTO[]>();
    for (const r of flow.resources ?? []) {
      const arr = m.get(r.nodeId) ?? [];
      arr.push(r);
      m.set(r.nodeId, arr);
    }
    return m;
  }, [flow.resources]);

  const nodes: LaidNode[] = useMemo(
    () => rawNodes.map((n) => ({ ...n, phase: (n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan') as Phase })),
    [rawNodes],
  );
  const steps = useMemo(() => buildSteps(nodes, edges), [nodes, edges]);

  // 选中的节点属于第几步 —— 详情面板就近插在该步骤正下方。
  const selectedStepIndex = useMemo(
    () => (selectedKey ? steps.findIndex((g) => g.some((n) => n.key === selectedKey)) : -1),
    [steps, selectedKey],
  );

  // 列数：按容器实测宽度算，宽屏多列、手机两列。
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.clientWidth;
      if (!w) return;
      const fit = Math.floor((w + COL_GAP) / (MIN_COL + COL_GAP));
      setCols(Math.max(1, Math.min(steps.length, fit)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [steps.length]);

  // 详情面板就近展开后，若落在视口外则轻轻滚入视野。
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedKey]);

  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const selected = selectedKey ? nodeByKey.get(selectedKey) ?? null : null;

  // 节点完成（C1）：所有「实战」资源（非 chapter）都做过才算；知识卡片读完不算。
  const nodeDone = useCallback(
    (n: LaidNode) => {
      const res = resourcesByNode.get(n.id) ?? [];
      const practices = res.filter((r) => r.type !== 'chapter');
      if (practices.length === 0) return false;
      return practices.every((r) => isDone(r.type, r.refId));
    },
    [resourcesByNode, isDone],
  );

  const doneCount = useMemo(() => nodes.filter(nodeDone).length, [nodes, nodeDone]);

  // 推荐下一步：流程顺序中第一个未实战的节点。
  const nextKey = useMemo(() => {
    for (const st of steps) for (const n of st) if (!nodeDone(n)) return n.key;
    return null;
  }, [steps, nodeDone]);

  const toggleSys = (id: string) => {
    setOpenSys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickNode = (key: string) => setSelectedKey((cur) => (cur === key ? null : key));

  if (q.isLoading) return <LoadingState label="加载工厂全景…" />;

  return (
    <div className="ff">
      <style>{`
        .ff{font-family:inherit;color:var(--fg)}
        .ff *{box-sizing:border-box}
        .ff .sec-h{display:flex;align-items:baseline;gap:10px;margin:0 0 6px;flex-wrap:wrap}
        .ff .sec-h h2{font-size:20px;margin:0;font-weight:600;letter-spacing:-.01em}
        .ff .sec-h .sub{color:var(--muted);font-size:13px}

        .ff .ff-prog{display:flex;align-items:center;gap:10px;margin:0 0 18px}
        .ff .ff-prog .bar{flex:1;max-width:220px;height:4px;border-radius:var(--radius-pill);
          background:var(--surface-3);overflow:hidden}
        .ff .ff-prog .bar i{display:block;height:100%;background:var(--accent);
          border-radius:var(--radius-pill);transition:width .3s var(--ease-standard)}
        .ff .ff-prog .txt{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}

        .ff .ff-legend{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 16px}
        .ff .ff-legend .lg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
        .ff .ff-legend .dot{width:8px;height:8px;border-radius:var(--radius-pill);flex:none}

        .ff .ff-grid{display:grid;gap:20px ${COL_GAP}px;align-items:stretch}
        .ff .step{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0}
        .ff .step .sno{font-size:11px;color:var(--meta);font-variant-numeric:tabular-nums;
          letter-spacing:.08em;padding-left:2px}
        .ff .step .link{position:absolute;top:50%;right:-${Math.round(COL_GAP / 2) + 8}px;
          margin-top:-8px;color:var(--border-strong);pointer-events:none;display:flex}

        .ff .node{position:relative;width:100%;flex:1;background:var(--surface);
          border:1px solid var(--border);border-radius:var(--radius-md);
          padding:12px 12px 12px 15px;cursor:pointer;font-family:inherit;text-align:left;
          display:flex;align-items:center;gap:10px;overflow:hidden;min-height:62px;
          transition:border-color .16s var(--ease-standard),background .16s var(--ease-standard),
            box-shadow .16s var(--ease-standard);
          animation:ffNodeIn .3s var(--ease-out) both}
        .ff .node::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
          background:var(--ph);opacity:.75}
        .ff .node.phase-plan{--ph:var(--phase-plan)}
        .ff .node.phase-production{--ph:var(--phase-production)}
        .ff .node.phase-qc{--ph:var(--phase-qc)}
        .ff .node.phase-logistics{--ph:var(--phase-logistics)}
        .ff .node:hover{border-color:var(--border-strong);background:var(--surface-2)}
        .ff .node.active{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .ff .node.is-next{border-color:var(--accent);
          box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)}
        .ff .node .nic{color:var(--muted);flex:none;display:flex;transition:color .16s var(--ease-standard)}
        .ff .node:hover .nic,.ff .node.active .nic{color:var(--accent)}
        .ff .node .ntx{min-width:0;flex:1}
        .ff .node .ntitle{display:block;font-size:14px;font-weight:500;line-height:1.35;
          color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ff .node .nmeta{display:block;margin-top:2px;font-size:12px;font-weight:400;color:var(--muted);
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ff .node .nmeta .next{display:inline-flex;align-items:center;gap:1px;color:var(--accent)}
        .ff .node .ndone{flex:none;color:var(--success);display:flex}
        @keyframes ffNodeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

        .ff .panel{margin-top:22px;border:1px solid var(--border);border-radius:var(--radius-md);
          background:var(--surface);padding:20px;animation:ffPanelIn .22s var(--ease-out) both}
        @keyframes ffPanelIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        .ff .p-head{display:flex;align-items:center;gap:10px}
        .ff .p-head .pic{color:var(--accent);display:flex;flex:none}
        .ff .p-head h3{margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em}
        .ff .p-head .close{margin-left:auto;background:none;border:none;cursor:pointer;
          color:var(--muted);padding:5px;border-radius:var(--radius-xs);display:flex;
          transition:background .15s var(--ease-standard),color .15s var(--ease-standard)}
        .ff .p-head .close:hover{background:var(--surface-2);color:var(--fg)}
        .ff .p-meta{display:flex;align-items:center;gap:8px;margin:9px 0 14px;
          font-size:12px;color:var(--muted);flex-wrap:wrap}
        .ff .p-meta .dot{width:8px;height:8px;border-radius:var(--radius-pill);flex:none}
        .ff .p-meta .sp{color:var(--border-strong)}
        .ff .p-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
        .ff .p-know{color:var(--fg-2);margin:0 0 16px;line-height:1.75;font-size:14px}
        .ff .p-sec{font-size:12px;font-weight:500;color:var(--muted);margin:0 0 9px}
        .ff .p-tags{display:flex;gap:6px;flex-wrap:wrap}
        .ff .tag{background:var(--tag-bg);border:1px solid var(--tag-border);
          border-radius:var(--radius-xs);padding:2px 8px;font-size:12px;color:var(--tag-fg)}
        .ff .drill{display:flex;align-items:center;gap:11px;width:100%;text-align:left;
          border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 12px;
          background:var(--surface);text-decoration:none;color:inherit;cursor:pointer;
          transition:background .15s var(--ease-standard),border-color .15s var(--ease-standard);
          font-family:inherit}
        .ff .drill + .drill{margin-top:8px}
        .ff .drill:hover{background:var(--surface-2);border-color:var(--border-strong)}
        .ff .drill .di{color:var(--muted);flex:none;display:flex}
        .ff .drill:hover .di{color:var(--accent)}
        .ff .drill .dl{display:block;font-weight:500;font-size:14px}
        .ff .drill .dgo{margin-left:auto;color:var(--border-strong);flex:none;display:flex}
        .ff .drill:hover .dgo{color:var(--accent)}

        .ff .hint{display:flex;align-items:center;gap:7px;margin-top:16px;
          color:var(--muted);font-size:12px}

        .ff .sys-section{margin-top:34px}
        .ff .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
        .ff .sys{padding:16px 18px;border:1px solid var(--border);border-radius:var(--radius-md);
          background:var(--surface);cursor:pointer;
          transition:border-color .15s var(--ease-standard),background .15s var(--ease-standard)}
        .ff .sys:hover{border-color:var(--border-strong);background:var(--surface-2)}
        .ff .sys .top{display:flex;align-items:center;gap:11px}
        .ff .sys .ic{color:var(--muted);flex:none;display:flex}
        .ff .sys:hover .ic{color:var(--accent)}
        .ff .sys h3{margin:0;font-size:15px;font-weight:600}
        .ff .sys .role{color:var(--muted);font-size:13px;margin:2px 0 0}
        .ff .sys .body{display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);
          color:var(--fg-2);font-size:14px;line-height:1.7}
        .ff .sys.open .body{display:block}
        .ff .sys .caret{margin-left:auto;color:var(--border-strong);flex:none;display:flex;
          transition:transform .18s var(--ease-standard)}
        .ff .sys.open .caret{transform:rotate(90deg)}

        @media(max-width:640px){
          .ff .p-body{grid-template-columns:1fr;gap:18px}
          .ff .step .link{display:none}
          .ff .node{padding:11px 10px 11px 13px;min-height:58px}
          .ff .node .ntitle{white-space:normal}
        }
      `}</style>

      {/* ═══ 标题 + 进度（C1：只数做过实战的环节）═══ */}
      <div className="sec-h">
        <h2>工厂全景</h2>
        <span className="sub">按流程顺序走一遍，每个环节都能点进去看知识 + 动手练</span>
      </div>
      <div className="ff-prog">
        <span className="bar"><i style={{ width: `${nodes.length ? (doneCount / nodes.length) * 100 : 0}%` }} /></span>
        <span className="txt">已实战 {doneCount} / {nodes.length} 个环节</span>
      </div>

      <div className="ff-legend">
        {PHASES.map((p) => (
          <span key={p} className="lg">
            <span className="dot" style={{ background: `var(--phase-${p})` }} />
            {PHASE_LABEL[p]}
          </span>
        ))}
      </div>

      {/* ═══ 响应式步骤网格（详情就近插在选中步骤正下方）═══ */}
      <div className="ff-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {steps.map((group, si) => {
          const isRowEnd = (si + 1) % cols === 0;
          const isLast = si === steps.length - 1;
          return (
            <Fragment key={si}>
              <div className="step">
                <span className="sno">{String(si + 1).padStart(2, '0')}</span>
                {group.map((n, ni) => {
                  const done = nodeDone(n);
                  const isNext = !done && n.key === nextKey;
                  return (
                    <button key={n.key} type="button"
                      className={`node phase-${n.phase}${selectedKey === n.key ? ' active' : ''}${isNext ? ' is-next' : ''}`}
                      style={{ animationDelay: `${(si * 2 + ni) * 22}ms` }}
                      onClick={() => pickNode(n.key)} aria-pressed={selectedKey === n.key}>
                      <span className="nic"><Icon name={isIconName(n.icon) ? (n.icon as IconName) : 'process'} size={20} /></span>
                      <span className="ntx">
                        <span className="ntitle">{n.label}</span>
                        <span className="nmeta">
                          {isNext
                            ? <span className="next">从这里继续<Icon name="chevron-right" size={16} /></span>
                            : PHASE_LABEL[n.phase]}
                        </span>
                      </span>
                      {done ? <span className="ndone" aria-label="已实战"><Icon name="check-circle" size={16} /></span> : null}
                    </button>
                  );
                })}
                {!isRowEnd && !isLast
                  ? <span className="link" aria-hidden="true"><Icon name="chevron-right" size={16} /></span>
                  : null}
              </div>
              {selected && selectedStepIndex === si ? (
                <div className="panel" style={{ gridColumn: '1 / -1' }} ref={panelRef}>
                  <NodeStation
                    node={selected}
                    resources={resourcesByNode.get(selected.id) ?? []}
                    isDone={isDone}
                    onClose={() => setSelectedKey(null)}
                  />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>

      <div className="hint">
        <Icon name="check-circle" size={16} />
        <span>打勾 = 已实战（做过 SQL 或测验） · 绿框 = 建议从这里继续</span>
      </div>

      {/* ═══ 横切系统 ═══ */}
      <section className="sys-section">
        <div className="sec-h">
          <h2>贯穿全流程的系统</h2>
          <span className="sub">MES / ERP / WMS / QMS 是工具，不是孤立入口</span>
        </div>
        <div className="grid" style={{ marginTop: 14 }}>
          {SYSTEMS.map((s) => (
            <div key={s.id} className={`sys${openSys.has(s.id) ? ' open' : ''}`}
              onClick={() => toggleSys(s.id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSys(s.id); } }}>
              <div className="top">
                <div className="ic"><Icon name={s.icon} size={20} /></div>
                <div><h3>{s.name}</h3><div className="role">{s.role}</div></div>
                <div className="caret"><Icon name="chevron-right" size={16} /></div>
              </div>
              <div className="body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
