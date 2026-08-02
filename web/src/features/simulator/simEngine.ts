/**
 * 车间仿真引擎（纯函数 + 编排辅助）。
 * 拓扑排序工艺路线 → 工单按批投产 → 逐工序流转 →
 * 检验节点按不良率分流（合格 / 回流返工 / 报废）→ 实时日志 + 指标。
 * 不引入任何运行时依赖，零副作用。
 */
import type { SimNode, SimEdge } from './simTypes';
import { NODE_LIBRARY } from './simTypes';

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
  leadTimeMin: number; // 累计标准工时
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
  outGood: number; // 流出合格数
  defective: number;
  reworked: number;
  scrapped: number;
  leadMin: number;
}

/** 默认投产批次 */
export const DEFAULT_BATCH = 200;

/** 回流返工回收率（假设一次返工后恢复的比例） */
const REWORK_YIELD = 0.92;

/**
 * 规划仿真：校验图结构 + 拓扑排序 + 识别回流边。
 * 纯函数，不产生日志，只返回计划与错误。
 */
export function planSimulation(nodes: SimNode[], edges: SimEdge[], batch = DEFAULT_BATCH): SimPlan {
  const errors: string[] = [];
  if (nodes.length === 0) {
    errors.push('画布为空，请先从左侧拖拽工序节点搭建流程');
  }

  const starts = nodes.filter((n) => (NODE_LIBRARY[n.nodeType]?.ports.in ?? 0) === 0);
  const ends = nodes.filter((n) => (NODE_LIBRARY[n.nodeType]?.ports.out ?? 0) === 0);
  if (starts.length === 0) errors.push('缺少起点节点（来料），请添加「来料」');
  if (ends.length === 0) errors.push('缺少终点节点（发货），请添加「发货」');

  // 回流目标：从检验节点出发、标记为 rework（dashed）的连线
  const reworkTargets = new Map<string, string>();
  const nodeTypeOf = (id: string) => nodes.find((n) => n.id === id)?.nodeType;
  for (const e of edges) {
    const t = nodeTypeOf(e.from);
    if (t && t.startsWith('i_') && e.dashed) reworkTargets.set(e.from, e.to);
  }

  // Kahn 拓扑排序
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const map = new Map(nodes.map((n) => [n.id, n]));
  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  // 回流（虚线）边是反馈环，不参与拓扑排序，否则会被误判成"环/断点"。
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
  const def = NODE_LIBRARY[node.nodeType];
  const cat = def?.category;
  const hours = node.props.hours ?? 0;
  const ts = now.toLocaleTimeString('zh-CN', { hour12: false });

  if (cat === 'endpoint') {
    if (node.nodeType === 'material') {
      return {
        log: { ts, type: 'run', msg: `来料入库 ${plan.batch} 件，工单 WO-${ts.replace(/:/g, '')} 下发` },
        outGood: plan.batch,
        defective: 0,
        reworked: 0,
        scrapped: 0,
        leadMin: 0,
      };
    }
    // 发货
    return {
      log: { ts, type: 'ok', msg: `成品发货 ${inGood} 件，订单履约完成` },
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
        ? `检验「${node.label}」：${inGood} 件中 ${defective} 件不良` +
          (reworkTarget ? `，${reworked} 件回流返工、${defective - reworked} 件报废` : `，${scrapped} 件报废`)
        : `检验「${node.label}」：全部合格`;
    return {
      log: { ts, type: defective > 0 ? 'warn' : 'ok', msg },
      outGood,
      defective,
      reworked,
      scrapped,
      leadMin: 0,
    };
  }

  // 加工 / 仓储：合格数不变，仅消耗工时
  const msg = `工序「${node.label}」处理 ${inGood} 件（标准工时 ${hours || '—'} 分）`;
  return {
    log: { ts, type: 'run', msg },
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
