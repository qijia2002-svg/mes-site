/**
 * 工厂进度摘要（factory-first 口径，全局壳与工厂页共用同一份真值）。
 *
 *  总环节数   = 主流程拓扑拍平后的节点数
 *  走过      = touched（读过知识卡 / 做过任一实战都算「了解过」）
 *  练过      = practiced（该环节全部实战做完，C1 原义）
 *
 * 进度真值来自 useNodeProgress（本地镜像 + 云端水合的跨设备进度），
 * 流程图来自 api.flowchart（缓存 5min，无数据回落 DEFAULT_FLOW）。
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import type { FlowNodeDTO, NodeResourceDTO } from '../../api/endpoints';
import { DEFAULT_FLOW, PHASE_BY_KEY, buildSteps, type LaidNode, type Phase } from './factoryFlow.data';
import { useNodeProgress } from './useNodeProgress';
import { useNodeStatus } from './useNodeStatus';

const SLUG = 'generic-factory';

export interface PhaseStat {
  phase: Phase;
  total: number;
  practiced: number;
  /** 了解过（含只读知识卡）。 */
  touched: number;
}

export interface FactorySummary {
  total: number;
  touched: number;
  practiced: number;
  practicableTotal: number;
  /** touched / total，0–100 整数。 */
  pct: number;
  /** 建议从这里继续的节点 key（首个「有实战没练完」→ 首个没碰过的）。 */
  nextKey: string | null;
  /** 四阶段（plan→production→qc→logistics）进度，用于个人中心分布图。 */
  phaseStats: PhaseStat[];
}

const PHASE_ORDER: Phase[] = ['plan', 'production', 'qc', 'logistics'];

export function useFactorySummary(): FactorySummary {
  const q = useQuery({
    queryKey: ['flowchart', SLUG],
    queryFn: () => api.flowchart(SLUG),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { isDone } = useNodeProgress(SLUG);

  const flow = q.data && q.data.nodes?.length ? q.data : DEFAULT_FLOW;

  const resourcesByNode = useMemo(() => {
    const m = new Map<number, NodeResourceDTO[]>();
    for (const r of flow.resources ?? []) {
      const arr = m.get(r.nodeId) ?? [];
      arr.push(r);
      m.set(r.nodeId, arr);
    }
    return m;
  }, [q.data, flow.resources]);

  const nodes = useMemo(() => {
    const raw = flow.nodes as (FlowNodeDTO & { phase?: Phase })[];
    const laid: LaidNode[] = raw.map((n) => ({
      ...n,
      phase: (n.phase ?? PHASE_BY_KEY[n.key] ?? 'plan') as Phase,
    }));
    return buildSteps(laid, flow.edges).flat();
  }, [q.data, flow.nodes, flow.edges]);

  const status = useNodeStatus(nodes, resourcesByNode, isDone);

  const total = nodes.length;
  const pct = total > 0 ? Math.round((status.touchedCount / total) * 100) : 0;

  const phaseStats = useMemo<PhaseStat[]>(() => {
    const acc: Record<Phase, PhaseStat> = {
      plan: { phase: 'plan', total: 0, practiced: 0, touched: 0 },
      production: { phase: 'production', total: 0, practiced: 0, touched: 0 },
      logistics: { phase: 'logistics', total: 0, practiced: 0, touched: 0 },
      qc: { phase: 'qc', total: 0, practiced: 0, touched: 0 },
    };
    for (const n of nodes) {
      const st = status.statusOf(n);
      const a = acc[n.phase];
      a.total += 1;
      if (st === 'practiced') {
        a.practiced += 1;
        a.touched += 1;
      } else if (st === 'touched') {
        a.touched += 1;
      }
    }
    return PHASE_ORDER.map((p) => acc[p]);
  }, [nodes, status]);

  return {
    total,
    touched: status.touchedCount,
    practiced: status.practicedCount,
    practicableTotal: status.practicableTotal,
    pct,
    nextKey: status.nextKey,
    phaseStats,
  };
}
