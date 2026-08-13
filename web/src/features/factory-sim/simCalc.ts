/**
 * 工厂教学模拟器 · 产能限流引擎（PRD-FactorySim-v1 §4）。
 *
 * 为什么不复用旧 simEngine.ts：
 * 旧引擎是「流量守恒」模型——computeStep 对加工节点直接 outGood = inGood，
 * 不按产能限流，实测会永远 passed = Q（减不良），默认配置算出 M1=100，
 * 根本出不了 PRD 验收要求的 M1=53，更演示不了「瓶颈卡死产出」。
 * 本引擎按「瓶颈产能限流」建模（produced = min(Q, T)），这才是教学灵魂，旧引擎做不到。
 * 因此「重建」= 旧拖拽沙盒整体退役，本文件独立承担教学计算。
 *
 * 纯函数、零副作用、无外部依赖，可直接被前端 import 或被 node --experimental-strip-types 验证。
 */

export interface SimParams {
  /** 这单要交多少货（件）20–500，默认 100 */
  Q: number;
  /** 卡住那道工序（机加工）加几台机器 1–4，默认 1 */
  kb: number;
  /** 不卡那道工序（组装）加几台机器 1–3，默认 1 */
  kf: number;
  /** 做坏的比例（%）0–20，默认 5 */
  p: number;
  /** 一次投多少件（批量）20–400，默认 100 */
  B: number;
  /** 换型停机假设开关（标签 6），默认关 */
  swapOn: boolean;
  /** 班次 1 或 2（标签 7），默认 1 */
  shift: 1 | 2;
}

export interface SimResult {
  /** M1 这班交出多少好货（合格发货件数） */
  M1: number;
  /** M2 产线最大能耐（瓶颈产能，件/班，含班次缩放） */
  M2: number;
  /** M3 卡在半路的半成品（在制品堆积） */
  M3: number;
  /** M4 真正要几天交完（按班次取整；交不完为 null） */
  M4: number | null;
  /** M5 做坏扔掉的（报废） */
  M5: number;
  /** M6 做坏返工的 */
  M6: number;
  /** M7 闲着没干的机器占比（非瓶颈工序平均闲置率 %） */
  M7: number;
  /** 最慢那道工序的显示名（大白话，不暴露专业术语） */
  bottleneckLabel: string;
  /** 各工序最终产能（件/班），已含换型修正；供流程图展示利用率与瓶颈 */
  capByNode: number[];
  /** 瓶颈工序下标（0=下料, 1=机加工, 2=组装, 3=检验） */
  bottleneckIndex: number;
  /** 理论加工工时（分/件）= 各工序标准工时之和，刻意保留 simEngine 的诚实注释精神 */
  theoreticalMin: number;
  /** 每道工序的闲置率明细（供标签 4 展开） */
  idleByNode: { label: string; idle: number; isBottleneck: boolean }[];
  /** 调试/教学用底层量 */
  produced: number;
  defective: number;
  reworked: number;
  scrapped: number;
  Tbase: number;
  Tshift: number;
}

const SHIFT_MIN = 480; // 单班分钟数（8 小时工作制）
const BASE_TIME = [2, 9, 3, 1.5]; // 四道工序标准工时（分/件）：下料 / 机加工 / 组装 / 检验
const NODE_LABELS = ['下料', '机加工', '组装', '检验'];
const REWORK_YIELD = 0.92; // 返工回收率（同旧 simEngine）
const CHANGEOVER_MIN = 20; // 每批换型固定损耗（分钟，模型常数）

/**
 * 跑一次模拟，返回 7 个读数卡片 + 底层量。
 * 数学严格对齐 PRD §4，保证三条反直觉结果可复现：
 *  - k_f 拉动 M1 不动（非瓶颈开再快也没用）
 *  - k_b 拉动 M1 近似翻倍（杠杆全在瓶颈）
 *  - Q 加倍 M3 爆炸、M4 变长（加单不加产能，堆的是仓库）
 */
export function runSim(p: SimParams): SimResult {
  const units = [1, p.kb, p.kf, 1];
  // 各工序单班产能（件/班）= floor(单班分钟 / 标准工时) × 并行单元数
  const rawCap = BASE_TIME.map((t, i) => Math.floor(SHIFT_MIN / t) * units[i]);
  // 换型只扣机加工（瓶颈）可用时间（假设开关，标签 6）
  const setup = p.swapOn ? Math.ceil(p.Q / p.B) * CHANGEOVER_MIN : 0;
  const effCap2 = Math.floor((SHIFT_MIN - Math.min(setup, SHIFT_MIN - 1)) / BASE_TIME[1]) * p.kb;
  rawCap[1] = effCap2;

  const Tbase = Math.min(...rawCap); // 单班瓶颈产能（产线最大能耐，不含班次）
  const Tshift = Tbase * p.shift; // 含班次缩放后的有效产能
  const bnIndex = rawCap.indexOf(Tbase); // 最慢工序
  const bottleneckLabel = NODE_LABELS[bnIndex];

  const produced = Math.min(p.Q, Tshift); // 本班最多流出的件数（未计质量）
  const defective = Math.round(produced * (p.p / 100));
  const reworked = Math.round(defective * REWORK_YIELD);
  const scrapped = defective - reworked;
  const M1 = produced - scrapped; // 合格发货量
  const M3 = Math.max(0, p.Q - M1); // 卡在半路的半成品
  const M4 = M1 > 0 ? Math.ceil(p.Q / Tshift) : null; // 真实交期（天，按班次取整）
  const M5 = scrapped;
  const M6 = reworked;
  const M2 = Tshift;

  // 设备闲置率：单班实际占用分钟的反面；用 Tbase（单班）算，班次多少不改变单班利用率
  const idleByNode = NODE_LABELS.map((label, i) => {
    const busy = (Tbase * BASE_TIME[i]) / units[i];
    const idle = Math.max(0, 1 - busy / SHIFT_MIN) * 100;
    return { label, idle: Math.round(idle), isBottleneck: i === bnIndex };
  });
  const nonBn = idleByNode.filter((n) => !n.isBottleneck);
  const M7 = nonBn.length ? Math.round(nonBn.reduce((s, n) => s + n.idle, 0) / nonBn.length) : 0;

  const theoreticalMin = BASE_TIME.reduce((a, b) => a + b, 0); // 15.5 分/件

  return { M1, M2, M3, M4, M5, M6, M7, bottleneckLabel, capByNode: rawCap, bottleneckIndex: bnIndex, theoreticalMin, idleByNode, produced, defective, reworked, scrapped, Tbase, Tshift };
}

export type FeedbackKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

/** 第 5 节 9 条大白话反馈文案（命中即展示，口语、有画面感、不说教） */
export const FEEDBACK: Record<FeedbackKey, string> = {
  A: '你把不卡的那道工序从 1 个工位加到 3 个，发货还是 53 件——因为真正卡住整条线的，是另一道更慢的工序。给它加人，等于给不堵车的马路多修车道。',
  B: '你把卡住的那道工序加了 1 台机器，整条线立刻从 53 件涨到 106 件。瓶颈一通，全线都通——这是工厂里最值钱的一个道理。',
  C: '订单从 100 件加到 200 件，可你没让产线变快，所以半路堆的货从 47 件涨到 147 件，交期也从 2 天拖到 4 天。加单不加产能，堆的是仓库不是钱。',
  D: '你那台下料机，这班 78% 的时间在旁边干等——因为后道工序太慢，它早早就干完了没活接。买设备时以为全在赚钱，其实大半时间在陪跑。',
  E: '你把批量从 100 件切成 25 件，结果发货反而少了——因为每切一批就要停机调机器 20 分钟，切太碎，机器全在调机没在干活。',
  F: '不良率从 5% 提到 15%，发货只少了 1 件，但报废多了、返工多了。坏消息不会立刻显示在产量上，都藏在了「返工」和「报废」这两个角落。',
  G: '系统说每件只要 15.5 分钟加工，但你 100 件要 2 个班次才交完。中间的差距不是加工，是排队——真实工厂里排队常常占掉八成以上的时间。',
  H: '这版配置挺均衡：瓶颈不卡、机器不闲、货不堆。现实里这种状态很少见，多半是你刚调对了。',
  I: '你从 1 班加到 2 班，产能直接翻倍、交期减半——但前提是全线一起加。要是只给不卡的地方加，还是白搭。',
};

/**
 * 选一条最该让用户看到的反馈（按 PRD §5 优先级）。
 * recentToggle：用户刚切换过的假设开关，优先展示对应文案（刚开换型→E；刚切班次→I）。
 */
export function pickFeedback(p: SimParams, r: SimResult, recentToggle?: 'swap' | 'shift' | null): FeedbackKey {
  if (recentToggle === 'swap') return 'E';
  if (recentToggle === 'shift') return 'I';
  if (p.kf > 1) {
    const base = runSim({ ...p, kf: 1 }).M1;
    if (base === r.M1) return 'A';
  }
  if (p.kb > 1) {
    const base = runSim({ ...p, kb: 1 }).M1;
    if (r.M1 > base) return 'B';
  }
  if (p.Q > r.Tshift) return 'C';
  if (r.M7 >= 60) return 'D';
  if (p.swapOn && p.B < p.Q / 2) {
    const base = runSim({ ...p, swapOn: false }).M1;
    if (r.M1 < base) return 'E';
  }
  if (p.p > 5) return 'F';
  if (r.M4 && r.M4 > 1) return 'G';
  return 'H';
}

/** 默认参数，供页面初始化 */
export const DEFAULT_PARAMS: SimParams = { Q: 100, kb: 1, kf: 1, p: 5, B: 100, swapOn: false, shift: 1 };
