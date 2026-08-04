/**
 * 首页「我的学习信息进度」卡片（用户核心诉求：戚家硕你好 + 当前在学 + 今日所学
 * + 是否复习 + 是否继续学习）。
 *
 * 数据全部复用既有接口（learning-paths / topics / progress / chapters），无新增后端端点
 * 依赖；仅在「AI 学习建议」按需调用 /api/v1/ai/study-tip。
 * 遵循 P0：图标走 Icon 体系、配色用 design token、零 emoji、零硬编码色值。
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from './Icon';
import { api, type LearningPath, type Topic, type ProgressEvent } from '../api/endpoints';
import { getNickname } from '../lib/profileStore';
import { VoiceButton } from './VoiceButton';

const DAY_MS = 86_400_000;

function isToday(ts?: number): boolean {
  if (typeof ts !== 'number') return false;
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

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

export default function HomeStudyInfo() {
  const pathsQ = useQuery({ queryKey: ['learning-paths'], queryFn: api.learningPaths, staleTime: 60_000 });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: api.topics, staleTime: 60_000 });
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 30_000 });

  const nickname = getNickname();
  const events = (progressQ.data?.events ?? []) as ProgressEvent[];
  const completedSet = useMemo(
    () => new Set((progressQ.data?.completedChapterIds ?? []).map(String)),
    [progressQ.data],
  );

  const allTopicIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of pathsQ.data ?? []) for (const id of p.topicIds) ids.add(id);
    return [...ids];
  }, [pathsQ.data]);

  const chapterQs = useQueries({
    queries: allTopicIds.map((id) => ({
      queryKey: ['chapters', id],
      queryFn: () => api.chapters(id),
      staleTime: 60_000,
    })),
  });

  // chapterId -> {title, topicId}
  const chapterIndex = useMemo(() => {
    const m = new Map<string, { title: string; topicId: number }>();
    allTopicIds.forEach((tid, i) => {
      for (const c of chapterQs[i]?.data ?? []) m.set(String(c.id), { title: c.title, topicId: tid });
    });
    return m;
  }, [allTopicIds, chapterQs]);

  const topicTitle = (id: number) =>
    topicsQ.data?.find((t: Topic) => t.id === id)?.title ?? `课程 #${id}`;

  // 当前在学：选进度最多的路径，找其第一个未完成的课程
  const { activePath, nextTopicId, nextTopicTitle, pathPct } = useMemo(() => {
    const paths = (pathsQ.data ?? []) as LearningPath[];
    if (paths.length === 0) return { activePath: null, nextTopicId: null, nextTopicTitle: '', pathPct: 0 };
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
    const { done, total } = doneOf(best);
    return {
      activePath: best,
      nextTopicId: nextTid,
      nextTopicTitle: topicTitle(nextTid),
      pathPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [pathsQ.data, chapterQs, allTopicIds, completedSet, topicsQ.data]);

  // 今日所学
  const todayTitles = useMemo(
    () =>
      events
        .filter((e) => isToday(e.createdAt))
        .map((e) => chapterIndex.get(e.itemId ?? '')?.title)
        .filter((t): t is string => Boolean(t))
        .slice(0, 3),
    [events, chapterIndex],
  );

  // 复习判断
  const lastEvent = useMemo(
    () => events.reduce<ProgressEvent | null>((a, b) => ((b.createdAt ?? 0) > (a?.createdAt ?? 0) ? b : a), null),
    [events],
  );
  const daysSinceLast = lastEvent?.createdAt ? Math.floor((Date.now() - lastEvent.createdAt) / DAY_MS) : null;
  const reviewTitle = lastEvent ? chapterIndex.get(lastEvent.itemId ?? '')?.title : null;
  const hasProgress = completedSet.size > 0 || events.length > 0;
  const needReview = hasProgress && (daysSinceLast === null || daysSinceLast >= 1);

  const streak = useMemo(() => computeStreak(events), [events]);
  const continueTo = nextTopicId != null ? `/courses/${nextTopicId}` : '/courses';

  // 语音播报文案：把卡片核心信息串成一句人话
  const speechText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${nickname || '学习者'}你好`);
    if (nextTopicTitle) parts.push(`你当前在学${nextTopicTitle}`);
    if (todayTitles.length > 0) parts.push(`今天你学了${todayTitles.join('、')}`);
    if (needReview && reviewTitle) parts.push(`已经${daysSinceLast ?? 0}天没学习，建议复习${reviewTitle}`);
    parts.push(`继续学习${nextTopicTitle || '课程内容'}吧`);
    return parts.join('，') + '。';
  }, [nickname, nextTopicTitle, todayTitles, needReview, reviewTitle, daysSinceLast]);

  // AI 学习建议（按需）
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [tipError, setTipError] = useState(false);

  const askAi = async () => {
    setTipLoading(true);
    setTipError(false);
    try {
      const r = await api.aiStudyTip({
        doneChapters: completedSet.size,
        totalChapters: chapterIndex.size,
        currentTopic: nextTopicTitle,
        streakDays: streak,
        needReview,
        reviewTopic: reviewTitle ?? '',
      });
      setTip(r.tip || '保持节奏，每天学一点就是进步。');
    } catch {
      setTipError(true);
    } finally {
      setTipLoading(false);
    }
  };

  return (
    <section className="home-study-card panel">
      <div className="home-study-head">
        <div>
          <h2 className="home-study-greeting">
            {nickname ? `${nickname}你好` : '你好'}
          </h2>
          <p className="home-study-sub">
            这是你的学习档案 ·{' '}
            {streak > 0 ? (
              <span className="home-study-streak">
                <Icon name="streak" size={16} /> 连续学习 {streak} 天
              </span>
            ) : (
              '今天开始你的第一步'
            )}
          </p>
        </div>
        <VoiceButton text={speechText} />
      </div>

      <div className="home-study-rows">
        {/* 当前在学 */}
        <div className="home-study-row">
          <span className="home-study-label">
            <Icon name="chapter" size={16} /> 当前在学
          </span>
          <span className="home-study-value">
            {nextTopicTitle ? (
              <>
                {nextTopicTitle}
                {activePath && (
                  <span className="home-study-meta"> · {activePath.title} {pathPct}%</span>
                )}
              </>
            ) : (
              <span className="home-study-muted">还没有进行中的课程</span>
            )}
          </span>
        </div>

        {/* 今日所学 */}
        <div className="home-study-row">
          <span className="home-study-label">
            <Icon name="schedule" size={16} /> 今天学到
          </span>
          <span className="home-study-value">
            {todayTitles.length > 0 ? (
              todayTitles.map((t) => (
                <span key={t} className="tag tag-soft">
                  {t}
                </span>
              ))
            ) : (
              <span className="home-study-muted">今天还没开始，现在就学一章？</span>
            )}
          </span>
        </div>

        {/* 是否复习 */}
        <div className="home-study-row">
          <span className="home-study-label">
            <Icon name="history" size={16} /> 复习提醒
          </span>
          <span className="home-study-value">
            {!hasProgress ? (
              <span className="home-study-muted">先完成第一章，系统会帮你跟踪复习</span>
            ) : needReview ? (
              <span className="home-study-warn">
                <Icon name="warn" size={16} /> 已 {daysSinceLast ?? 0} 天未学习
                {reviewTitle ? `，建议复习《${reviewTitle}》` : ''}
              </span>
            ) : (
              <span className="home-study-ok">
                <Icon name="success" size={16} /> 状态不错，保持节奏
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="home-study-actions">
        <Link className="btn btn-primary btn-sm" to={continueTo}>
          <Icon name="run" size={16} /> {nextTopicTitle ? '继续学习' : '开始学习'}
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={askAi} disabled={tipLoading}>
          <Icon name="hint" size={16} /> {tipLoading ? 'AI 思考中…' : 'AI 学习建议'}
        </button>
      </div>

      {tip && (
        <div className="home-study-tip">
          <Icon name="hint" size={16} />
          <span>{tip}</span>
          <VoiceButton text={tip} />
        </div>
      )}
      {tipError && (
        <p className="home-study-muted" style={{ marginTop: 'var(--space-2)' }}>
          AI 建议暂时不可用，稍后再试。
        </p>
      )}
    </section>
  );
}
