import { useCallback, useState } from 'react';
import { Toast } from '../components/Toast';

/**
 * A shared error surface for mutations.
 *
 * An audit found 14 mutations with no `onError` and no pending state —
 * Finish workout, Start workout, Add exercises, Save prescription, Assign
 * day, Change units among them. Every one of those buttons did nothing
 * visible when its request failed, which is indistinguishable from a
 * control that was never wired up, and is exactly how several bugs were
 * reported here ("clicking add to today DOES NOTHING", "Use this plan
 * doesn't do anything").
 *
 * Writing `onError` by hand at every call site is what did not happen, so
 * this makes the correct thing a one-liner:
 *
 *   const feedback = useActionFeedback();
 *   useMutation({ ..., onError: feedback.report('Could not save.') });
 *   ...
 *   {feedback.node}
 *
 * Deliberately not a global toast host: a failure belongs on the screen
 * that caused it, and a screen that forgets to render `node` should be
 * visibly missing its errors rather than quietly posting them elsewhere.
 */
export function useActionFeedback() {
  const [message, setMessage] = useState<string | null>(null);

  /** Returns a handler, so it reads as `onError: report('...')`. */
  const report = useCallback((text: string) => () => setMessage(text), []);
  const clear = useCallback(() => setMessage(null), []);

  const node = message ? (
    <Toast variant="error" message={message} onDismiss={clear} />
  ) : null;

  return { report, clear, node, message };
}
