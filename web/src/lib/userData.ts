/**
 * 跨设备用户数据云端镜像（Issue #2 修复）。
 *
 * 背景：作品集 / 个人资料 / 引擎状态 / 仿真状态原先只存浏览器 localStorage，
 * 按设备隔离，导致"不同电脑登录看到不同内容"。本模块把它们改造成
 * 「云端(D1 user_kv)为主、本地为兜底」：
 *   - 启动时把云端数据拉到本地镜像（bootstrapUserData），并做一次本地→云端迁移；
 *   - 写入时本地镜像立即生效（保证现有同步读取者即时看到），后台异步同步云端；
 *   - 云端不可达时回退本地镜像，离线也不丢数据。
 *
 * 键空间（按登录账号 sub 在后端隔离）：
 *   portfolio / profile / sim_project / engine.activePath / engine.selectedPaths
 *
 * 约定：本地镜像统一前缀 mes.ud.，与遗留键（mes.portfolio 等）区分，便于一次性迁移。
 */
import { apiGet, apiPut } from '../api/client';

/** 已知键：启动水合时全部拉取一遍；迁移时按 LEGACY 映射从遗留键迁入。 */
export const USER_DATA_KEYS = [
  'portfolio',
  'profile',
  'sim_project',
  'engine.activePath',
  'engine.selectedPaths',
  'sim.sqlExport',
] as const;

const LS_PREFIX = 'mes.ud.';
const MIG_FLAG = 'mes.ud.migrated';

/** 遗留 localStorage 键 -> 云端键的迁移映射。 */
const LEGACY: Record<string, string> = {
  'portfolio': 'mes.portfolio',
  'profile': 'mes.profile',
  'sim_project': 'mes.sim_project',
  'engine.activePath': 'mes.engine.activePath',
  'engine.selectedPaths': 'mes.engine.selectedPaths',
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* 隐私模式 / 配额耗尽：静默降级，云端同步会兜底 */
  }
}

/**
 * 同步写入本地镜像，并返回真实是否写入成功（隐私模式 / 配额耗尽时返回 false）。
 * 与 `write` 的区别：`write` 还会异步同步云端且返回 void；本函数只管本地、
 * 且把"是否真的写进去了"如实交给调用方，避免上层误以为永远成功。
 */
export function writeLocal<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** 同步读取：优先本地镜像。供现有同步消费者（AppShell 昵称、各页初始值）使用。 */
export function peek<T>(key: string, fallback: T): T {
  return lsGet(key, fallback);
}

/** 从云端加载某键：成功则写入本地镜像；失败回退本地镜像 / 默认（离线安全）。 */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await apiGet<{ value: unknown | null }>(
      `/api/v1/user/data/${encodeURIComponent(key)}`,
    );
    if (res.value !== null && res.value !== undefined) {
      const v = res.value as T;
      lsSet(key, v);
      return v;
    }
  } catch {
    /* 离线：回退本地镜像 */
  }
  return lsGet(key, fallback);
}

/**
 * 写入：本地镜像立即生效（同步读取者即时看到），再后台异步同步云端。
 * 云端失败不抛错——本地镜像已保留，下次加载/写入会再尝试同步。
 */
export async function write<T>(key: string, value: T): Promise<void> {
  lsSet(key, value);
  try {
    await apiPut(`/api/v1/user/data/${encodeURIComponent(key)}`, { value });
  } catch {
    /* 离线降级 */
  }
}

let migrating: Promise<void> | null = null;

/** 一次性本地→云端迁移：把遗留 localStorage 数据推到云端后清除遗留键。幂等。 */
export function migrateLegacyIfNeeded(): Promise<void> {
  if (migrating) return migrating;
  migrating = (async () => {
    if (localStorage.getItem(MIG_FLAG) === '1') return;
    for (const [newKey, oldKey] of Object.entries(LEGACY)) {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(oldKey);
      } catch {
        /* ignore */
      }
      if (raw) {
        try {
          const val = JSON.parse(raw);
          await write(newKey, val); // 写云端 + 本地镜像
          try {
            localStorage.removeItem(oldKey);
          } catch {
            /* ignore */
          }
        } catch {
          /* 脏数据跳过 */
        }
      }
    }
    try {
      localStorage.setItem(MIG_FLAG, '1');
    } catch {
      /* ignore */
    }
  })();
  return migrating;
}

/**
 * 启动水合：迁移 + 把所有已知键从云端拉到本地镜像。
 * 带超时兜底——即使云端慢/不可达，最多阻塞首屏 ~4s，之后用本地镜像/默认继续。
 */
export async function bootstrapUserData(timeoutMs = 4000): Promise<void> {
  await Promise.race([
    (async () => {
      await migrateLegacyIfNeeded();
      await Promise.allSettled(
        USER_DATA_KEYS.map((k) => load(k, null as unknown as Record<string, never>)),
      );
    })(),
    new Promise<void>((resolve) => setTimeout(() => resolve(), timeoutMs)),
  ]);
}
