/**
 * 车间仿真引擎（纯函数 + 编排辅助）。
 * 拓扑排序工艺路线 → 工单按批投产 → 逐工序流转（边带流量、节点汇流求和）→
 * 检验节点按不良率分流（合格 / 回流返工 / 报废）→ 回流迭代收敛后再循环 →
 * 实时日志 + 指标。
 * 不引入任何运行时依赖，零副作用。
 */
import type { SimNode, SimEdge, SimNodeDef } from './simTypes';
import { NODE_LIBRARY } from './simTypes';

/** 取节点定义：优先用节点自带 def（自定义工序已随节点持久化），否则回退 NODE_LIBRARY */
function nodeDef(n: SimNode): SimNodeDef | undefined {
  return n.def ?? NODE_LIBRARY[n.nodeType];
}

/** 运行日志条目 */
export interface SimLogEntry {
  ts: string;
  type: 'info' | 'ok' | 'warn' | 'fail' | 'run';
  msg: string;
}

/** 仿真指标 */
export interface SimMetrics {
  total: number; // 投产数量
  passed: number; // 最终合格发货
  defective: number; // 累计检验发现的不良
  reworked: number; // 回流返工数量
  scrapped: number; // 报废数量
  theoreticalProcessMin: number; // 理论加工工时（分）：仅各工序标准工时之和，不含排队/搬运/换型/检验等待。真实生产周期中排队常占 80% 以上，此值会严重偏小，切勿当成交期或交付周期使用。
}

/** 仿真计划（拓扑序 + 回流映射 + 校验错误） */
export interface SimPlan {
  order: SimNode[]; // 拓扑序节点
  reworkTargets: Map<string, string>; // 检验节点 id → 回流目标节点 id
  errors: string[];
  totalHours: number;
  batch: number;
}

/** 单步仿真结果 */
export interface SimStep {
  log: SimLogEntry;
  good: number; // 合格流出（不含返工）
  outGood: number; // 该节点对外总流出（合格 + 返工）
  defective: number;
  reworked: number;
  scrapped: number;
  leadMin: number;
}

/** 默认投产批次 */
export const DEFAULT_BATCH = 200;

/** 回流返工回收率（假设一次返工后恢复的比例） */
const REWORK_YIELD = 0.92;

/** 回流迭代收敛上限（防反馈环死循环） */
const MAX_ITER = 12;

/** 单班工时（小时），用于把瓶颈产能换算成「理论班产」 */
const SHIFT_HOURS = 16;

function woId(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `WO-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/**
 * 规划仿真：校验图结构 + 拓扑排序 + 识别回流边。
 * 纯函数，不产生日志，只返回计划与错误。
 */
export function planSimulation(nodes: SimNode[], edges: SimEdge[], batch = DEFAULT_BATCH): SimPlan {
  const errors: string[] = [];
  if (nodes.length === 0) {
    errors.push('画布为空，请先从左侧拖拽工序节点搭建流程');
  }

  const starts = nodes.filter((n) => (nodeDef(n)?.ports.in ?? 0) === 0);
  const ends = nodes.filter((n) => (nodeDef(n)?.ports.out ?? 0) === 0);
  if (starts.length === 0) errors.push('缺少起点节点（来料），请添加「来料」');
  if (ends.length === 0) errors.push('缺少终点节点（发货），请添加「发货」');

  // 回流目标：从检验节点出发、标记为 rework（dashed）的连线
  const reworkTargets = new Map<string, string>();
  const nodeTypeOf = (id: string) => nodes.find((n) => n.id === id)?.nodeType;
  for (const e of edges) {
    const t = nodeTypeOf(e.from);
    if (t && t.startsWith('i_') && e.dashed) reworkTargets.set(e.from, e.to);
  }

  // Kahn 拓扑排序（忽略虚线回流边，避免被误判成环）
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const map = new Map(nodes.map((n) => [n.id, n]));
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    if (e.dashed) return;
    if (indeg.has(e.to) && adj.has(e.from)) {
      indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
      adj.get(e.from)!.push(e.to);
    }
  });
  const queue: string[] = [];
  indeg.forEach((d, id) => {
    if (d === 0) queue.push(id);
  });
  const order: SimNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = map.get(id);
    if (node) order.push(node);
    for (const nxt of adj.get(id) ?? []) {
      indeg.set(nxt, (indeg.get(nxt) ?? 0) - 1);
      if (indeg.get(nxt) === 0) queue.push(nxt);
    }
  }
  if (order.length !== nodes.length) {
    errors.push('工艺流程存在环或断点，请检查连线是否连通');
  }

  const totalHours = nodes.reduce((s, n) => s + (n.props.hours ?? 0), 0);
  return { order, reworkTargets, errors, totalHours, batch };
}

/**
 * 计算单个节点在仿真中的流转结果。
 * 纯函数：输入进入的合格数 + 计划，输出流出合格数与日志。
 */
export function computeStep(node: SimNode, inGood: number, plan: SimPlan, now: Date): SimStep {
  const def = nodeDef(node);
  const cat = def?.category;
  const hours = node.props.hours ?? 0;
  const ts = now.toLocaleTimeString('zh-CN', { hour12: false });

  if (cat === 'endpoint') {
    if (node.nodeType === 'material') {
      return {
        log: { ts, type: 'run', msg: `来料入库 ${plan.batch} 件，工单 ${woId(now)} 下发` },
        good: plan.batch,
        outGood: plan.batch,
        defective: 0,
        reworked: 0,
        scrapped: 0,
        leadMin: 0,
      };
    }
    // 发货
    return {
      log: { ts, type: 'ok', msg: `成品发货 ${Math.round(inGood)} 件，订单履约完成` },
      good: inGood,
      outGood: inGood,
      defective: 0,
      reworked: 0,
      scrapped: 0,
      leadMin: 0,
    };
  }

  if (cat === 'inspect') {
    const rate = (node.props.defectRate ?? 0) / 100;
    const defective = Math.round(inGood * rate);
    const good = inGood - defective;
    const reworkTarget = plan.reworkTargets.get(node.id);
    let reworked = 0;
    let scrapped = 0;
    if (defective > 0) {
      if (reworkTarget) reworked = Math.round(defective * REWORK_YIELD);
      else scrapped = defective;
    }
    const outGood = good + reworked;
    const msg =
      defective > 0
        ? `检验「${node.label}」：${Math.round(inGood)} 件中 ${defective} 件不良` +
          (reworkTarget ? `，${reworked} 件回流返工、${defective - reworked} 件报废` : `，${scrapped} 件报废`)
        : `检验「${node.label}」：全部合格`;
    return {
      log: { ts, type: defective > 0 ? 'warn' : 'ok', msg },
      good,
      outGood,
      defective,
      reworked,
      scrapped,
      leadMin: 0,
    };
  }

  // 加工 / 仓储：合格数不变，仅消耗工时
  const msg = `工序「${node.label}」处理 ${Math.round(inGood)} 件（标准工时 ${hours || '—'} 分）`;
  return {
    log: { ts, type: 'run', msg },
    good: inGood,
    outGood: inGood,
    defective: 0,
    reworked: 0,
    scrapped: 0,
    leadMin: hours,
  };
}

/** 首条仿真日志 */
export function startLog(batch: number): SimLogEntry {
  return {
    ts: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    type: 'info',
    msg: `仿真启动：投产批次 ${batch} 件，开始沿工艺路线流转`,
  };
}

/** 按边比率把 amount 分配到多条出边（缺省等权） */
function distribute(outs: SimEdge[], amount: number, edgeFlow: Record<string, number>): void {
  if (outs.length === 0 || amount <= 0) return;
  const ratios = outs.map((e) => (e.ratio && e.ratio > 0 ? e.ratio : 1));
  const total = ratios.reduce((a, b) => a + b, 0) || 1;
  outs.forEach((e, i) => {
    edgeFlow[e.id] = (edgeFlow[e.id] ?? 0) + (amount * ratios[i]) / total;
  });
}

/** 瓶颈工序分析结果（C 档） */
export interface SimBottleneck {
  id: string;
  label: string;
  capacity: number; // 产能（件/小时）
  perShift: number; // 理论班产（件/班）
}

// ============================================================================
// 仿真结果 → SQL 库（两岛打通）：把一次运行的结构化明细序列化进 sim_* 表。
// 仅描述数据形状，真正的建表/插值在 simToSql.ts；此处产出纯数据，零副作用。
// ============================================================================

/** 仿真产出的工单（命名空间隔离，不引用 canonical 的 product_id 外键） */
export interface SimWorkOrderRecord {
  woNo: string;
  product: string; // 产线产出描述（仿真不建模具体产品，用文字标签）
  qtyPlan: number;
  qtyDone: number;
  state: string; // finished / running
  workshop: string;
  dueDate: string;
}

/** 仿真产出的逐工序报工（process + inspect 节点各一行） */
export interface SimProductionRecord {
  recId: number;
  nodeLabel: string;
  equipCode: string;
  operator: string;
  qtyOk: number;
  qtyNg: number;
  reportTime: string;
}

/** 仿真产出的逐检验质检 */
export interface SimQualityCheck {
  checkId: number;
  nodeLabel: string;
  checkTime: string;
  result: string; // 合格 / 不合格
  defectType: string | null;
}

/** 一次运行的完整明细报告（供 simToSql 序列化） */
export interface SimRunReport {
  workOrder: SimWorkOrderRecord;
  production: SimProductionRecord[];
  checks: SimQualityCheck[];
}

/** 完整仿真结果 */
export interface SimSimulateResult {
  ok: boolean;
  errors: string[];
  logs: SimLogEntry[]; // 按拓扑序，用于逐节点动画
  order: SimNode[];
  metrics: SimMetrics;
  edgeFlow: Record<string, number>; // 每条边的流量（含回流虚线边）
  nodeInflow: Record<string, number>;
  nodeOutflow: Record<string, number>;
  bottleneck: SimBottleneck | null;
  bottleneckId: string | null;
  /** 在制堆积（WIP）：每节点一班清不掉的 backlog；瓶颈及其上游会冒出数值，说明产能被最慢工序卡死 */
  wip: Record<string, number>;
  /** 拥堵边：指向在制 > 0 节点的入边，画布标红加粗 */
  congestedEdges: string[];
  /** 结构化明细报告（两岛打通）：工单 + 逐工序报工 + 逐检验质检，供序列化进 SQL 库 */
  report: SimRunReport;
}

function emptyMetrics(batch: number): SimMetrics {
  return { total: batch, passed: 0, defective: 0, reworked: 0, scrapped: 0, theoreticalProcessMin: 0 };
}

function emptyReport(): SimRunReport {
  return { workOrder: { woNo: '', product: '', qtyPlan: 0, qtyDone: 0, state: 'running', workshop: '', dueDate: '' }, production: [], checks: [] };
}

/**
 * 完整仿真：迭代收敛处理汇流与回流反馈环。
 * 每条边携带流量；节点入流 = 所有入边流量之和（天然支持多输入汇流）；
 * 检验节点把合格品往前送、不良品按比率回流到目标节点再次处理。
 */
export function simulate(nodes: SimNode[], edges: SimEdge[], batch = DEFAULT_BATCH): SimSimulateResult {
  const plan = planSimulation(nodes, edges, batch);
  if (plan.errors.length) {
    return { ok: false, errors: plan.errors, logs: [], order: [], metrics: emptyMetrics(batch), edgeFlow: {}, nodeInflow: {}, nodeOutflow: {}, bottleneck: null, bottleneckId: null, wip: {}, congestedEdges: [], report: emptyReport() };
  }

  const inEdges = new Map<string, SimEdge[]>();
  const outEdges = new Map<string, SimEdge[]>();
  nodes.forEach((n) => {
    inEdges.set(n.id, []);
    outEdges.set(n.id, []);
  });
  edges.forEach((e) => {
    if (inEdges.has(e.to)) inEdges.get(e.to)!.push(e);
    if (outEdges.has(e.from)) outEdges.get(e.from)!.push(e);
  });

  // 投料源 / 发货汇按拓扑判定，而非写死 nodeType：
  // 入度为 0 的 endpoint（material 或 cust-order）都是投料起点；
  // 出度为 0 的 endpoint（ship 或 shipping）都是发货终点。
  // 这样通用工厂（cust-order→…→shipping）和离散制造示例线（material→…→ship）都能正确仿真。
  const isSource = (n: SimNode) => nodeDef(n)?.category === 'endpoint' && (inEdges.get(n.id)?.length ?? 0) === 0;
  const isSink = (n: SimNode) => nodeDef(n)?.category === 'endpoint' && (outEdges.get(n.id)?.length ?? 0) === 0;

  const edgeFlow: Record<string, number> = {};
  edges.forEach((e) => (edgeFlow[e.id] = 0));
  const nodeInflow: Record<string, number> = {};
  const nodeOutflow: Record<string, number> = {};
  const now = new Date();

  // Phase 1：迭代收敛（汇流求和 + 回流再循环）
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // 1. 由当前边流量算各节点入流
    nodes.forEach((n) => {
      nodeInflow[n.id] = inEdges.get(n.id)!.reduce((s, e) => s + (edgeFlow[e.id] ?? 0), 0);
    });
    // 2. 拓扑序算各节点出流
    const newOut: Record<string, number> = {};
    for (const node of plan.order) {
      const def = nodeDef(node);
      const cat = def?.category;
      if (cat === 'endpoint' && isSource(node)) newOut[node.id] = batch;
      else if (cat === 'endpoint' && isSink(node)) newOut[node.id] = nodeInflow[node.id];
      else newOut[node.id] = computeStep(node, nodeInflow[node.id], plan, now).outGood;
    }
    // 3. 由出流重新分配边流量（合格往前、返工回流）
    const newEdgeFlow: Record<string, number> = {};
    edges.forEach((e) => (newEdgeFlow[e.id] = 0));
    for (const node of plan.order) {
      const def = nodeDef(node);
      const outs = outEdges.get(node.id)!.filter((e) => !e.dashed);
      const reworkE = outEdges.get(node.id)!.find((e) => e.dashed);
      if (def?.category === 'inspect' && reworkE) {
        const st = computeStep(node, nodeInflow[node.id], plan, now);
        distribute(outs, st.good, newEdgeFlow); // 合格品往前走
        newEdgeFlow[reworkE.id] = (newEdgeFlow[reworkE.id] ?? 0) + st.reworked; // 返工品回流
      } else {
        distribute(outs, newOut[node.id], newEdgeFlow);
      }
    }
    // 4. 收敛判定
    let maxDelta = 0;
    edges.forEach((e) => {
      maxDelta = Math.max(maxDelta, Math.abs((newEdgeFlow[e.id] ?? 0) - (edgeFlow[e.id] ?? 0)));
    });
    edges.forEach((e) => (edgeFlow[e.id] = newEdgeFlow[e.id]));
    nodes.forEach((n) => (nodeOutflow[n.id] = newOut[n.id]));
    if (maxDelta < 0.5) break;
  }

  // Phase 2：终态日志 + 指标（用收敛后的入/出流，单次计账不重复）
  const logs: SimLogEntry[] = [];
  let defective = 0;
  let reworked = 0;
  let scrapped = 0;
  let lead = 0;
  for (const node of plan.order) {
    const def = nodeDef(node);
    if (!def) continue;
    const cat = def.category;
    const inflow = nodeInflow[node.id];
    if (cat === 'endpoint' && isSource(node)) {
      logs.push({ ts: now.toLocaleTimeString('zh-CN', { hour12: false }), type: 'run', msg: `「${node.label}」下发工单 ${woId(now)}，投料 ${batch} 件` });
    } else if (cat === 'endpoint' && isSink(node)) {
      logs.push({ ts: now.toLocaleTimeString('zh-CN', { hour12: false }), type: 'ok', msg: `成品「${node.label}」发货 ${Math.round(inflow)} 件，订单履约完成` });
    } else if (cat === 'inspect') {
      const st = computeStep(node, inflow, plan, now);
      defective += st.defective;
      reworked += st.reworked;
      scrapped += st.scrapped;
      logs.push(st.log);
    } else {
      logs.push({ ts: now.toLocaleTimeString('zh-CN', { hour12: false }), type: 'run', msg: `工序「${node.label}」处理 ${Math.round(inflow)} 件（标准工时 ${node.props.hours || '—'} 分）` });
      lead += node.props.hours ?? 0;
    }
  }

  const sourceCount = nodes.filter(isSource).length || 1;
  const total = batch * sourceCount;
  const shipNodes = nodes.filter(isSink);
  const passed = shipNodes.reduce((s, n) => s + (nodeOutflow[n.id] ?? 0), 0);
  const metrics: SimMetrics = {
    total,
    passed: Math.round(passed),
    defective: Math.round(defective),
    reworked: Math.round(reworked),
    scrapped: Math.round(scrapped),
    theoreticalProcessMin: lead,
  };

  // 瓶颈分析：产能最低的在制工序（起止节点视为无限产能，不限制）
  let bottleneck: SimBottleneck | null = null;
  let minCap = Infinity;
  for (const node of plan.order) {
    const def = nodeDef(node);
    if (!def || def.category === 'endpoint') continue;
    const cap = node.props.capacity && node.props.capacity > 0
      ? node.props.capacity
      : node.props.hours && node.props.hours > 0
        ? 60 / node.props.hours
        : Infinity;
    if (cap < minCap) {
      minCap = cap;
      bottleneck = { id: node.id, label: node.label, capacity: cap, perShift: Math.round(cap * SHIFT_HOURS) };
    }
  }

  // 在制堆积（WIP）：每节点一班清不掉的 backlog。瓶颈（产能最低）及其上游会冒出数值，
  // 直观说明「非瓶颈开再快也没用」——产线吞吐被最慢工序卡死，前面的工序只能堆在制品。
  const wip: Record<string, number> = {};
  const congestedEdges: string[] = [];
  for (const node of plan.order) {
    const def = nodeDef(node);
    if (!def || def.category === 'endpoint') { wip[node.id] = 0; continue; }
    const cap = node.props.capacity && node.props.capacity > 0
      ? node.props.capacity
      : node.props.hours && node.props.hours > 0
        ? 60 / node.props.hours
        : Infinity;
    const through = cap === Infinity ? Infinity : cap * SHIFT_HOURS;
    const inflow = nodeInflow[node.id] ?? 0;
    wip[node.id] = through === Infinity ? 0 : Math.max(0, Math.round(inflow - through));
  }
  const congestedNodeIds = new Set(Object.keys(wip).filter((k) => wip[k] > 0));
  for (const e of edges) {
    if (congestedNodeIds.has(e.to)) congestedEdges.push(e.id);
  }

  // 两岛打通：把一次运行的结构化明细打包成 report（工单 + 逐工序报工 + 逐检验质检），
  // 由 simToSql 序列化成 sim_* 表写进 SQL 库。仿真不建模具体产品，工单用文字标签。
  const OPERATORS = ['仿真工·甲', '仿真工·乙', '仿真工·丙', '仿真工·丁'];
  const baseTime = new Date(now.getTime()); // 快照，避免 mutate
  const ts = baseTime.toLocaleTimeString('zh-CN', { hour12: false });
  const dateStr = baseTime.toISOString().slice(0, 10);
  const woNo = woId(baseTime);
  const production: SimProductionRecord[] = [];
  const checks: SimQualityCheck[] = [];
  let recSeq = 0;
  let chkSeq = 0;
  let cumMinutes = 0; // 累计工时（分），用于摊开时间深度
  for (const node of plan.order) {
    const def = nodeDef(node);
    if (!def || def.category === 'endpoint') continue;
    const inflow = nodeInflow[node.id] ?? 0;
    const st = computeStep(node, inflow, plan, baseTime);
    const nodeHours = node.props.hours ?? 0;
    // 按累计工时偏移时间戳：每步推进 nodeHours 分钟，模拟真实报时顺序
    const stepTime = new Date(baseTime.getTime() + cumMinutes * 60000);
    const stepTs = stepTime.toLocaleTimeString('zh-CN', { hour12: false });
    cumMinutes += Math.max(nodeHours, 1); // 至少推 1 分钟，避免同时间戳
    production.push({
      recId: ++recSeq,
      nodeLabel: node.label,
      equipCode: node.label,
      operator: OPERATORS[recSeq % OPERATORS.length],
      qtyOk: Math.round(st.good),
      qtyNg: Math.round(st.defective),
      reportTime: stepTs,
    });
    if (def.category === 'inspect') {
      const bad = st.defective > 0;
      checks.push({
        checkId: ++chkSeq,
        nodeLabel: node.label,
        checkTime: stepTs,
        result: bad ? '不合格' : '合格',
        defectType: bad ? '检验不良' : null,
      });
    }
  }
  const report: SimRunReport = {
    workOrder: {
      woNo,
      product: '仿真产线产出',
      qtyPlan: Math.round(total),
      qtyDone: Math.round(passed),
      state: passed > 0 ? 'finished' : 'running',
      workshop: '仿真沙盒',
      dueDate: dateStr,
    },
    production,
    checks,
  };

  return { ok: true, errors: [], logs, order: plan.order, metrics, edgeFlow, nodeInflow, nodeOutflow, bottleneck, bottleneckId: bottleneck?.id ?? null, wip, congestedEdges, report };
}
