/**
 * Typography scale — Inter, per docs/design/setframe-design-system.md §3
 * and the live Figma specimen (style guide §2). `numericMetric` and
 * `numericWorkoutSet` use tabular figures for Setframe's core "275 × 5"
 * legibility requirement (master spec).
 */
export const fontFamily = {
  base: 'Inter',
} as const;

export const fontWeight = {
  regular: '400',
  semiBold: '600',
} as const;

export type TypeScaleToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
  tabularNums?: boolean;
};

export const typeScale: Record<string, TypeScaleToken> = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: fontWeight.semiBold },
  pageTitle: { fontSize: 24, lineHeight: 32, fontWeight: fontWeight.semiBold },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: fontWeight.semiBold },
  body: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.regular },
  compactBody: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.regular },
  label: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.regular },
  helper: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.regular },
  numericMetric: {
    fontSize: 24,
    lineHeight: 36,
    fontWeight: fontWeight.semiBold,
    tabularNums: true,
  },
  numericWorkoutSet: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeight.semiBold,
    tabularNums: true,
  },
  button: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semiBold },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.regular },
};

export type TypeScaleKey = keyof typeof typeScale;
