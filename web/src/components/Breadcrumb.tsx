/**
 * 面包屑。基线由路由推导，末级标题由页面通过 useCrumbTail 注入
 * （章节名 / 题目名这类只有页面自己知道的动态文案）。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';

interface Crumb {
  label: string;
  to?: string;
}

const CrumbContext = createContext<(label: string | null) => void>(() => {});
const CrumbTailContext = createContext<string | null>(null);

export function CrumbProvider({ children }: { children: React.ReactNode }) {
  const [tail, setTailState] = useState<string | null>(null);
  const setTail = useCallback((label: string | null) => setTailState(label), []);
  return (
    <CrumbTailContext.Provider value={tail}>
      <CrumbContext.Provider value={setTail}>{children}</CrumbContext.Provider>
    </CrumbTailContext.Provider>
  );
}

/** 页面调用：注入面包屑末级文案，卸载时自动清理。 */
export function useCrumbTail(label: string | null | undefined) {
  const setTail = useContext(CrumbContext);
  useEffect(() => {
    setTail(label ?? null);
    return () => setTail(null);
  }, [label, setTail]);
}

const SECTION: Record<string, { label: string; to: string }> = {
  engine: { label: '学习', to: '/engine' },
  courses: { label: '课程', to: '/courses' },
  chapters: { label: '课程', to: '/courses' },
  'learning-paths': { label: '学习路径', to: '/learning-paths' },
  roadmap: { label: '职业路径', to: '/roadmap' },
  tracks: { label: '职业路径', to: '/roadmap' },
  'sql-space': { label: 'SQL 工作台', to: '/sql-space' },
  quiz: { label: '题库', to: '/quiz' },
  simulator: { label: '工厂仿真', to: '/simulator' },
  profile: { label: '个人中心', to: '/profile' },
  portfolio: { label: '作品集', to: '/portfolio' },
  dictionary: { label: '名称翻译', to: '/dictionary' },
  login: { label: '登录', to: '/login' },
  admin: { label: '后台', to: '/admin' },
};

const FALLBACK_LEAF: Record<string, string> = {
  engine: '学习中心',
  courses: '课程详情',
  chapters: '章节正文',
  'learning-paths': '路径详情',
  tracks: '能力路线',
  'sql-space': '练习',
  quiz: '题目',
  simulator: '仿真编辑',
};

export function Breadcrumb() {
  const { pathname } = useLocation();
  const tail = useContext(CrumbTailContext);

  const crumbs = useMemo<Crumb[]>(() => {
    const segments = pathname.split('/').filter(Boolean);
    const list: Crumb[] = [{ label: '工作台', to: '/' }];
    if (segments.length === 0) return [{ label: '工作台' }];

    const section = SECTION[segments[0]];
    if (!section) return [{ label: '工作台', to: '/' }, { label: '页面不存在' }];

    const hasLeaf = segments.length > 1;
    list.push(hasLeaf ? { label: section.label, to: section.to } : { label: section.label });
    if (hasLeaf) list.push({ label: tail || FALLBACK_LEAF[segments[0]] || '详情' });
    return list;
  }, [pathname, tail]);

  return (
    <nav className="breadcrumb" aria-label="面包屑">
      <ol>
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {i > 0 && <Icon name="chevron-right" size={16} className="crumb-sep" />}
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
