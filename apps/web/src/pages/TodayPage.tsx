import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, Button } from '../components';
import { useApiClient } from '../lib/api-client';

/**
 * Today — dashboard with a pre-workout preview card (style guide §18
 * Idea 5) and a "From Apple Health" metric grid with trend-vs-30-day-avg
 * indicators (style guide §18 Idea 4). cycleLengthWeeks/
 * estimatedDurationMinutes come from docs/data-model.md's TrainingProgram/
 * WorkoutTemplate fields.
 *
 * Mobile-first: base layout stacks planned-workout + metrics in a single
 * column (matching `Screen/Mobile/Today`); the 2-column layout (matching
 * `Screen/Web/Today`'s "planned workout + check-in on the left, ... on
 * the right" per style guide §14) only applies from `tablet` up.
 */
interface TodayMetric {
  label: string;
  value: string;
  trendDirection: 'up' | 'down';
  trendLabel: string;
}

/**
 * Response shape of GET /v1/dashboard/today (see
 * apps/api/src/routes/dashboard.ts) — a passthrough aggregate, not yet a
 * finalized Zod schema. weekLabel/dayLabel/estimatedDurationMinutes are
 * always null until phase-4 program-activation work lands server-side.
 */
interface DashboardTodayResponse {
  localDate: string;
  sessions: { id: string; status: string; templateId: string | null }[];
  activitySummary: {
    steps: number | null;
    activeEnergyKcal: string | null;
    exerciseMinutes: number | null;
  } | null;
  nutritionSnapshot: { caloriesKcal: string | null } | null;
  weekLabel: string | null;
  dayLabel: string | null;
  estimatedDurationMinutes: number | null;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[24]}px;

  ${mq.tablet} {
    grid-template-columns: 1.4fr 1fr;
  }
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const SectionTitle = styled.h2`
  font-size: ${typeScale.sectionTitle.fontSize}px;
  font-weight: ${typeScale.sectionTitle.fontWeight};
  margin: 0;
`;

const WorkoutSubtitle = styled.p`
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: 0 0 ${spacing[16]}px;
`;

const ActionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    flex-direction: row;
  }
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[12]}px;

  ${mq.tablet} {
    grid-template-columns: 1fr 1fr;
  }
`;

const MetricTile = styled(Card)`
  border-radius: ${radius.large}px;
`;

const MetricLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const MetricValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
`;

const TrendRow = styled.div<{ $direction: 'up' | 'down' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => (p.$direction === 'up' ? p.theme.status.success : p.theme.status.error)};
`;

async function fetchToday(
  api: ReturnType<typeof useApiClient>,
  localDate: string,
): Promise<DashboardTodayResponse> {
  return api.get<DashboardTodayResponse>(`/dashboard/today?localDate=${localDate}`);
}

function todaysLocalDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TodayPage() {
  const api = useApiClient();
  const localDate = todaysLocalDate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => fetchToday(api, localDate),
  });

  const plannedSession = data?.sessions.find((s) => s.status !== 'abandoned') ?? null;

  // TODO: apps/api's /v1/dashboard/today doesn't yet expose 30-day-avg
  // comparisons (only raw daily_activity_summary/daily_nutrition_snapshot
  // rows) — trend direction/label are display-only placeholders until a
  // trend-comparison endpoint exists.
  const rawMetrics: (TodayMetric | null)[] = data
    ? [
        data.activitySummary?.steps != null
          ? {
              label: 'Steps',
              value: data.activitySummary.steps.toLocaleString(),
              trendDirection: 'up',
              trendLabel: 'today',
            }
          : null,
        data.activitySummary?.activeEnergyKcal != null
          ? {
              label: 'Active Calories',
              value: Math.round(Number(data.activitySummary.activeEnergyKcal)).toString(),
              trendDirection: 'up',
              trendLabel: 'today',
            }
          : null,
        data.activitySummary?.exerciseMinutes != null
          ? {
              label: 'Exercise Minutes',
              value: data.activitySummary.exerciseMinutes.toString(),
              trendDirection: 'up',
              trendLabel: 'today',
            }
          : null,
        data.nutritionSnapshot?.caloriesKcal != null
          ? {
              label: 'Calories (MFP)',
              value: Math.round(Number(data.nutritionSnapshot.caloriesKcal)).toLocaleString(),
              trendDirection: 'up',
              trendLabel: 'today',
            }
          : null,
      ]
    : [];
  const metrics: TodayMetric[] = rawMetrics.filter((m): m is TodayMetric => m !== null);

  return (
    <Grid>
      <Section>
        <SectionTitle>Today's Workout</SectionTitle>
        <Card>
          {isLoading ? (
            <span>Loading…</span>
          ) : isError ? (
            <span>Couldn't load today's plan.</span>
          ) : plannedSession ? (
            <>
              <strong>Workout in progress</strong>
              <WorkoutSubtitle>
                Status: {plannedSession.status}
                {data?.estimatedDurationMinutes ? ` · ~${data.estimatedDurationMinutes} min` : ''}
              </WorkoutSubtitle>
              <ActionRow>
                <Button variant="primary">Continue Workout</Button>
                <Button variant="secondary">Preview</Button>
              </ActionRow>
            </>
          ) : (
            <>
              <span>No workout planned today.</span>
              <ActionRow>
                <Button variant="primary">Start Ad-hoc Workout</Button>
              </ActionRow>
            </>
          )}
        </Card>
      </Section>

      <Section>
        <SectionTitle>From Apple Health</SectionTitle>
        <MetricGrid>
          {isLoading ? (
            <span>Loading…</span>
          ) : metrics.length === 0 ? (
            <span>No Apple Health data synced for today yet.</span>
          ) : (
            metrics.map((metric) => {
              const TrendIcon = metric.trendDirection === 'up' ? TrendingUp : TrendingDown;
              return (
                <MetricTile key={metric.label}>
                  <MetricLabel>{metric.label}</MetricLabel>
                  <MetricValue>{metric.value}</MetricValue>
                  <TrendRow $direction={metric.trendDirection}>
                    <TrendIcon size={14} aria-hidden="true" />
                    {metric.trendLabel}
                  </TrendRow>
                </MetricTile>
              );
            })
          )}
        </MetricGrid>
      </Section>
    </Grid>
  );
}
