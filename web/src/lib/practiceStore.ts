/**
 * 统一练习进度（UX 重梳 Phase C 验收标准 #3 · 收口 B4）。
 *
 * 全站所有"做练习"入口——
 *   章节测验（ChapterPage）/ 模块考试（CourseDetailPage）/
 *   工厂内联自测（InlinePractice）/ 随堂测验（QuizQuestionPage）/
 *   SQL 沙盒（SqlSandbox）
 * 都向这里写同一份本地进度，练习中心据此汇总，不再各记各的、互不连通。
 *
 * 纪律：纯前端 localStorage（后端暂无进度聚合接口），**诚实不造假**——
 *   仅在用户真实完成 / 通过时写入；不预填、不估算、不虚构任何数量。
 */
import { useSyncExternalStore } from 'react';
import { peek, writeLocal } from './userData';

const KEY = 'practice.progress.v1';
const EVENT = 'mes:practice-changed';

export type QuizContext = 'chapter' | 'module' | 'factory' | 'standalone';

export interface PracticeProgress {
  /** 已完成章节测验的章节 id（去重） */
  chaptersQuiz: string[];
  /** 已通过模块考试的模块/课程 id（去重） */
  modulesQuiz: string[];
  /** 已通过工厂内联自测的节点 id（去重） */
  factoryQuiz: string[];
  /** 随堂/独立测验完成次数（无稳定 key 的入口累计） */
  standaloneQuiz: number;
  /** 已通过判题的 SQL 习题 id（去重） */
  sqlPassed: string[];
}

function blank(): PracticeProgress {
  return { chaptersQuiz: [], modulesQuiz: [], factoryQuiz: [], standaloneQuiz: 0, sqlPassed: [] };
}

function read(): PracticeProgress {
  const p = peek<Partial<PracticeProgress>>(KEY, {});
  return {
    chaptersQuiz: Array.isArray(p?.chaptersQuiz) ? p!.chaptersQuiz : [],
    modulesQuiz: Array.isArray(p?.modulesQuiz) ? p!.modulesQuiz : [],
    factoryQuiz: Array.isArray(p?.factoryQuiz) ? p!.factoryQuiz : [],
    standaloneQuiz: typeof p?.standaloneQuiz === 'number' ? p!.standaloneQuiz : 0,
    sqlPassed: Array.isArray(p?.sqlPassed) ? p!.sqlPassed : [],
  };
}

// 模块加载即读一次，作为 useSyncExternalStore 的稳定快照引用。
let snapshot: PracticeProgress = read();
const listeners = new Set<() => void>();

function save(next: PracticeProgress) {
  snapshot = next;
  writeLocal(KEY, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* 忽略单个监听异常 */
    }
  }
}

function addUnique(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr : [...arr, v];
}

/** 记录一次测验完成（按 context 归类，chapter/module/factory 按 key 去重） */
export function recordQuiz(opts: {
  context: QuizContext;
  key?: string | number;
  score: number;
  total: number;
}): void {
  const p = read();
  const k = opts.key != null ? String(opts.key) : null;
  if (opts.context === 'chapter' && k) p.chaptersQuiz = addUnique(p.chaptersQuiz, k);
  else if (opts.context === 'module' && k) p.modulesQuiz = addUnique(p.modulesQuiz, k);
  else if (opts.context === 'factory' && k) p.factoryQuiz = addUnique(p.factoryQuiz, k);
  else p.standaloneQuiz += 1;
  save(p);
}

/** 记录一道 SQL 习题通过判题（按 exerciseId 去重） */
export function recordSqlPass(exerciseId: number | string): void {
  const p = read();
  p.sqlPassed = addUnique(p.sqlPassed, String(exerciseId));
  save(p);
}

export function getPracticeSnapshot(): PracticeProgress {
  return snapshot;
}

/** 订阅进度变更（供 useSyncExternalStore 使用），返回取消订阅函数 */
export function subscribePractice(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** React 订阅钩子：进度变化时组件自动重渲染 */
export function usePracticeSummary(): PracticeProgress {
  return useSyncExternalStore(subscribePractice, getPracticeSnapshot, getPracticeSnapshot);
}
