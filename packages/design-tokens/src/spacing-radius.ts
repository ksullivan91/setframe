/**
 * Spacing scale — 4/8/12/16/24/32/40/48, per
 * docs/design/setline-design-system.md §4 and the Figma
 * `Setline/Spacing` variable collection.
 */
export const spacing = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
} as const;

export type SpacingKey = keyof typeof spacing;

/**
 * Radius scale — restrained 2-tier + pill, per
 * docs/design/setline-design-system.md §4.
 */
export const radius = {
  small: 8,
  large: 16,
  full: 999,
} as const;

export type RadiusKey = keyof typeof radius;
