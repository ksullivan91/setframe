import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Toast } from '../components/Toast';

/**
 * The toast never went away.
 *
 * Its only exit was a tap, and a caller that passed no `onDismiss` produced
 * one that could not be dismissed at all — so every confirmation and every
 * error stayed on screen for the rest of the session. It went unnoticed
 * because no test rendered it, and because the component looks complete:
 * it has an `onDismiss` prop, it just never called it itself.
 */
let tree: ReactTestRenderer | null = null;

function render(node: React.ReactElement) {
  act(() => {
    tree = create(<ThemeProvider>{node}</ThemeProvider>);
  });
  return tree!;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => {
    tree?.unmount();
  });
  tree = null;
  jest.useRealTimers();
});

it('clears itself without being tapped', () => {
  const onDismiss = jest.fn();
  render(<Toast variant="success" message="Added from Apple Health." onDismiss={onDismiss} />);

  expect(onDismiss).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('gives an error longer to be read than a confirmation', () => {
  const onDismiss = jest.fn();
  render(<Toast variant="error" message="Could not remove activity." onDismiss={onDismiss} />);

  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('survives a caller that passes a new function every render', () => {
  /* The subtle version of the same bug: callers write
     `onDismiss={() => setToast(null)}`, a fresh function each render. If the
     timer depended on that identity it would reset continuously and never
     fire — the component would look fixed and behave exactly as before. */
  const onDismiss = jest.fn();
  const rendered = render(<Toast variant="success" message="Saved." onDismiss={() => onDismiss()} />);

  act(() => {
    jest.advanceTimersByTime(1500);
  });
  act(() => {
    rendered.update(
      <ThemeProvider>
        <Toast variant="success" message="Saved." onDismiss={() => onDismiss()} />
      </ThemeProvider>,
    );
  });
  act(() => {
    jest.advanceTimersByTime(1500);
  });

  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('waits for a decision when it offers one', () => {
  /* A toast with a retry action should not vanish mid-reach. */
  const onDismiss = jest.fn();
  render(
    <Toast
      variant="error"
      message="Could not save."
      actionLabel="Retry now"
      onAction={jest.fn()}
      onDismiss={onDismiss}
    />,
  );

  act(() => {
    jest.advanceTimersByTime(20000);
  });
  expect(onDismiss).not.toHaveBeenCalled();
});

it('restarts the clock when a second message replaces the first', () => {
  const onDismiss = jest.fn();
  const rendered = render(<Toast variant="success" message="First." onDismiss={onDismiss} />);

  act(() => {
    jest.advanceTimersByTime(2000);
  });
  act(() => {
    rendered.update(
      <ThemeProvider>
        <Toast variant="success" message="Second." onDismiss={onDismiss} />
      </ThemeProvider>,
    );
  });
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  // The first toast's remaining 1s must not dismiss the second.
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
