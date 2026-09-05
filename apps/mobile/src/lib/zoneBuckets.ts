import type { TrendsResponse } from '@setframe/schemas';

/**
 * Folding per-day zone minutes into the columns a chart draws.
 *
 * The API returns a point per day per zone because that is what it stores.
 * How many days one column covers is a presentation choice that depends on
 * the range on screen, so it happens here — shared, because Progress and any
 * future surface must bucket a week the same way.
 */

export type ZoneBucket = {
  label: string;
  minutes: readonly [number, number, number, number, number];
};

/** What one column covers, for the caption. */
export function zoneBucketUnit(rangeDays: number): 'day' | 'week' | 'month' {
  return bucketPlanFor(rangeDays).unit;
}

/** What one column covers at each range, and how its label reads. */
export function bucketPlanFor(rangeDays: number): {
  unit: 'day' | 'week' | 'month';
  size: number;
  label: (date: string, index: number, count: number) => string;
} {
  if (rangeDays <= 7) {
    return {
      unit: 'day',
      size: 1,
      label: (date) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${date}T12:00:00`).getDay()] ?? '',
    };
  }
  if (rangeDays <= 120) {
    return {
      unit: 'week',
      size: 7,
      /* Every column labelled at four, every fourth at thirteen — a label
         under each of thirteen columns is 26px of text in 24px of space. */
      label: (date, index, count) =>
        count <= 5 || index % 4 === 0
          ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : '',
    };
  }
  return {
    unit: 'month',
    size: 30,
    label: (date, index) =>
      index % 3 === 0
        ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })
        : '',
  };
}

/** Active minutes gained or lost across the window, first column to last. */
export function zoneChangeMinutes(
  buckets: readonly { minutes: readonly [number, number, number, number, number] }[],
): number | null {
  if (buckets.length < 2) return null;
  const total = (b: (typeof buckets)[number]) => b.minutes.reduce((a, m) => a + m, 0);
  return total(buckets[buckets.length - 1]!) - total(buckets[0]!);
}

/**
 * Fold five per-day zone series into the card's columns.
 *
 * The API returns a point per day per zone because that is what it stores;
 * bucketing is a presentation choice that depends on the range, so it
 * happens here rather than being baked into the response.
 */
export function buildZoneBuckets(
  data: TrendsResponse | undefined,
  rangeDays: number,
): { label: string; minutes: readonly [number, number, number, number, number] }[] {
  if (!data) return [];
  const byDate = new Map<string, [number, number, number, number, number]>();
  for (const zone of [1, 2, 3, 4, 5] as const) {
    const series = data.series.find((s) => s.key === `zone${zone}Minutes`);
    for (const point of series?.points ?? []) {
      const row = byDate.get(point.localDate) ?? [0, 0, 0, 0, 0];
      row[zone - 1] = point.value;
      byDate.set(point.localDate, row);
    }
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return [];

  const plan = bucketPlanFor(rangeDays);
  const origin = Date.parse(`${dates[0]!}T12:00:00Z`);
  const groups: { date: string; minutes: [number, number, number, number, number] }[] = [];
  for (const date of dates) {
    const index = Math.floor((Date.parse(`${date}T12:00:00Z`) - origin) / 86400000 / plan.size);
    const existing = groups[index];
    const day = byDate.get(date)!;
    if (existing) {
      day.forEach((m, i) => { existing.minutes[i] = (existing.minutes[i] ?? 0) + m; });
    } else {
      groups[index] = { date, minutes: [...day] as [number, number, number, number, number] };
    }
  }

  const filled = groups.filter(Boolean);
  return filled.map((group, index) => ({
    label: plan.label(group.date, index, filled.length),
    minutes: group.minutes as readonly [number, number, number, number, number],
  }));
}

