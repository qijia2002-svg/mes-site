/**
 * 路由清单（Route Manifest）—— 自注册体验总线（UX 重梳 v2 · 根治 N1/N2）。
 *
 * 把「导航归属 + 激活高亮」从手写 match 字符串改为数据驱动：
 *   加一个模拟/演练类页面，只要在对应一级组下加一条 children（或 matchPrefixes），
 *   它就会**自动**出现在侧栏/底栏并自动高亮，杜绝「加功能即变孤儿路由」的架构债。
 *
 * 规则：
 *   · children    —— 在桌面侧栏平铺、移动端由各落地页进入的二级入口（会展示 + 高亮）。
 *   · matchPrefixes —— 仅用于高亮、不展示为子项的路径前缀（兼容旧路由如 /roadmap /tracks）。
 *   · 一级高亮 = 命中 to / children 任一前缀 / matchPrefixes 任一前缀。
 * 学习动作（演练/测试等）标 spine:true，供脊柱进度上报（N4）识别。
 */
import type { IconName } from '../components/Icon';

export type NavGroupId = 'factory' | 'courses' | 'practice' | 'profile';

export interface NavChildDef {
  to: string;
  label: string;
  icon: IconName;
  /** 是否学习动作（演练/测试等），标注后由脊柱进度体系识别。 */
  spine?: boolean;
}

export interface NavGroupDef {
  id: NavGroupId;
  to: string;
  label: string;
  icon: IconName;
  children: NavChildDef[];
  /** 仅高亮用的额外路径前缀（不展示为子项）。 */
  matchPrefixes: string[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: 'factory',
    to: '/factory',
    label: '看 · 工厂',
    icon: 'factory',
    // 排产模拟 /scheduling 在此声明即自动进导航 + 自动高亮（治 N1）
    children: [
      { to: '/simulator', label: '模拟器', icon: 'gauge' },
      { to: '/order-to-delivery', label: '订单到交付', icon: 'truck' },
      { to: '/scheduling', label: '排产模拟', icon: 'schedule', spine: true },
    ],
    // /knowledge-graph 直开（演练中深究概念）时归属「看·工厂」高亮
    matchPrefixes: ['/knowledge-graph'],
  },
  {
    id: 'courses',
    to: '/courses',
    label: '学 · 课程',
    icon: 'courses',
    children: [
      { to: '/learning-paths', label: '学习路径', icon: 'paths' },
      { to: '/roadmap', label: '岗位路线', icon: 'stage' },
    ],
    // /tracks 详情页 + /chapters 章节阅读页也归属「学·课程」高亮，但不作为子项平铺
    matchPrefixes: ['/tracks', '/chapters'],
  },
  {
    id: 'practice',
    to: '/practice',
    label: '练 · 练习',
    icon: 'tools',
    children: [
      { to: '/sql-space', label: 'SQL 沙盒', icon: 'sql' },
      { to: '/quiz', label: '测验', icon: 'quiz' },
      { to: '/dictionary', label: '词典', icon: 'dictionary' },
    ],
    matchPrefixes: [],
  },
  {
    id: 'profile',
    to: '/profile',
    label: '我的',
    icon: 'user',
    children: [{ to: '/portfolio', label: '作品集', icon: 'portfolio' }],
    matchPrefixes: [],
  },
];

/** 当前路径是否命中某个一级组的激活态（导航高亮）。 */
export function isNavActive(group: NavGroupDef, pathname: string): boolean {
  if (pathname === group.to || pathname.startsWith(`${group.to}/`)) return true;
  for (const c of group.children) {
    if (pathname === c.to || pathname.startsWith(`${c.to}/`)) return true;
  }
  for (const p of group.matchPrefixes) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}
