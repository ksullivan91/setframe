import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalDate } from './useLocalDate';

/**
 * Regression coverage for Story 07 (morning weight date-scoping bug):
 * a plain `todayLocalDate()` call only evaluates once per render, so a
 * user who leaves the Today page open across midnight would keep seeing
 * yesterday's local date — and, downstream, yesterday's completion state
 * — until an unrelated re-render happened to occur. `useLocalDate` must
 * re-evaluate on its own so the date (and everything keyed on it) rolls
 * over correctly without requiring a page reload.
 */
describe('useLocalDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current local date on mount', () => {
    vi.setSystemTime(new Date('2026-08-21T23:58:00'));
    const { result } = renderHook(() => useLocalDate());
    expect(result.current).toBe('2026-08-21');
  });

  it('rolls over to the next local date after midnight without a remount', () => {
    vi.setSystemTime(new Date('2026-08-21T23:58:00'));
    const { result } = renderHook(() => useLocalDate());
    expect(result.current).toBe('2026-08-21');

    // Advance past midnight; the hook's internal interval should pick up
    // the new day even though nothing else re-rendered the component.
    act(() => {
      vi.setSystemTime(new Date('2026-08-22T00:03:00'));
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe('2026-08-22');
  });

  it('rolls over when the tab regains visibility after a day boundary', () => {
    vi.setSystemTime(new Date('2026-08-21T23:59:30'));
    const { result } = renderHook(() => useLocalDate());
    expect(result.current).toBe('2026-08-21');

    act(() => {
      vi.setSystemTime(new Date('2026-08-22T08:00:00'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current).toBe('2026-08-22');
  });
});
