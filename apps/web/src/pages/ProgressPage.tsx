import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card } from '../components';
import { useApiClient } from '../lib/api-client';

/**
 * Progress — trend cards (label + headline + delta + sparkline) and the
 * consistency-streak widget, per style guide §11/§19.3. Mobile-first:
 * base layout stacks trend cards single-column (matching
 * `Screen/Mobile/Progress`); from `tablet` up they wrap into a
 * multi-column row (matching the web version's `layoutWrap: "WRAP"`
 * note in §19.3), and the consistency streak grid only needs the fixed
 * 8-column layout once there's enough width for it not to feel cramped.
 *
 * Figma's design calls for 5 trend cards (body weight, weekly volume,
 * secondary lift, workouts/month, primary lift 1RM), but 3 of those
 * (body weight, weekly volume, secondary lift) require backend
 * aggregation endpoints that are still phase-3/4 stubs (see TODOs on
 * GET /v1/exercises/:exerciseId/progress and /history in
 * apps/api/src/routes/exercises.ts) — deferred until that lands. Added
 * two more cards derivable from data already fetched here (workouts
 * this week + 8-week average) to reduce the gap in the meantime.
 */
const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[16]}px;
  margin-bottom: ${spacing[24]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(2, 1fr);
  }

  ${mq.desktop} {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
`;

const TrendLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const TrendValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
  margin: ${spacing[4]}px 0;
`;

const TrendDelta = styled.div`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.status.success};
`;

const Sparkline = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 32px;
  margin-top: ${spacing[8]}px;
`;

const Bar = styled.div<{ $height: number }>`
  width: 8px;
  height: ${(p) => p.$height}%;
  background: ${(p) => p.theme.action.primary};
  border-radius: 2px;
`;

const StreakGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${spacing[8]}px;
  margin-top: ${spacing[12]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(8, 1fr);
  }
`;

const WeekColumn = styled.div`
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  gap: 4px;
  justify-items: center;
`;

const Dot = styled.div<{ $filled: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => (p.$filled ? p.theme.action.primary : p.theme.action.accentSubtle)};
`;

interface ConsistencyWeek {
  weekStart: string;
  plannedCount: number;
  completedCount: number;
  completionRatio: number | null;
}

interface ProgressPoint {
  localDate: string;
  estimatedOneRepMax?: number;
  volume?: number;
}

export function ProgressPage() {
  const api = useApiClient();

  const { data: weeks, isLoading: consistencyLoading } = useQuery({
    queryKey: ['progress-consistency'],
    queryFn: () => api.get<ConsistencyWeek[]>('/progress/consistency?weeks=8'),
  });

  const { data: exercises } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/exercises'),
  });
  const primaryExercise = exercises?.[0] ?? null;

  const { data: exerciseProgress } = useQuery({
    queryKey: ['exercise-progress', primaryExercise?.id],
    // TODO: apps/api's GET /v1/exercises/:exerciseId/progress is a stub
    // that always returns `{ points: [] }` (see apps/api/src/routes/
    // exercises.ts) — the 1RM/volume trend cards below fall back to an
    // empty state until that route computes real trend data.
    queryFn: () => api.get<{ points: ProgressPoint[] }>(`/exercises/${primaryExercise!.id}/progress`),
    enabled: !!primaryExercise,
  });

  const points = exerciseProgress?.points ?? [];
  const latestPoint = points[points.length - 1] ?? null;

  const completedPerWeek = weeks?.map((w) => w.completedCount) ?? [];
  const plannedPerWeek = weeks?.map((w) => w.plannedCount) ?? [];
  const totalCompleted = completedPerWeek.reduce((a, b) => a + b, 0);
  const totalPlanned = plannedPerWeek.reduce((a, b) => a + b, 0);
  const maxDots = Math.max(4, ...completedPerWeek, ...plannedPerWeek);
  const avgWorkoutsPerWeek = completedPerWeek.length ? totalCompleted / completedPerWeek.length : 0;
  const thisWeekCompleted = completedPerWeek[completedPerWeek.length - 1] ?? 0;
  const lastWeekCompleted = completedPerWeek[completedPerWeek.length - 2] ?? 0;

  const trends = [
    latestPoint?.estimatedOneRepMax != null
      ? {
          label: `${primaryExercise?.name ?? 'Exercise'} Est. 1RM`,
          value: `${Math.round(latestPoint.estimatedOneRepMax)} lb`,
          delta: '',
          bars: points.slice(-6).map((p) => Math.min(100, (p.estimatedOneRepMax ?? 0) / 3)),
        }
      : null,
    completedPerWeek.length
      ? {
          label: 'Workouts this week',
          value: `${thisWeekCompleted}`,
          delta: lastWeekCompleted ? `${thisWeekCompleted >= lastWeekCompleted ? '+' : ''}${thisWeekCompleted - lastWeekCompleted} vs last week` : '',
          bars: completedPerWeek.slice(-6).map((c) => Math.min(100, (c / maxDots) * 100)),
        }
      : null,
    completedPerWeek.length
      ? {
          label: 'Avg workouts / week (8 wk)',
          value: avgWorkoutsPerWeek.toFixed(1),
          delta: '',
          bars: completedPerWeek.slice(-6).map((c) => Math.min(100, (c / maxDots) * 100)),
        }
      : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <div>
      <h1>Progress</h1>

      {trends.length > 0 && (
        <CardGrid>
          {trends.map((trend) => (
            <Card key={trend.label}>
              <TrendLabel>{trend.label}</TrendLabel>
              <TrendValue>{trend.value}</TrendValue>
              <TrendDelta>{trend.delta}</TrendDelta>
              <Sparkline>
                {trend.bars.map((h, i) => (
                  <Bar key={i} $height={h} />
                ))}
              </Sparkline>
            </Card>
          ))}
        </CardGrid>
      )}

      <Card>
        <h2 style={{ marginTop: 0 }}>Consistency (last 8 weeks)</h2>
        {consistencyLoading ? (
          <p>Loading…</p>
        ) : completedPerWeek.length === 0 ? (
          <p>No workout history yet — complete a workout to see your streak here.</p>
        ) : (
          <>
            <StreakGrid>
              {completedPerWeek.map((completed, weekIndex) => (
                <WeekColumn key={weekIndex}>
                  {Array.from({ length: maxDots }).map((_, dotIndex) => (
                    <Dot key={dotIndex} $filled={dotIndex < completed} />
                  ))}
                </WeekColumn>
              ))}
            </StreakGrid>
            <p style={{ fontWeight: 600, marginBottom: 0 }}>
              {totalCompleted} of {totalPlanned || totalCompleted} sessions completed
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
