/**
 * 学习中心：分组课程卡片（带进度）+ 最近学习入口。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { api, type Topic } from '../api/endpoints';

interface Group {
  label: string;
  desc: string;
  match: (t: Topic) => boolean;
}

const GROUPS: Group[] = [
  { label: 'ERP 原理与模块', desc: '从销售订单到财务结算', match: (t) => t.slug?.startsWith('erp') || t.modules?.includes('ERP') },
  { label: 'MES 核心模块', desc: '工单/物料/报工/质量/追溯/设备/看板', match: (t) => t.slug?.startsWith('mes') || t.modules?.includes('MES') },
  { label: 'SQL 查询基础', desc: 'SELECT / WHERE / GROUP BY / JOIN', match: (t) => t.slug?.startsWith('sql') || t.modules?.includes('SQL') },
  { label: 'PLC 可编程逻辑控制器', desc: '梯形图 / 工业控制 / SCADA-MES集成', match: (t) => t.slug?.startsWith('plc') || t.modules?.includes('PLC') },
];

function TopicCard({ topic, done, total }: { topic: Topic; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = total > 0 && done >= total;
  return (
    <Link className="card" to={`/courses/${topic.id}`}>
      <h3 className="card-title">{topic.title}</h3>
      <p className="card-desc">{topic.description || '暂无课程简介。'}</p>
      {total > 0 && (
        <div className="card-progress">
          <span className="card-progress-label">
            {isComplete ? '已完成' : `已学 ${done}/${total} · ${pct}%`}
          </span>
          <div className="progress-track" style={{ height: 4 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="tag-row">
        {topic.modules.map((m) => <span key={m} className="tag">{m}</span>)}
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const progress = useQuery({ queryKey: ['progress'], queryFn: api.progress });

  const chapterQs = useQueries({
    queries: (topics.data ?? []).map((t) => ({
      queryKey: ['chapters', t.id],
      queryFn: () => api.chapters(t.id),
      staleTime: 5 * 60_000,
      enabled: !!topics.data,
    })),
  });

  const completedSet = useMemo(
    () => new Set((progress.data?.completedChapterIds ?? []).map(String)),
    [progress.data],
  );

  const topicStats = useMemo(() => {
    return new Map((topics.data ?? []).map((t, i) => {
      const chs = chapterQs[i]?.data ?? [];
      const done = chs.filter((c) => completedSet.has(String(c.id))).length;
      return [t.id, { done, total: chs.length }];
    }));
  }, [topics.data, chapterQs, completedSet]);

  // 最近学习：从 events 中找最新的 chapter 事件
  const recentChapter = useMemo(() => {
    const events = progress.data?.events ?? [];
    const chapterEvents = events.filter((e) => e.itemType === 'chapter' && e.itemId);
    if (chapterEvents.length === 0) return null;
    const latest = chapterEvents.reduce((a, b) =>
      (a.createdAt ?? 0) > (b.createdAt ?? 0) ? a : b,
    );
    return { id: latest.itemId!, title: `章节 #${latest.itemId}` };
  }, [progress.data]);

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">学习中心</h1>
          <p className="page-sub">按模块分组，选一个开始。已读章节标绿，进度实时同步。</p>
        </div>
        {topics.data && <span className="row-meta">共 {topics.data.length} 门</span>}
      </header>

      {/* 最近学习 */}
      {recentChapter && (
        <div className="alert alert-info">
          <Icon name="run" size={16} className="alert-glyph" />
          <div>
            <span style={{ fontWeight: 'var(--weight-emph-cjk)' }}>继续学习</span>
            <Link to={`/chapters/${recentChapter.id}`} className="text-link" style={{ fontSize: 'var(--text-sm)' }}>
              最近阅读：{recentChapter.title} →
            </Link>
          </div>
        </div>
      )}

      {topics.isLoading && <LoadingState label="正在加载课程…" />}
      {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
      {topics.data?.length === 0 && (
        <EmptyState title="还没有课程" hint="内容由后台导入，导入后会出现在这里。" icon="courses" />
      )}

      {topics.data && topics.data.length > 0 && GROUPS.map((group) => {
        // 按进度排序：未完成的排前面
        const items = topics.data!
          .filter(group.match)
          .sort((a, b) => {
            const sa = topicStats.get(a.id) ?? { done: 0, total: 0 };
            const sb = topicStats.get(b.id) ?? { done: 0, total: 0 };
            const pa = sa.total > 0 ? sa.done / sa.total : 0;
            const pb = sb.total > 0 ? sb.done / sb.total : 0;
            return pa - pb; // 进度低的在前面
          });
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="section">
            <div className="section-head">
              <h2 className="section-title">{group.label}</h2>
              <span className="row-meta">{group.desc}</span>
            </div>
            <ul className="card-grid">
              {items.map((t) => {
                const stat = topicStats.get(t.id) ?? { done: 0, total: 0 };
                return (
                  <li key={t.id}>
                    <TopicCard topic={t} done={stat.done} total={stat.total} />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
