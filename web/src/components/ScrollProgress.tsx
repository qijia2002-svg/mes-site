/**
 * 页面滚动进度条：fixed top-0，2px 渐变条。
 * 参考 zhizao-academy.html 的 scroll-progress。
 */
import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight <= 0) {
        setPct(0);
        return;
      }
      setPct(Math.min(100, (scrollTop / scrollHeight) * 100));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="页面阅读进度"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 2,
        width: `${pct}%`,
        background: `linear-gradient(90deg, var(--accent), var(--accent-hover))`,
        zIndex: 'var(--z-toast)',
        transition: 'width 0.1s linear',
      }}
    />
  );
}
