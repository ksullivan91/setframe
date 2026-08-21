import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Check } from 'lucide-react';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { ProgressRing } from './ProgressRing';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

/**
 * Optional submit-lifecycle status. When set, the button's label is
 * swapped for a `ProgressRing` (loading) or a `Check` mark (success)
 * without changing the button's footprint — the label stays in the
 * layout (via `visibility: hidden`) so nothing reflows. Per user
 * request: "button morph to checkmark" for daily-step saves and
 * "progress rings on click API submit interactions" more broadly.
 */
export type ButtonStatus = 'idle' | 'loading' | 'success';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  status?: ButtonStatus;
}

const popIn = keyframes`
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  60% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const StyledButton = styled.button<{ $variant: ButtonVariant; $status: ButtonStatus }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing[8]}px;
  height: 44px;
  padding: 0 ${spacing[24]}px;
  border-radius: ${radius.small}px;
  border: 1px solid transparent;
  font-size: ${typeScale.button.fontSize}px;
  line-height: ${typeScale.button.lineHeight}px;
  font-weight: ${typeScale.button.fontWeight};
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }

  ${(p) =>
    p.$variant === 'primary' &&
    css`
      background: ${p.theme.action.primary};
      color: ${p.theme.action.primaryText};
      &:hover:not(:disabled) {
        background: ${p.theme.action.primaryHover};
      }
    `}

  ${(p) =>
    p.$variant === 'secondary' &&
    css`
      background: transparent;
      color: ${p.theme.text.primary};
      border-color: ${p.theme.border.default};
      &:hover:not(:disabled) {
        background: ${p.theme.surface.sunken};
      }
    `}

  ${(p) =>
    p.$variant === 'tertiary' &&
    css`
      /* Text/ghost treatment for low-frequency, low-priority actions
         (e.g. "Skip", "Switch to full editor") — should never visually
         compete with a primary or secondary control in the same region. */
      background: transparent;
      color: ${p.theme.text.secondary};
      border-color: transparent;
      padding: 0 ${spacing[8]}px;
      &:hover:not(:disabled) {
        color: ${p.theme.text.primary};
        background: ${p.theme.surface.sunken};
      }
    `}

  ${(p) =>
    p.$variant === 'destructive' &&
    css`
      background: ${p.theme.action.destructive};
      color: ${p.theme.action.primaryText};
      &:hover:not(:disabled) {
        opacity: 0.9;
      }
    `}

  ${(p) =>
    p.$status === 'success' &&
    css`
      background: ${p.theme.status.success};
      border-color: ${p.theme.status.success};
      color: ${p.theme.action.primaryText};
    `}
`;

const Label = styled.span<{ $hidden: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[8]}px;
  /* opacity (not visibility/display) so the label stays part of the
     button's accessible name while visually replaced by the spinner/
     checkmark overlay. */
  ${(p) => p.$hidden && css`opacity: 0;`}
`;

const StatusOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: ${popIn} 0.25s ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

const statusAnnouncement: Record<Exclude<ButtonStatus, 'idle'>, string> = {
  loading: 'Loading',
  success: 'Saved',
};

/**
 * Button — primary/secondary/tertiary/destructive variants per style
 * guide §5. Pass `status="loading"`/`"success"` to morph the label into
 * a spinner or checkmark for submit interactions (see `ButtonStatus`).
 * The checkmark/spinner overlay is decorative (`aria-hidden`) — a
 * visually-hidden `aria-live` region announces the same transition to
 * screen-reader users so the confirmation isn't sight-only.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', status = 'idle', type = 'button', children, disabled, ...props },
  ref,
) {
  const isTransient = status === 'loading' || status === 'success';

  return (
    <StyledButton
      ref={ref}
      type={type}
      $variant={variant}
      $status={status}
      disabled={disabled || status === 'loading'}
      aria-busy={status === 'loading' || undefined}
      {...props}
    >
      <Label $hidden={isTransient}>{children}</Label>
      {status === 'loading' ? (
        <StatusOverlay aria-hidden="true">
          <ProgressRing size={18} />
        </StatusOverlay>
      ) : null}
      {status === 'success' ? (
        <StatusOverlay aria-hidden="true">
          <Check size={20} strokeWidth={3} />
        </StatusOverlay>
      ) : null}
      {isTransient ? (
        <VisuallyHidden role="status" aria-live="polite">
          {statusAnnouncement[status]}
        </VisuallyHidden>
      ) : null}
    </StyledButton>
  );
});
