/**
 * 首页打招呼区域：显示昵称 + 日期星期 + 励志话 + 学习进度摘要。
 * 昵称存 localStorage（个人中心可编辑），进度数据复用 React Query 缓存。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { api } from '../api/endpoints';
import './GreetingBar.css';

const NICK_KEY = 'mes.nickname';

export function getNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) || '';
  } catch {
    return '';
  }
}

export function setNickname(name: string) {
  try {
    localStorage.setItem(NICK_KEY, name);
  } catch {
    // 存储不可用不影响功能
  }
}

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

/** 基于日期选一条励志话（每天固定，不随机跳） */
function todayMotivation(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return MOTIVATIONS[day % MOTIVATIONS.length];
}

function formatDate(): string {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const w = weekdays[now.getDay()];
  return `${m} 月 ${d} 日 · 星期${w}`;
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

export function GreetingBar() {
  const progressQ = useQuery({ queryKey: ['progress'], queryFn: api.progress, staleTime: 60_000 });

  const nickname = getNickname();
  const greeting = timeGreeting();
  const date = formatDate();
  const motivation = todayMotivation();
  const doneCount = progressQ.data?.completedChapterIds?.length ?? 0;

  return (
    <div className="greeting-bar">
      <div className="greeting-main">
        <h2 className="greeting-title">
          {greeting}，{nickname || '学习者'}
        </h2>
        <p className="greeting-meta">
          <Icon name="schedule" size={16} />
          {date}
          {doneCount > 0 && (
            <>
              <span className="greeting-sep">·</span>
              <Icon name="chapter" size={16} />
              已学 {doneCount} 章
            </>
          )}
        </p>
        <p className="greeting-motivation">{motivation}</p>
      </div>
      <Link className="greeting-cta" to="/courses">
        <Icon name="run" size={16} />
        继续学习
      </Link>
    </div>
  );
}
