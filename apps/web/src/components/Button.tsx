import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styled, { css } from 'styled-components';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const StyledButton = styled.button<{ $variant: ButtonVariant }>`
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
    p.$variant === 'destructive' &&
    css`
      background: ${p.theme.action.destructive};
      color: ${p.theme.action.primaryText};
      &:hover:not(:disabled) {
        opacity: 0.9;
      }
    `}
`;

/** Button — primary/secondary/destructive variants per style guide §5. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', type = 'button', ...props },
  ref,
) {
  return <StyledButton ref={ref} type={type} $variant={variant} {...props} />;
});
