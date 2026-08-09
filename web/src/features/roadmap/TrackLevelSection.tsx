/**
 * 路线详情页的单个等级段（UIUX §5.2）：级头 + 目标 + 学完能做什么 + 章节清单 + 规划中分组。
 * 不套卡片（Density 6：用分隔线不用容器），段与段之间靠 border-top 划开。
 *
 * 等级字面一律中文「入门/中级/高级」—— `L{n}` 在课程页已经是布鲁姆分类的所指，
 * 同一个人一天里看到两种 L2 会直接串味。锚点 id 仍用 `level-l{n}`，那是技术标识不是文案。
 */
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/StateBlock';
import type { TrackLevelDetail } from '../../api/roadmap';
import { levelAnchor } from './RoadmapNode';
import { levelCn, levelTone } from './roadmapLabels';

export function TrackLevelSection({
  detail,
  prev,
}: {
  detail: TrackLevelDetail;
  prev?: { level: number; name: string; chapters: number };
}) {
  const name = levelCn(detail.level, detail.name);
  const { progress } = detail;
  const chapters = detail.chapters ?? [];
  const planned = detail.plannedChapters ?? [];
  const outcomes = detail.outcomes ?? [];
  const done = progress?.state === 'completed';

  return (
    <section className="rm-level-section" id={levelAnchor(detail.level)}>
      <div className="rm-level-head">
        <span className={`rm-level ${levelTone(detail.level)}`} aria-hidden="true">
          {detail.level}
        </span>
        <h2 className="rm-level-name">{name}</h2>
        {detail.hours > 0 && <span className="rm-level-hours">{detail.hours} 学时</span>}
        <span className="rm-level-count">
          {progress?.done ?? 0}/{progress?.total ?? chapters.length} 章
        </span>
        <span className="rm-bar rm-bar-sm" aria-hidden="true">
          <span className="rm-bar-fill" style={{ width: `${progress?.percent ?? 0}%` }} />
        </span>
      </div>

      {detail.goal && <p className="rm-level-goal">{detail.goal}</p>}

      {outcomes.length > 0 && (
        <div className="rm-outcomes">
          <p className="rm-caps">学完这一级你能做什么</p>
          <ul className="rm-outcome-list">
            {outcomes.map((text) => (
              <li key={text}>
                <Icon
                  name={done ? 'success' : 'stage'}
                  size={16}
                  className={done ? 'rm-outcome-done' : 'rm-outcome-todo'}
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chapters.length === 0 && planned.length === 0 && (
        <EmptyState
          title={`${name} · 内容规划中`}
          hint={
            prev && prev.chapters > 0
              ? `这一级还没排章节。${levelCn(prev.level, prev.name)}的 ${prev.chapters} 章足够支撑当前阶段，先把它啃完。`
              : '这一级还没排章节。可以先看同岗位路径里其他已上线的能力线。'
          }
          icon="schedule"
          action={
            prev && prev.chapters > 0 ? (
              <a className="btn btn-secondary btn-sm" href={`#${levelAnchor(prev.level)}`}>
                回到{levelCn(prev.level, prev.name)}继续
              </a>
            ) : (
              <Link className="btn btn-secondary btn-sm" to="/roadmap">
                回岗位路径看别的线
              </Link>
            )
          }
        />
      )}

      {chapters.length > 0 && (
        <ul className="row-list">
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <Link className="row-link" to={`/chapters/${chapter.id}`}>
                <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                <Icon
                  name={chapter.done ? 'success' : 'chapter'}
                  size={16}
                  className={chapter.done ? 'rm-outcome-done' : 'row-glyph'}
                />
                <span className="row-title">{chapter.title}</span>
                <Icon name="chevron-right" size={16} className="row-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {planned.length > 0 && (
        <div className="rm-planned-group">
          <p className="rm-caps rm-planned-caps">规划中 · 已排 {planned.length} 章</p>
          <ul className="row-list">
            {planned.map((item) => (
              <li key={item.title}>
                {/* 不可点：用 div 不用 a，没有 hover 底色，避免"看起来能进去" */}
                <div className="row-link is-static">
                  <Icon name="schedule" size={16} className="row-glyph" />
                  <span className="row-title">{item.title}</span>
                  {item.desc && <span className="row-meta">{item.desc}</span>}
                  <span className="pill">规划中</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
