/**
 * useDraggable —— 让浮层（AI 导师入口）可在屏幕上拖动并持久化位置。
 *
 * 设计要点：
 *   · 指针事件（pointer events）统一鼠标 / 触摸，移动端加 touch-action:none 防止拖动时页面滚动。
 *   · 拖动超过 5px 视为「拖」而非「点」，release 时用 isDragging() 让调用方吞掉误触发的 click。
 *   · 位置写入 localStorage（按 storageKey 隔离），重新进入沿用上次落点；越界自动夹紧到可视区。
 *   · 不直接写死颜色 / 不用 emoji；返回 inline style 仅含定位，其余样式走各自 CSS 类（P0 合规）。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

export interface DragPos {
  x: number;
  y: number;
}

interface Options {
  storageKey: string;
  /** 无缓存时按视口计算默认落点（右下角，移动端让出底栏）。 */
  defaultPos: () => DragPos;
  /** 距离视口边缘的最小留白，避免拖出屏幕外。 */
  edgePadding?: number;
}

function load(key: string, fallback: () => DragPos): DragPos {
  if (typeof window === 'undefined') return fallback();
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw) as DragPos;
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch {
    /* 忽略损坏的缓存 */
  }
  return fallback();
}

export function useDraggable({ storageKey, defaultPos, edgePadding = 8 }: Options) {
  const [pos, setPos] = useState<DragPos>(() => load(storageKey, defaultPos));
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const start = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const posRef = useRef(pos);
  const draggedRef = useRef(false); // 最近一次手势是否发生了拖动（供 click 抑制）

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const clamp = useCallback(
    (x: number, y: number): DragPos => {
      const el = ref.current;
      const w = el?.offsetWidth ?? 56;
      const h = el?.offsetHeight ?? 56;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 9999;
      const pad = edgePadding;
      return {
        x: Math.max(pad, Math.min(vw - w - pad, x)),
        y: Math.max(pad, Math.min(vh - h - pad, y)),
      };
    },
    [edgePadding],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button != null && e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      el.setPointerCapture?.(e.pointerId);
      start.current = { px: e.clientX, py: e.clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
      draggedRef.current = false;
      setDragging(true);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.px;
      const dy = e.clientY - s.py;
      if (!s.moved && Math.hypot(dx, dy) < 5) return; // 小于阈值当点击
      s.moved = true;
      draggedRef.current = true;
      setPos(clamp(s.ox + dx, s.oy + dy));
    },
    [clamp],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      ref.current?.releasePointerCapture?.(e.pointerId);
      start.current = null;
      setDragging(false);
      if (s?.moved) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(posRef.current));
        } catch {
          /* 隐私模式下写入失败不致命 */
        }
      }
    },
    [storageKey],
  );

  /** 在 onClick 开头调用：若刚拖动则吞掉这次点击，并复位标记。 */
  const consumeDrag = useCallback((): boolean => {
    const was = draggedRef.current;
    draggedRef.current = false;
    return was;
  }, []);

  const style: CSSProperties = {
    position: 'fixed',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    right: 'auto',
    bottom: 'auto',
    touchAction: 'none',
    zIndex: 'calc(var(--z-sticky) + 10)',
  };

  return { ref, style, dragging, onPointerDown, onPointerMove, onPointerUp, consumeDrag };
}
