import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styled from 'styled-components';
import { radius } from '@setline/design-tokens';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label — required since IconButton has no visible text. */
  'aria-label': string;
  children: ReactNode;
}

const StyledIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${radius.full}px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${(p) => p.theme.surface.sunken};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

/**
 * IconButton — compact circular icon-only tap target (add/remove/
 * duplicate/reorder actions), style guide §6. Uses Lucide icons as
 * children, e.g. `<IconButton aria-label="Add set"><Plus size={16}/></IconButton>`.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { type = 'button', ...props },
  ref,
) {
  return <StyledIconButton ref={ref} type={type} {...props} />;
});
