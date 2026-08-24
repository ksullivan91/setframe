import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { spacing } from '@setframe/design-tokens';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { useScrollLock } from '../lib/useScrollLock';

export interface ModalProps {
  /** Whether the modal is currently shown. Nothing renders when false. */
  open: boolean;
  /** Called when the user requests to close (Esc, backdrop click, close button). */
  onClose: () => void;
  /** Rendered as the dialog's accessible name (`aria-labelledby`). */
  title: ReactNode;
  /** Optional supporting text under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Max-width of the dialog card; defaults to 480px. */
  maxWidth?: number;
}

/**
 * Below this width the dialog behaves as a near-full-screen bottom
 * sheet instead of a centered card (Story 05) — mobile Safari's
 * browser chrome eats into small-viewport centered dialogs, and a
 * sheet anchored to the bottom edge scrolls more predictably.
 */
const MOBILE_SHEET_BREAKPOINT = 640;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[16]}px;
  z-index: 1000;

  @media (max-width: ${MOBILE_SHEET_BREAKPOINT}px) {
    align-items: flex-end;
    padding: 0;
  }
`;

const DialogCard = styled(Card)<{ $maxWidth: number }>`
  width: min(${(p) => p.$maxWidth}px, 100%);
  /* vh first as a fallback for browsers without dvh support; dvh (where
     supported) tracks the real visible viewport, so the sheet resizes
     with the iOS keyboard/chrome instead of being cropped by them. */
  max-height: 90vh;
  max-height: 90dvh;
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;

  @media (max-width: ${MOBILE_SHEET_BREAKPOINT}px) {
    width: 100%;
    max-height: 85vh;
    max-height: 85dvh;
    border-radius: 16px 16px 0 0;
    padding-bottom: max(${spacing[16]}px, env(safe-area-inset-bottom));
    /* Story 29 — this used to floor at 0px instead of Card's own base
       inset, so a notched device's safe-area-inset-left/right (usually 0
       in portrait) replaced the horizontal padding entirely instead of
       extending it, leaving content edge-to-edge. */
    padding-left: max(${spacing[16]}px, env(safe-area-inset-left));
    padding-right: max(${spacing[16]}px, env(safe-area-inset-right));
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing[12]}px;

  @media (max-width: ${MOBILE_SHEET_BREAKPOINT}px) {
    position: sticky;
    top: 0;
    background: ${(p) => p.theme.surface.raised};
    padding-bottom: ${spacing[8]}px;
    z-index: 1;
  }
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
`;

const Description = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: 0.875rem;
`;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal — reusable accessible dialog primitive (style guide follow-up:
 * previously every "modal" in the app was a page-local `styled(Card)`
 * with hand-rolled Esc/focus handling, e.g. TodayPage's Preview dialog).
 * Provides: `role="dialog"`/`aria-modal`/`aria-labelledby`/
 * `aria-describedby`, Esc-to-close, backdrop-click-to-close, focus
 * moved to the dialog on open, a rudimentary focus trap (Tab/Shift+Tab
 * wraps within the dialog), and focus restored to the trigger on close.
 */
export function Modal({ open, onClose, title, description, children, maxWidth = 480 }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
    // Focus capture/restore should only run when `open` toggles, not when
    // callers pass a fresh `onClose` reference on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <Backdrop onClick={onClose}>
      <DialogCard
        ref={dialogRef}
        $maxWidth={maxWidth}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <Header>
          <TitleGroup>
            <Title id={titleId}>{title}</Title>
            {description ? <Description id={descriptionId}>{description}</Description> : null}
          </TitleGroup>
          <IconButton ref={closeButtonRef} aria-label="Close dialog" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </Header>
        {children}
      </DialogCard>
    </Backdrop>,
    document.body,
  );
}
