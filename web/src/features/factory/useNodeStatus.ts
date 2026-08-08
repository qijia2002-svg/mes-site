/**
 * 节点状态的纯派生层（不碰存储、不发请求）。
 *
 * 进度语义（守住 C1「实战才算完成」，同时让只读过知识的人也看得见反馈）：
 *   practiced —— 有实战资源，且全部做完（C1 原义不变）
 *   touched   —— 任意资源（含 chapter 知识卡）做过 → 至少「了解过」
 *   plain     —— 两者都不是
 *
 * 分母只数「有实战的环节」（practicableTotal），避免空节点把进度条永久压低；
 * nextKey 也只在有实战的环节里挑，挑不到才退回首个没碰过的节点。
 */
import { useMemo } from 'react';
import type { NodeResourceDTO } from '../../api/endpoints';
import { practicesOf, type LaidNode } from './factoryFlow.data';

export type NodeStatus = 'practiced' | 'touched' | 'plain';

export interface NodeStatusApi {
  /** 单个节点的三态。 */
  statusOf: (node: LaidNode) => NodeStatus;
  /** 已练完的环节数（分子）。 */
  practicedCount: number;
  /** 碰过（含只读知识卡）的环节数。 */
  touchedCount: number;
  /** 挂了实战内容的环节数（分母）。为 0 时调用方不应渲染进度条。 */
  practicableTotal: number;
  /** 建议从这里继续：首个「有实战但没练完」的节点；没有则首个没碰过的节点。 */
  nextKey: string | null;
}

/**
 * @param orderedNodes 流程顺序（buildSteps 拍平后的拓扑序），决定 nextKey 取谁。
 * @param resourcesByNode nodeId → 该节点挂的资源。
 * @param isDone 来自 useNodeProgress，唯一的完成度真值来源。
 */
export function useNodeStatus(
  orderedNodes: LaidNode[],
  resourcesByNode: Map<number, NodeResourceDTO[]>,
  isDone: (type: string, refId: number) => boolean,
): NodeStatusApi {
  return useMemo(() => {
    const byKey = new Map<string, NodeStatus>();
    let practicedCount = 0;
    let touchedCount = 0;
    let practicableTotal = 0;
    let firstUnpracticed: string | null = null;
    let firstUntouched: string | null = null;

    for (const n of orderedNodes) {
      const res = resourcesByNode.get(n.id) ?? [];
      const practices = practicesOf(res);
      const practiced = practices.length > 0 && practices.every((r) => isDone(r.type, r.refId));
      const touched = res.some((r) => isDone(r.type, r.refId));

      if (practices.length > 0) {
        practicableTotal += 1;
        if (practiced) practicedCount += 1;
        else if (firstUnpracticed === null) firstUnpracticed = n.key;
      }
      if (touched) touchedCount += 1;
      else if (firstUntouched === null) firstUntouched = n.key;

      byKey.set(n.key, practiced ? 'practiced' : touched ? 'touched' : 'plain');
    }

    return {
      statusOf: (node: LaidNode) => byKey.get(node.key) ?? 'plain',
      practicedCount,
      touchedCount,
      practicableTotal,
      nextKey: firstUnpracticed ?? firstUntouched ?? null,
    };
  }, [orderedNodes, resourcesByNode, isDone]);
}
