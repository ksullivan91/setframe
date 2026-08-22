import type { HTMLAttributes } from 'react';
import styled from 'styled-components';
import { radius, spacing } from '@setframe/design-tokens';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * Card — used for genuinely distinct groupings (e.g. an exercise block of
 * sets), not as a generic decorative wrapper for everything. Style guide
 * §6.
 */
export const Card = styled.div<CardProps>`
  background: ${(p) => p.theme.surface.raised};
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.large}px;
  padding: ${spacing[16]}px;
`;
