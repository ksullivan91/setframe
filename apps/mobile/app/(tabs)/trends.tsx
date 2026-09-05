import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { addDays } from '@setframe/domain';
import type { TrendMetricKey, TrendsResponse, TrendSeries } from '@setframe/schemas';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { useApiClient } from '../../src/lib/api-client';
import { TrendMetricCard } from '../../src/components/log/TrendMetricCard';

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
    /* Weight lives on Progress, with its own chart and its seven-day
       average — the summary card here was the poorer of two views of the
       same number, and having both invited the question of which was
       right. Body fat stays: it has no second home. */
    metrics: [
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

export default function TrendsScreen() {
  const theme = useTheme();
  const api = useApiClient();
  const today = useLocalDate();
  const topPadding = useScreenTopPadding(spacing[24]);
  const [rangeDays, setRangeDays] = useState<number>(30);

  const from = addDays(today, -rangeDays);

  /* Intensity and body weight moved to Progress. Both are questions about
     training rather than about the body — how hard the work was, and what
     the work is doing to you — and they read against training volume in a
     way they never did beside resting heart rate. */
  const query = useQuery({
    queryKey: ['trends', from, today],
    queryFn: () => api.get<TrendsResponse>(`/trends?from=${from}&to=${today}`),
  });

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
        GROUPS.map((group) => (
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
        ))
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
