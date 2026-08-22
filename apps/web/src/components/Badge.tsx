import type { HTMLAttributes, ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { Trophy } from 'lucide-react';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

export type BadgeTone = 'neutral' | 'success' | 'error' | 'caution' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const StyledBadge = styled.span<{ $tone: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]}px;
  padding: 2px ${spacing[8]}px;
  border-radius: ${radius.full}px;
  font-size: ${typeScale.caption.fontSize}px;
  font-weight: 600;
  white-space: nowrap;

  ${(p) =>
    p.$tone === 'accent' &&
    css`
      background: ${p.theme.action.accentSubtle};
      color: ${p.theme.action.primary};
    `}
  ${(p) =>
    p.$tone === 'success' &&
    css`
      background: ${p.theme.action.accentSubtle};
      color: ${p.theme.status.success};
    `}
  ${(p) =>
    p.$tone === 'error' &&
    css`
      background: ${p.theme.action.accentSubtle};
      color: ${p.theme.status.error};
    `}
  ${(p) =>
    p.$tone === 'caution' &&
    css`
      background: ${p.theme.action.accentSubtle};
      color: ${p.theme.status.caution};
    `}
  ${(p) =>
    p.$tone === 'neutral' &&
    css`
      background: ${p.theme.surface.sunken};
      color: ${p.theme.text.secondary};
    `}
`;

/** Badge/Chip — small status pill. Use tone="accent" for general chips. */
export function Badge({ tone = 'neutral', children, ...props }: BadgeProps) {
  return (
    <StyledBadge $tone={tone} {...props}>
      {children}
    </StyledBadge>
  );
}

/**
 * PRBadge — the trophy treatment for a new personal record, per style
 * guide §17 (WorkoutLogger/SessionSummary PR signal).
 */
export function PRBadge({ label = 'PR' }: { label?: string }) {
  return (
    <Badge tone="accent" aria-label={`Personal record: ${label}`}>
      <Trophy size={14} aria-hidden="true" />
      {label}
    </Badge>
  );
}
