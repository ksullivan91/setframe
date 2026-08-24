import { typeScale as rawTypeScale, type TypeScaleToken } from '@setframe/design-tokens';

/**
 * `@setframe/design-tokens`' `typeScale` is declared as `Record<string,
 * TypeScaleToken>`, so both direct lookups and its own `TypeScaleKey`
 * export (`keyof typeof typeScale`) widen to `string`, making every
 * lookup `TypeScaleToken | undefined` under `noUncheckedIndexedAccess`.
 * All of Setframe's actual scale keys are known and stable (see
 * docs/design/setframe-design-system.md §3) — this re-exports the same
 * object under a locally-declared literal key union instead of
 * scattering non-null assertions across every component.
 */
type KnownTypeScaleKey =
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
  | 'caption';

export const typeScale: Record<KnownTypeScaleKey, TypeScaleToken> = rawTypeScale as Record<
  KnownTypeScaleKey,
  TypeScaleToken
>;

/**
 * Story 28 — below this effective font size, iOS Safari auto-zooms a form
 * control on focus and leaves the page visibly zoomed after blur. Every
 * mobile-width text/numeric input, select, and textarea must render at
 * least this size; each references this one constant rather than
 * hardcoding 16 independently.
 */
export const mobileSafeInputFontSize = 16;
