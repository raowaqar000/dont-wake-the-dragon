/**
 * Blocks browser behaviors that break a touchscreen game:
 * long-press menus, pinch/double-tap zoom, text selection and page scrolling.
 * CSS (touch-action / overscroll-behavior) covers most of this; these are backups
 * for WebViews and browsers that ignore it.
 */
export function installMobileGuards(): void {
  const prevent = (e: Event): void => {
    e.preventDefault();
  };
  const nonPassive: AddEventListenerOptions = { passive: false };

  document.addEventListener('contextmenu', prevent);
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dblclick', prevent);

  // Page scroll / pull-to-refresh.
  document.addEventListener('touchmove', prevent, nonPassive);

  // Multi-finger zoom.
  document.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    nonPassive,
  );

  // iOS Safari pinch gestures.
  document.addEventListener('gesturestart', prevent, nonPassive);
  document.addEventListener('gesturechange', prevent, nonPassive);
}
