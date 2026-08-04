/**
 * AI 学习建议卡片（自包含，可被多页复用）。
 *
 * 复用一个既有端点 POST /api/v1/ai/study-tip；按需调用，失败优雅降级。
 * 数据自行聚合（学习路径 / 章节 / 进度），不依赖父组件传参 —— 因此可独立挂到任意页面。
 *
 * 遵循 P0：图标走 Icon 体系、零 emoji、配色用 token、单文件 ≤300 行、
 * 所有 hook 置于组件顶部且顺序固定（防 React #310 渲染期 hook 数量变化）。
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from './Icon';
import { api, type LearningPath, type Topic, type ProgressEvent } from '../api/endpoints';
import { VoiceButton } from './VoiceButton';

const DAY_MS = 86_400_000;

function computeStreak(events: ProgressEvent[]): number {
  const daySet = new Set<string>();
  for (const e of events) {
    if (typeof e.createdAt === 'number') {
      const d = new Date(e.createdAt);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - (i + 1) * DAY_MS);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (daySet.has(key)) streak++;
    else break;
  }
  return streak;
}

export default function AiStudyTip() {
  const pathsQ = useQuery({ queryKey: ['ai-tip-paths'], queryFn: api.learningPaths, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['ai-tip-topics'], queryFn: api.topics, staleTime: 60_000 });
  const progressQ = useQuery({ queryKey: ['ai-tip-progress'], queryFn: api.progress, staleTime: 30_000 });

  const completedSet = useMemo(
    () => new Set((progressQ.data?.completedChapterIds ?? []).map(String)),
    [progressQ.data],
  );
  const events = (progressQ.data?.events ?? []) as ProgressEvent[];

  const allTopicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of pathsQ.data ?? []) for (const id of p.topicIds) ids.add(id);
    return [...ids];
  }, [pathsQ.data]);

  const chapterQs = useQueries({
    queries: allTopicIds.map((id) => ({
      queryKey: ['ai-tip-chapters', id],
      queryFn: () => api.chapters(id),
      staleTime: 60_000,
    })),
  });

  const chapterIndex = useMemo(() => {
    const m = new Map<string, { title: string; topicId: number }>();
    allTopicIds.forEach((tid, i) => {
      for (const c of chapterQs[i]?.data ?? []) m.set(String(c.id), { title: c.title, topicId: tid });
    });
    return m;
  }, [allTopicIds, chapterQs]);

  const topicTitle = (id: number) =>
    topicsQ.data?.find((t: Topic) => t.id === id)?.title ?? `课程 #${id}`;

  // 连续学习天数（必须在使用它的 summary 之前计算，避免 TDZ）
  const streak = useMemo(() => computeStreak(events), [events]);

  const summary = useMemo(() => {
    const paths = (pathsQ.data ?? []) as LearningPath[];
    if (paths.length === 0) {
      return { doneChapters: 0, totalChapters: 0, currentTopic: '', streakDays: 0, needReview: false, reviewTopic: '' };
    }
    const doneOf = (p: LearningPath) => {
      let done = 0;
      let total = 0;
      for (const tid of p.topicIds) {
        const idx = allTopicIds.indexOf(tid);
        const chs = chapterQs[idx]?.data ?? [];
        done += chs.filter((c) => completedSet.has(String(c.id))).length;
        total += chs.length;
      }
      return { done, total };
    };
    let best = paths[0];
    let bestDone = -1;
    for (const p of paths) {
      const { done } = doneOf(p);
      if (done > 0 && done > bestDone) {
        best = p;
        bestDone = done;
      }
    }
    const nextTid =
      best.topicIds.find((tid) => {
        const idx = allTopicIds.indexOf(tid);
        const chs = chapterQs[idx]?.data ?? [];
        const d = chs.filter((c) => completedSet.has(String(c.id))).length;
        return chs.length > 0 && d < chs.length;
      }) ?? best.topicIds[0];

    const last = events.reduce<ProgressEvent | null>(
      (a, b) => ((b.createdAt ?? 0) > (a?.createdAt ?? 0) ? b : a),
      null,
    );
    const reviewTitle = last ? chapterIndex.get(last.itemId ?? '')?.title ?? '' : '';

    return {
      doneChapters: completedSet.size,
      totalChapters: chapterIndex.size,
      currentTopic: topicTitle(nextTid),
      streakDays: streak,
      needReview: completedSet.size > 0 || events.length > 0,
      reviewTopic: reviewTitle,
    };
  }, [pathsQ.data, chapterQs, allTopicIds, completedSet, chapterIndex, topicsQ.data, events, streak]);

  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  const ask = async () => {
    setLoading(true);
    setErr(false);
    try {
      const r = await api.aiStudyTip({
        doneChapters: summary.doneChapters,
        totalChapters: summary.totalChapters,
        currentTopic: summary.currentTopic,
        streakDays: summary.streakDays,
        needReview: summary.needReview,
        reviewTopic: summary.reviewTopic,
      });
      setTip(r.tip || '保持节奏，每天学一点就是进步。');
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-announce-cjk)' }}>
          <Icon name="hint" size={20} style={{ color: 'var(--accent)' }} />
          <span>AI 学习建议</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={ask} disabled={loading}>
          <Icon name="hint" size={16} /> {loading ? 'AI 思考中…' : '生成建议'}
        </button>
      </div>

      {tip && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-soft)',
          }}
        >
          <Icon name="hint" size={16} style={{ flex: 'none', marginTop: 2, color: 'var(--meta)' }} />
          <span style={{ flex: 1, lineHeight: 1.7 }}>{tip}</span>
          <VoiceButton text={tip} />
        </div>
      )}
      {err && (
        <p style={{ color: 'var(--meta)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          AI 建议暂时不可用，稍后再试。
        </p>
      )}
    </div>
  );
}
