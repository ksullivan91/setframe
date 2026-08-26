import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  bucketLabel,
  bucketStart,
  buildStrengthSeries,
  describeAdherence,
  describeStrengthPending,
  plannedWeeks,
  buildOverviewInsights,
  buildProgressSeries,
  comparePeriods,
  countBucketForRange,
  currentPeriodLabel,
  daysBetween,
  describeBucketValue,
  formatBucketPeriod,
  progressRangeLabel,
  describeWeightRate,
  defaultRange,
  rangeOptions,
  formatCompactNumber,
  formatDateRangeLabel,
  formatMetricValue,
  formatWeekRange,
  groupPatternValues,
  metricDefinition,
  metricLabel,
  movementPatternGroupLabel,
  orderMovementPatternGroups,
  weekEndDate,
  weekOverWeekChange,
  weekStartOf,
  windowForRange,
  type InsightMetric,
  type ProgressRange,
  type ProgressMetricKey,
  type SeriesPoint,
} from '@setframe/domain';
import type { ProgressOverviewResponse } from '@setframe/schemas';
import { Card } from '../../src/components/Card';
import {
  AdherenceChart,
  ColumnChart,
  LineChart,
  RangeSelector,
  SmallMultiples,
  StackedChart,
} from '../../src/components/Charts';
import { MetricInfo } from '../../src/components/MetricInfo';
import { ProgressInsights } from '../../src/components/ProgressInsights';
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

/**
 * Training composition — the mobile counterpart of web's `CompositionSection`.
 *
 * The volume section above answers "how much"; this answers "of what", which
 * a single total structurally cannot. Grouped into the five planning
 * categories rather than drawn per detailed pattern: capping the patterns at
 * a palette-sized limit was tried on web and rendered badly, with a grey
 * "Other" band becoming one of the largest things on the chart.
 *
 * Weekly only, deliberately. A day's movement mix describes one workout, not
 * a trend, and a monthly bucket would blur the very alternation (push day,
 * pull day, leg day) the chart exists to show.
 */

/**
 * Strength — the mobile counterpart of web's `StrengthPanels`.
 *
 * A lift is only drawn once it clears the metric's own
 * `minimumSessionsForTrend`. That floor is not a UI preference: estimated
 * 1RM's stated limitation is "treat small changes as noise", so two points
 * joined by a line would be two observations plus an implication we cannot
 * support.
 */

/**
 * Adherence — the mobile counterpart of web's `AdherenceSection`.
 *
 * Answers the north star's "what caused the change" more often than anything
 * else on the screen: volume fell because two planned days were missed, not
 * because effort dropped. Unanswerable until now, because the API hardcoded
 * `plannedCount: null`.
 *
 * Rendered only when a plan actually existed — a user with no active program
 * sees nothing here rather than a column of zeroes implying failure.
 */
export function AdherenceSection({
  weeks,
}: {
  weeks: ProgressOverviewResponse['training']['weeks'];
}) {
  const planned = useMemo(() => plannedWeeks(weeks), [weeks]);
  const summary = describeAdherence(weeks);
  const theme = useTheme();

  if (!planned.length) return null;

  return (
    <Card>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Plan vs actual</Text>
        <MetricInfo
          label="Plan vs actual"
          explanation="How many of your planned training days you actually completed each week."
          calculation="Planned days come from your active program's schedule — the days of the week it assigns a workout to. The marker on each bar is that week's target; the bar is what you completed."
          limitation="Only weeks your program actually covered are shown. Weeks before you set the program up are left out rather than drawn as zeroes, because there was no plan to fall short of. Extra sessions beyond the plan are shown as met, not as a problem."
        />
      </View>

      <AdherenceChart
        weeks={planned}
        formatPeriod={(weekStart) => formatWeekRange(weekStart)}
        label="Planned versus completed sessions by week"
        testID="adherence-chart"
      />

      {summary ? <Helper testID="adherence-summary">{summary}</Helper> : null}
    </Card>
  );
}

export function StrengthPanels({
  exercises,
  volumeUnit,
}: {
  exercises: ProgressOverviewResponse['exercises'];
  volumeUnit: 'lb' | 'kg';
}) {
  const theme = useTheme();
  const { lifts, pending } = useMemo(() => buildStrengthSeries(exercises), [exercises]);
  const formatValue = useMemo(
    () => (value: number) => `${Math.round(value).toLocaleString()} ${volumeUnit}`,
    [volumeUnit],
  );
  const pendingNote = describeStrengthPending(pending);

  /* The heading lives here, not on the screen, so a user whose training has
     no 1RM at all — cycling, bodyweight work — never sees an "Estimated 1RM
     per session" promise with nothing underneath it. */
  if (!lifts.length && !pendingNote) return null;

  const heading = (
    <View>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Strength</Text>
        <MetricInfo
          label="Strength"
          explanation="Whether the weight you can lift is going up, lift by lift."
          calculation="Each panel plots your estimated 1RM per session — weight × (1 + reps / 30) from your best working set. Every panel shares the same left-to-right time axis, so you can read straight down the column to see when several lifts moved together."
          limitation="Panels have their own vertical scales, because a deadlift and a lateral raise differ by too much to share one. So heights are not comparable between panels — compare each line against its own stated range. Estimated 1RM is an estimate, not a tested max, and it gets less accurate above about 10 reps."
        />
      </View>
      {lifts.length ? (
        <Helper>Estimated 1RM per session. Panels share a time axis; each has its own scale.</Helper>
      ) : null}
    </View>
  );

  if (!lifts.length) {
    // Nothing plottable yet. Say what is missing rather than drawing an empty
    // frame, and never imply the user has made no progress.
    return (
      <View style={styles.stack}>
        {heading}
        <Helper testID="strength-pending">{pendingNote}</Helper>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {heading}
      <SmallMultiples
        lifts={lifts.slice(0, 6)}
        formatValue={formatValue}
        /* Relative, not absolute. Without a floor a lift that moved 2.5 lb
           over three months draws as a dramatic climb, because the domain
           collapses onto the noise the metric's own limitation warns about.
           But a fixed floor cannot serve both a 400 lb deadlift and a 25 lb
           lateral raise, so the floor is 8% of each lift's own median. */
        minimumSpanRatio={0.08}
        label="Estimated 1RM by lift"
        testID="strength-panels"
      />
      {pendingNote ? <Helper testID="strength-pending">{pendingNote}</Helper> : null}
    </View>
  );
}

export function CompositionSection({
  composition,
  localDate,
}: {
  composition: ProgressOverviewResponse['composition'] | undefined;
  localDate: string;
}) {
  const theme = useTheme();

  /* Driven by the same range helpers every other section uses, so which
     ranges are offered — and which is chosen first — stays consistent across
     the screen rather than being decided twice with different rules. */
  /* Tolerates an API that predates this field. Web and the API deploy
     separately and nothing deploys on push, so a client is briefly newer
     than the service it talks to on every release — this exact ordering
     already broke production once in this rebuild. The guard is on the data,
     not wrapped around the hooks, so hook order stays unconditional. */
  const weeks = composition?.weeks ?? [];

  const weekSeries = useMemo<SeriesPoint[]>(
    () =>
      weeks.map((week) => ({
        localDate: week.weekStart,
        value: week.total > 0 ? week.total : null,
      })),
    [weeks],
  );

  const [range, setRange] = useState<ProgressRange>(() => defaultRange(weekSeries, localDate));
  const ranges = useMemo(() => rangeOptions(weekSeries, localDate), [weekSeries, localDate]);

  /* Windowed by date rather than by slicing a fixed count off the tail: the
     payload's week list is bounded by whatever `weeks` the screen requested,
     so counting backwards from its end would silently show a different span
     than the range claims whenever those two disagree. */
  const windowed = useMemo(() => {
    const { start, end } = windowForRange(range, localDate);
    return weeks.filter((week) => week.weekStart >= start && week.weekStart <= end);
  }, [weeks, range, localDate]);

  const buckets = useMemo(
    () =>
      windowed.map((week) => ({
        localDate: week.weekStart,
        values: groupPatternValues(week.values),
        meta: { isCurrent: week.isCurrent },
      })),
    [windowed],
  );

  const windowTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const bucket of buckets) {
      for (const [key, value] of Object.entries(bucket.values)) {
        totals.set(key, (totals.get(key) ?? 0) + value);
      }
    }
    return [...totals.entries()].map(([key, total]) => ({ key, total }));
  }, [buckets]);

  const stackKeys = useMemo(
    () => orderMovementPatternGroups(windowTotals.map((entry) => entry.key)),
    [windowTotals],
  );

  const total = windowTotals.reduce((sum, entry) => sum + entry.total, 0);
  const unit = composition?.unit ?? 'lb';
  const formatValue = (value: number) =>
    `${Math.round(value).toLocaleString()} ${unit}`;

  // Nothing classified means nothing to compose. Saying so beats an empty
  // axis, and names the reason, which is fixable by the user.
  if (total <= 0) {
    if (!composition || composition.unclassifiedTotal <= 0) return null;
    return (
      <Card>
        <SectionTitle>Training composition</SectionTitle>
        <Helper testID="composition-unclassified-only">
          {`None of the exercises you have logged carries a movement pattern yet, so there is nothing to break your ${formatValue(
            composition.unclassifiedTotal,
          )} of volume down by. Patterns come from the exercise library, and most entries do not have one set.`}
        </Helper>
      </Card>
    );
  }

  const disclosure =
    composition && composition.unclassifiedTotal > 0
      ? `${formatValue(composition.unclassifiedTotal)} from ${
          composition.unclassifiedExerciseCount
        } ${composition.unclassifiedExerciseCount === 1 ? 'exercise' : 'exercises'} without a movement pattern is not shown above.`
      : undefined;

  const leader = [...windowTotals].sort((a, b) => b.total - a.total)[0];

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Training composition
          </Text>
          <MetricInfo
            label="Training composition"
            explanation="What your training volume was actually made of, by movement pattern."
            calculation="The same weight × reps that makes up Training volume, grouped by what each exercise trains — squats and hinges are Legs, presses are Push, rows and pull-ups are Pull. The bands in a bar always add up to that week's total."
            limitation="Grouping depends on each exercise carrying a movement pattern in the library, and many do not yet — those are not editable in the app today. Anything ungrouped is reported below the chart rather than hidden, so the total here can be well below your full volume."
          />
        </View>
        <RangeSelector
          options={ranges}
          value={range}
          onChange={setRange}
          label="Training composition time range"
        />
      </View>

      <Helper testID="composition-range-context">
        {`${windowed.length} ${windowed.length === 1 ? 'week' : 'weeks'} · one bar per week`}
      </Helper>

      <StackedChart
        buckets={buckets}
        keys={stackKeys}
        labelForKey={movementPatternGroupLabel}
        formatValue={formatValue}
        formatTick={(value) => formatCompactNumber(value)}
        formatPeriod={(weekStart) => formatWeekRange(weekStart)}
        label={`Training composition by movement pattern, weekly, ${progressRangeLabel(range).toLowerCase()}`}
        emptyLabel="No weighted work"
        disclosure={disclosure}
        testID="composition-chart"
      />

      {leader && total > 0 ? (
        <Helper testID="composition-summary">
          {`${movementPatternGroupLabel(leader.key)} was your largest share at ${Math.round(
            (leader.total / total) * 100,
          )}% of ${formatValue(total)}.`}
        </Helper>
      ) : null}
    </Card>
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

/**
 * Sessions and Volume — the same chart with different arithmetic.
 *
 * The web counterpart is `TrainingSeriesSection` in
 * apps/web/src/pages/ProgressPage.tsx. Same information architecture, same
 * bucketing, same copy; only the primitives differ, which is the parity rule
 * this repo works under (CLAUDE.md, "Frontend structure"). The arithmetic is
 * shared outright via packages/domain, so the two cannot drift on what a
 * bucket means or when a comparison is honest.
 */
export function TrainingSeriesSection({
  title,
  metricInfo,
  days,
  weeks,
  firstActivityDate,
  localDate,
  valueOf,
  formatValue,
  formatCompact,
  emptyLabel,
  unitNoun,
  minStep,
  testIDPrefix,
}: {
  title: string;
  metricInfo: React.ReactNode;
  days: ProgressOverviewResponse['training']['days'];
  weeks: ProgressOverviewResponse['training']['weeks'];
  firstActivityDate: string | null;
  localDate: string;
  valueOf: (day: { completedCount: number; volume: number | null }) => number | null;
  formatValue: (value: number) => string;
  formatCompact: (value: number) => string;
  emptyLabel: string;
  unitNoun: (value: number) => string;
  /** 1 for a count of whole sessions; unset for a continuous total. */
  minStep?: number;
  testIDPrefix: string;
}) {
  const theme = useTheme();
  const raw = useMemo<SeriesPoint[]>(
    () => days.map((day) => ({ localDate: day.localDate, value: valueOf(day) })),
    [days, valueOf],
  );

  const [range, setRange] = useState<ProgressRange>(() => defaultRange(raw, localDate));
  const ranges = useMemo(() => rangeOptions(raw, localDate), [raw, localDate]);

  const series = useMemo(
    () =>
      buildProgressSeries(raw, {
        range,
        endLocalDate: localDate,
        aggregation: 'sum',
        /* The function, not a precomputed bucket: ALL's span is only known
           once the data has been windowed, and computing it out here yields
           zero for ALL. */
        bucket: countBucketForRange,
        emptyIsZero: true,
        zeroFrom: firstActivityDate,
      }),
    [raw, range, localDate, firstActivityDate],
  );

  /* A rest week is a fact about a week and the payload only carries it at
     that grain, so it is applied only when a mark *is* a week. */
  const restWeeks = useMemo(
    () => new Set(weeks.filter((week) => week.isRestWeek).map((week) => week.weekStart)),
    [weeks],
  );

  const currentBucket = bucketStart(localDate, series.bucket);
  const columns = useMemo<SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[]>(
    () =>
      series.points.map((point) => ({
        localDate: point.localDate,
        value: point.value,
        meta: {
          isCurrent: point.localDate === currentBucket,
          isRest: series.bucket === 'week' && point.value === 0 && restWeeks.has(point.localDate),
        },
      })),
    [series, currentBucket, restWeeks],
  );

  const comparison = comparePeriods(series, localDate);
  const periodLabel = currentPeriodLabel(series.bucket);
  const bucketNoun = series.bucket === 'day' ? 'day' : series.bucket;
  const total = series.points.reduce((sum, point) => sum + (point.value ?? 0), 0);
  const counted = series.points.filter((point) => point.value != null).length;

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {metricInfo}
        </View>
        <RangeSelector options={ranges} value={range} onChange={setRange} label={`${title} time range`} />
      </View>

      <Helper testID={`${testIDPrefix}-range-context`}>
        {`${formatDateRangeLabel(series.window.start, series.window.end)} · one bar per ${bucketNoun}`}
      </Helper>

      {comparison && comparison.current.value != null ? (
        <View style={styles.rangeStatRow} testID={`${testIDPrefix}-comparison`}>
          <View>
            <Text style={[styles.rangeStatLabel, { color: theme.text.secondary }]}>
              {/* Story 33/50: an in-progress period says so in words, never
                  by its bar colour alone. */}
              {comparison.isPartial
                ? periodLabel
                : formatBucketPeriod(comparison.current.localDate, series.bucket)}
            </Text>
            <Text
              style={[styles.rangeStatValue, { color: theme.text.primary }]}
              testID={`${testIDPrefix}-current`}
            >
              {comparison.isPartial
                ? `${formatValue(comparison.current.value)} so far`
                : formatValue(comparison.current.value)}
            </Text>
          </View>

          {/* Only when the previous period is genuinely known. A null one
              predates the user's first session, and comparing against it
              would invent a baseline they were never there for. */}
          {comparison.previous?.value != null ? (
            <View>
              <Text style={[styles.rangeStatLabel, { color: theme.text.secondary }]}>
                {`Previous ${bucketNoun}`}
              </Text>
              <Text
                style={[styles.rangeStatValue, { color: theme.text.primary }]}
                testID={`${testIDPrefix}-previous`}
              >
                {formatValue(comparison.previous.value)}
              </Text>
            </View>
          ) : null}

          {comparison.change != null ? (
            <View>
              <Text style={[styles.rangeStatLabel, { color: theme.text.secondary }]}>Change</Text>
              <Text
                style={[styles.rangeStatValue, { color: theme.text.primary }]}
                testID={`${testIDPrefix}-change`}
              >
                {`${comparison.change > 0 ? '↑' : comparison.change < 0 ? '↓' : '→'} ${formatValue(
                  Math.abs(comparison.change),
                )}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ColumnChart
        series={columns}
        formatValue={formatValue}
        formatTick={formatCompact}
        minStep={minStep}
        formatPeriod={(start) => formatBucketPeriod(start, series.bucket)}
        currentLabel={periodLabel}
        label={`${title}, ${bucketLabel(series.bucket)}, ${progressRangeLabel(range).toLowerCase()}`}
        emptyLabel={emptyLabel}
        testID={`${testIDPrefix}-chart`}
      />

      {comparison?.isPartial ? (
        <Helper testID={`${testIDPrefix}-partial-note`}>
          {`${periodLabel} is still in progress, so its bar is not yet comparable to a finished ${bucketNoun}.`}
        </Helper>
      ) : null}

      <Helper testID={`${testIDPrefix}-total`}>
        {`${formatValue(total)} ${unitNoun(total)} across ${counted} ${
          counted === 1 ? bucketNoun : `${bucketNoun}s`
        }.`}
      </Helper>
    </Card>
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

  const ranges = useMemo(() => rangeOptions(rawSeries, localDate), [rawSeries, localDate]);
  /* Opens on the tightest window that still shows every check-in, and is
     held in state so it survives selection and re-render. Identical to web. */
  const [range, setRange] = useState<ProgressRange>(() => defaultRange(rawSeries, localDate));

  /* Body weight averages within a bucket; empty buckets stay `null`, since
     an unweighed day is unknown rather than zero. Same call as web. */
  /* The whole series is kept, not just its points: `bucket` is what tells
     the chart whether a mark is a day or a week, and dropping it is how the
     readout came to label a weekly mean with a single date. Mirrors web. */
  const rawSeriesForRange = useMemo(
    () => buildProgressSeries(rawSeries, { range, endLocalDate: localDate, aggregation: 'mean' }),
    [rawSeries, range, localDate],
  );
  const trendSeriesForRange = useMemo(
    () => buildProgressSeries(trendSeries, { range, endLocalDate: localDate, aggregation: 'mean' }),
    [trendSeries, range, localDate],
  );
  const visibleRaw = rawSeriesForRange.points;
  const visibleTrend = trendSeriesForRange.points;

  const format = (value: number) => `${value.toFixed(1)} ${bodyWeight.unit}`;

  // `weeks` only contains weeks that actually have check-ins, so the last
  // entry can be weeks old after a break. Label it honestly rather than
  // calling a fortnight-old average "this week".
  const latestWeek = bodyWeight.weeks.at(-1) ?? null;
  /* Only offered when the two weeks are adjacent and each has enough
     check-ins to have a real average — see weekOverWeekChange. */
  const weekChange = useMemo(() => weekOverWeekChange(bodyWeight.weeks), [bodyWeight.weeks]);

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
        <RangeSelector options={ranges} value={range} onChange={setRange} label="Body weight time range" />
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
          /* At 3M and longer a mark is a week's mean, not a morning's
             weigh-in. Naming the bucket's span keeps the readout from
             claiming a reading on a day that may never have been logged. */
          formatPeriod={(localDate) => formatBucketPeriod(localDate, rawSeriesForRange.bucket)}
          describePoint={(index) => {
            const point = visibleRaw[index];
            return point ? describeBucketValue(point, rawSeriesForRange.bucket, 'mean') : null;
          }}
          label={`Body weight in ${bodyWeight.unit} over time, ${bucketLabel(
            rawSeriesForRange.bucket,
          )}, ${progressRangeLabel(range).toLowerCase()}`}
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
          {weekChange
            ? `${' · '}${weekChange.change >= 0 ? '+' : '−'}${Math.abs(weekChange.change).toFixed(
                1,
              )} ${bodyWeight.unit} vs previous week`
            : ''}
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
  const series = useMemo<SeriesPoint<{ sessionId: string }>[]>(
    () =>
      exercise.points.map((point) => ({
        localDate: point.localDate,
        value: point.metrics.find((metric) => metric.key === headlineKey)?.value ?? null,
        meta: { sessionId: point.sessionId },
      })),
    [exercise.points, headlineKey],
  );

  /* Every chart on this screen opens on the tightest range that still shows
     every observation. Hardcoding 'ALL' here made one card follow a different
     rule than body weight directly above it. */
  const [range, setRange] = useState<ProgressRange>(() => defaultRange(series, localDate));
  const ranges = useMemo(() => rangeOptions(series, localDate), [series, localDate]);
  /* "Best of the session" reading, so a bucket takes its last observation
     rather than averaging two sessions into a number never actually lifted. */
  const visible = useMemo(
    () => buildProgressSeries(series, { range, endLocalDate: localDate, aggregation: 'last' }).points,
    [series, range, localDate],
  );

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
          options={ranges}
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
  /* A full year plus the partial current week, so W through Y all have their
     whole window on hand. The old value was 12, which silently truncated
     every range past 3M to a quarter of what the user selected. */
  const [windowWeeks, setWindowWeeks] = useState(53);
  const topPadding = useScreenTopPadding();
  /* Applied to every return path below — the loading and error states are
     as capable of rendering under the Dynamic Island as the loaded one. */
  const contentStyle = [styles.content, { paddingTop: topPadding }];

  const query = useQuery({
    queryKey: ['progress-overview', localDate, windowWeeks],
    queryFn: () =>
      api.get<ProgressOverviewResponse>(`/progress/overview?weeks=${windowWeeks}&localDate=${localDate}`),
  });

  /* ALL has to mean all. `firstActivityDate` is deliberately unwindowed, so a
     user with more history than the default window says so in the first
     response and we widen once. Only ever widens, so this settles after one
     extra fetch and never fires for anyone under a year in. */
  const firstActivity = query.data?.training.firstActivityDate ?? null;
  useEffect(() => {
    if (!firstActivity) return;
    const needed = Math.ceil(daysBetween(firstActivity, localDate) / 7) + 1;
    if (needed > windowWeeks) setWindowWeeks(Math.min(needed, 260));
  }, [firstActivity, localDate, windowWeeks]);

  /* Story 51. Fixed to the week rather than a page-level range: the strip
     answers "what's changed lately", and week-over-week is the span a user
     actually acts on. Identical to the web screen's call, so both platforms
     describe the same payload with the same words. */
  const insights = useMemo(
    () => (query.data ? buildOverviewInsights(query.data, { endLocalDate: localDate }) : []),
    [query.data, localDate],
  );

  /* Mobile has no anchors to link to, so each chart section records its own
     offset within the scroll content as it lays out, and focusing an insight
     scrolls there. Kept in a ref rather than state: these are written on
     every layout pass, and a setState per pass would re-render the screen
     continuously while it settles. */
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Partial<Record<InsightMetric, number>>>({});
  const captureOffset = (metric: InsightMetric) => (event: LayoutChangeEvent) => {
    sectionOffsets.current[metric] = event.nativeEvent.layout.y;
  };
  const focusInsight = (metric: InsightMetric) => {
    const y = sectionOffsets.current[metric];
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
  };

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

  const { training, bodyWeight, composition, exercises, recentSessions } = query.data;
  const currentWeek = training.weeks.at(-1);
  /* Only offered when some weighted work exists. A user who only ever walks
     has no volume to chart, and an all-zero axis would read as a verdict on
     their training rather than as a metric that does not apply. */
  const hasAnyVolume = training.days.some((day) => day.volume != null);
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
      <ScrollView ref={scrollRef} style={background} contentContainerStyle={contentStyle}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Progress</Text>
          <Helper>How your training, strength and weight are actually moving.</Helper>
        </View>

        <ProgressInsights insights={insights} onFocus={(item) => focusInsight(item.metric)} />

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
                explanation="Workouts you have completed since Sunday."
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

        <View onLayout={captureOffset('training_frequency')}>
          <TrainingSeriesSection
            title="Training frequency"
            metricInfo={
              <MetricInfo
                label="Training frequency"
                explanation="How many workouts you completed in each period."
                calculation="One completed workout counts once, whether it was scheduled or added on the day. Walks and other Additional Activity are not counted here — they are movement, but they are not the session you planned."
                limitation="A period you had not signed up for yet is left blank rather than drawn as a zero, so early ranges can start part-way along."
              />
            }
            days={training.days}
            weeks={training.weeks}
            firstActivityDate={training.firstActivityDate}
            localDate={localDate}
            valueOf={(day) => day.completedCount}
            formatValue={(value) => `${Math.round(value)}`}
            formatCompact={(value) => `${Math.round(value)}`}
            emptyLabel="No sessions"
            unitNoun={(value) => (Math.round(value) === 1 ? 'session' : 'sessions')}
            // Sessions are whole things; a 0.5 gridline would be nonsense.
            minStep={1}
            testIDPrefix="sessions"
          />
        </View>

        <View onLayout={captureOffset('body_weight')}>
          <BodyWeightSection bodyWeight={bodyWeight} localDate={localDate} />
        </View>

        {hasAnyVolume ? (
          <View onLayout={captureOffset('training_volume')}>
            <TrainingSeriesSection
              title="Training volume"
              metricInfo={
                <MetricInfo
                  label="Training volume"
                  explanation="The total weight you moved in each period, across weighted lifts only."
                  calculation="Weight × reps, summed over every completed set of a weighted exercise. A set you did not save does not count. Cardio, timed and distance work carry no load to total, so they are left out rather than counted as zero."
                  limitation="Volume measures work done, not strength. It normally falls when you train heavier for fewer reps or take a deload week, and that is not a step backwards."
                />
              }
              days={training.days}
              weeks={training.weeks}
              firstActivityDate={training.firstActivityDate}
              localDate={localDate}
              valueOf={(day) => day.volume}
              formatValue={(value) => `${Math.round(value).toLocaleString()} ${training.volumeUnit}`}
              /* Axis labels only: 12,420 lb does not fit under a bar at
                 390pt, and the exact figure is still one tap away. */
              formatCompact={(value) => formatCompactNumber(value)}
              emptyLabel="No weighted work"
              unitNoun={() => 'total'}
              testIDPrefix="volume"
            />
          </View>
        ) : null}

        <AdherenceSection weeks={training.weeks} />

        <CompositionSection composition={composition} localDate={localDate} />

        {exercises.length ? (
          <View style={styles.stack}>
            <StrengthPanels exercises={exercises} volumeUnit={training.volumeUnit} />

            <View>
              <SectionTitle>By exercise</SectionTitle>
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
