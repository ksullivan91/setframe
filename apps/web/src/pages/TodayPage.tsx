import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, Button } from '../components';

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
interface TodayData {
  plannedWorkout: {
    name: string;
    weekNumber: number;
    dayNumber: number;
    exerciseCount: number;
    estimatedDurationMinutes: number;
  } | null;
  metrics: {
    label: string;
    value: string;
    trendDirection: 'up' | 'down';
    trendLabel: string;
  }[];
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

async function fetchToday(): Promise<TodayData> {
  // Placeholder shape until apps/api's Today endpoint is finalized (see
  // docs/api.md). Falls back to representative sample data so the page
  // renders meaningfully during development.
  return {
    plannedWorkout: {
      name: 'Push Day',
      weekNumber: 2,
      dayNumber: 3,
      exerciseCount: 5,
      estimatedDurationMinutes: 50,
    },
    metrics: [
      { label: 'Steps', value: '8,412', trendDirection: 'up', trendLabel: '+6% vs 30-day avg' },
      { label: 'Active Calories', value: '410', trendDirection: 'up', trendLabel: '+3% vs 30-day avg' },
      { label: 'Exercise Minutes', value: '32', trendDirection: 'down', trendLabel: '-8% vs 30-day avg' },
      { label: 'Calories (MFP)', value: '2,180', trendDirection: 'down', trendLabel: '-2% vs 30-day avg' },
    ],
  };
}

export function TodayPage() {
  const { data } = useQuery({ queryKey: ['today'], queryFn: fetchToday });

  return (
    <Grid>
      <Section>
        <SectionTitle>Today's Workout</SectionTitle>
        <Card>
          {data?.plannedWorkout ? (
            <>
              <strong>{data.plannedWorkout.name}</strong>
              <WorkoutSubtitle>
                Week {data.plannedWorkout.weekNumber} · Day {data.plannedWorkout.dayNumber} ·{' '}
                {data.plannedWorkout.exerciseCount} exercises · ~
                {data.plannedWorkout.estimatedDurationMinutes - 5}–
                {data.plannedWorkout.estimatedDurationMinutes + 5} min
              </WorkoutSubtitle>
              <ActionRow>
                <Button variant="primary">Start Workout</Button>
                <Button variant="secondary">Preview</Button>
              </ActionRow>
            </>
          ) : (
            <span>No workout planned today.</span>
          )}
        </Card>
      </Section>

      <Section>
        <SectionTitle>From Apple Health</SectionTitle>
        <MetricGrid>
          {data?.metrics.map((metric) => {
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
          })}
        </MetricGrid>
      </Section>
    </Grid>
  );
}
