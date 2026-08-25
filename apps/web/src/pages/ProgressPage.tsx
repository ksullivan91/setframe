import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { spacing } from '@setframe/design-tokens';
import {
  availableRanges,
  describeWeightRate,
  filterByRange,
  formatDateRangeLabel,
  formatMetricValue,
  formatWeekRange,
  isProgressOverview,
  metricDefinition,
  metricLabel,
  weekStartOf,
  type ChartRange,
  type ProgressMetricKey,
  type SeriesPoint,
} from '@setframe/domain';
import {
  Card,
  ColumnChart,
  FadeIn,
  LineChart,
  MetricInfo,
  RangeSelector,
  Skeleton,
  SkeletonStack,
} from '../components';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { useApiClient } from '../lib/api-client';

/**
 * Progress.
 *
 * Organised summary -> trend -> detail, and built on one rule: a
 * visualisation has to answer a question. The previous screen drew every
 * metric as a full-width bar scaled to the series max, which meant a single
 * observation rendered as 100% of nothing in particular. Where there is no
 * interpretable denominator there is now either a real dated chart or plain
 * text, and never a decorative bar.
 *
 * Two deliberate choices worth not undoing:
 *  - Body weight leads with a 7-day average and a rate per week, never a
 *    day-over-day delta, and is never coloured red or green. See
 *    docs/research/body-weight-display-psychology.md.
 *  - Training leads with weeks-trained rather than a streak, because a
 *    streak's cliff punishes one missed week with total loss. See
 *    docs/research/progress-metrics-motivation.md.
 */

interface ProgressMetric {
  key: string;
  value: number | null;
  loadUnit?: 'lb' | 'kg';
  distanceUnit?: 'm' | 'km' | 'mi';
}

interface ProgressOverviewResponse {
  training: {
    weeks: {
      weekStart: string;
      completedCount: number;
      plannedCount: number | null;
      completionRatio: number | null;
      volume: number | null;
      isCurrent: boolean;
    }[];
    weeksTrained: number;
    windowWeeks: number;
    currentStreakWeeks: number;
    longestStreakWeeks: number;
    totalCompleted: number;
    averageSessionsPerWeek: number;
    volumeUnit: 'lb' | 'kg';
  };
  bodyWeight: {
    unit: 'lb' | 'kg';
    sufficiency: 'none' | 'establishing' | 'ready';
    checkInCount: number;
    currentAverage: number | null;
    latestCheckIn: { localDate: string; weightValue: number } | null;
    ratePerWeek: number | null;
    direction: 'rising' | 'falling' | 'steady' | null;
    windowWeeks: number;
    points: { localDate: string; raw: number; trend: number; rollingAverage: number | null }[];
    weeks: { weekStart: string; average: number; low: number; high: number; checkInCount: number }[];
  };
  exercises: {
    exerciseId: string;
    exerciseName: string;
    prescriptionKind: string;
    metricKeys: string[];
    sessionCount: number;
    points: {
      sessionId: string;
      localDate: string;
      sessionName: string;
      metrics: ProgressMetric[];
      isWeightPr: boolean;
      isRepPr: boolean;
    }[];
  }[];
  recentSessions: {
    sessionId: string;
    localDate: string;
    completedAt: string | null;
    sessionName: string;
    exerciseCount: number;
    setCount: number;
    volume: number | null;
    prCount: number;
  }[];
}

const Page = styled.div`
  display: grid;
  gap: ${spacing[24]}px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: ${typeScale.sectionTitle.fontSize}px;
  font-weight: ${typeScale.sectionTitle.fontWeight};
  margin: 0;
  display: flex;
  align-items: center;
`;

const HelperText = styled.p`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: 0;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${spacing[12]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const SummaryCard = styled(Card)<{ $accent?: 'purple' | 'green' | 'none' }>`
  display: grid;
  gap: ${spacing[4]}px;
  align-content: start;
  border-left: 3px solid
    ${(p) =>
      p.$accent === 'green'
        ? p.theme.status.success
        : p.$accent === 'purple'
          ? p.theme.action.primary
          : 'transparent'};
`;

const SummaryLabel = styled.div`
  display: flex;
  align-items: center;
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const SummaryValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  line-height: 1.1;
`;

const SummaryUnit = styled.span`
  font-size: 0.5em;
  font-weight: 400;
`;

const SummaryDetail = styled.div`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const TwoColumn = styled.div`
  display: grid;
  gap: ${spacing[16]}px;

  ${mq.desktop} {
    grid-template-columns: 3fr 2fr;
    align-items: start;
  }
`;

const Stack = styled.div<{ $gap?: number }>`
  display: grid;
  gap: ${(p) => p.$gap ?? spacing[12]}px;
`;

const MetricRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[16]}px;
`;

const MetricChip = styled.div`
  display: grid;
  gap: 2px;
  min-width: 92px;
`;

const MetricChipLabel = styled.div`
  display: flex;
  align-items: center;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const MetricChipValue = styled.div`
  font-size: ${typeScale.body.fontSize}px;
  font-weight: 600;
`;

const SessionRow = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  padding: ${spacing[12]}px;
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: 12px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  min-height: 44px;
  color: inherit;
  font: inherit;

  &:hover,
  &:focus-visible {
    border-color: ${(p) => p.theme.action.primary};
  }
`;

const SessionName = styled.div`
  font-weight: 600;
`;

const PrPill = styled.span`
  padding: 2px ${spacing[8]}px;
  border-radius: 999px;
  font-size: ${typeScale.caption.fontSize}px;
  font-weight: 600;
  background: ${(p) => p.theme.status.success}1f;
  color: ${(p) => p.theme.status.success};
`;

const ExerciseList = styled.div`
  display: grid;
  gap: ${spacing[16]}px;

  ${mq.desktop} {
    grid-template-columns: repeat(2, 1fr);
  }
`;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function formatDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Sunday of a Monday-anchored week, as a `YYYY-MM-DD` string. */
function formatWeekEnd(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00`);
  end.setDate(end.getDate() + 6);
  const year = end.getFullYear();
  const month = String(end.getMonth() + 1).padStart(2, '0');
  const day = String(end.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Local (not UTC) calendar date — passed to the API so "last N weeks" is
// computed relative to the user's actual today, not the server's UTC clock.
function todayLocalDate() {
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

function ProgressSkeleton() {
  return (
    <Page data-testid="progress-skeleton">
      <div>
        <h1>Progress</h1>
        <HelperText>Loading your trends…</HelperText>
      </div>
      <SummaryGrid>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <SkeletonStack>
              <Skeleton $width="60%" $height={13} />
              <Skeleton $width="45%" $height={26} />
              <Skeleton $width="80%" $height={13} />
            </SkeletonStack>
          </Card>
        ))}
      </SummaryGrid>
      <TwoColumn>
        <Card>
          <SkeletonStack $gap={12}>
            <Skeleton $width="40%" $height={18} />
            <Skeleton $height={140} />
          </SkeletonStack>
        </Card>
        <Card>
          <SkeletonStack $gap={12}>
            <Skeleton $width="50%" $height={18} />
            <Skeleton $height={140} />
          </SkeletonStack>
        </Card>
      </TwoColumn>
    </Page>
  );
}

function BodyWeightSection({
  bodyWeight,
  localDate,
}: {
  bodyWeight: ProgressOverviewResponse['bodyWeight'];
  localDate: string;
}) {
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

  const visibleRaw = useMemo(
    () => filterByRange(rawSeries, range, localDate),
    [rawSeries, range, localDate],
  );
  const visibleTrend = useMemo(
    () => filterByRange(trendSeries, range, localDate),
    [trendSeries, range, localDate],
  );

  const format = (value: number) => `${value.toFixed(1)} ${bodyWeight.unit}`;

  // `weeks` only contains weeks that actually have check-ins, so the last
  // entry can be weeks old after a break. Label it honestly rather than
  // calling a fortnight-old average "this week".
  const latestWeek = bodyWeight.weeks.at(-1) ?? null;

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
        <Stack>
          <SectionTitle>Body weight</SectionTitle>
          <HelperText>
            No morning weigh-ins yet. Log your morning weight on Today and your trend will build here.
          </HelperText>
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
      <Stack>
        <SectionHeader>
          <SectionTitle>
            Body weight
            <MetricInfo
              label="Body weight trend"
              explanation="Your morning weight over time. The purple dots are what you logged; the green line is the underlying trend."
              calculation="The headline figure is your average over the last 7 days. The trend line moves a tenth of the way toward each new reading, so one heavy meal barely shifts it."
              limitation="Weight swings by several pounds day to day from water, food and salt. Whether the trend going up or down is good depends entirely on what you are training for, so we do not assume."
            />
          </SectionTitle>
          <RangeSelector
            ranges={ranges}
            value={range}
            onChange={setRange}
            label="Body weight time range"
          />
        </SectionHeader>

        {visibleRaw.length ? (
          <HelperText data-testid="body-weight-range-context">
            {formatDateRangeLabel(visibleRaw[0]!.localDate, visibleRaw.at(-1)!.localDate)}
          </HelperText>
        ) : null}

        {bodyWeight.sufficiency === 'establishing' ? (
          <>
            <SummaryValue>
              {bodyWeight.latestCheckIn ? format(bodyWeight.latestCheckIn.weightValue) : '—'}
            </SummaryValue>
            <HelperText data-testid="body-weight-establishing">
              {bodyWeight.checkInCount === 1
                ? 'One check-in so far. A single weigh-in is a starting point, not a trend — keep logging and the picture will build.'
                : `${bodyWeight.checkInCount} check-ins so far. Your trend appears once there is about a week of data to smooth.`}
            </HelperText>
          </>
        ) : (
          <>
            <div>
              <SummaryValue data-testid="body-weight-average">
                {bodyWeight.currentAverage != null ? format(bodyWeight.currentAverage) : '—'}
              </SummaryValue>
              <SummaryDetail>7-day average</SummaryDetail>
            </div>
            <HelperText data-testid="body-weight-rate">
              {describeWeightRate(
                bodyWeight.ratePerWeek,
                bodyWeight.direction,
                bodyWeight.unit,
                bodyWeight.windowWeeks,
              )}
            </HelperText>
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
            testId="body-weight-chart"
          />
        ) : null}

        {rangeDelta ? (
          <HelperText data-testid="body-weight-range-delta">
            {`${rangeDelta.change >= 0 ? '+' : '−'}${Math.abs(rangeDelta.change).toFixed(1)} ${
              bodyWeight.unit
            } between ${formatDate(rangeDelta.from)} and ${formatDate(rangeDelta.to)}`}
          </HelperText>
        ) : null}

        {latestWeek ? (
          <SummaryDetail data-testid="body-weight-week-range">
            {`${
              latestWeek.weekStart === weekStartOf(localDate)
                ? 'This week'
                : `Week of ${formatDate(latestWeek.weekStart)}`
            }: avg ${latestWeek.average.toFixed(1)} · range ${latestWeek.low.toFixed(
              1,
            )}–${latestWeek.high.toFixed(1)} ${bodyWeight.unit}`}
          </SummaryDetail>
        ) : null}
      </Stack>
    </Card>
  );
}

function ExerciseCard({
  exercise,
  localDate,
}: {
  exercise: ProgressOverviewResponse['exercises'][number];
  localDate: string;
}) {
  const navigate = useNavigate();
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
      <Stack>
        <SectionHeader>
          <SectionTitle>{exercise.exerciseName}</SectionTitle>
          <RangeSelector
            ranges={ranges}
            value={range}
            onChange={setRange}
            label={`${exercise.exerciseName} time range`}
          />
        </SectionHeader>

        <MetricRow>
          {latest?.metrics.map((metric) => (
            <MetricChip key={metric.key}>
              <MetricChipLabel>
                {metricLabel(metric.key)}
                <MetricInfoFor metricKey={metric.key} />
              </MetricChipLabel>
              {/* Never a zero: an applicable metric with no data says so. */}
              <MetricChipValue>
                {formatMetricValue(metric.key as ProgressMetricKey, metric.value, {
                  loadUnit: metric.loadUnit,
                  distanceUnit: metric.distanceUnit,
                }) ?? 'Not logged'}
              </MetricChipValue>
            </MetricChip>
          ))}
        </MetricRow>

        {headlineKey && plottable.length >= minimumSessions ? (
          <LineChart
            series={visible}
            zeroBased={metricDefinition(headlineKey).aggregation === 'total'}
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
              if (point?.meta) navigate(`/workout/${point.meta.sessionId}`);
            }}
            testId={`exercise-chart-${exercise.exerciseId}`}
          />
        ) : (
          <HelperText data-testid="exercise-insufficient">
            {`${exercise.sessionCount} ${
              exercise.sessionCount === 1 ? 'session' : 'sessions'
            } logged. A trend needs at least ${minimumSessions}.`}
          </HelperText>
        )}

        <SessionRow type="button" onClick={() => navigate(`/history/${exercise.exerciseId}`)}>
          <span>See full history</span>
          <span aria-hidden>→</span>
        </SessionRow>
      </Stack>
    </Card>
  );
}

export function ProgressPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const localDate = todayLocalDate();
  const windowWeeks = 12;

  const query = useQuery({
    queryKey: ['progress-overview', localDate, windowWeeks],
    queryFn: () =>
      api.get<ProgressOverviewResponse>(
        `/progress/overview?weeks=${windowWeeks}&localDate=${localDate}`,
      ),
  });

  // A deployed API can lag the deployed client, so an older response shape is
  // a real possibility rather than a theoretical one. Treat anything that is
  // not the contract as an error state instead of destructuring into a crash.
  const overview = isProgressOverview(query.data) ? query.data : null;

  const sessionSeries = useMemo<SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[]>(
    () =>
      (overview?.training.weeks ?? []).map((week) => ({
        localDate: week.weekStart,
        // Zero is a real, meaningful value for a week count, so it is plotted
        // rather than nulled — a missed week has to be visible.
        value: week.completedCount,
        meta: { isCurrent: week.isCurrent, isRest: week.isRestWeek },
      })),
    [overview],
  );

  const volumeSeries = useMemo<SeriesPoint<{ isCurrent?: boolean }>[]>(
    () =>
      (overview?.training.weeks ?? []).map((week) => ({
        localDate: week.weekStart,
        value: week.volume,
        meta: { isCurrent: week.isCurrent },
      })),
    [overview],
  );

  if (query.isLoading) return <ProgressSkeleton />;

  if (query.isError || !overview) {
    return (
      <Page>
        <h1>Progress</h1>
        <Card>
          <HelperText>
            We could not load your progress just now. Refresh the page or try again shortly.
          </HelperText>
        </Card>
      </Page>
    );
  }

  const { training, bodyWeight, exercises, recentSessions } = overview;
  const currentWeek = training.weeks.at(-1);
  const hasAnyVolume = volumeSeries.some((point) => point.value != null);
  // Story 31: the chart's active period must be stated explicitly, not left
  // for the user to infer from bars — this is the exact span the two
  // weekly ColumnCharts below render, so it can never drift from what the
  // chart actually shows.
  const trainingWindowRange =
    training.weeks.length > 0
      ? formatDateRangeLabel(training.weeks[0]!.weekStart, formatWeekEnd(training.weeks.at(-1)!.weekStart))
      : null;
  const hasAnyData = training.totalCompleted > 0 || bodyWeight.checkInCount > 0;

  if (!hasAnyData) {
    return (
      <Page>
        <div>
          <h1>Progress</h1>
          <HelperText>Your trends will appear here as you train.</HelperText>
        </div>
        <Card>
          <Stack>
            <SectionTitle>Nothing to chart yet</SectionTitle>
            <HelperText>
              Complete a workout or log your morning weight on Today. We will not draw a trend until
              there is enough data for it to mean something.
            </HelperText>
          </Stack>
        </Card>
      </Page>
    );
  }

  return (
    <FadeIn>
      <Page>
        <div>
          <h1>Progress</h1>
          <HelperText>How your training, strength and weight are actually moving.</HelperText>
        </div>

        <SummaryGrid>
          <SummaryCard $accent="green">
            <SummaryLabel>
              Weeks trained
              <MetricInfo
                label="Weeks trained"
                explanation={`How many of the last ${training.windowWeeks} weeks you trained at least once.`}
                calculation="Any week containing a completed session counts."
                limitation="We show this instead of a streak on purpose: a streak drops to zero the moment you miss a week, and one ordinary bad week should not wipe out months of work."
              />
            </SummaryLabel>
            <SummaryValue data-testid="weeks-trained">
              {training.weeksTrained}
              <SummaryUnit> of {training.windowWeeks}</SummaryUnit>
            </SummaryValue>
            <SummaryDetail>
              {training.averageSessionsPerWeek.toFixed(1)} sessions/week average
            </SummaryDetail>
          </SummaryCard>

          <SummaryCard $accent="purple">
            <SummaryLabel>
              This week
              <MetricInfo
                label="Sessions this week"
                explanation="Workouts you have completed since Monday."
                calculation="Completed sessions dated within the current week."
                limitation={null}
              />
            </SummaryLabel>
            <SummaryValue data-testid="sessions-this-week">
              {currentWeek?.completedCount ?? 0}
            </SummaryValue>
            <SummaryDetail>
              {currentWeek?.completionRatio != null
                ? `${Math.round(currentWeek.completionRatio * 100)}% of plan`
                : 'No plan set for this week'}
            </SummaryDetail>
          </SummaryCard>

          <SummaryCard>
            <SummaryLabel>
              Streak
              <MetricInfo
                label="Training streak"
                explanation="Consecutive weeks with at least one workout."
                calculation="Counted back from your most recent completed week. The current week does not break it while it is still in progress."
                limitation="Your best streak is kept even after the current one ends — it happened, and it still counts."
              />
            </SummaryLabel>
            <SummaryValue data-testid="current-streak">{training.currentStreakWeeks}</SummaryValue>
            <SummaryDetail>Best: {training.longestStreakWeeks} weeks</SummaryDetail>
          </SummaryCard>

          <SummaryCard $accent="purple">
            <SummaryLabel>Body weight</SummaryLabel>
            <SummaryValue data-testid="summary-body-weight">
              {bodyWeight.currentAverage != null
                ? bodyWeight.currentAverage.toFixed(1)
                : bodyWeight.latestCheckIn
                  ? bodyWeight.latestCheckIn.weightValue.toFixed(1)
                  : '—'}
              <SummaryUnit> {bodyWeight.unit}</SummaryUnit>
            </SummaryValue>
            <SummaryDetail>
              {bodyWeight.currentAverage != null ? '7-day average' : 'Latest check-in'}
            </SummaryDetail>
          </SummaryCard>
        </SummaryGrid>

        <TwoColumn>
          <Card>
            <Stack>
              <SectionHeader>
                <SectionTitle>
                  Sessions per week
                  <MetricInfo
                    label="Sessions per week"
                    explanation="How many workouts you completed in each of the last few weeks."
                    calculation="One bar per week, Monday to Sunday. Weeks with no training are shown as empty slots so gaps stay visible, and a week you spent resting is tinted rather than left grey."
                    limitation="The current week is still in progress, so its bar will usually be shorter."
                  />
                </SectionTitle>
              </SectionHeader>
              {trainingWindowRange ? (
                <HelperText data-testid="sessions-range-context">{trainingWindowRange}</HelperText>
              ) : null}
              <ColumnChart
                series={sessionSeries}
                formatValue={(value) => `${Math.round(value)}`}
                formatPeriod={(weekStart) => formatWeekRange(weekStart)}
                label={`Completed sessions per week over the last ${training.windowWeeks} weeks`}
                emptyLabel="No sessions"
                testId="sessions-chart"
              />
              <HelperText>
                {`${training.totalCompleted} sessions across ${training.windowWeeks} weeks. This week is highlighted in green.`}
              </HelperText>
            </Stack>
          </Card>

          <BodyWeightSection bodyWeight={bodyWeight} localDate={localDate} />
        </TwoColumn>

        {hasAnyVolume ? (
          <Card>
            <Stack>
              <SectionHeader>
                <SectionTitle>
                  Weekly volume
                  <MetricInfo
                    label="Weekly volume"
                    explanation="The total weight you moved each week, across weighted lifts only."
                    calculation="Weight × reps summed over every completed set of a weighted exercise. Cardio and bodyweight work are excluded because they carry no load to total."
                    limitation="Volume measures work done, not strength. It normally falls when you train heavier for fewer reps or take a deload week, and that is not a step backwards."
                  />
                </SectionTitle>
              </SectionHeader>
              {trainingWindowRange ? (
                <HelperText data-testid="volume-range-context">{trainingWindowRange}</HelperText>
              ) : null}
              <ColumnChart
                series={volumeSeries}
                formatValue={(value) =>
                  `${Math.round(value).toLocaleString()} ${training.volumeUnit}`
                }
                formatPeriod={(weekStart) => formatWeekRange(weekStart)}
                label={`Weekly training volume in ${training.volumeUnit}`}
                emptyLabel="No weighted work"
                testId="volume-chart"
              />
            </Stack>
          </Card>
        ) : null}

        {exercises.length ? (
          <Stack $gap={spacing[16]}>
            <div>
              <SectionTitle>Strength</SectionTitle>
              <HelperText>
                Each exercise shows only the measures that make sense for how it is programmed.
              </HelperText>
            </div>
            <ExerciseList>
              {exercises.slice(0, 4).map((exercise) => (
                <ExerciseCard key={exercise.exerciseId} exercise={exercise} localDate={localDate} />
              ))}
            </ExerciseList>
          </Stack>
        ) : null}

        {recentSessions.length ? (
          <Card>
            <Stack>
              <SectionTitle>Recent sessions</SectionTitle>
              {recentSessions.map((session) => (
                <SessionRow
                  key={session.sessionId}
                  type="button"
                  onClick={() => navigate(`/workout/${session.sessionId}`)}
                  data-testid="recent-session"
                >
                  <div>
                    <SessionName>{session.sessionName}</SessionName>
                    <SummaryDetail>
                      {`${formatDate(session.localDate)} · ${session.exerciseCount} exercises · ${
                        session.setCount
                      } sets`}
                      {session.volume != null
                        ? ` · ${Math.round(session.volume).toLocaleString()} ${training.volumeUnit}`
                        : ''}
                    </SummaryDetail>
                  </div>
                  {session.prCount > 0 ? (
                    <PrPill>{`${session.prCount} PR${session.prCount === 1 ? '' : 's'}`}</PrPill>
                  ) : null}
                </SessionRow>
              ))}
            </Stack>
          </Card>
        ) : null}
      </Page>
    </FadeIn>
  );
}
