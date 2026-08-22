import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useLocalDate } from '../lib/useLocalDate';

/**
 * Regression coverage for Story 07 (morning weight date-scoping bug):
 * a plain `todayLocalDate()` call only evaluates once per render, so a
 * user who leaves the Today screen open/backgrounded across midnight
 * would keep seeing yesterday's local date — and, downstream,
 * yesterday's completion state — until an unrelated re-render happened
 * to occur. `useLocalDate` must re-evaluate on its own so the date (and
 * everything keyed on it) rolls over correctly without an app restart.
 */
function LocalDateProbe() {
  const localDate = useLocalDate();
  return <Text testID="local-date">{localDate}</Text>;
}

describe('useLocalDate (mobile)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current local date on mount', () => {
    jest.setSystemTime(new Date('2026-08-21T23:58:00'));
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<LocalDateProbe />);
    });
    expect(tree!.root.findByProps({ testID: 'local-date' }).props.children).toBe('2026-08-21');
  });

  it('rolls over to the next local date after midnight without a remount', () => {
    jest.setSystemTime(new Date('2026-08-21T23:58:00'));
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<LocalDateProbe />);
    });
    expect(tree!.root.findByProps({ testID: 'local-date' }).props.children).toBe('2026-08-21');

    act(() => {
      jest.setSystemTime(new Date('2026-08-22T00:03:00'));
      jest.advanceTimersByTime(60_000);
    });

    expect(tree!.root.findByProps({ testID: 'local-date' }).props.children).toBe('2026-08-22');
  });

  it('rolls over when the app returns to the foreground after a day boundary', () => {
    jest.setSystemTime(new Date('2026-08-21T23:59:30'));

    let changeListener: ((state: string) => void) | undefined;
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'change') changeListener = listener as (state: string) => void;
        return { remove: jest.fn() };
      });

    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(<LocalDateProbe />);
    });
    expect(tree!.root.findByProps({ testID: 'local-date' }).props.children).toBe('2026-08-21');

    act(() => {
      jest.setSystemTime(new Date('2026-08-22T08:00:00'));
      changeListener?.('active');
    });

    expect(tree!.root.findByProps({ testID: 'local-date' }).props.children).toBe('2026-08-22');
    addEventListenerSpy.mockRestore();
  });
});
