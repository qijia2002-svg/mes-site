/**
 * 离线 / 弱网横幅：监听 online/offline 事件，断网时顶部提示，
 * 让用户明白"为什么数据停在旧状态 / 加载不出来"，而不是看到一堆报错。
 * 配合 main.tsx 的 networkMode:'always' + refetchOnReconnect 使用。
 */
import { useEffect, useState } from 'react';

export function NetworkBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky, 50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        background: 'var(--warn-soft)',
        color: 'var(--warn)',
        borderBottom: '1px solid var(--warn-border)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--warn)',
          display: 'inline-block',
        }}
      />
      网络已断开，正在尝试恢复…数据会在重新连接后自动刷新
    </div>
  );
}
