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
