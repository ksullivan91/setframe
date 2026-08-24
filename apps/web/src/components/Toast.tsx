import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

export type ToastVariant = 'success' | 'error';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  /** e.g. "Retry now" per style guide §8 offline strategy, or "Undo" after a removal. */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  show: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ToastStack = styled.div`
  position: fixed;
  bottom: ${spacing[24]}px;
  right: ${spacing[24]}px;
  /* Story 35 — anchoring only from the right with a min-width and no cap
     let a long enough message push the box's left edge off a narrow
     mobile viewport (position: fixed elements still count toward document
     scrollWidth even though they're visually clipped from view). An
     explicit max-width — not just a matching left offset, which a flex
     container with unconstrained content doesn't reliably respect for
     auto-resolving position:fixed width — keeps it viewport-safe. */
  max-width: calc(100vw - ${spacing[24]}px - ${spacing[16]}px);
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
  z-index: 1000;
`;

const ToastItem = styled.div<{ $variant: ToastVariant }>`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[12]}px ${spacing[16]}px;
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.inverse};
  background: ${(p) => (p.$variant === 'error' ? p.theme.text.primary : p.theme.status.success)};
  font-size: ${typeScale.body.fontSize}px;
  min-width: min(240px, 100%);
  max-width: 100%;
`;

const ActionButton = styled.button`
  margin-left: auto;
  background: none;
  border: none;
  /* Both toast variants use a dark/saturated fill, so the inverse text
     colour is the only one that stays legible on each. */
  color: ${(p) => p.theme.text.inverse};
  text-decoration: underline;
  font-weight: 600;
  cursor: pointer;
  padding: ${spacing[4]}px ${spacing[8]}px;
  min-height: 32px;
`;

/** ToastProvider — mount once near the app root, then call `useToast().show(...)`. */
const DISMISS_MS = 5000;
/**
 * An action-bearing toast is the only route to that action — most
 * importantly "Undo" after a removal. Five seconds isn't enough to reach a
 * button that sits at the end of the tab order and is announced by a polite
 * live region, so give those toasts a longer life (WCAG 2.2.1).
 */
const ACTIONABLE_DISMISS_MS = 20000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...toast, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), toast.actionLabel ? ACTIONABLE_DISMISS_MS : DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Pointer or keyboard focus on a toast pauses its countdown, so the action
  // can't disappear out from under someone who is reaching for it.
  const pause = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastStack role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            $variant={t.variant}
            onMouseEnter={() => pause(t.id)}
            onFocus={() => pause(t.id)}
          >
            {t.variant === 'success' ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <AlertCircle size={18} aria-hidden="true" />
            )}
            {t.message}
            {t.actionLabel ? (
              <ActionButton
                onClick={() => {
                  // Dismiss first so a double-click can't fire the action twice.
                  dismiss(t.id);
                  t.onAction?.();
                }}
              >
                {t.actionLabel}
              </ActionButton>
            ) : null}
          </ToastItem>
        ))}
      </ToastStack>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
