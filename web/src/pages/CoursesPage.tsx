/**
 * 学习中心：按知识领域分组展示所有课程模块，每张卡片显示学习进度。
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
  icon: string;
  match: (t: Topic) => boolean;
}

// 分组按 slug 前缀匹配，不再硬编码 topic ID
const GROUPS: Group[] = [
  { label: 'ERP 原理与模块', desc: '从销售订单到财务结算的企业经营全貌', icon: 'report', match: (t) => t.slug?.startsWith('erp') || t.modules?.includes('ERP') },
  { label: 'MES 核心模块', desc: '工单/物料/报工/质量/追溯/设备/看板', icon: 'workshop', match: (t) => t.slug?.startsWith('mes') || t.modules?.includes('MES') },
  { label: 'SQL 查询基础', desc: 'SELECT / WHERE / GROUP BY / JOIN', icon: 'sql', match: (t) => t.slug?.startsWith('sql') || t.modules?.includes('SQL') },
  { label: 'PLC 可编程逻辑控制器', desc: '基础/梯形图/工业控制/SCADA-MES集成', icon: 'equipment', match: (t) => t.slug?.startsWith('plc') || t.modules?.includes('PLC') },
];

/** 单张课程卡片：标题 + 简介 + 标签 + 进度条 */
function TopicCard({ topic, done, total }: { topic: Topic; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link className="card" to={`/courses/${topic.id}`}>
      <h3 className="card-title">{topic.title}</h3>
      <p className="card-desc">{topic.description || '暂无课程简介。'}</p>
      {total > 0 && (
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: 'var(--text-xs)', color: 'var(--meta)' }}>
            <span>学习进度</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{done}/{total} · {pct}%</span>
          </div>
          <div className="progress-track" style={{ height: '4px' }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="tag-row">
        {topic.modules.map((m) => (
          <span key={m} className="tag">{m}</span>
        ))}
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.topics });
  const progress = useQuery({ queryKey: ['progress'], queryFn: api.progress });

  // 并行拉每门课的章节数 + 已读数
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

  // 每门课的完成数
  const topicStats = useMemo(() => {
    return new Map((topics.data ?? []).map((t, i) => {
      const chs = chapterQs[i]?.data ?? [];
      const done = chs.filter((c) => completedSet.has(String(c.id))).length;
      return [t.id, { done, total: chs.length }];
    }));
  }, [topics.data, chapterQs, completedSet]);

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="page-title">学习中心</h1>
          <p className="page-sub">
            ERP / MES / SQL / PLC 理论章节 + 实操判题。已读章节会标绿，进度实时同步。
          </p>
        </div>
        {topics.data && <span className="row-meta">共 {topics.data.length} 门</span>}
      </header>

      {topics.isLoading && <LoadingState label="正在加载课程…" />}
      {topics.isError && <ErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
      {topics.data?.length === 0 && (
        <EmptyState title="还没有课程" hint="内容由后台导入，导入后会出现在这里。" icon="courses" />
      )}

      {topics.data && topics.data.length > 0 && (
        <>
          {GROUPS.map((group) => {
            const items = topics.data!.filter(group.match);
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
        </>
      )}
    </section>
  );
}
