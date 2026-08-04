/**
 * 岗位选择器（UIUX §3.3）：WAI-ARIA Tabs 模式。
 * 方向键在 chip 之间移动、Home/End 跳首尾，Tab 键只进出组件（roving tabindex），
 * 否则 5 个岗位会在 Tab 序列里挡在矩阵前面。
 */
import { useRef } from 'react';
import { Icon } from '../../components/Icon';
import type { CareerListItem } from '../../api/roadmap';
import { careerIcon } from './trackIcons';

export const ROLE_PANEL_ID = 'rm-panel';

export function roleTabId(slug: string): string {
  return `rm-tab-${slug}`;
}

export function RoleSelector({
  careers,
  value,
  onChange,
}: {
  careers: CareerListItem[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (from: number, delta: number | 'home' | 'end') => {
    const last = careers.length - 1;
    let next: number;
    if (delta === 'home') next = 0;
    else if (delta === 'end') next = last;
    else next = (from + delta + careers.length) % careers.length;
    const target = careers[next];
    if (!target) return;
    onChange(target.slug);
    refs.current[target.slug]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        move(index, 'home');
        break;
      case 'End':
        event.preventDefault();
        move(index, 'end');
        break;
      default:
        break;
    }
  };

  return (
    <div className="rm-roles" role="tablist" aria-label="岗位">
      {careers.map((career, index) => {
        const selected = career.slug === value;
        return (
          <button
            key={career.slug}
            type="button"
            role="tab"
            id={roleTabId(career.slug)}
            aria-selected={selected}
            aria-controls={ROLE_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'rm-role is-active' : 'rm-role'}
            ref={(el) => {
              refs.current[career.slug] = el;
            }}
            onClick={() => onChange(career.slug)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            <Icon name={careerIcon(career.slug, career.icon)} size={20} className="rm-role-glyph" />
            <span className="rm-role-text">
              <span className="rm-role-title">{career.title}</span>
              <span className="rm-role-meta">
                {career.stageCount} 阶段 · {career.trackCount} 条能力线
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
