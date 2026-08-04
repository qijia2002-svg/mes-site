/**
 * 首页「知识模块」导航：把冗长的环形分布图换成紧凑、可点击的模块芯片。
 * 每个芯片跳到对应课程（/courses/:topicId），做到"联动"——点一下就能进学习。
 *
 * 数据来自 ProgressDashboard 的 pathStats（API 驱动，非硬编码），
 * 按章节数排序取前 N 个模块。知识内容后续在后台改，这里不用动。
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import type { PathStat } from './ProgressDashboard';

export function ModuleNav({ pathStats }: { pathStats: PathStat[] }) {
  const modules = useMemo(() => {
    const m = new Map<number, { name: string; chapters: number; done: number }>();
    for (const p of pathStats) {
      for (const t of p.topics) {
        const existing =
          m.get(t.topicId) ??
          { name: t.topic?.title ?? `模块 ${t.topicId}`, chapters: 0, done: 0 };
        existing.chapters += t.total;
        existing.done += t.done;
        m.set(t.topicId, existing);
      }
    }
    return Array.from(m.entries())
      .map(([id, d]) => ({ id, ...d }))
      .filter((x) => x.chapters > 0)
      .sort((a, b) => b.chapters - a.chapters);
  }, [pathStats]);

  if (modules.length === 0) return null;

  return (
    <div className="dash-panel module-nav-panel">
      <div className="module-nav-head">
        <div>
          <div className="dash-panel-title">知识模块</div>
          <div className="dash-panel-sub">点击进入对应课程</div>
        </div>
        <Link className="module-nav-all" to="/courses">
          全部课程
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
      <div className="module-nav-chips">
        {modules.map((m) => {
          const pct = m.chapters > 0 ? Math.round((m.done / m.chapters) * 100) : 0;
          return (
            <Link key={m.id} to={`/courses/${m.id}`} className="module-chip">
              <span className="module-chip-name">{m.name}</span>
              <span className="module-chip-meta">
                {m.done}/{m.chapters} 章
              </span>
              <span className="module-chip-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
