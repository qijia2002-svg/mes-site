/**
 * 工厂全景（factory-first 导航主干）—— v11「响应式折行」重设计。
 *
 * v10 的问题：节点按数据里的 x/y 绝对定位，形成一条 1540px 的横向长带，
 * 必须一直往右拖才能看完，手机上更是完全不可用。
 *
 * v11 的解法：不再用绝对坐标，改为按拓扑深度切「步骤」，再用响应式网格折行铺满宽度。
 *  - 深度（最长路径）相同的节点归为同一步骤，天然保住分支（如 采购 / BOM 并列）。
 *  - 列数由容器实测宽度算出：宽屏一行 5~6 步、平板 3~4 步、手机 2 步，自动折行。
 *  - 顺序靠「步骤序号 01/02/…」承载，行内用极淡 chevron 连接，行尾不画箭头。
 *  - 去掉缩放 / 拖拽平移 / 全屏 100vw 长画布 —— 折行之后这些都不需要了。
 *  - 详情从右侧抽屉改为流程图正下方内联展开（看练同屏，手机上天然成立）。
 *
 * 视觉延续 v10 方向 B（Notion/Linear 克制专业）：
 *  白底 hairline 卡片 · 3px 左色条表阶段 · check-circle 表已学 · 无脉冲无渐变。
 * P0：零硬编码色（全部 var(--token)）· 图标全走 Icon.tsx 注册表 · 无 emoji · 无弹跳缓动。
 */
import { useEffect, Fragment, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '../../components/Icon';
import { LoadingState } from '../../components/StateBlock';
import { api } from '../../api/endpoints';
import type { FlowNodeDTO, FlowEdgeDTO } from '../../api/endpoints';

/** 单列最小宽度与列间距 —— 决定折行断点。 */
const MIN_COL = 168;
const COL_GAP = 26;
const VISITED_KEY = 'factory.visited';

type Phase = 'plan' | 'production' | 'qc' | 'logistics';

const PHASES: Phase[] = ['plan', 'production', 'qc', 'logistics'];
const PHASE_LABEL: Record<Phase, string> = {
  plan: '计划/仓储', production: '生产执行', qc: '质量检验', logistics: '物流出库',
};

/** 兜底工厂流（与 worker 种子一致）。x/y 仅作后端兼容，v11 布局不再使用。 */
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

type LaidNode = FlowNodeDTO & { phase: Phase };

/**
 * 按最长路径算深度，把节点切成「步骤」。深度相同 = 流程上并行的分支。
 * 有环或数据异常时回退为「按输入顺序每个节点一步」，保证永远能渲染。
 */
function buildSteps(nodes: LaidNode[], edges: FlowEdgeDTO[]): LaidNode[][] {
  const keys = new Set(nodes.map((n) => n.key));
  const valid = edges.filter((e) => keys.has(e.from) && keys.has(e.to));
  const outs = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  nodes.forEach((n) => { outs.set(n.key, []); indeg.set(n.key, 0); });
  valid.forEach((e) => {
    outs.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  });

  const depth = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((n) => { if ((indeg.get(n.key) ?? 0) === 0) { depth.set(n.key, 0); queue.push(n.key); } });

  let seen = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    seen += 1;
    const d = depth.get(cur) ?? 0;
    for (const nx of outs.get(cur) ?? []) {
      depth.set(nx, Math.max(depth.get(nx) ?? 0, d + 1));
      const left = (indeg.get(nx) ?? 0) - 1;
      indeg.set(nx, left);
      if (left === 0) queue.push(nx);
    }
  }

  // 有环 / 未全部遍历到 → 退化为线性步骤，宁可朴素也不能不显示。
  if (seen !== nodes.length) return nodes.map((n) => [n]);

  const byDepth = new Map<number, LaidNode[]>();
  nodes.forEach((n) => {
    const d = depth.get(n.key) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  });
  return [...byDepth.keys()].sort((a, b) => a - b).map((d) => byDepth.get(d)!);
}

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

  const nodes: LaidNode[] = useMemo(
    () => rawNodes.map((n) => ({ ...n, phase: (n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan') as Phase })),
    [rawNodes],
  );
  const steps = useMemo(() => buildSteps(nodes, edges), [nodes, edges]);

  // 选中的节点属于第几步 —— 详情面板就近插在该步骤正下方，点谁就贴着谁展开，不用滚到最底。
  const selectedStepIndex = useMemo(
    () => (selectedKey ? steps.findIndex((g) => g.some((n) => n.key === selectedKey)) : -1),
    [steps, selectedKey],
  );

  // 列数：按容器实测宽度算，宽屏多列、手机两列，纯 CSS 断点做不到「按内容数量收敛」。
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

  // 详情面板就近展开后，若落在视口外则轻轻滚入视野（block:nearest，不大幅跳动）。
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedKey]);

  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const selected = selectedKey ? nodeByKey.get(selectedKey) ?? null : null;

  // 推荐下一步：流程顺序中第一个未学过的节点。
  const nextKey = useMemo(() => {
    for (const st of steps) for (const n of st) if (!visited.has(n.key)) return n.key;
    return null;
  }, [steps, visited]);

  const doneCount = useMemo(() => nodes.filter((n) => visited.has(n.key)).length, [nodes, visited]);

  const toggleSys = (id: string) => {
    setOpenSys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickNode = (key: string) => {
    setSelectedKey((cur) => (cur === key ? null : key));
    markVisited(key);
  };

  if (q.isLoading) return <LoadingState label="加载工厂全景…" />;

  return (
    <div className="ff">
      <style>{`
        .ff{font-family:inherit;color:var(--fg)}
        .ff *{box-sizing:border-box}
        .ff .sec-h{display:flex;align-items:baseline;gap:10px;margin:0 0 6px;flex-wrap:wrap}
        .ff .sec-h h2{font-size:20px;margin:0;font-weight:600;letter-spacing:-.01em}
        .ff .sec-h .sub{color:var(--muted);font-size:13px}

        /* ── 进度条（学习产品感：走过多少环节）── */
        .ff .ff-prog{display:flex;align-items:center;gap:10px;margin:0 0 18px}
        .ff .ff-prog .bar{flex:1;max-width:220px;height:4px;border-radius:var(--radius-pill);
          background:var(--surface-3);overflow:hidden}
        .ff .ff-prog .bar i{display:block;height:100%;background:var(--accent);
          border-radius:var(--radius-pill);transition:width .3s var(--ease-standard)}
        .ff .ff-prog .txt{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}

        /* ── 图例 ── */
        .ff .ff-legend{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 16px}
        .ff .ff-legend .lg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
        .ff .ff-legend .dot{width:8px;height:8px;border-radius:var(--radius-pill);flex:none}

        /* ── 响应式步骤网格：折行铺满宽度，不再是横向长带 ── */
        .ff .ff-grid{display:grid;gap:20px ${COL_GAP}px;align-items:stretch}
        .ff .step{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0}
        .ff .step .sno{font-size:11px;color:var(--meta);font-variant-numeric:tabular-nums;
          letter-spacing:.08em;padding-left:2px}
        /* 行内步骤之间的极淡 chevron；行尾不画，靠序号承接下一行 */
        .ff .step .link{position:absolute;top:50%;right:-${Math.round(COL_GAP / 2) + 8}px;
          margin-top:-8px;color:var(--border-strong);pointer-events:none;display:flex}

        /* ── 节点卡片（延续 v10 hairline 风格）── */
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

        /* ── 内联详情：在流程图正下方展开，看练同屏 ── */
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
        .ff .drill .dd{display:block;font-size:12px;color:var(--muted);margin-top:2px}
        .ff .drill .dgo{margin-left:auto;color:var(--border-strong);flex:none;display:flex}
        .ff .drill:hover .dgo{color:var(--accent)}

        .ff .hint{display:flex;align-items:center;gap:7px;margin-top:16px;
          color:var(--muted);font-size:12px}

        /* ── 横切系统 ── */
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

      {/* ═══ 标题 + 进度 ═══ */}
      <div className="sec-h">
        <h2>工厂全景</h2>
        <span className="sub">按流程顺序走一遍，每个环节都能点进去看知识 + 动手练</span>
      </div>
      <div className="ff-prog">
        <span className="bar"><i style={{ width: `${nodes.length ? (doneCount / nodes.length) * 100 : 0}%` }} /></span>
        <span className="txt">已走过 {doneCount} / {nodes.length} 个环节</span>
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
                  const done = visited.has(n.key);
                  const isNext = !done && n.key === nextKey;
                  return (
                    <button key={n.key} type="button"
                      className={`node phase-${n.phase}${selectedKey === n.key ? ' active' : ''}${isNext ? ' is-next' : ''}`}
                      style={{ animationDelay: `${(si * 2 + ni) * 22}ms` }}
                      onClick={() => pickNode(n.key)} aria-pressed={selectedKey === n.key}>
                      <span className="nic"><Icon name={n.icon as IconName} size={20} /></span>
                      <span className="ntx">
                        <span className="ntitle">{n.label}</span>
                        <span className="nmeta">
                          {isNext
                            ? <span className="next">从这里继续<Icon name="chevron-right" size={16} /></span>
                            : PHASE_LABEL[n.phase]}
                        </span>
                      </span>
                      {done ? <span className="ndone" aria-label="已走过"><Icon name="check-circle" size={16} /></span> : null}
                    </button>
                  );
                })}
                {!isRowEnd && !isLast
                  ? <span className="link" aria-hidden="true"><Icon name="chevron-right" size={16} /></span>
                  : null}
              </div>
              {selected && selectedStepIndex === si ? (
                <div className="panel" style={{ gridColumn: '1 / -1' }} ref={panelRef}>
                  <div className="p-head">
                    <span className="pic"><Icon name={selected.icon as IconName} size={20} /></span>
                    <h3>{selected.label}</h3>
                    <button type="button" className="close" onClick={() => setSelectedKey(null)} aria-label="收起">
                      <Icon name="close" size={20} />
                    </button>
                  </div>
                  <div className="p-meta">
                    <span className="dot" style={{ background: `var(--phase-${selected.phase})` }} />
                    <span>{PHASE_LABEL[selected.phase]}</span>
                    <span className="sp">·</span>
                    <span>{selected.kind === 'entry' ? '流程起点' : selected.kind === 'exit' ? '流程终点' : '生产环节'}</span>
                  </div>
                  <div className="p-body">
                    <div>
                      <p className="p-know">{selected.description}</p>
                      <div className="p-sec">涉及系统</div>
                      <div className="p-tags">
                        {(SYSTEM_HINTS[selected.key] ?? []).map((s) => <span key={s} className="tag">{s}</span>)}
                      </div>
                    </div>
                    <div>
                      <div className="p-sec">在这个环节动手练</div>
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
                    </div>
                  </div>
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>

      <div className="hint">
        <Icon name="check-circle" size={16} />
        <span>打勾 = 已走过 · 绿框 = 建议从这里继续</span>
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
