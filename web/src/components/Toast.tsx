/**
 * Toast 通知系统：居中底部、深底白字、圆角 pill、自动 2s 消失。
 * 使用 React Context + Portal，全局单例。
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _nextId = 0;

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setVisible(true));
    // 2s 后开始退出
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDone(toast.id), 300);
    }, 2000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onDone, toast.id]);

  const bg =
    toast.type === 'success' ? 'var(--success)'
    : toast.type === 'error' ? 'var(--danger)'
    : 'var(--ink-solid)';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: bg,
        color: '#fff',
        fontSize: 'var(--text-sm)',
        padding: 'var(--space-2) var(--space-5)',
        borderRadius: 'var(--radius-pill)',
        boxShadow: 'var(--elev-dropdown)',
        whiteSpace: 'nowrap',
        maxWidth: '90vw',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.2s var(--ease-standard), transform 0.2s var(--ease-standard)',
        pointerEvents: 'auto',
      }}
    >
      {toast.message}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 'var(--z-toast)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDone={removeToast} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
