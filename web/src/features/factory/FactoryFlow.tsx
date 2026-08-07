/**
 * 工厂全景（factory-first 导航主干）—— v10「克制专业」重设计。
 *
 * 设计依据：design-system/factory-flow-redesign.md（方向 B · Notion/Linear 克制专业）
 *  - 节点 = 白底 + 1px hairline 描边 + 大留白，横向排布（20px 图标 · 标题 · 环节名）。
 *    不做整卡色块填充、不做 56px 大徽章 —— v9「拥挤 + 像 BPM 工具」的根因。
 *  - 四阶段语义只以 3px 左色条 + 图例圆点表达，色值全部走 --phase-* token。
 *  - 进度用 Linear 式克制表达：已学 = check-circle(success)；推荐下一步 = accent 描边 +
 *    极轻光晕 + 「下一步」文字，无脉冲动画。
 *  - 连线 1.5px 中性灰；选中路径 accent 细线 + 轻流动虚线（linear）。
 *  - 保留：全屏画布、拖拽平移、缩放/平移 localStorage 记忆、详情抽屉、DEFAULT_FLOW 兜底。
 *  - P0：零硬编码色（全部 var(--token)）· 图标全走 Icon.tsx 注册表 · 无 emoji · 无弹跳缓动。
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '../../components/Icon';
import { LoadingState } from '../../components/StateBlock';
import { api } from '../../api/endpoints';
import type { FlowNodeDTO, FlowEdgeDTO } from '../../api/endpoints';

const NODE_W = 168;
const BOX_H = 64;
/** 数据坐标 → 画布坐标的呼吸系数：不改数据，只在渲染时拉开间距。 */
const SPREAD_X = 1.34;
const SPREAD_Y = 1.55;
const PAD = 48;
const VIEW_KEY = 'factory.view';
const VISITED_KEY = 'factory.visited';

type Phase = 'plan' | 'production' | 'qc' | 'logistics';

const PHASES: Phase[] = ['plan', 'production', 'qc', 'logistics'];
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

/** 实战入口：直接跳既有路由。 */
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
  const rawNodes = flow.nodes as (FlowNodeDTO & { phase?: Phase })[];
  const edges = flow.edges;

  /** 拉开间距后的布局坐标（数据不动，只动渲染）。 */
  const { nodes, bounds } = useMemo(() => {
    const laid = rawNodes.map((n) => ({
      ...n,
      phase: (n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan') as Phase,
      lx: n.x * SPREAD_X,
      ly: n.y * SPREAD_Y,
    }));
    const xs = laid.map((n) => n.lx);
    const ys = laid.map((n) => n.ly);
    const left = Math.min(...xs) - PAD;
    const right = Math.max(...xs) + NODE_W + PAD;
    const top = Math.min(...ys) - PAD;
    const bottom = Math.max(...ys) + BOX_H + PAD;
    return { nodes: laid, bounds: { left, top, w: right - left, h: bottom - top } };
  }, [rawNodes]);

  // 缩放：自动适配宽度（封顶 1.35）或被用户手动缩放覆盖；记忆到 localStorage。
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
      const s = avail >= bounds.w ? Math.min(1.35, avail / bounds.w) : 1;
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
  const zoomIn = () => setUserZoom(clamp((userZoom ?? autoScale) * 1.12, 0.6, 2));
  const zoomOut = () => setUserZoom(clamp((userZoom ?? autoScale) / 1.12, 0.6, 2));
  const fit = () => { setUserZoom(null); saveView(); };

  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
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

  const doneCount = useMemo(() => nodes.filter((n) => visited.has(n.key)).length, [nodes, visited]);

  const toggleSys = (id: string) => {
    setOpenSys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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

  if (q.isLoading) return <LoadingState label="加载工厂全景…" />;

  return (
    <div className="ff">
      <style>{`
        .ff{font-family:inherit;color:var(--fg)}
        .ff *{box-sizing:border-box}
        .ff .ff-inner{max-width:1120px;margin:0 auto;padding:0 4px}
        .ff .sec-h{display:flex;align-items:baseline;gap:10px;margin:0 0 16px;flex-wrap:wrap}
        .ff .sec-h h2{font-size:20px;margin:0;font-weight:600;letter-spacing:-.01em}
        .ff .sec-h .sub{color:var(--muted);font-size:13px}
        .ff .sec-h .prog{margin-left:auto;font-size:12px;color:var(--muted);
          font-variant-numeric:tabular-nums}

        /* ── 全屏画布（hairline first：无阴影，只有 1px 边）── */
        .ff .board{position:relative;width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);
          padding:20px 18px 26px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);
          background:var(--surface);overflow:auto;cursor:grab;user-select:none}
        .ff .board.grabbing{cursor:grabbing}

        /* ── 工具栏 ── */
        .ff .ff-toolbar{position:sticky;top:0;left:0;z-index:5;display:flex;align-items:center;
          gap:8px;flex-wrap:wrap;margin-bottom:18px;padding:6px 10px;border-radius:var(--radius-sm);
          background:var(--surface);border:1px solid var(--border)}
        .ff .ff-toolbar .grp{display:inline-flex;align-items:center;gap:2px}
        .ff .ff-tbtn{height:28px;min-width:28px;padding:0 6px;border-radius:var(--radius-xs);
          border:1px solid transparent;background:transparent;color:var(--muted);
          display:inline-flex;align-items:center;justify-content:center;gap:6px;
          cursor:pointer;transition:background .15s var(--ease-standard),color .15s var(--ease-standard);
          font-family:inherit;font-size:12px}
        .ff .ff-tbtn:hover{background:var(--surface-2);color:var(--fg)}
        .ff .ff-zoom{font-size:12px;color:var(--muted);min-width:38px;text-align:center;
          font-variant-numeric:tabular-nums}
        .ff .ff-sep{width:1px;height:18px;background:var(--border)}
        .ff .ff-legend{display:inline-flex;gap:14px;flex-wrap:wrap;margin-left:auto;padding-right:2px}
        .ff .ff-legend .lg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
        .ff .ff-legend .dot{width:8px;height:8px;border-radius:var(--radius-pill);flex:none}

        .ff .stage-scale{position:relative;width:100%}
        .ff .stage{position:relative;transform-origin:top left}
        .ff .stage svg{position:absolute;inset:0;display:block}
        .ff .ff-line{stroke:var(--border-strong);stroke-width:1.5;fill:none;
          transition:stroke .2s var(--ease-standard),opacity .2s var(--ease-standard)}
        .ff .ff-line.hi{stroke:var(--accent);stroke-dasharray:6 5;animation:ffFlow 1.1s linear infinite}
        .ff .ff-line.muted{opacity:.35}
        @keyframes ffFlow{to{stroke-dashoffset:-22}}

        /* ── 节点：白底 hairline，横向排布，大留白 ── */
        .ff .node{position:absolute;width:${NODE_W}px;min-height:${BOX_H}px;
          background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);
          padding:12px 14px 12px 16px;cursor:pointer;font-family:inherit;text-align:left;
          display:flex;align-items:center;gap:11px;overflow:hidden;
          transition:border-color .16s var(--ease-standard),background .16s var(--ease-standard),
            box-shadow .16s var(--ease-standard),opacity .22s var(--ease-standard);
          animation:ffNodeIn .34s var(--ease-out) both}
        /* 阶段语义：3px 左色条，绝不整卡填充 */
        .ff .node::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
          background:var(--ph);opacity:.75}
        .ff .node.phase-plan{--ph:var(--phase-plan)}
        .ff .node.phase-production{--ph:var(--phase-production)}
        .ff .node.phase-qc{--ph:var(--phase-qc)}
        .ff .node.phase-logistics{--ph:var(--phase-logistics)}
        .ff .node:hover{border-color:var(--border-strong);background:var(--surface-2)}
        .ff .node.active{border-color:var(--accent);background:var(--surface);
          box-shadow:0 0 0 3px var(--accent-soft)}
        .ff .node.is-next{border-color:var(--accent);
          box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)}
        .ff .node.dim{opacity:.4}
        .ff .node .nic{color:var(--muted);flex:none;display:flex;transition:color .16s var(--ease-standard)}
        .ff .node:hover .nic,.ff .node.active .nic{color:var(--accent)}
        .ff .node .ntx{min-width:0;flex:1}
        .ff .node .ntitle{display:block;font-size:14px;font-weight:500;line-height:1.35;
          color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ff .node .nmeta{display:flex;align-items:center;gap:5px;margin-top:3px;
          font-size:12px;font-weight:400;color:var(--muted)}
        .ff .node .nmeta .next{display:inline-flex;align-items:center;gap:2px;color:var(--accent)}
        .ff .node .ndone{flex:none;color:var(--success);display:flex}
        @keyframes ffNodeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

        /* ── 右侧详情抽屉 ── */
        .ff .drawer{position:absolute;top:0;right:0;bottom:0;width:372px;max-width:88%;
          background:var(--surface);border-left:1px solid var(--border);
          box-shadow:var(--elev-modal);z-index:6;
          transform:translateX(100%);transition:transform .22s var(--ease-standard);
          padding:22px 22px 26px;overflow-y:auto;display:flex;flex-direction:column}
        .ff .drawer.open{transform:translateX(0)}
        .ff .d-head{display:flex;align-items:center;gap:10px}
        .ff .d-head .dic{color:var(--muted);display:flex;flex:none}
        .ff .d-head h3{margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em}
        .ff .d-head .close{margin-left:auto;background:none;border:none;cursor:pointer;
          color:var(--muted);padding:5px;border-radius:var(--radius-xs);display:flex;
          transition:background .15s var(--ease-standard),color .15s var(--ease-standard)}
        .ff .d-head .close:hover{background:var(--surface-2);color:var(--fg)}
        .ff .d-meta{display:flex;align-items:center;gap:8px;margin:10px 0 16px;
          font-size:12px;color:var(--muted)}
        .ff .d-meta .dot{width:8px;height:8px;border-radius:var(--radius-pill);flex:none}
        .ff .d-meta .sp{color:var(--border-strong)}
        .ff .d-know{color:var(--fg-2);margin:0 0 18px;line-height:1.7;font-size:14px}
        .ff .d-sec{font-size:12px;font-weight:500;color:var(--muted);margin:0 0 9px}
        .ff .d-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}
        .ff .tag{background:var(--tag-bg);border:1px solid var(--tag-border);
          border-radius:var(--radius-xs);padding:2px 8px;font-size:12px;color:var(--tag-fg)}
        .ff .drill{display:flex;align-items:center;gap:11px;width:100%;text-align:left;
          border:1px solid transparent;border-radius:var(--radius-sm);padding:10px 10px 10px 8px;
          background:transparent;text-decoration:none;color:inherit;cursor:pointer;
          transition:background .15s var(--ease-standard),border-color .15s var(--ease-standard);
          font-family:inherit}
        .ff .drill + .drill{margin-top:2px}
        .ff .drill:hover{background:var(--surface-2);border-color:var(--border)}
        .ff .drill .di{color:var(--muted);flex:none;display:flex}
        .ff .drill:hover .di{color:var(--accent)}
        .ff .drill .dl{display:block;font-weight:500;font-size:14px}
        .ff .drill .dd{display:block;font-size:12px;color:var(--muted);margin-top:2px}
        .ff .drill .dgo{margin-left:auto;color:var(--border-strong);flex:none;display:flex}
        .ff .drill:hover .dgo{color:var(--accent)}

        /* ── 画布下方提示 ── */
        .ff .pan-hint{display:flex;align-items:center;gap:7px;margin-top:14px;
          color:var(--muted);font-size:12px}

        /* ── 横切系统 ── */
        .ff .sys-section{margin-top:32px}
        .ff .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
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

        @media(max-width:720px){
          .ff .board{width:100%;margin-left:0}
          .ff .ff-inner{max-width:100%}
          .ff .drawer{width:100%;max-width:100%}
          .ff .grid{grid-template-columns:1fr}
          .ff .ff-legend{margin-left:0;width:100%;gap:10px}
        }
      `}</style>

      {/* ═══ 标题 ═══ */}
      <div className="ff-inner">
        <div className="sec-h">
          <h2>工厂全景</h2>
          <span className="sub">点任意环节看「知识 + 实战」</span>
          <span className="prog">已走过 {doneCount} / {nodes.length} 个环节</span>
        </div>
      </div>

      {/* ═══ 全屏画布 ═══ */}
      <div className="board" ref={boardRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <div className="ff-toolbar">
          <div className="grp">
            <button type="button" className="ff-tbtn" aria-label="缩小" onClick={zoomOut}><Icon name="minus" size={16} /></button>
            <span className="ff-zoom">{Math.round(scale * 100)}%</span>
            <button type="button" className="ff-tbtn" aria-label="放大" onClick={zoomIn}><Icon name="plus" size={16} /></button>
          </div>
          <span className="ff-sep" />
          <button type="button" className="ff-tbtn" onClick={fit}>
            <Icon name="expand" size={16} />适应
          </button>
          <div className="ff-legend">
            {PHASES.map((p) => (
              <span key={p} className="lg">
                <span className="dot" style={{ background: `var(--phase-${p})` }} />
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
                <marker id="ff-arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                  <path d="M0,0.5 L7,4 L0,7.5 Z" fill="var(--border-strong)" />
                </marker>
                <marker id="ff-arrow-hi" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                  <path d="M0,0.5 L7,4 L0,7.5 Z" fill="var(--accent)" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const s = nodeByKey.get(e.from);
                const t = nodeByKey.get(e.to);
                if (!s || !t) return null;
                const y1 = s.ly - bounds.top + BOX_H / 2;
                const x1 = s.lx - bounds.left + NODE_W;
                const y2 = t.ly - bounds.top + BOX_H / 2;
                const x2 = t.lx - bounds.left;
                const dx = Math.max(30, (x2 - x1) * 0.45);
                const hi = selectedKey === e.from || selectedKey === e.to;
                const muted = !!related && !hi;
                return (
                  <path key={i} className={`ff-line${hi ? ' hi' : ''}${muted ? ' muted' : ''}`}
                    markerEnd={hi ? 'url(#ff-arrow-hi)' : 'url(#ff-arrow)'}
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`} />
                );
              })}
            </svg>
            {nodes.map((n, idx) => {
              const dim = !!related && !related.has(n.key);
              const done = visited.has(n.key);
              const isNext = !done && n.key === nextKey;
              return (
                <button key={n.key} type="button"
                  className={`node phase-${n.phase}${selectedKey === n.key ? ' active' : ''}${isNext ? ' is-next' : ''}${dim ? ' dim' : ''}`}
                  style={{ left: n.lx - bounds.left, top: n.ly - bounds.top, animationDelay: `${idx * 32}ms` }}
                  onClick={() => { setSelectedKey(n.key); markVisited(n.key); }} aria-pressed={selectedKey === n.key}>
                  <span className="nic"><Icon name={n.icon as IconName} size={20} /></span>
                  <span className="ntx">
                    <span className="ntitle">{n.label}</span>
                    <span className="nmeta">
                      {isNext
                        ? <span className="next">下一步<Icon name="chevron-right" size={16} /></span>
                        : <span>{PHASE_LABEL[n.phase]}</span>}
                    </span>
                  </span>
                  {done ? <span className="ndone" aria-label="已学过"><Icon name="check-circle" size={16} /></span> : null}
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
                <span className="dic"><Icon name={selected.icon as IconName} size={20} /></span>
                <h3>{selected.label}</h3>
                <button type="button" className="close" onClick={() => setSelectedKey(null)} aria-label="关闭">
                  <Icon name="close" size={20} />
                </button>
              </div>
              <div className="d-meta">
                <span className="dot" style={{ background: `var(--phase-${selected.phase})` }} />
                <span>{PHASE_LABEL[selected.phase]}</span>
                <span className="sp">·</span>
                <span>{selected.kind === 'entry' ? '流程起点' : selected.kind === 'exit' ? '流程终点' : '生产环节'}</span>
              </div>
              <p className="d-know">{selected.description}</p>

              <div className="d-sec">涉及系统</div>
              <div className="d-tags">
                {(SYSTEM_HINTS[selected.key] ?? []).map((s) => <span key={s} className="tag">{s}</span>)}
              </div>

              <div className="d-sec">在这个环节动手练</div>
              {DRILLS.map((d) => (
                <Link key={d.to} to={d.to} className="drill">
                  <span className="di"><Icon name={d.icon} size={20} /></span>
                  <span>
                    <span className="dl">{d.label}</span>
                    <span className="dd">{d.desc}</span>
                  </span>
                  <span className="dgo"><Icon name="chevron-right" size={16} /></span>
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
          <span>拖动画布可查看完整工厂 · 打勾=已走过 · accent 描边=推荐下一步</span>
        </div>

        <section className="sys-section">
          <div className="sec-h">
            <h2>贯穿全流程的系统</h2>
            <span className="sub">MES / ERP / WMS / QMS 是工具，不是孤立入口</span>
          </div>
          <div className="grid">
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
    </div>
  );
}
