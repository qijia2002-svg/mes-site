import type { SimNode, SimEdge } from './simTypes';
import type { SimMetrics, SimBottleneck } from './simEngine';

/** 单条验收项 */
export interface LevelCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** 关卡验收结果 */
export interface LevelEval {
  pass: boolean;
  checks: LevelCheck[];
}

/** 验收上下文：取当前画布 + 最近一次仿真结果 */
export interface LevelContext {
  nodes: SimNode[];
  edges: SimEdge[];
  metrics: SimMetrics | null;
  bottleneck: SimBottleneck | null;
}

export interface SimLevel {
  id: string;
  title: string;
  brief: string;
  constraints: string[];
  evaluate(ctx: LevelContext): LevelEval;
}

const hasInspect = (nodes: SimNode[]) => nodes.some((n) => n.nodeType.startsWith('i_'));
const hasEndpoint = (nodes: SimNode[]) =>
  nodes.some((n) => n.nodeType === 'material' || n.nodeType === 'ship');
const processCount = (nodes: SimNode[]) =>
  nodes.filter((n) => n.nodeType !== 'material' && n.nodeType !== 'ship' && !n.nodeType.startsWith('i_')).length;

/**
 * 训练关卡：从「跑通」到「约束理论」，每关给约束 + 验收指标。
 * 学员自由搭线，但必须满足验收才算过关——把沙盒从「玩具」变成「训练器」。
 */
export const SIM_LEVELS: SimLevel[] = [
  {
    id: 'connect',
    title: '第 1 关 · 跑通产线',
    brief: '从工序库拖出加工 / 检验 / 起止节点，连成一条从投料到发货的完整工艺路线。',
    constraints: ['至少 1 个加工工序', '有投料（起点）与发货（终点）', '连线连通、无孤立节点、无环'],
    evaluate({ nodes, metrics }) {
      const checks: LevelCheck[] = [];
      const pc = processCount(nodes);
      checks.push({ label: '有加工工序', ok: pc >= 1, detail: `当前 ${pc} 个` });
      checks.push({ label: '有投料与发货节点', ok: hasEndpoint(nodes), detail: hasEndpoint(nodes) ? '已具备' : '缺起止节点' });
      const ran = !!metrics;
      checks.push({
        label: '运行成功且发出成品',
        ok: ran && metrics!.passed > 0,
        detail: ran ? `发货 ${metrics!.passed} 件` : '尚未成功运行',
      });
      return { pass: checks.every((c) => c.ok), checks };
    },
  },
  {
    id: 'throughput',
    title: '第 2 关 · 班产 ≥ 200 件',
    brief: '默认配置班产偏低。优化产线（提产能 / 减不良 / 加设备），让单班合格发货达到 200 件以上。',
    constraints: ['合格发货 ≥ 200 件', '提示：先找瓶颈——产能最低的那道工序卡住了整条线'],
    evaluate({ metrics }) {
      const passed = metrics?.passed ?? 0;
      const checks: LevelCheck[] = [
        { label: '合格发货 ≥ 200 件', ok: passed >= 200, detail: `当前 ${passed} 件` },
      ];
      return { pass: checks.every((c) => c.ok), checks };
    },
  },
  {
    id: 'quality',
    title: '第 3 关 · 不良下合格 ≥ 190',
    brief: '真实工厂不良率约 3%。搭一条带检验 + 不合格回流的线，让合格发货 ≥ 190 件——逼你加检验和返工回路。',
    constraints: ['合格发货 ≥ 190 件', '必须含检验节点 + 不合格回流（否则不良品直接流出）'],
    evaluate({ nodes, metrics }) {
      const passed = metrics?.passed ?? 0;
      const inspect = hasInspect(nodes);
      const checks: LevelCheck[] = [
        { label: '合格发货 ≥ 190 件', ok: passed >= 190, detail: `当前 ${passed} 件` },
        { label: '含检验节点 + 回流', ok: inspect, detail: inspect ? '已配置检验' : '未加检验节点' },
      ];
      return { pass: checks.every((c) => c.ok), checks };
    },
  },
  {
    id: 'bottleneck',
    title: '第 4 关 · 单点升级班产最大化',
    brief: '约束：只能把最慢那道工序（瓶颈）的产能顶上去，别把所有设备都加一遍。在此约束下把班产做到最大。',
    constraints: ['合格发货 ≥ 260 件（挑战线）', '约束：只优化瓶颈一道工序，体会「非瓶颈开再快也没用」'],
    evaluate({ metrics, bottleneck }) {
      const passed = metrics?.passed ?? 0;
      const checks: LevelCheck[] = [
        { label: '合格发货 ≥ 260 件', ok: passed >= 260, detail: `当前 ${passed} 件` },
        { label: '已识别瓶颈工序', ok: !!bottleneck, detail: bottleneck ? `瓶颈：${bottleneck.label}` : '未运行' },
      ];
      return { pass: checks.every((c) => c.ok), checks };
    },
  },
];
