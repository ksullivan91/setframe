import { useEffect } from 'react';

/**
 * Module-level lock count, shared across every `useScrollLock` caller.
 * `Modal` is one shared primitive used by several dialogs on the same
 * page (e.g. Guided Setup's `AddExercisePicker` and `ExerciseEditModal`);
 * without reference counting, whichever modal closed first would restore
 * `body`'s pre-lock style and silently unlock the page while a second
 * modal was still open. Only the first lock applies the style, and only
 * the last unlock restores it.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyle = { position: '', top: '', width: '' };

/**
 * Locks background scroll while `active`, using the iOS-safe
 * `position: fixed` body lock — a plain `overflow: hidden` on `body`
 * doesn't reliably stop background scroll on iOS Safari once a touch
 * has already started inside a nested scroll container (Story 20).
 * Restores the exact prior scroll position once every lock releases.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      const { body } = document;
      savedStyle = { position: body.style.position, top: body.style.top, width: body.style.width };
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.width = '100%';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount > 0) return;

      const { body } = document;
      body.style.position = savedStyle.position;
      body.style.top = savedStyle.top;
      body.style.width = savedStyle.width;
      window.scrollTo(0, savedScrollY);
    };
  }, [active]);
}
