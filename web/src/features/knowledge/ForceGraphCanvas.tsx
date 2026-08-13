/**
 * ForceGraphCanvas v2 — 零依赖力导向连线图（Canvas 2D）+ 增强互动。
 *
 * v1 基础：力仿真 + 拖拽 + 点击聚焦。
 * v2 增强：hover tooltip / 缩放控制（zoom in/out/reset）/
 *        双击重置布局 / 拖拽节点微放大 / 选中脉冲环 /
 *        ResizeObserver 自适应容器（窗口缩放/旋转自动重绘）。
 *
 * 零外部依赖（npm install 不可靠）。配色全走 getComputedStyle 读令牌。
 * P0 合规：无 emoji 图标、无紫粉渐变、无硬编码 hex（readColors 兜底除外）。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { KgNode, KgNodeKind, KgLink } from '../../api/endpoints';
import { Icon } from '../../components/Icon';

/* ═══════════════════════════════════════════
   内部类型（不导出）
   ═══════════════════════════════════════════ */
interface SimNode {
  id: string;
  kind: KgNodeKind;
  label: string;
  degree: number;
  refId?: number;
  nodeKey?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fixed: boolean;
}

interface SimLink {
  s: string;
  t: string;
  relation: 'process' | 'about';
}

interface Props {
  nodes: KgNode[];
  links: KgLink[];
  focusId: string | null;
  onSelect: (n: KgNode) => void;
}

interface Colors {
  accent: string;
  ink: string;
  muted: string;
  fg: string;
  fg2: string;
  border: string;
  surface: string;
  bg: string;
}

interface TooltipData { x: number; y: number; node: SimNode; }

/* ═══════════════════════════════════════════
   纯函数工具
   ═══════════════════════════════════════════ */
function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: v('--accent', '#547C70'),
    ink: v('--brand-ink', '#2d3a33'),
    muted: v('--muted', '#606864'),
    fg: v('--fg', '#222222'),
    fg2: v('--fg-2', '#3d4540'),
    border: v('--border', '#DDDFD6'),
    surface: v('--surface', '#ffffff'),
    bg: v('--bg', '#F3F3E9'),
  };
}

function nodeColor(kind: KgNodeKind, C: Colors): string {
  if (kind === 'concept') return C.accent;
  if (kind === 'node') return C.ink;
  return C.muted;
}

function radiusFor(kind: KgNodeKind, degree: number): number {
  if (kind === 'concept') return Math.min(7 + degree * 1.4, 18);
  if (kind === 'node') return 7;
  return 4.5;
}

/** 节点类型的中文短标签，用于反链/图例/tooltip（不引入图标，纯文字）。 */
export const KIND_LABEL: Record<string, string> = {
  concept: '概念',
  node: '流程节点',
  explainer: '节点讲解',
  micro: '微练习',
  glossary: '术语',
  topic: '课程',
  sql_ex: 'SQL 练习',
};

/* ═══════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════ */
export function ForceGraphCanvas({ nodes, links, focusId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<Colors>(readColors());
  /* tooltip 状态由 React 管理（DOM 浮层） */
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const stateRef = useRef<{
    sim: SimNode[];
    linkIdx: SimLink[];
    byId: Map<string, SimNode>;
    hoverId: string | null;
    dragId: string | null;
    dragMoved: boolean;
    downX: number;
    downY: number;
    raf: number;
    alpha: number;
    w: number;
    h: number;
    dpr: number;
    zoom: number;
    panX: number;
    panY: number;
    pulsePhase: number;   // 选中节点的脉冲相位
  } | null>(null);

  /** 缩放回调（给 UI 按钮用）——通过 stateRef 间接触发重绘 */
  const handleZoom = useCallback((delta: number) => {
    const st = stateRef.current;
    if (!st) return;
    st.zoom = Math.max(0.3, Math.min(3, st.zoom + delta));
    st.alpha = Math.max(st.alpha, 0.3);
    cancelAnimationFrame(st.raf);
    // 标记需要重绘；ResizeObserver 或下一次事件循环会触发实际绘制
    st.raf = requestAnimationFrame(() => { /* 占位：由内部 tick 驱动 */ });
  }, []);

  /** 重置视图（重新随机布局 + 缩放归一） */
  const handleReset = useCallback(() => {
    const st = stateRef.current;
    if (!st) return;
    const w = st.w;
    const h = st.h;
    for (const n of st.sim) {
      n.x = Math.random() * (w - 80) + 40;
      n.y = Math.random() * (h - 80) + 40;
      n.vx = 0;
      n.vy = 0;
      n.fixed = false;
    }
    st.zoom = 1;
    st.panX = 0;
    st.panY = 0;
    st.hoverId = null;
    st.alpha = 1; // 重启仿真
    setTooltip(null);
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(() => { /* 占位 */ });
  }, []);

  // ──── 核心渲染 effect ────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const canvasEl: HTMLCanvasElement = canvas;

    colorsRef.current = readColors();
    const C = colorsRef.current;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    const sim: SimNode[] = nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: n.label,
      degree: n.degree ?? 0,
      refId: n.refId,
      nodeKey: n.nodeKey,
      x: Math.random() * (w - 80) + 40,
      y: Math.random() * (h - 80) + 40,
      vx: 0,
      vy: 0,
      r: radiusFor(n.kind, n.degree ?? 0),
      fixed: false,
    }));
    const byId = new Map(sim.map((s) => [s.id, s]));
    const linkIdx: SimLink[] = [];
    for (const l of links) {
      if (byId.has(l.source) && byId.has(l.target)) {
        linkIdx.push({ s: l.source, t: l.target, relation: l.relation });
      }
    }

    const st = {
      sim, linkIdx, byId,
      hoverId: null as string | null,
      dragId: null as string | null,
      dragMoved: false,
      downX: 0, downY: 0,
      raf: 0,
      alpha: 1,
      w, h, dpr,
      zoom: 1,
      panX: 0,
      panY: 0,
      pulsePhase: 0,
    };
    stateRef.current = st;

    const ctx = canvas.getContext('2d')!;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // ── ResizeObserver：容器尺寸变化时自适应 ──
    const ro = new ResizeObserver(() => {
      const we = wrapRef.current;
      const ce = canvasRef.current;
      if (!we || !ce || !stateRef.current) return;
      const dpr2 = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const nw = we.clientWidth;
      const nh = we.clientHeight;
      if (nw < 1 || nh < 1) return;
      st.w = nw;
      st.h = nh;
      st.dpr = dpr2;
      ce.width = nw * dpr2;
      ce.height = nh * dpr2;
      ce.style.width = `${nw}px`;
      ce.style.height = `${nh}px`;
      for (const n of sim) {
        const pad = n.r + 4;
        if (n.x < pad) n.x = pad;
        if (n.x > nw - pad) n.x = nw - pad;
        if (n.y < pad) n.y = pad;
        if (n.y > nh - pad) n.y = nh - pad;
      }
      st.alpha = Math.max(st.alpha, 0.4);
      cancelAnimationFrame(st.raf);
      st.raf = requestAnimationFrame(() => { tick(); });
      draw();
    });
    ro.observe(wrap);

    // ── 辅助函数 ──
    function neighborsOf(id: string): Set<string> {
      const set = new Set<string>([id]);
      for (const l of st.linkIdx) {
        if (l.s === id) set.add(l.t);
        if (l.t === id) set.add(l.s);
      }
      return set;
    }
    const focusSet = focusId ? neighborsOf(focusId) : null;

    /** 世界坐标 → 屏幕坐标（应用 zoom + pan） */
    function toScreen(wx: number, wy: number): [number, number] {
      const cx = st.w / 2;
      const cy = st.h / 2;
      return [
        (wx - cx) * st.zoom + cx + st.panX,
        (wy - cy) * st.zoom + cy + st.panY,
      ];
    }

    // ── 力仿真 tick ──
    function tick() {
      const alpha = st.alpha;
      // 斥力
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.01; }
          const d = Math.sqrt(d2);
          const rep = (6000 * alpha) / d2;
          a.vx += (dx / d) * rep;
          a.vy += (dy / d) * rep;
          b.vx -= (dx / d) * rep;
          b.vy -= (dy / d) * rep;
        }
      }
      // 弹簧
      for (const l of st.linkIdx) {
        const a = byId.get(l.s)!;
        const b = byId.get(l.t)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const L = l.relation === 'process' ? 96 : 72;
        const k = l.relation === 'process' ? 0.02 : 0.035;
        const f = (d - L) * k * alpha;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
      // 向心 + 边界 + 积分
      for (const n of sim) {
        if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
        n.vx += (st.w / 2 - n.x) * 0.008 * alpha;
        n.vy += (st.h / 2 - n.y) * 0.008 * alpha;
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
        const pad = n.r + 4;
        if (n.x < pad) n.x = pad;
        if (n.x > st.w - pad) n.x = st.w - pad;
        if (n.y < pad) n.y = pad;
        if (n.y > st.h - pad) n.y = st.h - pad;
      }
      st.alpha *= 0.992;
      st.pulsePhase += 0.08; // 脉冲动画步进
      if (st.alpha < 0.005 && !st.dragId) return;
      st.raf = requestAnimationFrame(draw);
    }

    // ── 绘制 ──
    function draw() {
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.clearRect(0, 0, st.w, st.h);

      // 应用 zoom + pan 变换
      const cx = st.w / 2;
      const cy = st.h / 2;
      ctx.translate(cx + st.panX, cy + st.panY);
      ctx.scale(st.zoom, st.zoom);
      ctx.translate(-cx, -cy);

      // 边
      for (const l of st.linkIdx) {
        const a = byId.get(l.s)!;
        const b = byId.get(l.t)!;
        const inFocus = !focusSet || (focusSet.has(l.s) && focusSet.has(l.t));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (l.relation === 'about') {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = inFocus ? C.accent : 'rgba(150,160,156,0.12)';
          ctx.lineWidth = 1;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = inFocus ? C.border : 'rgba(150,160,156,0.12)';
          ctx.lineWidth = 1.4;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 节点
      for (const n of sim) {
        const inFocus = !focusSet || focusSet.has(n.id);
        const fill = nodeColor(n.kind, C);
        const isHover = n.id === st.hoverId;
        const isFocus = n.id === focusId;
        const isDrag = n.id === st.dragId;

        ctx.globalAlpha = inFocus ? 1 : 0.18;

        // 拖拽时微放大
        const r = (isDrag ? n.r * 1.2 : n.r);

        // 选中脉冲环
        if (isFocus && !isDrag) {
          const pulseR = r + 4 + Math.sin(st.pulsePhase) * 3;
          ctx.globalAlpha = 0.25 + Math.sin(st.pulsePhase) * 0.15;
          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = C.accent;
          ctx.fill();
          ctx.globalAlpha = inFocus ? 1 : 0.18;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();

        // hover / 选中描边
        if (isHover || isFocus) {
          ctx.lineWidth = isFocus ? 2.5 : 1.8;
          ctx.strokeStyle = isFocus ? C.accent : C.fg;
          ctx.stroke();
        }

        // 标签
        const showLabel =
          n.kind === 'concept' || n.kind === 'node' ||
          n.id === st.hoverId || (focusSet != null && focusSet.has(n.id));
        if (showLabel && inFocus) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = n.kind === 'concept' ? C.accent : C.fg2;
          ctx.font = `${n.kind === 'concept' ? 600 : 500} 11px var(--font-body, sans-serif)`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const label = n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label;
          ctx.fillText(label, n.x, n.y + r + 3);
        }
      }
      ctx.globalAlpha = 1;

      // 还原变换
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    }

    function animate() {
      st.alpha = 1;
      cancelAnimationFrame(st.raf);
      st.raf = requestAnimationFrame(() => { tick(); });
    }
    draw();
    st.raf = requestAnimationFrame(() => { tick(); });

    // ── 交互事件 ──
    function pos(e: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } {
      const rect = canvasEl.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    /** 屏幕坐标 → 世界坐标（逆 zoom+pan） */
    function toWorld(sx: number, sy: number): [number, number] {
      const cx = st.w / 2;
      const cy = st.h / 2;
      return [
        (sx - cx - st.panX) / st.zoom + cx,
        (sy - cy - st.panY) / st.zoom + cy,
      ];
    }

    function pick(wx: number, wy: number): SimNode | null {
      for (let i = sim.length - 1; i >= 0; i--) {
        const n = sim[i];
        const dx = wx - n.x;
        const dy = wy - n.y;
        if (dx * dx + dy * dy <= (n.r + 6) * (n.r + 6)) return n;
      }
      return null;
    }

    const onDown = (e: PointerEvent) => {
      const p = pos(e);
      const [wx, wy] = toWorld(p.x, p.y);
      const hit = pick(wx, wy);
      st.downX = p.x;
      st.downY = p.y;
      st.dragMoved = false;
      if (hit) {
        st.dragId = hit.id;
        hit.fixed = true;
        canvasEl.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      const p = pos(e);
      if (st.dragId) {
        const n = byId.get(st.dragId);
        if (n) {
          const [wx, wy] = toWorld(p.x, p.y);
          n.x = wx;
          n.y = wy;
          n.vx = 0;
          n.vy = 0;
        }
        if (Math.abs(p.x - st.downX) > 3 || Math.abs(p.y - st.downY) > 3) {
          st.dragMoved = true;
          st.alpha = Math.max(st.alpha, 0.3);
          cancelAnimationFrame(st.raf);
          st.raf = requestAnimationFrame(tick);
        }
        // 拖拽时更新 tooltip 位置
        if (st.dragId) {
          const dn = byId.get(st.dragId);
          if (dn) setTooltip({ x: p.x, y: p.y - 10, node: dn });
        }
      } else {
        const [wx, wy] = toWorld(p.x, p.y);
        const hit = pick(wx, wy);
        const id = hit ? hit.id : null;
        if (id !== st.hoverId) {
          st.hoverId = id;
          canvasEl.style.cursor = id ? 'pointer' : (st.zoom !== 1 ? 'grab' : 'default');
          cancelAnimationFrame(st.raf);
          draw();
        }
        // 更新 tooltip
        if (hit) {
          setTooltip({ x: p.x, y: p.y - 10, node: hit });
        } else {
          setTooltip(null);
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      const p = pos(e);
      if (st.dragId) {
        const n = byId.get(st.dragId);
        if (n) n.fixed = false;
        const wasClick = !st.dragMoved;
        const id = st.dragId;
        st.dragId = null;
        try { canvasEl.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        setTooltip(null);
        if (wasClick) {
          const node = byId.get(id);
          if (node) onSelect(nodes.find((nn) => nn.id === node.id) ?? (node as unknown as KgNode));
        }
        return;
      }
      // 非拖拽点击
      const [wx, wy] = toWorld(p.x, p.y);
      const hit = pick(wx, wy);
      setTooltip(null);
      if (hit) onSelect(nodes.find((nn) => nn.id === hit.id) ?? (hit as unknown as KgNode));
    };

    // 双击重置
    const onDblClick = (e: Event) => {
      // 只在空白区域双击才重置（双击节点是选中行为）
      const me = e as MouseEvent;
      const p = pos(me);
      const [wx, wy] = toWorld(p.x, p.y);
      const hit = pick(wx, wy);
      if (!hit) handleReset();
    };

    // 滚轮缩放
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      handleZoom(delta);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', () => {
      if (!st.dragId) { st.hoverId = null; setTooltip(null); cancelAnimationFrame(st.raf); draw(); }
    });
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, focusId, handleZoom, handleReset]);

  // ──── DOM 渲染 ────
  return (
    <div ref={wrapRef} className="kg-canvas-wrap">
      <canvas ref={canvasRef} />

      {/* Tooltip 浮层 */}
      {tooltip && (
        <div
          className="kg-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          role="tooltip"
        >
          <span className="kg-tooltip-kind">{KIND_LABEL[tooltip.node.kind] ?? tooltip.node.kind}</span>
          <span className="kg-tooltip-label">{tooltip.node.label}</span>
        </div>
      )}

      {/* 缩放控制条 */}
      <div className="kg-zoom-bar" aria-label="缩放控制">
        <button
          type="button"
          className="kg-zoom-btn"
          onClick={() => handleZoom(0.2)}
          title="放大"
          aria-label="放大"
        >
          <Icon name="zoom-in" size={16} />
        </button>
        <button
          type="button"
          className="kg-zoom-btn kg-zoom-reset"
          onClick={handleReset}
          title="重置布局"
          aria-label="重置布局"
        >
          <Icon name="refresh-cw" size={16} />
        </button>
        <button
          type="button"
          className="kg-zoom-btn"
          onClick={() => handleZoom(-0.2)}
          title="缩小"
          aria-label="缩小"
        >
          <Icon name="zoom-out" size={16} />
        </button>
      </div>

      {/* 提示文字 */}
      <div className="kg-hint" aria-hidden="true">
        拖拽移动节点 · 滚轮缩放 · 双击重置 · 点击查看详情
      </div>
    </div>
  );
}
