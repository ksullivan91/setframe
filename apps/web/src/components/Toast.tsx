import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

export type ToastVariant = 'success' | 'error';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  /** Only shown for error toasts — e.g. "Retry now" per style guide §8 offline strategy. */
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
  min-width: 240px;
`;

const RetryButton = styled.button`
  margin-left: auto;
  background: none;
  border: none;
  color: ${(p) => p.theme.status.error};
  font-weight: 600;
  cursor: pointer;
`;

/** ToastProvider — mount once near the app root, then call `useToast().show(...)`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastStack role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} $variant={t.variant}>
            {t.variant === 'success' ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <AlertCircle size={18} aria-hidden="true" />
            )}
            {t.message}
            {t.variant === 'error' && t.actionLabel ? (
              <RetryButton onClick={t.onAction}>{t.actionLabel}</RetryButton>
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
