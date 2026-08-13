/**
 * 顶栏快速跳转（替代原先的假搜索框）。
 *
 * 真行为：在「工厂环节 + 关键目的地」索引里即时过滤，键盘 / 点击都能跳。
 *  · 工厂环节 → /factory?node=<key>
 *  · 工具页 / 学习页 → 各自路由
 * 不依赖后端，索引由 DEFAULT_FLOW（静态兜底）与少量固定目的地组成。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { DEFAULT_FLOW } from '../features/factory/factoryFlow.data';

interface Dest {
  label: string;
  hint: string;
  to: string;
}

const STATIC_DESTS: Dest[] = [
  { label: '工厂全景', hint: '流程主线', to: '/factory' },
  { label: 'SQL 沙盒', hint: '工具', to: '/sql-space' },
  { label: '工厂模拟器', hint: '动手玩', to: '/simulator' },
  { label: '作品集', hint: '我的产出', to: '/portfolio' },
  { label: '学习路线', hint: '路径', to: '/learning-paths' },
  { label: '职业路线', hint: '岗位', to: '/roadmap' },
  { label: '名称翻译', hint: '词典', to: '/dictionary' },
  { label: '个人中心', hint: '账户', to: '/profile' },
];

export function TopbarSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const dests = useMemo<Dest[]>(() => {
    const nodes: Dest[] = (DEFAULT_FLOW.nodes ?? []).map((n) => ({
      label: n.label,
      hint: '工厂环节',
      to: `/factory?node=${encodeURIComponent(n.key)}`,
    }));
    return [...nodes, ...STATIC_DESTS];
  }, []);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return dests.slice(0, 6);
    return dests
      .filter((d) => d.label.toLowerCase().includes(t) || d.hint.toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, dests]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (d: Dest) => {
    navigate(d.to);
    setOpen(false);
    setQ('');
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches[active]) go(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="topbar-search" ref={rootRef}>
      <div className="topbar-search-wrap">
        <span className="topbar-search-icon">
          <Icon name="search" size={16} />
        </span>
        <input
          type="text"
          value={q}
          placeholder="搜索环节、SQL、搭建…"
          aria-label="快速跳转"
          aria-expanded={open}
          role="combobox"
          aria-controls="topbar-search-listbox"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="topbar-search-menu" id="topbar-search-listbox" role="listbox">
          {matches.map((d, i) => (
            <li
              key={`${d.to}#${d.label}`}
              role="option"
              aria-selected={i === active}
              className={`topbar-search-item${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(d);
              }}
            >
              <span className="topbar-search-item-label">{d.label}</span>
              <span className="topbar-search-item-hint">{d.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
