import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  availableRanges,
  describeWeightRate,
  filterByRange,
  formatDateRangeLabel,
  formatMetricValue,
  formatWeekRange,
  metricDefinition,
  metricLabel,
  weekEndDate,
  weekStartOf,
  type ChartRange,
  type ProgressMetricKey,
  type SeriesPoint,
} from '@setframe/domain';
import type { ProgressOverviewResponse } from '@setframe/schemas';
import { Card } from '../../src/components/Card';
import { ColumnChart, LineChart, RangeSelector } from '../../src/components/Charts';
import { MetricInfo } from '../../src/components/MetricInfo';
import { FadeIn, Skeleton, SkeletonStack } from '../../src/components/Skeleton';
import { useApiClient } from '../../src/lib/api-client';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

/**
 * Progress.
 *
 * Full parity with the web screen: an organised summary → trend → detail,
 * built on one rule — a visualisation has to answer a question, so where there
 * is no interpretable denominator there is either a real dated chart or plain
 * text, never a decorative bar.
 *
 * Two deliberate choices, both evidence-based (see docs/research):
 *  - Body weight leads with a 7-day average and a rate per week, never a
 *    day-over-day delta, and is never coloured red or green.
 *  - Training leads with weeks-trained rather than a streak, because a
 *    streak's cliff punishes one missed week with total loss.
 */

function formatDate(localDate: string): string {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// Local (not UTC) calendar date — passed to the API so "last N weeks" is
// computed relative to the user's actual today, not the server's UTC clock.
function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function MetricInfoFor({ metricKey }: { metricKey: string }) {
  const definition = metricDefinition(metricKey);
  if (!definition) return null;
  return (
    <MetricInfo
      label={definition.label}
      explanation={definition.explanation}
      calculation={definition.calculation}
      limitation={definition.limitation}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{children}</Text>
    </View>
  );
}

function Helper({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const theme = useTheme();
  return (
    <Text style={[styles.helper, { color: theme.text.secondary }]} testID={testID}>
      {children}
    </Text>
  );
}

function SummaryCard({
  label,
  info,
  value,
  unit,
  detail,
  accent,
  testID,
}: {
  label: string;
  info?: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  detail?: string;
  accent?: 'purple' | 'green';
  testID?: string;
}) {
  const theme = useTheme();
  const accentColor =
    accent === 'green' ? theme.status.success : accent === 'purple' ? theme.action.primary : 'transparent';
  return (
    <Card style={[styles.summaryCard, { borderLeftColor: accentColor, borderLeftWidth: 3 }]}>
      <View style={styles.summaryLabelRow}>
        <Text style={[styles.summaryLabel, { color: theme.text.secondary }]}>{label}</Text>
        {info}
      </View>
      <Text style={[styles.summaryValue, { color: theme.text.primary }]} testID={testID}>
        {value}
        {unit ? <Text style={styles.summaryUnit}>{unit}</Text> : null}
      </Text>
      {detail ? <Text style={[styles.summaryDetail, { color: theme.text.secondary }]}>{detail}</Text> : null}
    </Card>
  );
}

export function BodyWeightSection({
  bodyWeight,
  localDate,
}: {
  bodyWeight: ProgressOverviewResponse['bodyWeight'];
  localDate: string;
}) {
  const theme = useTheme();
  const rawSeries = useMemo<SeriesPoint[]>(
    () => bodyWeight.points.map((point) => ({ localDate: point.localDate, value: point.raw })),
    [bodyWeight.points],
  );
  const trendSeries = useMemo<SeriesPoint[]>(
    () => bodyWeight.points.map((point) => ({ localDate: point.localDate, value: point.trend })),
    [bodyWeight.points],
  );

  const ranges = useMemo(() => availableRanges(rawSeries, localDate), [rawSeries, localDate]);
  const [range, setRange] = useState<ChartRange>('ALL');

  const visibleRaw = useMemo(() => filterByRange(rawSeries, range, localDate), [rawSeries, range, localDate]);
  const visibleTrend = useMemo(
    () => filterByRange(trendSeries, range, localDate),
    [trendSeries, range, localDate],
  );

  const format = (value: number) => `${value.toFixed(1)} ${bodyWeight.unit}`;

  // `weeks` only contains weeks that actually have check-ins, so the last
  // entry can be weeks old after a break. Label it honestly rather than
  // calling a fortnight-old average "this week".
  const latestWeek = bodyWeight.weeks.at(-1) ?? null;

  // Story 32 — Start/Current/Change for the selected range, from the raw
  // check-ins actually visible (not the prior period's last value, and not
  // the smoothed trend below). A single present point shows only Current: a
  // change or trend computed from one observation would be fabricated.
  const rangeSummary = useMemo(() => {
    const present = visibleRaw.filter((point) => point.value != null);
    if (!present.length) return null;
    const start = present[0]!;
    const current = present.at(-1)!;
    if (present.length === 1) return { start: null, current, change: null };
    return { start, current, change: current.value! - start.value! };
  }, [visibleRaw]);

  // Deliberately built from the smoothed series and gated on a week of
  // elapsed time: an endpoint-to-endpoint difference between two raw
  // mornings a day apart is the day-over-day delta under another name.
  const rangeDelta = useMemo(() => {
    if (bodyWeight.sufficiency !== 'ready') return null;
    const present = visibleTrend.filter((point) => point.value != null);
    if (present.length < 2) return null;
    const first = present[0]!;
    const last = present.at(-1)!;
    if (daysBetween(first.localDate, last.localDate) < 7) return null;
    return { change: last.value! - first.value!, from: first.localDate, to: last.localDate };
  }, [visibleTrend, bodyWeight.sufficiency]);

  if (bodyWeight.sufficiency === 'none') {
    return (
      <Card>
        <SectionTitle>Body weight</SectionTitle>
        <Helper testID="body-weight-none">
          No morning weigh-ins yet. Log your morning weight on Today and your trend will build here.
        </Helper>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Body weight</Text>
          <MetricInfo
            label="Body weight trend"
            explanation="Your morning weight over time. The purple dots are what you logged; the green line is the underlying trend."
            calculation="The headline figure is your average over the last 7 days. The trend line moves a tenth of the way toward each new reading, so one heavy meal barely shifts it."
            limitation="Weight swings by several pounds day to day from water, food and salt. Whether the trend going up or down is good depends entirely on what you are training for, so we do not assume."
          />
        </View>
        <RangeSelector ranges={ranges} value={range} onChange={setRange} label="Body weight time range" />
      </View>

      {visibleRaw.length ? (
        <Helper testID="body-weight-range-context">
          {formatDateRangeLabel(visibleRaw[0]!.localDate, visibleRaw.at(-1)!.localDate)}
        </Helper>
      ) : null}

      {rangeSummary ? (
        <View style={styles.rangeStatRow} testID="body-weight-range-summary">
          {rangeSummary.start ? (
            <View>
              <Text style={[styles.rangeStatLabel, { color: theme.text.secondary }]}>Start</Text>
              <Text
                style={[styles.rangeStatValue, { color: theme.text.primary }]}
                testID="body-weight-range-start"
              >
                {format(rangeSummary.start.value!)}
              </Text>
            </View>
          ) : null}
          <View>
            <Text style={[styles.rangeStatLabel, { color: theme.text.secondary }]}>Current</Text>
            <Text
              style={[styles.rangeStatValue, { color: theme.text.primary }]}
              testID="body-weight-range-current"
            >
              {`${format(rangeSummary.current.value!)} · ${formatDate(rangeSummary.current.localDate)}`}
            </Text>
          </View>
          {rangeSummary.change != null ? (
            <View>
              <Text style={[styles.rangeStatLabel, { color: theme.text.secondary }]}>Change</Text>
              <Text
                style={[styles.rangeStatValue, { color: theme.text.primary }]}
                testID="body-weight-range-change"
              >
                {`${rangeSummary.change > 0 ? '↑' : rangeSummary.change < 0 ? '↓' : '→'} ${Math.abs(
                  rangeSummary.change,
                ).toFixed(1)} ${bodyWeight.unit}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {bodyWeight.sufficiency === 'establishing' ? (
        <>
          <Text style={[styles.summaryValue, { color: theme.text.primary }]}>
            {bodyWeight.latestCheckIn ? format(bodyWeight.latestCheckIn.weightValue) : '—'}
          </Text>
          <Helper testID="body-weight-establishing">
            {bodyWeight.checkInCount === 1
              ? 'One check-in so far. A single weigh-in is a starting point, not a trend — keep logging and the picture will build.'
              : `${bodyWeight.checkInCount} check-ins so far. Your trend appears once there is about a week of data to smooth.`}
          </Helper>
        </>
      ) : (
        <>
          <View>
            <Text style={[styles.summaryValue, { color: theme.text.primary }]} testID="body-weight-average">
              {bodyWeight.currentAverage != null ? format(bodyWeight.currentAverage) : '—'}
            </Text>
            <Text style={[styles.summaryDetail, { color: theme.text.secondary }]}>7-day average</Text>
          </View>
          <Helper testID="body-weight-rate">
            {describeWeightRate(
              bodyWeight.ratePerWeek,
              bodyWeight.direction,
              bodyWeight.unit,
              bodyWeight.windowWeeks,
            )}
          </Helper>
        </>
      )}

      {visibleRaw.length ? (
        <LineChart
          series={visibleRaw}
          trendSeries={bodyWeight.sufficiency === 'ready' ? visibleTrend : undefined}
          pointsOnly={bodyWeight.sufficiency !== 'ready'}
          zeroBased={false}
          minimumSpan={4}
          formatValue={format}
          label={`Body weight in ${bodyWeight.unit} over time`}
          testID="body-weight-chart"
        />
      ) : null}

      {rangeDelta ? (
        <Helper testID="body-weight-range-delta">
          {`${rangeDelta.change >= 0 ? '+' : '−'}${Math.abs(rangeDelta.change).toFixed(1)} ${
            bodyWeight.unit
          } between ${formatDate(rangeDelta.from)} and ${formatDate(rangeDelta.to)}`}
        </Helper>
      ) : null}

      {latestWeek ? (
        <Text style={[styles.summaryDetail, { color: theme.text.secondary }]} testID="body-weight-week-range">
          {`${
            latestWeek.weekStart === weekStartOf(localDate)
              ? 'This week'
              : `Week of ${formatDate(latestWeek.weekStart)}`
          }: avg ${latestWeek.average.toFixed(1)} · range ${latestWeek.low.toFixed(1)}–${latestWeek.high.toFixed(
            1,
          )} ${bodyWeight.unit}`}
        </Text>
      ) : null}
    </Card>
  );
}

export function ExerciseCard({
  exercise,
  localDate,
}: {
  exercise: ProgressOverviewResponse['exercises'][number];
  localDate: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const headlineKey = exercise.metricKeys[0];
  const [range, setRange] = useState<ChartRange>('ALL');

  const series = useMemo<SeriesPoint<{ sessionId: string }>[]>(
    () =>
      exercise.points.map((point) => ({
        localDate: point.localDate,
        value: point.metrics.find((metric) => metric.key === headlineKey)?.value ?? null,
        meta: { sessionId: point.sessionId },
      })),
    [exercise.points, headlineKey],
  );

  const ranges = useMemo(() => availableRanges(series, localDate), [series, localDate]);
  const visible = useMemo(() => filterByRange(series, range, localDate), [series, range, localDate]);

  const latest = exercise.points.at(-1);
  const definition = headlineKey ? metricDefinition(headlineKey) : null;
  const minimumSessions = definition?.minimumSessionsForTrend ?? 3;
  const plottable = visible.filter((point) => point.value != null);
  const headlineUnits = latest?.metrics.find((entry) => entry.key === headlineKey);

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{exercise.exerciseName}</Text>
        <RangeSelector
          ranges={ranges}
          value={range}
          onChange={setRange}
          label={`${exercise.exerciseName} time range`}
        />
      </View>

      <View style={styles.metricRow}>
        {latest?.metrics.map((metric) => (
          <View key={metric.key} style={styles.metricChip}>
            <View style={styles.summaryLabelRow}>
              <Text style={[styles.metricChipLabel, { color: theme.text.secondary }]}>
                {metricLabel(metric.key)}
              </Text>
              <MetricInfoFor metricKey={metric.key} />
            </View>
            <Text style={[styles.metricChipValue, { color: theme.text.primary }]} testID={`metric-${metric.key}`}>
              {formatMetricValue(metric.key as ProgressMetricKey, metric.value, {
                loadUnit: metric.loadUnit,
                distanceUnit: metric.distanceUnit,
              }) ?? 'Not logged'}
            </Text>
          </View>
        ))}
      </View>

      {headlineKey && plottable.length >= minimumSessions ? (
        <LineChart
          series={visible}
          zeroBased={definition?.aggregation === 'total'}
          formatValue={(value) =>
            formatMetricValue(headlineKey as ProgressMetricKey, value, {
              loadUnit: headlineUnits?.loadUnit,
              distanceUnit: headlineUnits?.distanceUnit,
              compact: true,
            }) ?? String(value)
          }
          label={`${exercise.exerciseName} ${metricLabel(headlineKey)} over time`}
          onSelectPoint={({ index }) => {
            // `index` is into the range-filtered series the chart was given.
            const point = visible[index];
            if (point?.meta)
              router.push({ pathname: '/session-summary', params: { sessionId: point.meta.sessionId } });
          }}
          testID={`exercise-chart-${exercise.exerciseId}`}
        />
      ) : (
        <Helper testID="exercise-insufficient">
          {`${exercise.sessionCount} ${
            exercise.sessionCount === 1 ? 'session' : 'sessions'
          } logged. A trend needs at least ${minimumSessions}.`}
        </Helper>
      )}

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`See full history for ${exercise.exerciseName}`}
        testID="exercise-history-link"
        onPress={() => router.push(`/exercise-history/${exercise.exerciseId}`)}
        style={[styles.sessionRow, { borderColor: theme.border.subtle }]}
      >
        <Text style={{ color: theme.text.primary, fontWeight: '600' }}>See full history</Text>
        <Text style={{ color: theme.text.secondary }}>→</Text>
      </Pressable>
    </Card>
  );
}

function ProgressSkeleton() {
  return (
    <View style={styles.skeletonRoot} testID="progress-skeleton">
      <View style={styles.header}>
        <Skeleton width="40%" height={26} />
        <Skeleton width="80%" height={14} />
      </View>
      <View style={styles.summaryGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} style={styles.summaryCard}>
            <SkeletonStack>
              <Skeleton width="60%" height={13} />
              <Skeleton width="45%" height={26} />
              <Skeleton width="80%" height={13} />
            </SkeletonStack>
          </Card>
        ))}
      </View>
      <Card>
        <SkeletonStack gap={12}>
          <Skeleton width="40%" height={18} />
          <Skeleton height={140} />
        </SkeletonStack>
      </Card>
      <Card>
        <SkeletonStack gap={12}>
          <Skeleton width="50%" height={18} />
          <Skeleton height={140} />
        </SkeletonStack>
      </Card>
    </View>
  );
}

export default function ProgressScreen() {
  const theme = useTheme();
  const api = useApiClient();
  const router = useRouter();
  const localDate = todayLocalDate();
  const windowWeeks = 12;
  const topPadding = useScreenTopPadding();
  /* Applied to every return path below — the loading and error states are
     as capable of rendering under the Dynamic Island as the loaded one. */
  const contentStyle = [styles.content, { paddingTop: topPadding }];

  const query = useQuery({
    queryKey: ['progress-overview', localDate, windowWeeks],
    queryFn: () =>
      api.get<ProgressOverviewResponse>(`/progress/overview?weeks=${windowWeeks}&localDate=${localDate}`),
  });

  const sessionSeries = useMemo<SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[]>(
    () =>
      (query.data?.training.weeks ?? []).map((week) => ({
        localDate: week.weekStart,
        // Zero is a real, meaningful value for a week count, so it is plotted
        // rather than nulled — a missed week has to be visible.
        value: week.completedCount,
        meta: { isCurrent: week.isCurrent, isRest: week.isRestWeek },
      })),
    [query.data],
  );

  const volumeSeries = useMemo<SeriesPoint<{ isCurrent?: boolean }>[]>(
    () =>
      (query.data?.training.weeks ?? []).map((week) => ({
        localDate: week.weekStart,
        value: week.volume,
        meta: { isCurrent: week.isCurrent },
      })),
    [query.data],
  );

  const background = { backgroundColor: theme.surface.canvas };

  if (query.isLoading) {
    return (
      <ScrollView style={background} contentContainerStyle={contentStyle}>
        <ProgressSkeleton />
      </ScrollView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScrollView style={background} contentContainerStyle={contentStyle}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Progress</Text>
        </View>
        <Card>
          <Helper>We could not load your progress just now. Pull to refresh or try again shortly.</Helper>
        </Card>
      </ScrollView>
    );
  }

  const { training, bodyWeight, exercises, recentSessions } = query.data;
  const currentWeek = training.weeks.at(-1);
  const hasAnyVolume = volumeSeries.some((point) => point.value != null);
  // Story 31: the chart's active period must be stated explicitly — this is
  // the exact span the two weekly ColumnCharts below render.
  const trainingWindowRange =
    training.weeks.length > 0
      ? formatDateRangeLabel(training.weeks[0]!.weekStart, weekEndDate(training.weeks.at(-1)!.weekStart))
      : null;
  const hasAnyData = training.totalCompleted > 0 || bodyWeight.checkInCount > 0;

  if (!hasAnyData) {
    return (
      <ScrollView style={background} contentContainerStyle={contentStyle}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Progress</Text>
          <Helper>Your trends will appear here as you train.</Helper>
        </View>
        <Card>
          <SectionTitle>Nothing to chart yet</SectionTitle>
          <Helper testID="progress-empty">
            Complete a workout or log your morning weight on Today. We will not draw a trend until there is
            enough data for it to mean something.
          </Helper>
        </Card>
      </ScrollView>
    );
  }

  return (
    <FadeIn>
      <ScrollView style={background} contentContainerStyle={contentStyle}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Progress</Text>
          <Helper>How your training, strength and weight are actually moving.</Helper>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Weeks trained"
            accent="green"
            testID="weeks-trained"
            value={`${training.weeksTrained}`}
            unit={` of ${training.windowWeeks}`}
            detail={`${training.averageSessionsPerWeek.toFixed(1)} sessions/week average`}
            info={
              <MetricInfo
                label="Weeks trained"
                explanation={`How many of the last ${training.windowWeeks} weeks you trained at least once.`}
                calculation="Any week containing a completed session counts."
                limitation="We show this instead of a streak on purpose: a streak drops to zero the moment you miss a week, and one ordinary bad week should not wipe out months of work."
              />
            }
          />

          <SummaryCard
            label="This week"
            accent="purple"
            testID="sessions-this-week"
            value={`${currentWeek?.completedCount ?? 0}`}
            detail={
              currentWeek?.completionRatio != null
                ? `${Math.round(currentWeek.completionRatio * 100)}% of plan`
                : 'No plan set for this week'
            }
            info={
              <MetricInfo
                label="Sessions this week"
                explanation="Workouts you have completed since Monday."
                calculation="Completed sessions dated within the current week."
                limitation={null}
              />
            }
          />

          <SummaryCard
            label="Streak"
            testID="current-streak"
            value={`${training.currentStreakWeeks}`}
            detail={`Best: ${training.longestStreakWeeks} weeks`}
            info={
              <MetricInfo
                label="Training streak"
                explanation="Consecutive weeks with at least one workout."
                calculation="Counted back from your most recent completed week. The current week does not break it while it is still in progress."
                limitation="Your best streak is kept even after the current one ends — it happened, and it still counts."
              />
            }
          />

          <SummaryCard
            label="Body weight"
            accent="purple"
            testID="summary-body-weight"
            value={
              bodyWeight.currentAverage != null
                ? bodyWeight.currentAverage.toFixed(1)
                : bodyWeight.latestCheckIn
                  ? bodyWeight.latestCheckIn.weightValue.toFixed(1)
                  : '—'
            }
            unit={` ${bodyWeight.unit}`}
            detail={bodyWeight.currentAverage != null ? '7-day average' : 'Latest check-in'}
          />
        </View>

        <Card>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Sessions per week</Text>
              <MetricInfo
                label="Sessions per week"
                explanation="How many workouts you completed in each of the last few weeks."
                calculation="One bar per week, Monday to Sunday. Weeks with no training are shown as empty slots so gaps stay visible."
                limitation="The current week is still in progress, so its bar will usually be shorter."
              />
            </View>
          </View>
          {trainingWindowRange ? <Helper testID="sessions-range-context">{trainingWindowRange}</Helper> : null}
          <ColumnChart
            series={sessionSeries}
            formatValue={(value) => `${Math.round(value)}`}
            formatPeriod={(weekStart) => formatWeekRange(weekStart)}
            label={`Completed sessions per week over the last ${training.windowWeeks} weeks`}
            emptyLabel="No sessions"
            testID="sessions-chart"
          />
          <Helper>
            {`${training.totalCompleted} sessions across ${training.windowWeeks} weeks. This week is highlighted in green.`}
          </Helper>
        </Card>

        <BodyWeightSection bodyWeight={bodyWeight} localDate={localDate} />

        {hasAnyVolume ? (
          <Card>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Weekly volume</Text>
                <MetricInfo
                  label="Weekly volume"
                  explanation="The total weight you moved each week, across weighted lifts only."
                  calculation="Weight × reps summed over every completed set of a weighted exercise. Cardio and bodyweight work are excluded because they carry no load to total."
                  limitation="Volume measures work done, not strength. It normally falls when you train heavier for fewer reps or take a deload week, and that is not a step backwards."
                />
              </View>
            </View>
            {trainingWindowRange ? <Helper testID="volume-range-context">{trainingWindowRange}</Helper> : null}
            <ColumnChart
              series={volumeSeries}
              formatValue={(value) => `${Math.round(value).toLocaleString()} ${training.volumeUnit}`}
              formatPeriod={(weekStart) => formatWeekRange(weekStart)}
              label={`Weekly training volume in ${training.volumeUnit}`}
              emptyLabel="No weighted work"
              testID="volume-chart"
            />
          </Card>
        ) : null}

        {exercises.length ? (
          <View style={styles.stack}>
            <View>
              <SectionTitle>Strength</SectionTitle>
              <Helper>Each exercise shows only the measures that make sense for how it is programmed.</Helper>
            </View>
            {exercises.slice(0, 4).map((exercise) => (
              <ExerciseCard key={exercise.exerciseId} exercise={exercise} localDate={localDate} />
            ))}
          </View>
        ) : null}

        {recentSessions.length ? (
          <Card>
            <SectionTitle>Recent sessions</SectionTitle>
            {recentSessions.map((session) => (
              <Pressable
                key={session.sessionId}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${session.sessionName}, ${formatDate(session.localDate)}`}
                testID="recent-session"
                onPress={() =>
                  router.push({ pathname: '/session-summary', params: { sessionId: session.sessionId } })
                }
                style={[styles.sessionRow, { borderColor: theme.border.subtle }]}
              >
                <View style={styles.flexShrink}>
                  <Text style={{ color: theme.text.primary, fontWeight: '600' }}>{session.sessionName}</Text>
                  <Text style={[styles.summaryDetail, { color: theme.text.secondary }]}>
                    {`${formatDate(session.localDate)} · ${session.exerciseCount} exercises · ${session.setCount} sets`}
                    {session.volume != null
                      ? ` · ${Math.round(session.volume).toLocaleString()} ${training.volumeUnit}`
                      : ''}
                  </Text>
                </View>
                {session.prCount > 0 ? (
                  <View style={[styles.prPill, { backgroundColor: `${theme.status.success}1f` }]}>
                    <Text
                      style={{
                        color: theme.status.success,
                        fontWeight: '600',
                        fontSize: typeScale.caption.fontSize,
                      }}
                    >
                      {`${session.prCount} PR${session.prCount === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  skeletonRoot: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[4],
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  helper: {
    fontSize: typeScale.caption.fontSize,
  },
  sectionHeader: {
    gap: spacing[8],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[12],
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: spacing[4],
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typeScale.label.fontSize,
  },
  summaryValue: {
    fontSize: typeScale.numericMetric.fontSize,
    fontWeight: '700',
  },
  summaryUnit: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '400',
  },
  summaryDetail: {
    fontSize: typeScale.caption.fontSize,
  },
  /* Story 32 — Start/Current/Change framing for the selected range. */
  rangeStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[16],
  },
  rangeStatLabel: {
    fontSize: typeScale.caption.fontSize,
  },
  rangeStatValue: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
  },
  stack: {
    gap: spacing[16],
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[16],
  },
  metricChip: {
    gap: 2,
    minWidth: 92,
  },
  metricChipLabel: {
    fontSize: typeScale.caption.fontSize,
  },
  metricChipValue: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
    padding: spacing[12],
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
  },
  flexShrink: {
    flexShrink: 1,
  },
  prPill: {
    paddingHorizontal: spacing[8],
    paddingVertical: 2,
    borderRadius: 999,
  },
});
