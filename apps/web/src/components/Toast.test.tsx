import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { ToastProvider, useToast } from './Toast';

function Trigger({ onAction }: { onAction: () => void }) {
  const toast = useToast();
  return (
    <button
      onClick={() => toast.show({ variant: 'success', message: 'Exercise removed.', actionLabel: 'Undo', onAction })}
    >
      remove
    </button>
  );
}

describe('Toast', () => {
  it('offers an action on success toasts so removals can be undone', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <ThemeProvider theme={getTheme('light')}>
        <ToastProvider>
          <Trigger onAction={onAction} />
        </ToastProvider>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'remove' }));
    expect(await screen.findByText('Exercise removed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledOnce();

    // Acting on a toast dismisses it, so "Undo" can't be fired twice.
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('keeps an action-bearing toast alive long enough to reach the action', async () => {
    vi.useFakeTimers();
    try {
      render(
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <Trigger onAction={vi.fn()} />
          </ToastProvider>
        </ThemeProvider>,
      );

      act(() => screen.getByRole('button', { name: 'remove' }).click());
      expect(screen.getByText('Exercise removed.')).toBeInTheDocument();

      // A plain toast would already be gone at 5s.
      act(() => void vi.advanceTimersByTime(6000));
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();

      act(() => void vi.advanceTimersByTime(20000));
      expect(screen.queryByText('Exercise removed.')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
