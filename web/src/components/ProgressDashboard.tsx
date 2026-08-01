/**
 * 首页学习进度仪表盘（用户明确需求：连接所有课程/作业/答题，一眼看懂学到哪了、该学什么）。
 *
 * 数据来源（全部复用既有接口，无新增后端端点）：
 *  - api.learningPaths()  每条路径的 topicIds
 *  - api.topics()         路径所含阶段（topic）的标题
 *  - api.chapters(topicId) 每阶段章节总数 + 标题（用于里程碑/下一步推算）
 *  - api.progress()       completedChapterIds（已读章节清单，去重）
 *
 * 下一步逻辑：数据驱动，不硬编码 25 天计划——按实际完成进度定位「当前路径 → 当前阶段 →
 * 下一章」，并按最近的学习节奏（完成章节数 / 跨度天数）自动估算完成日期。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { EmptyState, LoadingState } from './StateBlock';
import { api, type Chapter, type LearningPath, type Topic } from '../api/endpoints';
import './ProgressDashboard.css';

const DAY_MS = 86_400_000;

interface TopicStat {
  topic: Topic | null;
  topicId: number;
  chapters: Chapter[];
  total: number;
  done: number;
}
interface PathStat {
  path: LearningPath;
  topics: TopicStat[];
  total: number;
  done: number;
}

interface NextStep {
  path: LearningPath;
  topic: Topic | null;
  topicId: number;
  chapter: Chapter | null;
  remaining: number;
}

interface Plan {
  perDay: number;
  daysToFinish: number;
  etaDate: string;
  remaining: number;
}

/** 内联 SVG 进度环：用 --accent 描边，--border 做轨道，中心显示百分比。 */
function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c * (1 - pct / 100);
  return (
    <svg
      className="dash-ring-svg"
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${label} ${pct.toFixed(0)}%`}
    >
      <circle className="dash-ring-track" cx="60" cy="60" r={r} />
      <circle
        className="dash-ring-fill"
        cx="60"
        cy="60"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
      />
      <text className="dash-ring-value" x="60" y="58" textAnchor="middle">
        {pct.toFixed(0)}%
      </text>
      <text className="dash-ring-caption" x="60" y="76" textAnchor="middle">
        {label}
      </text>
    </svg>
  );
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function ProgressDashboard() {
  const pathsQ = useQuery({
    queryKey: ['learning-paths'],
    queryFn: api.learningPaths,
    retry: 1,
  });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, retry: 1 });
  const progressQ = useQuery({
    queryKey: ['progress'],
    queryFn: api.progress,
    retry: 1,
  });

  // 收集所有路径引用的去重 topicId，并行拉各阶段章节（用于总数与里程碑推算）。
  const topicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of pathsQ.data ?? []) for (const id of p.topicIds) ids.add(id);
    return [...ids];
  }, [pathsQ.data]);

  const chapterQs = useQueries({
    queries: topicIds.map((id) => ({
      queryKey: ['chapters', id] as const,
      queryFn: () => api.chapters(id),
      retry: 1,
    })),
  });

  const { pathStats, globalDone, globalTotal, nextStep, plan, completedSet } = useMemo(() => {
    const completedSet = new Set(
      (progressQ.data?.completedChapterIds ?? []).map((s) => String(s)),
    );
    const topicMap = new Map<number, Topic>();
    for (const t of topicsQ.data ?? []) topicMap.set(t.id, t);

    const chaptersByTopic = new Map<number, Chapter[]>();
    chapterQs.forEach((q, i) => {
      const id = topicIds[i];
      const list = (q.data ?? []).slice().sort((a, b) => a.sort - b.sort);
      chaptersByTopic.set(id, list);
    });

    const pathStats: PathStat[] = (pathsQ.data ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((path) => {
        const topics: TopicStat[] = path.topicIds.map((tid) => {
          const chapters = chaptersByTopic.get(tid) ?? [];
          const done = chapters.filter((c) => completedSet.has(String(c.id))).length;
          return { topic: topicMap.get(tid) ?? null, topicId: tid, chapters, total: chapters.length, done };
        });
        const total = topics.reduce((s, t) => s + t.total, 0);
        const done = topics.reduce((s, t) => s + t.done, 0);
        return { path, topics, total, done };
      });

    // 全局：跨所有路径的去重章节
    const allChapters = [...chaptersByTopic.values()].flat();
    const globalTotal = allChapters.length;
    const globalDone = allChapters.filter((c) => completedSet.has(String(c.id))).length;

    // 当前路径 = 第一个未完成（按 sort）；都完成则取第一条
    const incomplete = pathStats.filter((p) => p.done < p.total);
    const activePath = incomplete[0] ?? pathStats[0] ?? null;

    let nextStep: NextStep | null = null;
    if (activePath) {
      const activeTopicStat = activePath.topics.find((t) => t.done < t.total);
      const topicId = activeTopicStat?.topicId ?? activePath.topics[0]?.topicId ?? 0;
      const topic = activeTopicStat?.topic ?? activePath.topics[0]?.topic ?? null;
      const chapter = activeTopicStat?.chapters.find((c) => !completedSet.has(String(c.id))) ?? null;
      nextStep = {
        path: activePath.path,
        topic,
        topicId,
        chapter,
        remaining: Math.max(0, activePath.total - activePath.done),
      };
    }

    // 计划估算：按最近节奏（完成章节数 / 跨度天数）推算剩余天数
    let plan: Plan = { perDay: 0, daysToFinish: 0, etaDate: '', remaining: 0 };
    if (nextStep) {
      const events = (progressQ.data?.events ?? []).filter(
        (e) => e.itemType === 'chapter' && typeof e.createdAt === 'number',
      );
      const createdAts = events
        .map((e) => e.createdAt as number)
        .slice()
        .sort((a, b) => a - b);
      const completedCount = completedSet.size;
      let perDay = 0;
      if (createdAts.length > 0 && completedCount > 0) {
        const spanDays = Math.max((Date.now() - createdAts[0]) / DAY_MS, 1 / 24);
        perDay = completedCount / spanDays;
      }
      if (!(perDay > 0)) perDay = 1; // 没有历史则保守按每天 1 章估算
      const remaining = nextStep.remaining;
      const daysToFinish = Math.ceil(remaining / perDay);
      plan = { perDay, daysToFinish, etaDate: fmtDate(Date.now() + daysToFinish * DAY_MS), remaining };
    }

    return { pathStats, globalDone, globalTotal, nextStep, plan, completedSet };
  }, [pathsQ.data, topicsQ.data, progressQ.data, chapterQs, topicIds]);

  if (pathsQ.isLoading) return <LoadingState label="正在加载学习路线图…" />;
  if (pathsQ.isError || !pathsQ.data || pathStats.length === 0) {
    return (
      <EmptyState
        title="还没有学习路线图"
        hint="内容由后台导入后，这里会出现你的学习进度仪表盘。"
        icon="paths"
      />
    );
  }

  // 进度是辅助信息：取不到不致命，降级为 0 进度展示，不阻断首页。
  const loadingProgress = progressQ.isLoading;
  const chaptersLoading = chapterQs.some((q) => q.isLoading);
  const globalPct = globalTotal > 0 ? (globalDone / globalTotal) * 100 : 0;

  return (
    <section className="dash" aria-label="学习进度仪表盘">
      {/* 统计卡行：深色主题 KPI 卡，只用平台实际有的数据 */}
      <div className="dash-stats">
        <div className="dash-stat" data-acc="blue">
          <span className="dash-stat-glyph"><Icon name="dashboard" size={16} /></span>
          <div className="dash-stat-body">
            <span className="dash-stat-value">{globalPct.toFixed(0)}%</span>
            <span className="dash-stat-label">总进度</span>
          </div>
        </div>
        <div className="dash-stat" data-acc="cyan">
          <span className="dash-stat-glyph"><Icon name="chapter" size={16} /></span>
          <div className="dash-stat-body">
            <span className="dash-stat-value">{globalDone}<span className="dash-stat-total">/{globalTotal}</span></span>
            <span className="dash-stat-label">已学章节</span>
          </div>
        </div>
        <div className="dash-stat" data-acc="teal">
          <span className="dash-stat-glyph"><Icon name="paths" size={16} /></span>
          <div className="dash-stat-body">
            <span className="dash-stat-value">{pathStats.length}</span>
            <span className="dash-stat-label">学习路径</span>
          </div>
        </div>
        <div className="dash-stat" data-acc="green">
          <span className="dash-stat-glyph"><Icon name="sql" size={16} /></span>
          <div className="dash-stat-body">
            <span className="dash-stat-value">{progressQ.data?.passedExerciseIds?.length ?? 0}</span>
            <span className="dash-stat-label">SQL 通过</span>
          </div>
        </div>
      </div>

      {/* 环形图 + 下一站学习 并排 */}
      <div className="dash-hero-row">
        {/* 各模块章节分布环形图 */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <div className="dash-panel-title">知识模块分布</div>
              <div className="dash-panel-sub">各模块章节数</div>
            </div>
          </div>
          <ModuleDonut pathStats={pathStats} />
        </div>

        {/* 下一站学习 */}
        <div className="panel dash-hero">
          <ProgressRing value={globalPct} label="总进度" />
          <div className="dash-hero-body">
            {nextStep ? (
              <>
                <p className="dash-hero-lead">
                  下一站：<strong>{nextStep.path.title}</strong>
                  {nextStep.topic ? (
                    <>
                      {' › '}
                      <strong>{nextStep.topic.title}</strong>
                    </>
                  ) : null}
                {nextStep.chapter ? (
                  <>
                    {' › '}
                    <span className="dash-hero-chapter">{nextStep.chapter.title}</span>
                  </>
                ) : null}
              </p>
              <Link className="btn btn-primary dash-cta" to={`/courses/${nextStep.topicId}`}>
                <Icon name="run" size={16} />
                继续学习
                <Icon name="arrow-right" size={16} />
              </Link>
              {!loadingProgress && !chaptersLoading && plan.perDay > 0 ? (
                <p className="dash-eta">
                  <Icon name="schedule" size={16} className="dash-eta-glyph" />
                  按你最近每天约 {plan.perDay.toFixed(1)} 章的节奏，预计{' '}
                  <strong>{plan.etaDate}</strong> 学完《{nextStep.path.title}》（剩{' '}
                  {plan.remaining} 章）
                </p>
              ) : null}
            </>
          ) : (
            <p className="dash-hero-lead">
              <Icon name="success" size={20} className="dash-eta-glyph" />
              所有路线图都已读完，厉害！
            </p>
          )}
        </div>
      </div>
      </div>

      <ul className="dash-paths">
        {pathStats.map((p) => {
          const pct = p.total > 0 ? (p.done / p.total) * 100 : 0;
          const isActive = nextStep?.path.id === p.path.id && p.done < p.total;
          return (
            <li key={p.path.id} className={isActive ? 'dash-path is-active' : 'dash-path'}>
              <header className="dash-path-head">
                <span className="dash-path-glyph">
                  <Icon name="paths" size={20} />
                </span>
                <div className="dash-path-title">
                  <h3>{p.path.title}</h3>
                  {p.path.description ? <p>{p.path.description}</p> : null}
                </div>
                <span className="dash-path-pct">{pct.toFixed(0)}%</span>
              </header>

              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${p.path.title} 完成度`}
              >
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>

              <ul className="dash-topics">
                {p.topics.map((t) => {
                  const tIsActive = isActive && nextStep?.topicId === t.topicId && t.done < t.total;
                  return (
                    <li key={t.topicId} className={tIsActive ? 'dash-topic is-active' : 'dash-topic'}>
                      <Link className="dash-topic-link" to={`/courses/${t.topicId}`}>
                        <span className="dash-topic-name">
                          {t.topic?.title ?? `阶段 ${t.topicId}`}
                        </span>
                        <span className="dash-topic-count">
                          {t.done}/{t.total}
                        </span>
                      </Link>
                      <div className="dash-dots" aria-hidden="true">
                        {t.chapters.length > 0 ? (
                          t.chapters.map((c) => (
                            <span
                              key={c.id}
                              className={
                                completedSet.has(String(c.id)) ? 'dash-dot is-done' : 'dash-dot'
                              }
                            />
                          ))
                        ) : (
                          <span className="dash-dots-empty">无章节</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 各模块章节分布环形图（纯 SVG，用 pathStats 数据） */
const DONUT_COLORS = [
  'var(--accent-on-ink)',
  'var(--syn-keyword)',
  'var(--syn-string)',
  'var(--syn-number)',
  'var(--fg-2-on-ink)',
  'var(--meta-on-ink)',
];

function ModuleDonut({ pathStats }: { pathStats: PathStat[] }) {
  // 从 pathStats 展平所有 TopicStat，按模块聚合
  const moduleMap = new Map<number, { name: string; chapters: number; done: number }>();
  for (const p of pathStats) {
    for (const t of p.topics) {
      const existing = moduleMap.get(t.topicId) ?? {
        name: t.topic?.title ?? `模块 ${t.topicId}`,
        chapters: 0,
        done: 0,
      };
      existing.chapters += t.total;
      existing.done += t.done;
      moduleMap.set(t.topicId, existing);
    }
  }

  const modules = Array.from(moduleMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter((m) => m.chapters > 0)
    .sort((a, b) => b.chapters - a.chapters);

  const total = modules.reduce((sum, m) => sum + m.chapters, 0);

  if (total === 0) return <p style={{ color: 'var(--d-text-faint)' }}>暂无数据</p>;

  // 计算环形图各段的角度
  let rotation = -90;
  const segments = modules.map((m, i) => {
    const pct = (m.chapters / total) * 100;
    const seg = {
      ...m,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      pct,
      rotation,
    };
    rotation += (pct / 100) * 360;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox="0 0 200 200">
        <circle className="donut-track" cx="100" cy="100" r="80" />
        {segments.map((s, i) => (
          <circle
            key={s.id}
            className="donut-seg"
            cx="100"
            cy="100"
            r="80"
            pathLength={100}
            stroke={s.color}
            style={{ ['--len' as string]: s.pct, ['--d' as string]: `${0.1 + i * 0.3}s` }}
            transform={`rotate(${s.rotation} 100 100)`}
          />
        ))}
        <text className="donut-center" x="100" y="96">{total}</text>
        <text className="donut-center-sub" x="100" y="114">章节</text>
      </svg>
      <div className="donut-legend">
        {segments.map((s) => (
          <div key={s.id} className="legend-row">
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="legend-name">{s.name}</span>
            <span className="legend-val">{s.chapters}</span>
            <span className="legend-pct">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
