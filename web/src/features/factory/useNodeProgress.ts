/**
 * 工厂全景节点完成度（C1：只认「做过实战」，知识卡片读完不算完成）。
 *
 * 进度落在跨设备云端 KV（D1 user_kv）的 `factory.progress` 键下，本地镜像即时生效，
 * 云端异步同步。形状：
 *   { v: 1, flows: { [slug]: { done: { [`${type}:${refId}`]: ts } } } }
 * 其中 type ∈ chapter | sql | quiz | sim，refId 即 node_resources.ref_id。
 *
 * 完成事件：目标页（SqlSandbox / ChapterPage / QuizQuestionPage）在做完实战后派发
 * `factory:resource-done` 自定义事件，本 hook 监听并就地更新，无需目标页感知工厂流。
 */
import { useEffect, useState } from 'react';
import { peek, load, write } from '../../lib/userData';

export interface FactoryProgress {
  v: 1;
  flows: Record<string, { done: Record<string, number> }>;
}

const DEFAULT: FactoryProgress = { v: 1, flows: {} };

/** 实战资源类型（node_resources.res_type 的值域）。 */
export type ResourceType = 'chapter' | 'sql' | 'quiz' | 'sim';

/** 资源完成时由目标页派发的事件名。 */
export const NODE_RESOURCE_DONE = 'factory:resource-done';

function keyFor(type: string, refId: number): string {
  return `${type}:${refId}`;
}

/**
 * 读取 / 写入某张流程图（按 slug）的节点完成度。
 *  - 初始同步从本地镜像 peek，不阻塞首屏；
 *  - 挂载后异步从云端 load 水合（跨设备进度）；
 *  - 监听 NODE_RESOURCE_DONE 事件实时更新（页面内往返也能即时反映）。
 */
export function useNodeProgress(slug: string) {
  const [state, setState] = useState<FactoryProgress>(() => peek('factory.progress', DEFAULT));

  useEffect(() => {
    let alive = true;
    load('factory.progress', DEFAULT).then((v) => {
      if (alive) setState(v as FactoryProgress);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent<{ type: string; refId: number }>).detail;
      if (detail && typeof detail.type === 'string' && typeof detail.refId === 'number') {
        markDone(detail.type, detail.refId);
      }
    };
    window.addEventListener(NODE_RESOURCE_DONE, onDone);
    return () => window.removeEventListener(NODE_RESOURCE_DONE, onDone);
    // markDone 通过 setState 更新器引用最新 state，无需入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDone = (type: string, refId: number): boolean => {
    const flow = state.flows[slug];
    return !!flow?.done[keyFor(type, refId)];
  };

  const markDone = (type: string, refId: number): void => {
    setState((prev) => {
      const next: FactoryProgress = { v: 1, flows: { ...prev.flows } };
      const flow = { done: { ...(next.flows[slug]?.done ?? {}) } };
      flow.done[keyFor(type, refId)] = Date.now();
      next.flows[slug] = flow;
      // 本地镜像立即生效（write 内部已同步落地），云端后台同步。
      void write('factory.progress', next);
      return next;
    });
  };

  return { isDone, markDone };
}
