import { useEffect } from 'react';

/**
 * Locks background scroll while `active`, using the iOS-safe
 * `position: fixed` body lock — a plain `overflow: hidden` on `body`
 * doesn't reliably stop background scroll on iOS Safari once a touch
 * has already started inside a nested scroll container (Story 20).
 * Restores the exact prior scroll position on unlock.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
