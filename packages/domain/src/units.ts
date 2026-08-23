/**
 * Unit conversion for aggregating logged sets.
 *
 * `workout_set` stores `load_unit` ('lb' | 'kg') and `distance_unit`
 * ('m' | 'km' | 'mi') per row, so a single exercise's history can legitimately
 * mix units — a user who switches their preference mid-program, or logs a
 * treadmill run in miles and a track session in metres. Summing those raw
 * numbers produces a meaningless total, so every aggregation in the Progress
 * layer normalises to a canonical unit first and converts once for display.
 */

export type LoadUnit = 'lb' | 'kg';
export type DistanceUnit = 'm' | 'km' | 'mi';

/** Exact by definition (international avoirdupois pound, 1959). */
const KG_PER_LB = 0.45359237;
/** Exact by definition (international mile). */
const METRES_PER_MILE = 1609.344;
const METRES_PER_KM = 1000;

export function convertLoad(value: number, from: LoadUnit, to: LoadUnit): number {
  if (from === to) return value;
  return from === 'lb' ? value * KG_PER_LB : value / KG_PER_LB;
}

function toMetres(value: number, from: DistanceUnit): number {
  switch (from) {
    case 'm':
      return value;
    case 'km':
      return value * METRES_PER_KM;
    case 'mi':
      return value * METRES_PER_MILE;
  }
}

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  const metres = toMetres(value, from);
  switch (to) {
    case 'm':
      return metres;
    case 'km':
      return metres / METRES_PER_KM;
    case 'mi':
      return metres / METRES_PER_MILE;
  }
}

/**
 * The unit an aggregate should be reported in, given the units actually
 * present in the data. When a series is unmixed we keep the user's own unit
 * so the number they see matches the number they typed; when it is mixed we
 * fall back to `preferred` rather than silently picking the first row's unit.
 */
export function resolveLoadUnit(units: readonly LoadUnit[], preferred: LoadUnit = 'lb'): LoadUnit {
  const distinct = new Set(units);
  if (distinct.size === 1) return [...distinct][0]!;
  return preferred;
}

export function resolveDistanceUnit(
  units: readonly DistanceUnit[],
  preferred: DistanceUnit = 'mi',
): DistanceUnit {
  const distinct = new Set(units);
  if (distinct.size === 1) return [...distinct][0]!;
  return preferred;
}
