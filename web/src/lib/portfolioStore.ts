/**
 * 作品集 / 求职素材本地存储（个人中心 v2 扩展，Manufacturing OS P1）。
 *
 * 设计对齐 profileStore：
 *  - 项目无后端用户表，资料存浏览器 localStorage（与昵称/目标同源）。
 *  - 清缓存即失忆，是 MVP 明确取舍（Spec §3 不做学员账号）。
 *  - 写入失败（隐私模式 / 存储禁用）通过返回值 { ok } 暴露给上层提示。
 *
 * 字段对应 Manufacturing OS 文档「作品集板块（求职展示）」：
 * 存项目方案 / MES 需求文档 / 实施笔记，可当求职作品集。
 */
const KEY = 'mes.portfolio';

export type PortfolioCategory = '需求文档' | '实施笔记' | '方案' | '其他';

export interface PortfolioItem {
  id: string;
  title: string;
  category: PortfolioCategory;
  note: string;
  date: string; // YYYY-MM-DD
  updatedAt: number;
}

/** 取全部作品（返回副本，调用方按需排序）。 */
export function getPortfolio(): PortfolioItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PortfolioItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: PortfolioItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 新增一条作品，返回最新列表（倒序：最新在前）。 */
export function addPortfolioItem(
  item: Omit<PortfolioItem, 'id' | 'updatedAt'>,
): { ok: boolean; items: PortfolioItem[] } {
  const items = [{ ...item, id: genId(), updatedAt: Date.now() }, ...getPortfolio()];
  const ok = save(items);
  return { ok, items };
}

/** 删除一条作品，返回最新列表。 */
export function removePortfolioItem(id: string): { ok: boolean; items: PortfolioItem[] } {
  const items = getPortfolio().filter((x) => x.id !== id);
  const ok = save(items);
  return { ok, items };
}
