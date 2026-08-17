/**
 * 排产教学迷你模拟 · 负荷与瓶颈引擎（路线图 P0-1 · APS 排产教学化）。
 *
 * 角度：计划层。给定若干工单，看三件事——
 *   1) 各工作中心累计负荷 → 谁是最慢的瓶颈
 *   2) 工单排产顺序 → 总工期（makespan）怎么变
 *   3) 给瓶颈加机器 → 总工期怎么塌下来（呼应产线模拟器 simCalc 反馈 B）
 *
 * 模型：流程车间（flow shop）—— 每张工单都按相同顺序流经同一组工作中心
 * （下料 → 机加工 → 组装 → 检验）。复用 simCalc 的四道工序标准工时与
 * 「瓶颈产能限流」思想，但把它从「产线产出」翻到「计划排程」。
 *
 * 纯函数、零副作用、无外部依赖，可被前端 import 或被 node 直接验证。
 */

export interface SchedCenter {
  /** 工作中心 key */
  key: string;
  /** 显示名 */
  label: string;
  /** 单件标准工时（分/件） */
  baseTime: number;
  /** 并行机器数（可加资源破瓶颈），默认 1 */
  units: number;
}

export interface SchedOrder {
  id: string;
  label: string;
  /** 这单要造多少件 */
  qty: number;
}

export interface SchedBlock {
  orderId: string;
  orderLabel: string;
  /** 该工单在这道工序的起止（分钟，自排产起点） */
  start: number;
  end: number;
}

export interface SchedCenterResult {
  key: string;
  label: string;
  /** 该中心真实消耗的机器分钟（= ∑ 各工单 qty × baseTime，不受并行机影响） */
  machineMinutes: number;
  /** 单班产能（件）= floor(480 / baseTime) × units */
  capacity: number;
  /** 利用率 %（0–100），基于 makespan 与并行机 */
  utilization: number;
  isBottleneck: boolean;
  /** 甘特块（按排产顺序） */
  blocks: SchedBlock[];
}

export interface SchedResult {
  /** 总工期（分钟，单班尺度） */
  makespan: number;
  /** 折算班次（makespan / 480，1 位小数） */
  shifts: number;
  centers: SchedCenterResult[];
  bottleneckKey: string;
  bottleneckLabel: string;
  /** 各中心最大负荷（分钟），画负荷条用 */
  maxLoad: number;
}

const SHIFT_MIN = 480;

/**
 * 跑一次排产。orders 的顺序即排产顺序（用户可调）。
 * 流程车间递推：C[i][j] = max(C[i-1][j], C[i][j-1]) + qty_i × baseTime_j / units_j
 * 含义：第 i 张工单在第 j 道工序的完工时刻 = 它上一道完 vs 这工序上一单完，取晚者 + 本道耗时。
 */
export function runSched(orders: SchedOrder[], centers: SchedCenter[]): SchedResult {
  const n = orders.length;
  const m = centers.length;
  // 各中心有效单件工时（含并行机）
  const eff = centers.map((c) => c.baseTime / Math.max(1, c.units));

  const C: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  const blocks: SchedBlock[][][] = Array.from({ length: n }, () =>
    Array.from({ length: m }, () => [] as SchedBlock[]),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const dur = orders[i].qty * eff[j];
      const prevCenter = j > 0 ? C[i][j - 1] : 0;
      const prevOrder = i > 0 ? C[i - 1][j] : 0;
      const start = Math.max(prevCenter, prevOrder);
      const end = start + dur;
      C[i][j] = end;
      blocks[i][j] = [{ orderId: orders[i].id, orderLabel: orders[i].label, start, end }];
    }
  }

  const makespan = n > 0 && m > 0 ? C[n - 1][m - 1] : 0;
  const totalQty = orders.reduce((s, o) => s + o.qty, 0);

  const centersRes: SchedCenterResult[] = centers.map((c) => {
    const machineMinutes = totalQty * c.baseTime; // 真实机器分钟（不受并行机影响）
    const capacity = Math.floor(SHIFT_MIN / c.baseTime) * Math.max(1, c.units);
    const capacityMinutes = Math.max(1, c.units) * makespan;
    const utilization =
      makespan > 0 ? Math.min(100, Math.round((machineMinutes / capacityMinutes) * 100)) : 0;
    return {
      key: c.key,
      label: c.label,
      machineMinutes,
      capacity,
      utilization,
      isBottleneck: false,
      blocks: [],
    };
  });

  // 标记瓶颈：机器分钟最高的中心（并列取首个）
  let maxLoad = 0;
  centersRes.forEach((r) => {
    if (r.machineMinutes > maxLoad) maxLoad = r.machineMinutes;
  });
  centersRes.forEach((r) => {
    r.isBottleneck = r.machineMinutes === maxLoad;
  });

  // 回填每个中心的甘特块（按中心 j 收集所有 i）
  for (let j = 0; j < m; j++) {
    const arr: SchedBlock[] = [];
    for (let i = 0; i < n; i++) arr.push(blocks[i][j][0]);
    centersRes[j].blocks = arr;
  }

  const bn = centersRes.find((r) => r.isBottleneck) ?? centersRes[0];

  return {
    makespan,
    shifts: Math.round((makespan / SHIFT_MIN) * 10) / 10,
    centers: centersRes,
    bottleneckKey: bn?.key ?? '',
    bottleneckLabel: bn?.label ?? '',
    maxLoad,
  };
}

/** 默认四工作中心（与 simCalc 同标准工时，机加工 9 分/件为天然瓶颈） */
export const DEFAULT_CENTERS: SchedCenter[] = [
  { key: 'cut', label: '下料', baseTime: 2, units: 1 },
  { key: 'mach', label: '机加工', baseTime: 9, units: 1 },
  { key: 'asm', label: '组装', baseTime: 3, units: 1 },
  { key: 'qc', label: '检验', baseTime: 1.5, units: 1 },
];

/** 默认三张工单（总 130 件） */
export const DEFAULT_ORDERS: SchedOrder[] = [
  { id: 'WO-A', label: '工单 A', qty: 40 },
  { id: 'WO-B', label: '工单 B', qty: 60 },
  { id: 'WO-C', label: '工单 C', qty: 30 },
];
