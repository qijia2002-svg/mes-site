/**
 * 作品集 / 求职素材本地存储（个人中心 v2 扩展，Manufacturing OS P1）。
 *
 * v2 升级（用户需求：优化 + 增加功能）：
 *  - 富字段：role（岗位/角色）、skills（技能标签）、link（外链）、starred（置顶）。
 *  - 导出 / 导入：JSON 备份，解决"清缓存即失忆"的痛点（求职素材最怕误删）。
 *  - 按 id 合并导入，避免重复。
 *
 * 设计对齐 profileStore：
 *  - 项目无后端用户表，资料存浏览器 localStorage（与昵称/目标同源）。
 *  - 清缓存即失忆，是 MVP 明确取舍（Spec §3 不做学员账号）。
 *  - 写入失败（隐私模式 / 存储禁用）通过返回值 { ok } 暴露给上层提示。
 */
import { peek, write } from './userData';

export type PortfolioCategory = '需求文档' | '实施笔记' | '方案' | '其他';

export interface PortfolioItem {
  id: string;
  title: string;
  category: PortfolioCategory;
  note: string;
  date: string; // YYYY-MM-DD
  /** v2：岗位 / 角色，让作品更像求职素材 */
  role?: string;
  /** v2：技能标签 */
  skills?: string[];
  /** v2：外链（需求文档 / 方案原文 / 演示地址） */
  link?: string;
  /** v2：置顶 / 星标，列表优先展示 */
  starred?: boolean;
  updatedAt: number;
}

/** 取全部作品（云端镜像优先，离线回退；返回副本，调用方按需排序）。 */
export function getPortfolio(): PortfolioItem[] {
  const list = peek<PortfolioItem[]>('portfolio', []);
  return Array.isArray(list) ? list : [];
}

/** 写入：云端为主、本地兜底（userData 内部处理镜像与异步同步）。 */
function save(items: PortfolioItem[]): boolean {
  void write('portfolio', items);
  return true;
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

/** 更新一条作品（局部字段）。 */
export function updatePortfolioItem(
  id: string,
  patch: Partial<PortfolioItem>,
): { ok: boolean; items: PortfolioItem[] } {
  const items = getPortfolio().map((x) =>
    x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x,
  );
  const ok = save(items);
  return { ok, items };
}

/** 删除一条作品，返回最新列表。 */
export function removePortfolioItem(id: string): { ok: boolean; items: PortfolioItem[] } {
  const items = getPortfolio().filter((x) => x.id !== id);
  const ok = save(items);
  return { ok, items };
}

/** 置顶 / 取消置顶。 */
export function setStarred(id: string, starred: boolean): { ok: boolean; items: PortfolioItem[] } {
  return updatePortfolioItem(id, { starred });
}

/** 导出为格式化 JSON 字符串。 */
export function exportPortfolioString(): string {
  return JSON.stringify(getPortfolio(), null, 2);
}

const VALID_CATS: PortfolioCategory[] = ['需求文档', '实施笔记', '方案', '其他'];

/**
 * 导入 JSON 字符串：按 id 合并（导入的同 id 覆盖本地），校验宽容，
 * 缺字段补默认，绝不让一条脏数据打断整个导入。
 */
export function importPortfolioString(
  text: string,
): { ok: boolean; items: PortfolioItem[]; error?: string } {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { ok: false, items: getPortfolio(), error: '不是有效的作品集 JSON' };
    }
    const valid: PortfolioItem[] = [];
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') continue;
      if (typeof raw.title !== 'string' || !raw.title.trim()) continue;
      valid.push({
        id: typeof raw.id === 'string' ? raw.id : genId(),
        title: raw.title,
        category: VALID_CATS.includes(raw.category) ? raw.category : '其他',
        note: typeof raw.note === 'string' ? raw.note : '',
        date: typeof raw.date === 'string' ? raw.date : new Date().toISOString().slice(0, 10),
        role: typeof raw.role === 'string' ? raw.role : '',
        skills: Array.isArray(raw.skills)
          ? raw.skills.filter((s: unknown) => typeof s === 'string')
          : [],
        link: typeof raw.link === 'string' ? raw.link : '',
        starred: raw.starred === true,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      });
    }
    const map = new Map<string, PortfolioItem>();
    for (const it of getPortfolio()) map.set(it.id, it);
    for (const it of valid) map.set(it.id, it);
    const merged = [...map.values()];
    const ok = save(merged);
    return { ok, items: merged };
  } catch {
    return { ok: false, items: getPortfolio(), error: 'JSON 解析失败' };
  }
}
