import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAsyncStatusOptions {
  /** How long the "Saved" success state stays visible before returning to idle. Default 2000ms. */
  successDurationMs?: number;
}

export interface UseAsyncStatusResult {
  status: AsyncStatus;
  /** Wrap an async action (e.g. an autosave call) to drive status transitions automatically. */
  run: (action: () => Promise<unknown>) => Promise<void>;
  reset: () => void;
}

/**
 * useAsyncStatus — shared idle/loading/success/error state machine for
 * inline async actions (autosave, quick edits), per
 * user-experience-redesign.md §29-30. Pair with `<AsyncStatusIndicator />`
 * for the visible "Saving…"/"Saved"/"Couldn't save"/"Retry" copy. For
 * one-off notifications rather than inline field status, prefer the
 * existing `useToast()` instead.
 */
export function useAsyncStatus(options: UseAsyncStatusOptions = {}): UseAsyncStatusResult {
  const { successDurationMs = 2000 } = options;
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      clearTimeout(timeoutRef.current);
      setStatus('loading');
      try {
        await action();
        setStatus('success');
        timeoutRef.current = setTimeout(() => setStatus('idle'), successDurationMs);
      } catch {
        setStatus('error');
      }
    },
    [successDurationMs],
  );

  const reset = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setStatus('idle');
  }, []);

  return { status, run, reset };
}

export interface AsyncStatusIndicatorProps {
  status: AsyncStatus;
  /** Called when the user clicks "Retry" in the error state. */
  onRetry?: () => void;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  /** Suppress the "Saved" success text — use when a paired Button already
   * shows a checkmark morph for the same action, so the two don't repeat
   * the same confirmation. Loading/error states still render normally. */
  hideSuccess?: boolean;
}

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]}px;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const SuccessIcon = styled(Check)`
  color: ${(p) => p.theme.status.success};
`;

const ErrorIcon = styled(AlertCircle)`
  color: ${(p) => p.theme.status.error};
`;

const RetryLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: ${(p) => p.theme.status.error};
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
`;

const SpinIcon = styled(Loader2)`
  animation: spin 0.8s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

/**
 * AsyncStatusIndicator — renders inline "Saving…"/"Saved"/"Couldn't save,
 * Retry" copy with `role="status"`/`aria-live="polite"` so screen-reader
 * users get non-intrusive updates without a full toast (W3C ARIA22
 * status-message technique). Renders nothing while idle.
 */
export function AsyncStatusIndicator({
  status,
  onRetry,
  loadingLabel = 'Saving…',
  successLabel = 'Saved',
  errorLabel = "Couldn't save",
  hideSuccess = false,
}: AsyncStatusIndicatorProps) {
  if (status === 'idle') return null;
  if (status === 'success' && hideSuccess) return null;

  return (
    <Wrapper role="status" aria-live="polite">
      {status === 'loading' ? (
        <>
          <SpinIcon size={14} aria-hidden="true" />
          {loadingLabel}
        </>
      ) : null}
      {status === 'success' ? (
        <>
          <SuccessIcon size={14} aria-hidden="true" />
          {successLabel}
        </>
      ) : null}
      {status === 'error' ? (
        <>
          <ErrorIcon size={14} aria-hidden="true" />
          {errorLabel}
          {onRetry ? <RetryLink onClick={onRetry}>Retry</RetryLink> : null}
        </>
      ) : null}
    </Wrapper>
  );
}
