/**
 * 个人资料本地存储（无后端用户表，资料存浏览器 localStorage）。
 * 集中管理昵称 / 每日学习目标 / 学习提醒时间，供首页分析与设置页读写。
 *
 * v2 增强：
 *  - setProfile 返回 { ok }，写入失败（隐私模式 / 存储禁用 / 配额耗尽）可被上层感知并提示用户。
 *  - 写入成功后广播 'mes:profile-changed'，配合 useSyncExternalStore 让首页问候栏
 *    在设置页保存后即时更新，无需刷新或依赖组件重新挂载。
 */
const KEY = 'mes.profile';
const PROFILE_EVENT = 'mes:profile-changed';

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* 忽略单个监听异常 */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }
}

/** 订阅资料变更（供 useSyncExternalStore 使用）。返回取消订阅函数。 */
export function subscribeProfile(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export interface UserProfile {
  nickname: string;
  /** 每日学习目标（章/天），用于首页学习分析对比 */
  dailyGoal: number;
  /** 学习提醒时间 HH:MM */
  reminderTime: string;
}

const DEFAULTS: UserProfile = {
  nickname: '',
  dailyGoal: 3,
  reminderTime: '20:00',
};

export function getProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : DEFAULTS.nickname,
      dailyGoal:
        typeof parsed.dailyGoal === 'number' && parsed.dailyGoal > 0
          ? parsed.dailyGoal
          : DEFAULTS.dailyGoal,
      reminderTime: typeof parsed.reminderTime === 'string' ? parsed.reminderTime : DEFAULTS.reminderTime,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setProfile(patch: Partial<UserProfile>): { ok: boolean; profile: UserProfile } {
  const next = { ...getProfile(), ...patch };
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 隐私模式 / 存储被禁用 / 配额耗尽：标记为失败，让上层提示用户。
    ok = false;
  }
  if (ok) emit();
  return { ok, profile: next };
}

/* 兼容旧调用：GreetingBar / ProfilePage 仍用这两个函数 */
export function getNickname(): string {
  return getProfile().nickname;
}
export function setNickname(name: string): { ok: boolean } {
  const r = setProfile({ nickname: name });
  return { ok: r.ok };
}
