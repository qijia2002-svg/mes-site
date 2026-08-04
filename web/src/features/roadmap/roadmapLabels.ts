/**
 * 路径图的纯文案 / 纯数值换算。无 React、无 DOM，可直接单测。
 *
 * 等级字面主理人已裁决：本模块一律输出「入门 / 中级 / 高级」中文，
 * 不输出 L1/L2/L3——`L{n}` 在 CoursesPage 已是布鲁姆分类的所指，同屏会二义。
 */
import type { Importance, LevelProgress, ProgressState, TrackLevelDetail } from '../../api/roadmap';

const LEVEL_CN: Record<number, string> = { 1: '入门', 2: '中级', 3: '高级' };

/** 后端 levelName 形如 "L2 中级"：剥掉 L{n} 前缀，只留中文；缺失时按 level 兜底。 */
export function levelCn(level: number, rawName?: string): string {
  const stripped = (rawName ?? '').replace(/^L\s*\d+\s*[·\-:：]?\s*/i, '').trim();
  if (stripped) return stripped;
  return LEVEL_CN[level] ?? `第 ${level} 级`;
}

/** 等级明度阶梯的 class 后缀（中性通道，不占 accent 配额）。 */
export function levelTone(level: number): 'is-l1' | 'is-l2' | 'is-l3' {
  if (level >= 3) return 'is-l3';
  if (level === 2) return 'is-l2';
  return 'is-l1';
}

const IMPORTANCE_CN: Record<Importance, string> = {
  core: '必修',
  important: '重要',
  optional: '选修',
};

const IMPORTANCE_FULL: Record<Importance, string> = {
  core: '核心必修，不具备就进不了这个阶段',
  important: '重要，缺了会拖慢交付质量',
  optional: '选修加分，可后补或外包',
};

export function importanceLabel(imp: Importance): string {
  return IMPORTANCE_CN[imp] ?? IMPORTANCE_CN.optional;
}

export function importanceHint(imp: Importance): string {
  return IMPORTANCE_FULL[imp] ?? IMPORTANCE_FULL.optional;
}

export const IMPORTANCE_RANK: Record<Importance, number> = { core: 0, important: 1, optional: 2 };

/** 取更强的一档（core > important > optional）。 */
export function strongerImportance(a: Importance, b: Importance): Importance {
  return IMPORTANCE_RANK[a] <= IMPORTANCE_RANK[b] ? a : b;
}

const STATE_CN: Record<ProgressState, string> = {
  planned: '规划中',
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
};

export function stateLabel(state: ProgressState): string {
  return STATE_CN[state] ?? STATE_CN.not_started;
}

/** 阶段序号：01 / 02 …… 等宽显示用。 */
export function stageIndexLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** 进度环的 dash 参数。percent 一律夹到 0-100，避免脏数据画出负角度。 */
export function ringDash(percent: number, radius: number): { circumference: number; offset: number } {
  const c = 2 * Math.PI * radius;
  const p = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return { circumference: c, offset: c * (1 - p / 100) };
}

/** 进度环填充色的 token 名（完成度是本页唯一动用颜色的通道）。 */
export function ringTone(state: ProgressState): string {
  if (state === 'completed') return 'var(--rm-done-ring)';
  if (state === 'in_progress') return 'var(--rm-doing-ring)';
  return 'var(--rm-todo-ring)';
}

/** 规划中 = 该等级一章未上线（分母为 0），不是故障，是承诺。 */
export function isPlanned(progress: LevelProgress | undefined): boolean {
  return !progress || progress.state === 'planned' || progress.total === 0;
}

/**
 * 内容倒挂：高级有内容、入门/中级空（embedded 就是这个状态）。
 * 后端下发 contentStatus 时以它为准，没下发就按 levels 自行判定，两条路都能识别。
 */
export function isInverted(levels: TrackLevelDetail[], contentStatus?: string): boolean {
  if (contentStatus === 'inverted') return true;
  const has = (lv: number) => (levels.find((l) => l.level === lv)?.chapters.length ?? 0) > 0;
  return has(3) && !has(1) && !has(2);
}
