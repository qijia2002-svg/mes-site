/**
 * 岗位画像侧栏：薪资 / 需求 / 岗位定位 / 日常工作 / 产出物。
 * salary、demand 是后端下发的展示用原文字符串，前端不解析不排序，原样呈现。
 */
import { Icon } from '../../components/Icon';
import type { CareerDetail } from '../../api/roadmap';
import { careerIcon } from './trackIcons';

function List({ title, icon, items }: { title: string; icon: 'dispatch' | 'report'; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rm-aside-block">
      <p className="rm-caps">
        <Icon name={icon} size={16} className="rm-detail-glyph" />
        {title}
      </p>
      <ul className="rm-detail-list">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

export function CareerAside({ career }: { career: CareerDetail }) {
  return (
    <aside className="rm-aside" aria-label="岗位画像">
      <div className="rm-aside-head">
        <Icon name={careerIcon(career.slug, career.icon)} size={24} className="rm-aside-glyph" />
        <div>
          <p className="rm-aside-title">{career.title}</p>
          {career.tagline && <p className="rm-aside-tagline">{career.tagline}</p>}
        </div>
      </div>

      <dl className="rm-aside-facts">
        <div>
          <dt>薪资参考</dt>
          <dd>{career.salary || '暂未采集'}</dd>
        </div>
        <div>
          <dt>市场需求</dt>
          <dd>{career.demand || '暂未采集'}</dd>
        </div>
      </dl>

      {career.overview && <p className="rm-aside-overview">{career.overview}</p>}

      <List title="日常工作" icon="dispatch" items={career.dailyWork ?? []} />
      <List title="产出物" icon="report" items={career.outputs ?? []} />
    </aside>
  );
}
