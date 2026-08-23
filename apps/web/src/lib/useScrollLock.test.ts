import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollLock } from './useScrollLock';

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing while inactive', () => {
    renderHook(() => useScrollLock(false));
    expect(document.body.style.position).toBe('');
  });

  it('locks the body at the current scroll position while active', () => {
    renderHook(() => useScrollLock(true));
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-240px');
    expect(document.body.style.width).toBe('100%');
  });

  it('restores the prior style and scroll position on deactivation', () => {
    const { rerender } = renderHook(({ active }) => useScrollLock(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });

    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.width).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it('restores on unmount, not just on the active flag flipping', () => {
    const { unmount } = renderHook(() => useScrollLock(true));
    unmount();

    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it('keeps the page locked while a second lock is still active (two modals open at once)', () => {
    const first = renderHook(() => useScrollLock(true));
    const second = renderHook(() => useScrollLock(true));

    first.unmount();
    // The first modal closing must not unlock the page — the second is
    // still open. This is the exact bug a non-reference-counted lock has.
    expect(document.body.style.position).toBe('fixed');

    second.unmount();
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });
});
