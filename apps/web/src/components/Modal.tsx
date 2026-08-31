import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled, { css } from 'styled-components';
import { X } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { IconButton } from './IconButton';
import { typeScale } from '../theme/typeScale';
import { useScrollLock } from '../lib/useScrollLock';

/**
 * Setframe's one web dialog primitive. See `docs/design/web-modal-standard.md`
 * for the reasoning; this file implements it.
 *
 * Stories 64-66. The previous version chose its shape from the *breakpoint*:
 * below 640px every dialog became a bottom sheet capped at 85dvh. That is
 * correct for a short list of choices and wrong for everything else, and it
 * produced the reported "two sheets" defect — a form that does not fill 85% of
 * the viewport is a rounded white slab with the app's own white cards still
 * visible above it. Two stacked light surfaces read as two sheets, because
 * visually that is what they are.
 *
 * So the shape now follows the *task*. `presentation` is required rather than
 * defaulted: a caller should not be able to produce a bottom-sheet form by
 * omitting a prop, which is exactly how the old behaviour spread.
 */

/** Below this width, presentation actually diverges. */
const COMPACT_BREAKPOINT = 640;

export type ModalPresentation =
  /**
   * Forms, searchable pickers, anything that raises the keyboard or grows
   * dynamically. Fills the viewport on compact screens so there is no strip
   * of application left to read as a second surface.
   */
  | 'task'
  /**
   * Confirmations and short decisions. Stays centred and sized to its content
   * at every width — a two-sentence confirmation filling an iPhone is as
   * wrong as a form crammed into a drawer.
   */
  | 'compact'
  /**
   * A short list of contextual choices tied to one action. The only
   * presentation that is still a bottom sheet, and never a scrolling form.
   */
  | 'actions';

const Backdrop = styled.div<{ $presentation: ModalPresentation }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing[16]}px;
  z-index: 1000;

  @media (max-width: ${COMPACT_BREAKPOINT}px) {
    ${(p) =>
      p.$presentation === 'actions'
        ? css`
            align-items: flex-end;
            padding: 0;
          `
        : p.$presentation === 'task'
          ? css`
              padding: 0;
            `
          : css`
              /* compact keeps its centred inset so a confirmation reads as
                 a decision rather than as a destination. */
              padding: ${spacing[16]}px;
            `}
  }
`;

/**
 * The dialog surface.
 *
 * Deliberately not built on `Card`. `Card` carries its own padding, radius
 * and background, which is right for content in a page and wrong here: a
 * full-viewport task dialog must have no radius and no outer padding, and its
 * padding belongs to the scrolling region so a fixed header does not scroll
 * its own inset away.
 *
 * `dvh` with a `vh` fallback, never `100vh` alone: in mobile Safari `100vh`
 * is the viewport *without* browser chrome, so a `100vh` dialog is taller
 * than the screen and its footer is unreachable.
 */
const Surface = styled.div<{ $presentation: ModalPresentation; $maxWidth: number }>`
  display: flex;
  flex-direction: column;
  /* min-height:0 so the scrolling child can actually shrink; without it a
     flex item refuses to go below its content height and the *page* scrolls
     instead of the content region. */
  min-height: 0;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  border-radius: ${radius.large}px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
  width: min(${(p) => p.$maxWidth}px, 100%);
  max-height: 90vh;
  max-height: 90dvh;

  @media (max-width: ${COMPACT_BREAKPOINT}px) {
    ${(p) =>
      p.$presentation === 'task'
        ? css`
            /* One surface, the whole viewport. This is what removes the
               "second sheet": there is no application left showing. */
            width: 100%;
            max-width: none;
            height: 100vh;
            height: 100dvh;
            max-height: none;
            border-radius: 0;
            box-shadow: none;
          `
        : p.$presentation === 'actions'
          ? css`
              width: 100%;
              max-height: 60vh;
              max-height: 60dvh;
              border-radius: ${radius.large}px ${radius.large}px 0 0;
            `
          : css`
              width: min(${p.$maxWidth}px, 100%);
              max-height: 85vh;
              max-height: 85dvh;
            `}
  }
`;

/** Fixed while the content scrolls beneath it, so Close is always reachable. */
const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  flex: none;
  padding: ${spacing[16]}px;
  /* Safe-area insets *extend* the padding rather than replacing it. Using the
     inset alone leaves content edge-to-edge in portrait, where it is 0 — a
     bug this repo already fixed once (story 29). */
  padding-left: max(${spacing[16]}px, env(safe-area-inset-left));
  padding-right: max(${spacing[16]}px, env(safe-area-inset-right));
  padding-top: max(${spacing[16]}px, env(safe-area-inset-top));
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
  font-weight: ${typeScale.sectionTitle.fontWeight};
  /* A long exercise name must wrap rather than push the close button off. */
  overflow-wrap: anywhere;
`;

const Description = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

/**
 * The single scroll container. Exactly one element owns vertical scrolling
 * for a dialog — nested scrolling is what produces "which thing am I
 * scrolling" and the detached visual states this rework exists to remove.
 */
const Content = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
  padding: 0 ${spacing[16]}px ${spacing[16]}px;
  padding-left: max(${spacing[16]}px, env(safe-area-inset-left));
  padding-right: max(${spacing[16]}px, env(safe-area-inset-right));
`;

/** Sticky actions for long task dialogs, kept clear of the home indicator. */
const Footer = styled.div`
  flex: none;
  display: flex;
  gap: ${spacing[8]}px;
  justify-content: flex-end;
  padding: ${spacing[12]}px ${spacing[16]}px;
  padding-left: max(${spacing[16]}px, env(safe-area-inset-left));
  padding-right: max(${spacing[16]}px, env(safe-area-inset-right));
  padding-bottom: max(${spacing[12]}px, env(safe-area-inset-bottom));
  border-top: 1px solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
`;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  /** Whether the modal is currently shown. Nothing renders when false. */
  open: boolean;
  /** Called when the user requests to close (Esc, backdrop click, close button). */
  onClose: () => void;
  /**
   * How this dialog should present itself. Required on purpose — see the
   * module comment. Pick from the task, not from the screen size.
   */
  presentation: ModalPresentation;
  /** Rendered as the dialog's accessible name (`aria-labelledby`). */
  title: ReactNode;
  /** Optional supporting text under the title. */
  description?: ReactNode;
  children: ReactNode;
  /**
   * Actions pinned below the scrolling content. Use for a long task dialog
   * whose primary action would otherwise be scrolled out of reach.
   */
  footer?: ReactNode;
  /** Max-width for the centred presentations; ignored by a full-screen task. */
  maxWidth?: number;
}

export function Modal({
  open,
  onClose,
  presentation,
  title,
  description,
  children,
  footer,
  maxWidth = 480,
}: ModalProps) {
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
    <Backdrop $presentation={presentation} onClick={onClose} data-testid="modal-backdrop">
      <Surface
        ref={dialogRef}
        $presentation={presentation}
        $maxWidth={maxWidth}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-presentation={presentation}
        data-testid="modal-surface"
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
        <Content data-testid="modal-content">{children}</Content>
        {footer ? <Footer data-testid="modal-footer">{footer}</Footer> : null}
      </Surface>
    </Backdrop>,
    document.body,
  );
}
