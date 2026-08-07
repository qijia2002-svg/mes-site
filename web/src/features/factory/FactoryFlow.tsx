/**
 * 工厂全景（factory-first 导航主干）—— 全屏英雄视图 v3（四色分区 + 学习闭环）。
 *
 * 设计原则（与用户确认的设计方案一致）：
 *  - 全屏宽：.board 以 100vw 突破容器约束，铺满视口。
 *  - 四色分区（语义色，非装饰渐变）：
 *      蓝=计划/仓储 · 橙=生产执行 · 绿=质量检验 · 紫=物流出库。
 *  - 节点 = 工位卡片（圆角 + 图标 + 标题 + 环节标签 + 进度状态点）。
 *  - 进度状态点：绿=已学(点开过) · 灰=未开始 · 脉冲(accent)=推荐下一步。
 *  - 紧凑工具栏：缩放 −/+ · 适应画布 · 四色图例。缩放与平移记忆到 localStorage。
 *  - 互动：拖拽平移；点节点右侧滑出「知识 + 实战」；选中节点相关连线呈流动动画。
 *  - 图标走已注册 Icon 语义名；内置 DEFAULT_FLOW 兜底，首屏永不空白。
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '../../components/Icon';
import { LoadingState } from '../../components/StateBlock';
import { api } from '../../api/endpoints';
import type { FlowNodeDTO, FlowEdgeDTO } from '../../api/endpoints';

const NODE_W = 132;
const BOX_H = 104;
const R = 26;
const VIEW_KEY = 'factory.view';
const VISITED_KEY = 'factory.visited';

type Phase = 'plan' | 'production' | 'qc' | 'logistics';

/** 四色分区的色值（定义为组件级 token，fallback 为语义色本身）。 */
const PHASE_COLOR: Record<Phase, { fill: string; stroke: string }> = {
  plan: { fill: '#E6F1FB', stroke: '#378ADD' },
  production: { fill: '#FAEEDA', stroke: '#EF9F27' },
  qc: { fill: '#EAF3DE', stroke: '#639922' },
  logistics: { fill: '#EEEDFE', stroke: '#7F77DD' },
};
const PHASE_LABEL: Record<Phase, string> = {
  plan: '计划/仓储', production: '生产执行', qc: '质量检验', logistics: '物流出库',
};

/** 兜底工厂流（与 worker 种子一致，并带 phase 字段）。保证首屏永不空白。 */
const DEFAULT_FLOW: { nodes: (FlowNodeDTO & { phase: Phase })[]; edges: FlowEdgeDTO[] } = {
  nodes: [
    { id: 1, key: 'cust-order', label: '客户下单', kind: 'entry', icon: 'shopping-cart', x: 0, y: 200, description: '销售订单录入：客户要什么、多少、何时要。', phase: 'plan' },
    { id: 2, key: 'order-review', label: '订单评审', kind: 'process', icon: 'clipboard-check', x: 150, y: 200, description: '评审交期、产能、物料齐套性，决定是否接单与承诺交期。', phase: 'plan' },
    { id: 3, key: 'mps', label: '主生产计划', kind: 'process', icon: 'calendar', x: 300, y: 200, description: '把订单转成可执行的月度/周生产计划（MPS）。', phase: 'plan' },
    { id: 4, key: 'mrp', label: '物料需求计划', kind: 'process', icon: 'calculator', x: 450, y: 200, description: '按 BOM 展开，算出自制/外购物料的需求量与时间（MRP）。', phase: 'plan' },
    { id: 5, key: 'purchase', label: '采购与供应商', kind: 'process', icon: 'truck', x: 620, y: 110, description: '下采购单、跟供应商交期、到货与进料检验（IQC）。', phase: 'plan' },
    { id: 6, key: 'bom-route', label: 'BOM 与工艺路线', kind: 'process', icon: 'git-branch', x: 620, y: 290, description: '定义产品物料清单（BOM）与每道工序的工艺路线。', phase: 'plan' },
    { id: 7, key: 'picking', label: '领料发料', kind: 'process', icon: 'package', x: 790, y: 200, description: '仓储按工单发料到线边仓/工位（WMS）。', phase: 'plan' },
    { id: 8, key: 'dispatch', label: '生产派工', kind: 'process', icon: 'send', x: 940, y: 200, description: '把生产指令下达到具体工作中心/产线（MES 工单）。', phase: 'production' },
    { id: 9, key: 'shopfloor', label: '车间执行', kind: 'process', icon: 'factory', x: 1090, y: 200, description: '工序加工、报工（扫码/PDA/工单电脑）、在制品跟踪（MES）。', phase: 'production' },
    { id: 10, key: 'qc', label: '质量检验', kind: 'process', icon: 'check-circle', x: 1240, y: 200, description: '首检/巡检/终检，SPC 与质量追溯（QMS）。', phase: 'qc' },
    { id: 11, key: 'stock-in', label: '生产入库', kind: 'process', icon: 'warehouse', x: 1390, y: 200, description: '成品入库，更新库存（WMS）。', phase: 'logistics' },
    { id: 12, key: 'shipping', label: '发货出库', kind: 'exit', icon: 'log-out', x: 1540, y: 200, description: '按发货单拣货、装车、物流交付给客户。', phase: 'logistics' },
  ],
  edges: [
    { from: 'cust-order', to: 'order-review', label: '' },
    { from: 'order-review', to: 'mps', label: '' },
    { from: 'mps', to: 'mrp', label: '' },
    { from: 'mrp', to: 'purchase', label: '外购件' },
    { from: 'mrp', to: 'bom-route', label: '自制件 BOM' },
    { from: 'purchase', to: 'picking', label: '' },
    { from: 'bom-route', to: 'picking', label: '' },
    { from: 'picking', to: 'dispatch', label: '' },
    { from: 'dispatch', to: 'shopfloor', label: '' },
    { from: 'shopfloor', to: 'qc', label: '' },
    { from: 'qc', to: 'stock-in', label: '' },
    { from: 'stock-in', to: 'shipping', label: '' },
  ],
};

/** 节点 key → phase（后端无 phase 字段时回退用）。 */
const PHASE_BY_KEY: Record<string, Phase> = Object.fromEntries(DEFAULT_FLOW.nodes.map((n) => [n.key, n.phase]));

/** 横切系统提示：节点上挂的系统（谓语），不是主干。 */
const SYSTEM_HINTS: Record<string, string[]> = {
  'cust-order': ['销售', 'CRM'],
  'order-review': ['销售', '计划'],
  mps: ['ERP', '计划'],
  mrp: ['ERP', '物料'],
  purchase: ['ERP', '采购', 'SRM'],
  'bom-route': ['ERP', '工程', 'PLM'],
  picking: ['WMS'],
  dispatch: ['MES'],
  shopfloor: ['MES'],
  qc: ['QMS'],
  'stock-in': ['WMS'],
  shipping: ['WMS', '物流'],
};

/** 横切全流程的系统卡片（工具，不是孤立入口）。 */
const SYSTEMS: { id: string; name: string; icon: IconName; role: string; body: string }[] = [
  { id: 'mes', name: 'MES 制造执行', icon: 'equipment', role: '管「怎么把东西做出来」',
    body: '下工单、报工、工序流转、设备数据采集、质量节点卡控。是工厂的「神经中枢」，横贯原料→生产→质检→仓储→发货每个环节。' },
  { id: 'erp', name: 'ERP 企业资源', icon: 'sql', role: '管「要花多少、值多少」',
    body: '销售订单、BOM、采购、库存价值、成本核算。回答「生产什么、备多少料、花多少钱」，把计划层和执行层连起来。' },
  { id: 'wms', name: 'WMS 仓储管理', icon: 'package', role: '管「东西放哪、怎么拣」',
    body: '原料与成品的库位、上架策略、拣货波次。库存准不准，取决于和 MES 的实时同步。' },
  { id: 'qms', name: 'QMS 质量管理', icon: 'quiz', role: '管「合不合格、为什么」',
    body: '检验标准、不合格品隔离与偏差流程、质量追溯。把「质量」从一道工序变成贯穿全流程的能力。' },
];

/** 实战入口：直接跳既有路由，不再写"接入中"。 */
const DRILLS: { to: string; icon: IconName; label: string; desc: string }[] = [
  { to: '/simulator', icon: 'routing', label: '工厂仿真', desc: '拖拽搭建产线，看 MES 怎么流转' },
  { to: '/quiz', icon: 'quiz', label: '随堂测验', desc: '该环节的知识点考一考' },
  { to: '/sql-space', icon: 'sql', label: 'SQL 实战', desc: '写 SQL 查这个环节的数据' },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function FactoryFlow({ slug = 'generic-factory' }: { slug?: string }) {
  const q = useQuery({
    queryKey: ['flowchart', slug],
    queryFn: () => api.flowchart(slug),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [openSys, setOpenSys] = useState<Set<string>>(new Set());

  // 已学过的节点（点开过即标记），记忆到 localStorage。
  const [visited, setVisited] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || '[]')); } catch { return new Set(); }
  });
  const markVisited = (key: string) => {
    setVisited((prev) => {
      if (prev.has(key)) return prev;
      const nx = new Set(prev); nx.add(key);
      try { localStorage.setItem(VISITED_KEY, JSON.stringify([...nx])); } catch { /* noop */ }
      return nx;
    });
  };

  // 后端无数据/出错 → 用兜底工厂流。
  const flow = q.data && q.data.nodes?.length ? q.data : DEFAULT_FLOW;
  const nodes = flow.nodes as (FlowNodeDTO & { phase?: Phase })[];
  const edges = flow.edges;
  const phaseOf = (n: FlowNodeDTO & { phase?: Phase }): Phase => n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan';

  const { bounds } = useMemo(() => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const left = Math.min(...xs) - 40;
    const right = Math.max(...xs) + NODE_W + 40;
    const top = Math.min(...ys) - 40;
    const bottom = Math.max(...ys) + BOX_H + 40;
    return { bounds: { left, top, w: right - left, h: bottom - top } };
  }, [nodes]);

  // 缩放：自动适配宽度（封顶 1.6）或被用户手动缩放覆盖；记忆到 localStorage。
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(() => {
    try { const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); return v && typeof v.zoom === 'number' ? v.zoom : null; } catch { return null; }
  });
  const scale = userZoom ?? autoScale;
  useEffect(() => {
    const el = stageRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const calc = () => {
      const avail = parent.clientWidth - 36;
      const s = avail >= bounds.w ? Math.min(1.6, avail / bounds.w) : 1;
      setAutoScale(s > 0 ? s : 1);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [bounds.w]);

  // 还原上次平移位置。
  useEffect(() => {
    const b = boardRef.current;
    if (!b) return;
    try {
      const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
      if (v && typeof v.sl === 'number') b.scrollLeft = v.sl;
      if (v && typeof v.st === 'number') b.scrollTop = v.st;
    } catch { /* noop */ }
  }, []);

  const saveView = () => {
    const b = boardRef.current;
    if (!b) return;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ zoom: userZoom, sl: b.scrollLeft, st: b.scrollTop })); } catch { /* noop */ }
  };
  const zoomIn = () => setUserZoom(clamp((userZoom ?? autoScale) * 1.15, 0.5, 2.5));
  const zoomOut = () => setUserZoom(clamp((userZoom ?? autoScale) / 1.15, 0.5, 2.5));
  const fit = () => { setUserZoom(null); saveView(); };

  if (q.isLoading) return <LoadingState label="加载工厂全景…" />;

  const nodeByKey = new Map(nodes.map((n) => [n.key, n]));
  const selected = selectedKey ? nodeByKey.get(selectedKey) ?? null : null;

  // 选中节点的直接相邻节点集合（用于淡化非相关节点 + 高亮相关连线）。
  const related = useMemo(() => {
    if (!selectedKey) return null;
    const s = new Set<string>([selectedKey]);
    edges.forEach((e) => {
      if (e.from === selectedKey) s.add(e.to);
      if (e.to === selectedKey) s.add(e.from);
    });
    return s;
  }, [selectedKey, edges]);

  // 推荐下一步：流程顺序中第一个未学过的节点。
  const nextKey = useMemo(() => {
    for (const n of nodes) if (!visited.has(n.key)) return n.key;
    return null;
  }, [nodes, visited]);

  const toggleSys = (id: string) => {
    setOpenSys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 拖拽平移（grab / grabbing）。
  const drag = useRef<{ x: number; y: number; sl: number; st: number; on: boolean }>({ x: 0, y: 0, sl: 0, st: 0, on: false });
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('.node') || t.closest('.drawer') || t.closest('.ff-toolbar')) return;
    const b = boardRef.current;
    if (!b) return;
    drag.current = { x: e.clientX, y: e.clientY, sl: b.scrollLeft, st: b.scrollTop, on: true };
    try { b.setPointerCapture(e.pointerId); } catch { /* noop */ }
    b.classList.add('grabbing');
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.on) return;
    const b = boardRef.current;
    if (!b) return;
    b.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
    b.scrollTop = drag.current.st - (e.clientY - drag.current.y);
  };
  const onUp = () => {
    if (!drag.current.on) return;
    drag.current.on = false;
    boardRef.current?.classList.remove('grabbing');
    saveView();
  };

  const selPhaseStroke = selected ? PHASE_COLOR[phaseOf(selected)].stroke : null;

  return (
    <div className="ff">
      <style>{`
        .ff{font-family:inherit;color:var(--ink-solid,#1f2a24);
          --ff-accent:var(--accent,#547C70);
          --ff-accent-soft:var(--accent-soft,#eaf1ee);
          --ff-line:var(--border,#e3e8e5);
          --ff-mut:var(--muted,#6b7770);
          --ff-slate:#64748b;
          --ff-slate-soft:#f1f5f9;
          --ff-radius:16px;
          --ff-shadow:0 1px 2px rgba(31,42,36,.06),0 8px 24px rgba(31,42,36,.06);
          --ff-plan-fill:#E6F1FB;--ff-plan-stroke:#378ADD;
          --ff-production-fill:#FAEEDA;--ff-production-stroke:#EF9F27;
          --ff-qc-fill:#EAF3DE;--ff-qc-stroke:#639922;
          --ff-logistics-fill:#EEEDFE;--ff-logistics-stroke:#7F77DD}
        .ff *{box-sizing:border-box}
        .ff .ff-inner{max-width:1120px;margin:0 auto;padding:0 4px}
        .ff .sec-h{display:flex;align-items:baseline;gap:10px;margin:0 0 14px;flex-wrap:wrap}
        .ff .sec-h h2{font-size:20px;margin:0;font-weight:700}
        .ff .sec-h .sub{color:var(--ff-mut);font-size:13px}

        /* ── 全屏画布 ── */
        .ff .board{position:relative;width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);
          padding:22px 18px;border-radius:var(--ff-radius);border:1px solid var(--ff-line);
          background:
            radial-gradient(circle at 1px 1px, rgba(84,124,112,.10) 1px, transparent 0) 0 0/22px 22px,
            var(--surface,#fff);
          overflow:auto;cursor:grab;user-select:none}
        .ff .board.grabbing{cursor:grabbing}

        /* ── 紧凑工具栏 ── */
        .ff .ff-toolbar{position:sticky;top:0;left:0;z-index:5;display:flex;align-items:center;
          gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:8px 12px;border-radius:12px;
          background:var(--surface,#fff);border:1px solid var(--ff-line);box-shadow:var(--ff-shadow)}
        .ff .ff-toolbar .grp{display:inline-flex;align-items:center;gap:4px}
        .ff .ff-tbtn{width:30px;height:30px;border-radius:9px;border:1px solid var(--ff-line);
          background:var(--surface,#fff);color:var(--ff-mut);display:inline-flex;align-items:center;
          justify-content:center;cursor:pointer;transition:.15s;font-family:inherit}
        .ff .ff-tbtn:hover{border-color:var(--ff-accent);color:var(--ff-accent);background:var(--ff-accent-soft)}
        .ff .ff-zoom{font-size:12px;color:var(--ff-mut);min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
        .ff .ff-legend{display:inline-flex;gap:12px;flex-wrap:wrap;margin-left:auto}
        .ff .ff-legend .lg{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--ff-mut)}
        .ff .ff-legend .sw{width:12px;height:12px;border-radius:4px;border:1.5px solid}

        .ff .stage-scale{position:relative;width:100%}
        .ff .stage{position:relative;transform-origin:top left}
        .ff .stage svg{position:absolute;inset:0;display:block}
        .ff .ff-line{stroke:var(--ff-slate);stroke-width:2.5;fill:none;opacity:.35;transition:.25s}
        .ff .ff-line.hi{stroke-width:3.5;opacity:1;
          stroke-dasharray:10 9;animation:ffFlow 1s linear infinite}
        .ff .ff-line.muted{opacity:.12}
        @keyframes ffFlow{to{stroke-dashoffset:-38}}

        /* ── 节点（工位卡片）── */
        .ff .node{position:absolute;width:${NODE_W}px;background:var(--nf,var(--surface,#fff));
          border:1.5px solid var(--ns,var(--ff-line));border-radius:16px;padding:14px 10px 12px;
          cursor:pointer;font-family:inherit;box-shadow:var(--ff-shadow);
          display:flex;justify-content:center;
          transition:transform .18s, box-shadow .18s, border-color .18s, opacity .25s}
        .ff .node.phase-plan{--nf:var(--ff-plan-fill);--ns:var(--ff-plan-stroke)}
        .ff .node.phase-production{--nf:var(--ff-production-fill);--ns:var(--ff-production-stroke)}
        .ff .node.phase-qc{--nf:var(--ff-qc-fill);--ns:var(--ff-qc-stroke)}
        .ff .node.phase-logistics{--nf:var(--ff-logistics-fill);--ns:var(--ff-logistics-stroke)}
        .ff .node:hover{transform:translateY(-5px);box-shadow:0 12px 30px rgba(84,124,112,.20)}
        .ff .node.active{border-color:var(--ns);background:var(--nf);
          box-shadow:0 12px 32px rgba(84,124,112,.28)}
        .ff .node.dim{opacity:.32}
        .ff .node-in{display:flex;flex-direction:column;align-items:center;
          animation:ffNodeIn .5s var(--ease-out,ease) both}
        .ff .node .badge{width:56px;height:56px;border-radius:16px;
          background:var(--nf);color:var(--ns);
          display:flex;align-items:center;justify-content:center;transition:.18s}
        .ff .node:hover .badge,.ff .node.active .badge{background:var(--ns);color:#fff}
        .ff .node .chip{margin-top:10px;font-size:14px;font-weight:700;color:var(--ns)}
        .ff .node .kind{margin-top:4px;font-size:11px;color:var(--ff-mut);letter-spacing:.06em}
        .ff .node.entry{box-shadow:0 0 0 3px color-mix(in srgb, var(--ns) 18%, transparent), var(--ff-shadow)}
        @keyframes ffNodeIn{from{opacity:0;transform:translateY(16px) scale(.94)}to{opacity:1;transform:none}}

        /* ── 进度状态点 ── */
        .ff .node .stat{position:absolute;top:-5px;right:-5px;width:11px;height:11px;border-radius:50%;
          border:2px solid var(--surface,#fff);z-index:2}
        .ff .node .stat.done{background:var(--ff-success,#2f9e44)}
        .ff .node .stat.todo{background:#B4B2A9}
        .ff .node .stat.next{background:var(--ff-accent);animation:ffPulse 1.5s ease-in-out infinite}
        @keyframes ffPulse{0%,100%{box-shadow:0 0 0 0 rgba(84,124,112,.55)}50%{box-shadow:0 0 0 7px rgba(84,124,112,0)}}

        /* ── 右侧详情抽屉 ── */
        .ff .drawer{position:absolute;top:0;right:0;bottom:0;width:360px;max-width:88%;
          background:var(--surface,#fff);border-left:1px solid var(--ff-line);
          box-shadow:-12px 0 32px rgba(31,42,36,.12);z-index:6;
          transform:translateX(100%);transition:transform .22s ease;padding:20px;
          overflow-y:auto;display:flex;flex-direction:column}
        .ff .drawer.open{transform:translateX(0)}
        .ff .d-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}
        .ff .d-head .dbadge{width:46px;height:46px;border-radius:13px;
          background:var(--ns,var(--ff-accent-soft));color:var(--ns,var(--ff-accent));
          display:flex;align-items:center;justify-content:center;flex:0 0 auto}
        .ff .d-head h3{margin:0;font-size:18px}
        .ff .d-head .close{margin-left:auto;background:none;border:none;cursor:pointer;color:var(--ff-mut);
          padding:6px;border-radius:9px;transition:.15s}
        .ff .d-head .close:hover{background:var(--ff-slate-soft);color:var(--ink-solid,#1f2a24)}
        .ff .d-kind{font-size:12px;color:var(--ff-mut);margin:2px 0 12px}
        .ff .d-phase{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
          color:var(--ns,var(--ff-mut));background:var(--nf,var(--ff-accent-soft));
          border:1px solid var(--ns,var(--ff-line));border-radius:999px;padding:3px 10px;margin-bottom:12px}
        .ff .d-know{color:#33423a;margin:0 0 14px;line-height:1.7;font-size:14px}
        .ff .d-sys{background:var(--ff-accent-soft);border-left:4px solid var(--ff-accent);
          padding:11px 14px;border-radius:0 11px 11px 0;font-size:13px;color:#25433a;margin-bottom:14px}
        .ff .d-sys .lbl{font-weight:600;margin-bottom:6px}
        .ff .d-sys .tags{display:inline-flex;gap:6px;flex-wrap:wrap}
        .ff .tag{background:#fff;border:1px solid var(--ff-line);border-radius:999px;
          padding:2px 10px;font-size:12px;color:var(--ff-accent)}
        .ff .drills-h{font-size:12px;font-weight:600;color:var(--ff-mut);text-transform:uppercase;
          letter-spacing:.06em;margin:4px 0 10px}
        .ff .drill{display:flex;align-items:center;gap:12px;width:100%;text-align:left;
          border:1px solid var(--ff-line);border-radius:13px;padding:13px;margin-bottom:9px;
          background:var(--surface,#fff);text-decoration:none;color:inherit;cursor:pointer;
          transition:.15s;font-family:inherit}
        .ff .drill:hover{border-color:var(--ff-accent);background:var(--ff-accent-soft)}
        .ff .drill .di{width:38px;height:38px;border-radius:11px;background:var(--ff-accent-soft);
          color:var(--ff-accent);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
        .ff .drill .dl{font-weight:600;font-size:14px}
        .ff .drill .dd{font-size:12px;color:var(--ff-mut);margin-top:1px}

        /* ── 拖拽提示 ── */
        .ff .pan-hint{display:inline-flex;align-items:center;gap:8px;margin-top:12px;
          color:var(--ff-mut);font-size:12.5px}
        .ff .pan-hint svg{color:var(--ff-accent)}

        /* ── 系统卡片 ── */
        .ff .sys-section{margin-top:26px}
        .ff .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
        .ff .sys{padding:16px;border:1px solid var(--ff-line);border-radius:14px;background:var(--surface,#fff);
          cursor:pointer;box-shadow:var(--ff-shadow);transition:.15s}
        .ff .sys:hover{border-color:var(--ff-accent)}
        .ff .sys .top{display:flex;align-items:center;gap:12px}
        .ff .sys .ic{width:42px;height:42px;border-radius:12px;background:var(--ff-accent-soft);
          color:var(--ff-accent);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
        .ff .sys h3{margin:0;font-size:16px}
        .ff .sys .role{color:var(--ff-mut);font-size:13px;margin:2px 0 0}
        .ff .sys .body{display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--ff-line);
          color:#33423a;font-size:14px;line-height:1.65}
        .ff .sys.open .body{display:block}

        @media(max-width:720px){
          .ff .board{width:100%;margin-left:0}
          .ff .ff-inner{max-width:100%}
          .ff .drawer{width:100%;max-width:100%}
          .ff .grid{grid-template-columns:1fr}
        }
      `}</style>

      {/* ═══ 标题 ═══ */}
      <div className="ff-inner">
        <div className="sec-h">
          <h2>工厂全景</h2>
          <span className="sub">点任意环节看「知识 + 实战」· 拖动画布左右平移</span>
        </div>
      </div>

      {/* ═══ 全屏画布 ═══ */}
      <div className="board" ref={boardRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {/* 紧凑工具栏 */}
        <div className="ff-toolbar">
          <div className="grp">
            <button type="button" className="ff-tbtn" aria-label="缩小" onClick={zoomOut}><Icon name="minus" size={16} /></button>
            <span className="ff-zoom">{Math.round(scale * 100)}%</span>
            <button type="button" className="ff-tbtn" aria-label="放大" onClick={zoomIn}><Icon name="plus" size={16} /></button>
          </div>
          <button type="button" className="ff-tbtn" aria-label="适应画布" onClick={fit} style={{ width: 'auto', padding: '0 10px', gap: 6, display: 'inline-flex' }}>
            <Icon name="expand" size={16} /><span style={{ fontSize: 12, color: 'inherit' }}>适应</span>
          </button>
          <div className="ff-legend">
            {(Object.keys(PHASE_COLOR) as Phase[]).map((p) => (
              <span key={p} className="lg">
                <span className="sw" style={{ background: PHASE_COLOR[p].fill, borderColor: PHASE_COLOR[p].stroke }} />
                {PHASE_LABEL[p]}
              </span>
            ))}
          </div>
        </div>

        <div className="stage-scale" style={{ height: Math.round(bounds.h * scale) }}>
          <div className="stage" ref={stageRef}
            style={{ width: bounds.w, height: bounds.h, transform: `scale(${scale})` }}>
            <svg width={bounds.w} height={bounds.h}
              viewBox={`0 0 ${bounds.w} ${bounds.h}`} preserveAspectRatio="none"
              role="img" aria-label="工厂流程图">
              <defs>
                <marker id="ff-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                  <path d="M0,0 L8,4.5 L0,9 Z" fill="var(--ff-slate)" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const s = nodeByKey.get(e.from);
                const t = nodeByKey.get(e.to);
                if (!s || !t) return null;
                const y1 = s.y + BOX_H / 2;
                const x1 = s.x + NODE_W;
                const y2 = t.y + BOX_H / 2;
                const x2 = t.x;
                const dx = Math.max(40, (x2 - x1) * 0.5);
                const hi = selectedKey === e.from || selectedKey === e.to;
                const muted = !!related && !hi;
                return (
                  <path key={i} className={`ff-line${hi ? ' hi' : ''}${muted ? ' muted' : ''}`}
                    style={hi && selPhaseStroke ? { stroke: selPhaseStroke } : undefined}
                    markerEnd="url(#ff-arrow)"
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`} />
                );
              })}
            </svg>
            {nodes.map((n, idx) => {
              const ph = phaseOf(n);
              const dim = !!related && !related.has(n.key);
              const status = visited.has(n.key) ? 'done' : (n.key === nextKey ? 'next' : 'todo');
              return (
                <button key={n.key} type="button"
                  className={`node phase-${ph}${selectedKey === n.key ? ' active' : ''}${dim ? ' dim' : ''} ${n.kind}`}
                  style={{ left: n.x - bounds.left, top: n.y - bounds.top, animationDelay: `${idx * 50}ms` }}
                  onClick={() => { setSelectedKey(n.key); markVisited(n.key); }} aria-pressed={selectedKey === n.key}>
                  <span className={`stat ${status}`} aria-hidden="true" />
                  <span className="node-in">
                    <span className="badge"><Icon name={n.icon as IconName} size={24} /></span>
                    <span className="chip">{n.label}</span>
                    <span className="kind">{n.kind === 'entry' ? '起点' : n.kind === 'exit' ? '终点' : '环节'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 详情抽屉 */}
        <div className={`drawer${selected ? ' open' : ''}`} aria-hidden={!selected}>
          {selected ? (
            <>
              <div className="d-head">
                <span className="dbadge"><Icon name={selected.icon as IconName} size={24} /></span>
                <h3>{selected.label}</h3>
                <button type="button" className="close" onClick={() => setSelectedKey(null)} aria-label="关闭">
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="d-phase">
                <span className="sw" style={{ width: 10, height: 10, borderRadius: 3, background: PHASE_COLOR[phaseOf(selected)].fill, border: `1.5px solid ${PHASE_COLOR[phaseOf(selected)].stroke}`, display: 'inline-block' }} />
                {PHASE_LABEL[phaseOf(selected)]}
              </div>
              <div className="d-kind">
                {selected.kind === 'entry' ? '流程起点' : selected.kind === 'exit' ? '流程终点' : '生产环节'}
              </div>
              <p className="d-know">{selected.description}</p>
              <div className="d-sys">
                <div className="lbl">涉及系统</div>
                <div className="tags">
                  {(SYSTEM_HINTS[selected.key] ?? []).map((s) => <span key={s} className="tag">{s}</span>)}
                </div>
              </div>
              <div className="drills-h">动手练（真实跳转）</div>
              {DRILLS.map((d) => (
                <Link key={d.to} to={d.to} className="drill">
                  <span className="di"><Icon name={d.icon} size={20} /></span>
                  <span>
                    <span className="dl">{d.label}</span>
                    <span className="dd">{d.desc}</span>
                  </span>
                </Link>
              ))}
            </>
          ) : null}
        </div>
      </div>

      {/* ═══ 提示 + 横切系统 ═══ */}
      <div className="ff-inner">
        <div className="pan-hint">
          <Icon name="expand" size={16} />
          <span>可拖动画布查看完整工厂 · 点节点看细节 · 绿点=已学 · 灰点=未开始 · 脉冲=推荐下一步</span>
        </div>

        <section className="sys-section">
          <div className="sec-h">
            <h2>贯穿全流程的系统</h2>
            <span className="sub">MES / ERP / WMS / QMS 是工具，不是孤立入口，点开看它管什么</span>
          </div>
          <div className="grid">
            {SYSTEMS.map((s) => (
              <div key={s.id} className={`sys${openSys.has(s.id) ? ' open' : ''}`}
                onClick={() => toggleSys(s.id)} role="button" tabIndex={0}>
                <div className="top">
                  <div className="ic"><Icon name={s.icon} size={24} /></div>
                  <div><h3>{s.name}</h3><div className="role">{s.role}</div></div>
                </div>
                <div className="body">{s.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
