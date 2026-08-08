/**
 * 工厂节点详情抽屉（由 NodeStation 平移改造，内联面板正式退休）。
 *
 * 为什么是抽屉：内联展开会把下方节点顶走，地图位置漂移；抽屉 createPortal 到 body，
 * 与 grid 彻底解耦，点节点时地图纹丝不动。
 *
 * 三档形态：
 *   ≥1024px  side    右侧 min(420px,38vw)，无遮罩、non-modal，可继续点地图切节点
 *   768–1023 overlay 右侧 420px + 遮罩 + aria-modal
 *   <768     sheet   底部 86vh + 遮罩 + 锁 body 滚动
 * 关闭：Esc / 遮罩 / 关闭按钮 / 再点同节点（由父级 toggle）/ 路由跳走（卸载）。
 * 焦点：开时移入抽屉标题，关时归还触发它的那个按钮。
 * 动效：只动 transform + opacity，var(--motion-slow) var(--ease-standard)，无 bounce；
 *       prefers-reduced-motion 下由 CSS 降为纯 opacity 且 JS 不再等退场。
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon, isIconName, type IconName } from '../../components/Icon';
import type { NodeResourceDTO } from '../../api/endpoints';
import { PHASE_LABEL, type LaidNode } from './factoryFlow.data';
import NodeDrawerBody from './NodeDrawerBody';

const KIND_LABEL: Record<string, string> = {
  entry: '流程起点',
  exit: '流程终点',
  process: '生产环节',
};

type DrawerLayout = 'side' | 'overlay' | 'sheet';

function readLayout(): DrawerLayout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'side';
  if (window.matchMedia('(max-width: 767px)').matches) return 'sheet';
  return window.matchMedia('(min-width: 1024px)').matches ? 'side' : 'overlay';
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 视口档位。断点变化实时跟随，不需要重新打开抽屉。 */
function useDrawerLayout(): DrawerLayout {
  const [layout, setLayout] = useState<DrawerLayout>(readLayout);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const narrow = window.matchMedia('(max-width: 767px)');
    const sync = () => setLayout(readLayout());
    sync();
    wide.addEventListener('change', sync);
    narrow.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      narrow.removeEventListener('change', sync);
    };
  }, []);
  return layout;
}

export interface NodeDrawerProps {
  node: LaidNode;
  resources: NodeResourceDTO[];
  isDone: (type: string, refId: number) => boolean;
  practiced: boolean;
  prev: LaidNode | null;
  next: LaidNode | null;
  /** 父级请求关闭的信号量（如「再点一次同一个节点」），每 +1 触发一次带退场动画的关闭。 */
  closeSignal: number;
  onNavigate: (key: string) => void;
  onClose: () => void;
}

export default function NodeDrawer({
  node, resources, isDone, practiced, prev, next, closeSignal, onNavigate, onClose,
}: NodeDrawerProps) {
  const layout = useDrawerLayout();
  const modal = layout !== 'side';
  const panelRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [shown, setShown] = useState(false);

  // 入场：先渲染在关闭位，下一帧再切 open，否则 transform 过渡不会发生。
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 退场后再真正卸载，让 transform 走完；reduced-motion 直接关。
  const requestClose = useCallback(() => {
    setShown(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(onClose, reducedMotion() ? 0 : 320);
  }, [onClose]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // 父级信号关闭：走同一条退场路径，别让「再点同节点」变成瞬间消失。
  const handledSignal = useRef(closeSignal);
  useEffect(() => {
    if (closeSignal === handledSignal.current) return;
    handledSignal.current = closeSignal;
    requestClose();
  });

  // 换节点：撤销待关闭、重新展开，并把焦点送进新标题。
  useEffect(() => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
      setShown(true);
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && !panelRef.current?.contains(active)) {
      triggerRef.current = active;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [node.key]);

  // 关闭后把焦点还给触发它的按钮（节点卡片或「从这里继续」）。
  useEffect(
    () => () => {
      const trigger = triggerRef.current;
      if (trigger && document.body.contains(trigger)) trigger.focus({ preventScroll: true });
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  // 底部 sheet 是全屏遮挡态，锁住 body 滚动避免背景跟着滑。
  useEffect(() => {
    if (layout !== 'sheet') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [layout]);

  // modal 档位把 Tab 圈在抽屉内；side 档位是 non-modal，Tab 可以走回地图。
  const trapTab = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || !modal) return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const glyph: IconName = isIconName(node.icon) ? node.icon : 'process';

  return createPortal(
    <>
      {modal && (
        <div
          className={`nd-scrim${shown ? ' is-open' : ''}`}
          aria-hidden="true"
          onClick={requestClose}
        />
      )}
      <aside
        ref={panelRef}
        className={`nd nd-${layout}${shown ? ' is-open' : ''}`}
        role="dialog"
        aria-modal={modal || undefined}
        aria-labelledby="nd-title"
        onKeyDown={trapTab}
      >
        <header className="nd-head">
          <span className="nd-mark"><Icon name={glyph} size={20} /></span>
          <div className="nd-title">
            <h2 id="nd-title" ref={titleRef} tabIndex={-1}>{node.label}</h2>
            <div className="nd-sub">
              <span className="nd-dot" style={{ background: `var(--phase-${node.phase})` }} />
              <span>{PHASE_LABEL[node.phase]}</span>
              <span className="nd-sep">·</span>
              <span>{KIND_LABEL[node.kind] ?? '生产环节'}</span>
              <span className="nd-sep">·</span>
              <span className={practiced ? 'nd-ok' : undefined}>{practiced ? '已练过' : '未练'}</span>
            </div>
          </div>
          <button type="button" className="nd-close" onClick={requestClose} aria-label="关闭环节详情">
            <Icon name="close" size={20} />
          </button>
        </header>

        <NodeDrawerBody node={node} resources={resources} isDone={isDone} />

        <footer className="nd-foot">
          <button
            type="button"
            className="nd-step"
            disabled={!prev}
            onClick={() => prev && onNavigate(prev.key)}
          >
            <Icon name="chevron-left" size={16} />
            <span>{prev ? prev.label : '上一环节'}</span>
          </button>
          <button
            type="button"
            className="nd-step"
            disabled={!next}
            onClick={() => next && onNavigate(next.key)}
          >
            <span>{next ? next.label : '下一环节'}</span>
            <Icon name="chevron-right" size={16} />
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
