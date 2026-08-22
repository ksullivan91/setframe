import { spacing, radius, typeScale as rawTypeScale, themes, type SemanticTheme, type TypeScaleToken } from '@setframe/design-tokens';

/**
 * Mobile theme wrapper around `@setframe/design-tokens`. Dark mode is
 * structurally supported (themes.dark is fully wired) but deferred per
 * the design docs — `getTheme` defaults to 'light' and there is no UI
 * toggle yet, matching apps/web's `getTheme.ts` convention.
 */
export function getTheme(mode: 'light' | 'dark' = 'light'): SemanticTheme {
  return themes[mode];
}

/**
 * `@setframe/design-tokens`' `typeScale` is typed as `Record<string,
 * TypeScaleToken>`, so with `noUncheckedIndexedAccess` every property
 * access (`typeScale.body`, etc.) is seen as possibly `undefined` even
 * though every named key is guaranteed to exist. Re-typing this as a
 * concrete keyed object here (values unchanged) keeps consumers'
 * `typeScale.body.fontSize`-style access ergonomic without touching the
 * shared package.
 */
export const typeScale = rawTypeScale as Record<
  | 'display'
  | 'pageTitle'
  | 'sectionTitle'
  | 'body'
  | 'compactBody'
  | 'label'
  | 'helper'
  | 'numericMetric'
  | 'numericWorkoutSet'
  | 'button'
  | 'caption',
  TypeScaleToken
>;

export { spacing, radius };
export type { SemanticTheme };
