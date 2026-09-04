import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { addDays, estimateMaxHeartRate, zoneBands } from '@setframe/domain';
import type { TrendMetricKey, TrendsResponse, TrendSeries } from '@setframe/schemas';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { useApiClient } from '../../src/lib/api-client';
import { TrendMetricCard } from '../../src/components/log/TrendMetricCard';
import { HeartRateZoneCard } from '../../src/components/log/HeartRateZoneCard';
import { healthKit } from '../../src/healthkit/HealthKitAdapter';

/**
 * Trends — what your body is doing.
 *
 * The other half of the split in ADR 0013: Progress is computed from sets
 * you logged, Trends is measured about you and is true whether or not you
 * ever open the app. Grouped so a dozen metrics are not twelve peers.
 */
const RANGES = [
  /* A week is the range you check mid-training-block — "am I doing what I
     said I would this week". The longer ranges answer a different question,
     and it is not the one you ask on a Wednesday. */
  { label: 'Week', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
] as const;

const GROUPS: { title: string; metrics: { key: TrendMetricKey; label: string; unit: string; lowerIsBetter?: boolean; format?: (v: number) => string }[] }[] = [
  {
    title: 'BODY',
    metrics: [
      { key: 'weight', label: 'Weight', unit: 'lb', lowerIsBetter: true },
      { key: 'bodyFatPercentage', label: 'Body fat', unit: '%', lowerIsBetter: true },
    ],
  },
  {
    title: 'RECOVERY',
    metrics: [
      { key: 'restingHeartRate', label: 'Resting heart rate', unit: 'bpm', lowerIsBetter: true },
      { key: 'hrvSdnn', label: 'HRV', unit: 'ms' },
      {
        key: 'sleepMinutes',
        label: 'Sleep',
        unit: 'avg',
        format: (v) => `${Math.floor(v / 60)}h ${String(Math.round(v % 60)).padStart(2, '0')}m`,
      },
    ],
  },
  {
    title: 'ACTIVITY',
    metrics: [
      { key: 'steps', label: 'Steps', unit: 'per day', format: (v) => Math.round(v).toLocaleString('en-US') },
      { key: 'activeEnergy', label: 'Active energy', unit: 'cal', format: (v) => Math.round(v).toLocaleString('en-US') },
      { key: 'exerciseMinutes', label: 'Exercise minutes', unit: 'min', format: (v) => String(Math.round(v)) },
    ],
  },
  { title: 'CAPACITY', metrics: [{ key: 'vo2Max', label: 'VO₂ max', unit: 'ml/kg·min' }] },
];

const EMPTY: TrendSeries = { key: 'weight', points: [], latest: null, change: null };

/** What one column covers at each range, and how its label reads. */
function bucketPlanFor(rangeDays: number): {
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
function zoneChangeMinutes(
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
function buildZoneBuckets(
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

export default function TrendsScreen() {
  const theme = useTheme();
  const api = useApiClient();
  const today = useLocalDate();
  const topPadding = useScreenTopPadding(spacing[24]);
  const [rangeDays, setRangeDays] = useState<number>(30);

  const from = addDays(today, -rangeDays);

  /* The zone model lives on the device — the server has no date of birth,
     and should not acquire one to answer a question HealthKit can already
     answer. Sent per request so every day in the window is sliced under one
     current model, which is what makes a long chart comparable. */
  const profile = useQuery({
    queryKey: ['health-profile-for-zones'],
    queryFn: () => healthKit.getSnapshot(),
    staleTime: 60 * 60 * 1000,
  });
  const restingBpm = profile.data?.recovery.restingHeartRateBpm ?? null;
  const maxBpm = estimateMaxHeartRate(profile.data?.body.ageYears ?? null, null);
  const zoneModel = restingBpm && maxBpm && maxBpm > restingBpm ? { restingBpm, maxBpm } : null;
  const bands = zoneModel ? zoneBands(zoneModel) : [];

  const query = useQuery({
    queryKey: ['trends', from, today, zoneModel?.restingBpm, zoneModel?.maxBpm],
    queryFn: () =>
      api.get<TrendsResponse>(
        `/trends?from=${from}&to=${today}` +
          (zoneModel ? `&restingBpm=${zoneModel.restingBpm}&maxBpm=${zoneModel.maxBpm}` : ''),
      ),
  });

  /* Five one-per-day series arrive; the card wants columns. A week is shown
     day by day, longer ranges by week, a year by month — the card renders
     whatever it is handed and does not divide the window itself. */
  const zoneBuckets = buildZoneBuckets(query.data, rangeDays);

  const seriesFor = (key: TrendMetricKey): TrendSeries =>
    query.data?.series.find((s) => s.key === key) ?? { ...EMPTY, key };

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
    >
      <Text style={[styles.title, { color: theme.text.primary }]}>Trends</Text>

      <View style={styles.ranges}>
        {RANGES.map((range) => {
          const active = range.days === rangeDays;
          return (
            <Pressable
              key={range.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setRangeDays(range.days)}
              style={[
                styles.range,
                { backgroundColor: active ? theme.text.primary : theme.surface.sunken },
              ]}
            >
              <Text style={[styles.rangeLabel, { color: active ? theme.text.inverse : theme.text.secondary }]}>
                {range.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={theme.action.primary} />
      ) : query.isError ? (
        <Text style={[styles.note, { color: theme.text.secondary }]}>
          Couldn’t load your trends. Pull to refresh and try again.
        </Text>
      ) : (
        <>
        {/* Its own block above the metric groups: it is the only card that
            answers "how was the work distributed" rather than "what is this
            number now", and inside a group of single-value cards it reads as
            a peer of resting heart rate. */}
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: theme.text.secondary }]}>INTENSITY</Text>
          <HeartRateZoneCard
            buckets={zoneBuckets}
            bands={bands}
            bucketUnit={bucketPlanFor(rangeDays).unit}
            changeMinutes={zoneChangeMinutes(zoneBuckets)}
            unavailable={
              bands.length === 0 ? 'no-model' : zoneBuckets.length === 0 ? 'no-data' : undefined
            }
          />
        </View>
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.text.secondary }]}>{group.title}</Text>
            {group.metrics.map((metric) => (
              <TrendMetricCard
                key={metric.key}
                label={metric.label}
                unit={metric.unit}
                lowerIsBetter={metric.lowerIsBetter}
                format={metric.format}
                series={seriesFor(metric.key)}
              />
            ))}
          </View>
        ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[24], paddingBottom: spacing[32], gap: spacing[16] },
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  ranges: { flexDirection: 'row', gap: spacing[8] },
  range: { borderRadius: 999, paddingVertical: spacing[12], paddingHorizontal: spacing[16], minHeight: 44, justifyContent: 'center' },
  rangeLabel: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  group: { gap: spacing[8] },
  groupTitle: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
  note: { fontSize: typeScale.body.fontSize },
});
