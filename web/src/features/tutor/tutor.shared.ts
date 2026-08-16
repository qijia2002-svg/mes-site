/**
 * 导师模块共享工具：对话持久化 + 轻量富文本渲染（防 XSS）。
 * FAB（移动端）与 Workspace（桌面端）共用，避免逻辑分叉、保证对话历史一致。
 */
import type { TutorMsg } from './tutor.types';

export const TUTOR_STORAGE_KEY = 'mes-tutor-conv';

export function loadTutorHistory(): TutorMsg[] {
  try {
    const raw = localStorage.getItem(TUTOR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TutorMsg[]).slice(-20) : [];
  } catch {
    return [];
  }
}

export function saveTutorHistory(msgs: TutorMsg[]): void {
  try {
    localStorage.setItem(TUTOR_STORAGE_KEY, JSON.stringify(msgs.slice(-20)));
  } catch {
    /* 隐私模式写入失败不阻断使用 */
  }
}

export function clearTutorHistory(): void {
  try {
    localStorage.removeItem(TUTOR_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** 先转义再处理 **粗体** / `代码`，杜绝 XSS；换行交给 CSS white-space:pre-wrap。 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderRich(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}
