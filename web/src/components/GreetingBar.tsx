/**
 * 首页问候横幅：轻量文字横幅，显示昵称 + 连续学习天数 + 励志语。
 * 昵称存 localStorage（profileStore），进度数据复用 React Query 缓存。
 */
import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from './Icon';
import { api } from '../api/endpoints';
import { getNickname, setNickname, subscribeProfile } from '../lib/profileStore';
import './GreetingBar.css';

const DAY_MS = 86_400_000;

export { getNickname, setNickname };

const MOTIVATIONS = [
  '每天进步一点点，坚持就是胜利',
  '制造业数字化的未来，从理解每一个工序开始',
  '理论 + 实操 = 真正的掌握',
  '工厂的问题就是你的机会',
  '数据驱动决策，从 SQL 开始',
  '不懂就学，学了就用，用了就是你的',
  'MES 实施工程师的核心能力：看懂现场 + 说出方案',
  '每一道工序都值得被数字化',
];

function todayMotivation(): string {
  const day = Math.floor(Date.now() / DAY_MS);
  return MOTIVATIONS[day % MOTIVATIONS.length];
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/** 从 progress events 推算连续学习天数 */
function computeStreak(events: { createdAt?: number }[]): number {
  if (!events || events.length === 0) return 0;
  const daySet = new Set<string>();
  for (const e of events) {
    if (typeof e.createdAt === 'number') {
      const d = new Date(e.createdAt);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  let streak = 0;
  const today = new Date();
  // 从昨天开始检查（今天可能还没有学习记录）
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - (i + 1) * DAY_MS);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (daySet.has(key)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function GreetingBar() {
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });

  // 订阅资料变更：设置页保存昵称后，首页问候栏即时更新（无需刷新/重挂载）。
  const nickname = useSyncExternalStore(subscribeProfile, getNickname);
  const greeting = timeGreeting();
  const motivation = todayMotivation();
  const doneCount = progressQ.data?.completedChapterIds?.length ?? 0;
  const streak = computeStreak((progressQ.data as any)?.events ?? []);

  return (
    <div className="greeting-bar">
      <div className="greeting-main">
        <h2 className="greeting-title">
          {greeting}，{nickname || '学习者'}
        </h2>
        <p className="greeting-sub">
          {doneCount > 0 ? (
            <>
              <Icon name="chapter" size={16} />
              已学 {doneCount} 章
            </>
          ) : (
            <>
              <Icon name="chapter" size={16} />
              开始你的学习之旅
            </>
          )}
          {streak > 0 && (
            <span className="greeting-streak">
              <Icon name="streak" size={16} />
              连续学习
              <span className="greeting-streak-count">{streak}</span>
              天
            </span>
          )}
        </p>
        <p className="greeting-motivation">{motivation}</p>
      </div>
    </div>
  );
}
