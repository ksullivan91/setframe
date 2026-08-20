/**
 * Mobile-first breakpoints. Base/default styles (no media query) target
 * small/mobile viewports; use these `min-width` queries to progressively
 * enhance layout for larger screens — never `max-width` queries that
 * shrink a desktop-first layout down. Matches the mobile/web parity
 * pairs documented in docs/design/setline-figma-style-guide.md §14/§19.2
 * (narrow viewport ≈ the Figma mobile screens, wide viewport ≈ the
 * Figma web screens/AppShell).
 */
export const breakpoints = {
  tablet: 768,
  desktop: 1024,
} as const;

export const mq = {
  tablet: `@media (min-width: ${breakpoints.tablet}px)`,
  desktop: `@media (min-width: ${breakpoints.desktop}px)`,
} as const;
