/**
 * ForceGraphCanvas — 零依赖力导向连线图（Canvas 2D）。
 *
 * 为什么不用 react-force-graph-2d：本环境 npm install 不可靠、git 写操作受限，
 * 引入新依赖会让 typecheck 无法在本会话内收敛。这里用原生 Canvas + 一个轻量力仿真
 * 实现 Obsidian 式交互：可拖拽、点击聚焦局部图、配色全走设计令牌（无紫粉渐变、无 emoji）。
 *
 * 配色：全部用 getComputedStyle 读 --accent / --brand-ink / --muted 等令牌，绝不硬编码 hex
 * （遵守 MVP 专家团 P0 硬规则）。
 */
import { useEffect, useRef } from 'react';
import type { KgNode, KgNodeKind, KgLink } from '../../api/endpoints';

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

function nodeRadius(n: SimNode): number {
  if (n.kind === 'concept') return Math.min(7 + n.degree * 1.4, 18);
  if (n.kind === 'node') return 7;
  return 4.5;
}

function radiusFor(kind: KgNodeKind, degree: number): number {
  if (kind === 'concept') return Math.min(7 + degree * 1.4, 18);
  if (kind === 'node') return 7;
  return 4.5;
}

/** 节点类型的中文短标签，用于反链/图例（不引入图标，纯文字）。 */
export const KIND_LABEL: Record<string, string> = {
  concept: '概念',
  node: '流程节点',
  explainer: '节点讲解',
  micro: '微练习',
  glossary: '术语',
  topic: '课程',
  sql_ex: 'SQL 练习',
};

export function ForceGraphCanvas({ nodes, links, focusId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<Colors>(readColors());
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
  } | null>(null);

  // 每次节点/边变化都重建仿真（数据量小，重置代价可忽略）
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
      sim,
      linkIdx,
      byId,
      hoverId: null as string | null,
      dragId: null as string | null,
      dragMoved: false,
      downX: 0,
      downY: 0,
      raf: 0,
      alpha: 1,
      w,
      h,
      dpr,
    };
    stateRef.current = st;

    const ctx = canvas.getContext('2d')!;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    function neighborsOf(id: string): Set<string> {
      const set = new Set<string>([id]);
      for (const l of st.linkIdx) {
        if (l.s === id) set.add(l.t);
        if (l.t === id) set.add(l.s);
      }
      return set;
    }
    const focusSet = focusId ? neighborsOf(focusId) : null;

    function tick() {
      const alpha = st.alpha;
      // 斥力（所有节点两两）
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 0.01;
          }
          const d = Math.sqrt(d2);
          const rep = (6000 * alpha) / d2;
          const fx = (dx / d) * rep;
          const fy = (dy / d) * rep;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // 弹簧（连边）
      for (const l of st.linkIdx) {
        const a = byId.get(l.s)!;
        const b = byId.get(l.t)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const L = l.relation === 'process' ? 96 : 72;
        const k = l.relation === 'process' ? 0.02 : 0.035;
        const f = (d - L) * k * alpha;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // 向心 + 边界 + 积分
      for (const n of sim) {
        if (n.fixed) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
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
      if (st.alpha < 0.005 && !st.dragId) return; // 收敛后停帧，省 CPU
      st.raf = requestAnimationFrame(draw);
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, st.w, st.h);

      // 边
      for (const l of st.linkIdx) {
        const a = byId.get(l.s)!;
        const b = byId.get(l.t)!;
        const inFocus =
          !focusSet || (focusSet.has(l.s) && focusSet.has(l.t));
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
        ctx.globalAlpha = inFocus ? 1 : 0.18;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (n.id === st.hoverId || n.id === focusId) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.fg;
          ctx.stroke();
        }
        // 文字：概念 / 流程节点 常显；其余仅在聚焦邻居或 hover 时显示
        const showLabel =
          n.kind === 'concept' || n.kind === 'node' || n.id === st.hoverId || (focusSet != null && focusSet.has(n.id));
        if (showLabel && inFocus) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = n.kind === 'concept' ? C.accent : C.fg2;
          ctx.font = `${n.kind === 'concept' ? 600 : 500} 11px var(--font-body, sans-serif)`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const label = n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label;
          ctx.fillText(label, n.x, n.y + n.r + 3);
        }
      }
      ctx.globalAlpha = 1;
    }

    function animate() {
      st.alpha = 1;
      cancelAnimationFrame(st.raf);
      const loop = () => {
        tick();
      };
      st.raf = requestAnimationFrame(loop);
    }
    // tick 内部会续帧；先画一帧再启动
    draw();
    st.raf = requestAnimationFrame(() => {
      tick();
    });

    // ---- 交互 ----
    function pos(e: PointerEvent) {
      const rect = canvasEl.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function pick(x: number, y: number): SimNode | null {
      for (let i = sim.length - 1; i >= 0; i--) {
        const n = sim[i];
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy <= (n.r + 5) * (n.r + 5)) return n;
      }
      return null;
    }

    const onDown = (e: PointerEvent) => {
      const p = pos(e);
      const hit = pick(p.x, p.y);
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
          n.x = p.x;
          n.y = p.y;
          n.vx = 0;
          n.vy = 0;
        }
        if (Math.abs(p.x - st.downX) > 3 || Math.abs(p.y - st.downY) > 3) {
          st.dragMoved = true;
          st.alpha = Math.max(st.alpha, 0.3);
          cancelAnimationFrame(st.raf);
          st.raf = requestAnimationFrame(tick);
        }
      } else {
        const hit = pick(p.x, p.y);
        const id = hit ? hit.id : null;
        if (id !== st.hoverId) {
          st.hoverId = id;
          canvasEl.style.cursor = id ? 'pointer' : 'default';
          cancelAnimationFrame(st.raf);
          draw();
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
        try {
          canvasEl.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        if (wasClick) {
          const node = byId.get(id);
          if (node) onSelect(nodes.find((nn) => nn.id === node.id) ?? (node as unknown as KgNode));
        }
        return;
      }
      // 非拖拽的点击空白：选中 hover 节点
      const hit = pick(p.x, p.y);
      if (hit) onSelect(nodes.find((nn) => nn.id === hit.id) ?? (hit as unknown as KgNode));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', () => {
      if (!st.dragId && st.hoverId !== null) {
        st.hoverId = null;
        cancelAnimationFrame(st.raf);
        draw();
      }
    });

    return () => {
      cancelAnimationFrame(st.raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, focusId]);

  return (
    <div ref={wrapRef} className="kg-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
