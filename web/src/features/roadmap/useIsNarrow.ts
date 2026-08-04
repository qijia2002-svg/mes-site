/**
 * 是否处于手机断点（<768px）。
 *
 * 用 JS 判断而非纯 CSS，是因为移动端降级要求 SVG 连线层**整段不挂载**
 * （UIUX §3.5 / §4.2）——`display:none` 仍会进无障碍树、仍要算 layout，
 * 而路径图的连线对读屏毫无价值。CSS 做不到"不挂载"。
 */
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

function readMatch(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(readMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mql.addEventListener('change', onChange);
    // 挂载与首帧之间断点可能已变（旋转屏 / 拖窗口），补一次同步
    setNarrow(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return narrow;
}

/** `scrollIntoView` 是 JS 行为，全局 reduced-motion 兜底管不着，必须手动判（UIUX §7.2）。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
