import styled, { keyframes } from 'styled-components';
import { radius } from '@setframe/design-tokens';

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

/**
 * Skeleton — placeholder block with a shimmering gradient sweep, used in
 * place of "Loading…" text for content-shaped loading states (lists,
 * cards, metric tiles). Respects `prefers-reduced-motion` by falling back
 * to a static tinted block. `$rounded` gives a pill/circle shape for
 * avatar-like placeholders.
 */
export const Skeleton = styled.div<{ $height?: number; $width?: string; $rounded?: boolean }>`
  height: ${(p) => p.$height ?? 16}px;
  width: ${(p) => p.$width ?? '100%'};
  border-radius: ${(p) => (p.$rounded ? '999px' : `${radius.small}px`)};
  background: ${(p) => `linear-gradient(90deg, ${p.theme.surface.sunken} 25%, ${p.theme.border.subtle} 50%, ${p.theme.surface.sunken} 75%)`};
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: ${(p) => p.theme.surface.sunken};
  }
`;

export const SkeletonStack = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap ?? 8}px;
`;
