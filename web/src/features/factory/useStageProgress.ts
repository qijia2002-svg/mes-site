/**
 * 6 站主线的阶段级进度（BLOCK-03）。
 *
 * 要解的原问题：`useNodeStatus.nextKey` 走**全局拓扑序**挑「下一个」，
 * 于是学员刚练完本站首个节点，主 CTA 就把他甩到拓扑序上的下一个节点——
 * 那个节点很可能属于**后面的站**。表现就是「完成首站被带出当前阶段」。
 * 本 hook 自算 `stageNextKey`：**先在当前站内找没练完的，站内全练完了才跨站**。
 *
 * 另外两条口径：
 *  · 阶段级完成度（BLOCK-02）：分母用 `flow_stages.practice_types`，入门段只认 micro+quiz，
 *    SQL 不进分母。且必须与 `PRACTICE_TYPES` 白名单**取交集**（BLOCK-01），
 *    否则后端多下发一个前端没实现的类型，该站会永远练不完。
 *  · 锁定是**软引导**（ADR-018）：这里只算状态、只给因果文案，不做任何拦截。
 */
import { useMemo } from 'react';
import type { FlowStageDTO, NodeResourceDTO } from '../../api/endpoints';
import { PRACTICE_TYPES, nodePractices, type LaidNode } from './factoryFlow.data';
import { stageKeyOf } from './factoryStages.data';

export type StageStatus = 'done' | 'current' | 'locked';

export interface StageView {
  stageKey: string;
  title: string;
  subtitle: string;
  icon: string;
  sort: number;
  status: StageStatus;
  /** 归属本站的节点，保持流程顺序。 */
  nodes: LaidNode[];
  /** 挂了实战内容的节点数（本站分母）。 */
  practicableNodes: number;
  /** 已练完的节点数（本站分子）。 */
  practicedNodes: number;
  /** 本站是否有任何可练内容。false = 内容尚未播种，不是「已完成」。 */
  hasContent: boolean;
  /** 本站入口节点 key（流程顺序第一个）。 */
  entryKey: string | null;
  /** locked 态点击时给的因果说明——给方向，不是给拒绝。 */
  guidance: string;
}

export interface StageProgressApi {
  /** stages 缺失或一个节点都匹配不上时为 false，调用方应回落到全景视图。 */
  enabled: boolean;
  stages: StageView[];
  currentIndex: number;
  currentStage: StageView | null;
  /** 主 CTA 必须绑它，不要绑 useNodeStatus.nextKey（那个会跨站）。 */
  stageNextKey: string | null;
  /** 已完成站数 / 总站数，用于顶部主进度。 */
  practicedStages: number;
  totalStages: number;
  /** 全部站都走完。 */
  allDone: boolean;
}

const EMPTY: StageProgressApi = {
  enabled: false,
  stages: [],
  currentIndex: -1,
  currentStage: null,
  stageNextKey: null,
  practicedStages: 0,
  totalStages: 0,
  allDone: false,
};

/**
 * 阶段实践口径：取 `practice_types` 与全项目白名单的交集。
 * 后端还没下发（空数组）时回落全集——中间态宁可严格，也不要凭空少算分母。
 */
function effectiveTypes(stage: FlowStageDTO): ReadonlySet<string> {
  const declared = Array.isArray(stage.practiceTypes) ? stage.practiceTypes : [];
  const hit = declared.filter((t) => PRACTICE_TYPES.has(t));
  return hit.length > 0 ? new Set(hit) : PRACTICE_TYPES;
}

/**
 * @param stages 来自 flowchart 接口；缺失时调用方传静态 DEFAULT_STAGES。
 * @param orderedNodes 流程顺序（buildSteps 拍平），决定站内「下一个」取谁。
 * @param resourcesByNode nodeId → 该节点挂的资源。
 * @param isDone 唯一完成度真值来源（useNodeProgress）。
 */
export function useStageProgress(
  stages: FlowStageDTO[],
  orderedNodes: LaidNode[],
  resourcesByNode: Map<number, NodeResourceDTO[]>,
  isDone: (type: string, refId: number) => boolean,
): StageProgressApi {
  return useMemo(() => {
    if (!stages.length || !orderedNodes.length) return EMPTY;

    const sorted = [...stages].sort((a, b) => a.sort - b.sort);

    // 一趟算完每站的分子分母，同时记下「站内第一个没练完的节点」。
    const built = sorted.map((stage) => {
      const types = effectiveTypes(stage);
      const nodes = orderedNodes.filter((n) => stageKeyOf(n) === stage.stageKey);

      let practicableNodes = 0;
      let practicedNodes = 0;
      let firstUnpracticed: string | null = null;

      for (const n of nodes) {
        const res = resourcesByNode.get(n.id) ?? [];
        // P0 修复：分母改用 nodePractices 统一落键，初学者节点的 quiz/sql 按 node.id 落库，
        // 与抽屉 solve() 写入口对齐；再与本站 practice_types 取交集（BLOCK-02 口径不变）。
        const practices = nodePractices(n, res).filter((p) => types.has(p.type));
        if (practices.length === 0) continue; // 没挂内容的节点不进分母，避免永久压低
        practicableNodes += 1;
        if (practices.every((r) => isDone(r.type, r.refId))) practicedNodes += 1;
        else if (firstUnpracticed === null) firstUnpracticed = n.key;
      }

      const hasContent = practicableNodes > 0;
      return {
        stage,
        nodes,
        practicableNodes,
        practicedNodes,
        hasContent,
        firstUnpracticed,
        entryKey: nodes.length > 0 ? nodes[0].key : null,
        /**
         * 「练完」= 本站所有挂了内容的节点都练完。
         * 没内容的站视为**放行**（passthrough）而不是完成：内容还没播种的站
         * 若判为「永远没练完」，会把它后面所有站永久锁死——那是静默事故。
         */
        satisfied: hasContent ? practicedNodes === practicableNodes : true,
      };
    });

    // 一个节点都对不上（stage_key 全空 / 映射缺失）→ 不启用主线，让调用方回落全景。
    const matched = built.reduce((sum, b) => sum + b.nodes.length, 0);
    if (matched === 0) return EMPTY;

    const firstUnsatisfied = built.findIndex((b) => !b.satisfied);
    const allDone = firstUnsatisfied === -1;
    const currentIndex = allDone ? built.length - 1 : firstUnsatisfied;

    const views: StageView[] = built.map((b, i) => {
      const status: StageStatus = allDone || i < currentIndex
        ? 'done'
        : i === currentIndex
          ? 'current'
          : 'locked';
      const blocker = built[currentIndex].stage;
      return {
        stageKey: b.stage.stageKey,
        title: b.stage.title,
        subtitle: b.stage.subtitle,
        icon: b.stage.icon,
        sort: b.stage.sort,
        status,
        nodes: b.nodes,
        practicableNodes: b.practicableNodes,
        practicedNodes: b.practicedNodes,
        hasContent: b.hasContent,
        entryKey: b.entryKey,
        guidance:
          status === 'locked'
            ? `先完成第 ${currentIndex + 1} 站「${blocker.title}」，那一站的概念这里会用到`
            : '',
      };
    });

    // ── BLOCK-03 的关键一步 ──
    // 先在当前站内找没练完的节点；站内确实全练完了，才允许跨到下一站的入口。
    let stageNextKey: string | null = null;
    if (!allDone) {
      const cur = built[currentIndex];
      stageNextKey = cur.firstUnpracticed;
      if (stageNextKey === null) {
        const nextWithContent = built.slice(currentIndex + 1).find((b) => b.entryKey !== null);
        stageNextKey = nextWithContent?.entryKey ?? cur.entryKey;
      }
    }

    return {
      enabled: true,
      stages: views,
      currentIndex,
      currentStage: views[currentIndex] ?? null,
      stageNextKey,
      practicedStages: built.filter((b) => b.hasContent && b.satisfied).length,
      totalStages: built.length,
      allDone,
    };
  }, [stages, orderedNodes, resourcesByNode, isDone]);
}
