import styled from 'styled-components';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { calculateVolume, estimateOneRepMax } from '@setline/domain';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, PRBadge, Select } from '../components';
import { useApiClient } from '../lib/api-client';

const Page = styled.div`
  display: grid;
  gap: ${spacing[24]}px;
`;

const PickerRow = styled.div`
  max-width: 360px;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[12]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const DesktopStatCard = styled(Card)`
  display: none;

  ${mq.tablet} {
    display: block;
  }
`;

const MobileStatsCard = styled(Card)`
  display: grid;
  gap: ${spacing[12]}px;

  ${mq.tablet} {
    display: none;
  }
`;

const MobileStatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${spacing[12]}px;
`;

const StatLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const StatValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
`;

const TrendGrid = styled.div`
  display: grid;
  gap: ${spacing[16]}px;

  ${mq.desktop} {
    grid-template-columns: 1fr 1fr;
  }
`;

const TrendList = styled.div`
  display: grid;
  gap: ${spacing[12]}px;
`;

const SessionCard = styled(Card)`
  display: grid;
  gap: ${spacing[12]}px;
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${spacing[12]}px;
`;

const MetaText = styled.p`
  margin: 0;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const SetLine = styled.div`
  font-size: ${typeScale.compactBody.fontSize}px;
  font-variant-numeric: tabular-nums;
  color: ${(p) => p.theme.text.secondary};
`;

const EmptyState = styled(Card)`
  display: grid;
  gap: ${spacing[8]}px;
`;

interface ExerciseSummary {
  id: string;
  name: string;
}

interface HistoryItem {
  sessionId: string;
  sessionLocalDate: string;
  sessionCompletedAt: string | null;
  sessionName: string;
  setId: string;
  exerciseLogId: string;
  setType: string;
  sortOrder: number;
  weightValue: number | null;
  weightUnit: 'lb' | 'kg' | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
  rpe: number | null;
  isPrWeight: boolean;
  isPrReps: boolean;
  notes: string | null;
}

interface ExerciseHistoryResponse {
  items: HistoryItem[];
  nextCursor: string | null;
}

interface ExerciseProgressResponse {
  exerciseId: string;
  points: {
    sessionId: string;
    localDate: string;
    sessionName: string;
    topWeight: number | null;
    topReps: number | null;
    estimatedOneRepMax: number | null;
    volume: number;
    isWeightPr: boolean;
    isRepPr: boolean;
  }[];
}

function formatSessionDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function ExerciseHistoryPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const { exerciseId } = useParams<{ exerciseId?: string }>();

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<ExerciseSummary[]>('/exercises'),
  });

  const selectedExercise = useMemo(() => {
    if (!exercisesQuery.data?.length) return null;
    return exercisesQuery.data.find((exercise) => exercise.id === exerciseId) ?? null;
  }, [exerciseId, exercisesQuery.data]);

  useEffect(() => {
    if (!exerciseId && exercisesQuery.data?.[0]) {
      navigate(`/history/${exercisesQuery.data[0].id}`, { replace: true });
      return;
    }
    if (exerciseId && exercisesQuery.data?.length && !selectedExercise) {
      navigate(`/history/${exercisesQuery.data[0]!.id}`, { replace: true });
    }
  }, [exerciseId, exercisesQuery.data, navigate, selectedExercise]);

  const historyQuery = useQuery({
    queryKey: ['exercise-history', selectedExercise?.id],
    queryFn: () => api.get<ExerciseHistoryResponse>(`/exercises/${selectedExercise!.id}/history`),
    enabled: !!selectedExercise,
  });

  const progressQuery = useQuery({
    queryKey: ['exercise-progress', selectedExercise?.id],
    queryFn: () => api.get<ExerciseProgressResponse>(`/exercises/${selectedExercise!.id}/progress`),
    enabled: !!selectedExercise,
  });

  const sessionGroups = useMemo(() => {
    const grouped = new Map<string, HistoryItem[]>();
    for (const item of historyQuery.data?.items ?? []) {
      const list = grouped.get(item.sessionId) ?? [];
      list.push(item);
      grouped.set(item.sessionId, list);
    }
    return [...grouped.entries()]
      .map(([sessionId, items]) => ({
        sessionId,
        localDate: items[0]!.sessionLocalDate,
        completedAt: items[0]!.sessionCompletedAt,
        sessionName: items[0]!.sessionName,
        items: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .sort((a, b) => b.localDate.localeCompare(a.localDate));
  }, [historyQuery.data]);

  const topSet = useMemo(
    () =>
      (historyQuery.data?.items ?? []).reduce<HistoryItem | null>((best, item) => {
        if (item.weightValue == null || item.reps == null) return best;
        if (!best) return item;
        return estimateOneRepMax(item.weightValue, item.reps) > estimateOneRepMax(best.weightValue!, best.reps!)
          ? item
          : best;
      }, null),
    [historyQuery.data],
  );

  const estimated1RM =
    topSet?.weightValue != null && topSet.reps != null ? Math.round(estimateOneRepMax(topSet.weightValue, topSet.reps)) : null;
  const lastSessionVolume =
    sessionGroups[0] != null
      ? calculateVolume(sessionGroups[0].items.map((item) => ({ weightValue: item.weightValue, reps: item.reps })))
      : 0;

  if (exercisesQuery.isLoading) return <span>Loading exercises…</span>;
  if (exercisesQuery.isError || !exercisesQuery.data) return <span>Couldn't load exercises.</span>;

  return (
    <Page>
      <div>
        <h1>{selectedExercise ? `${selectedExercise.name} history` : 'Exercise history'}</h1>
        <MetaText>Pick an exercise to review session history, volume, personal records, and estimated strength trends.</MetaText>
      </div>

      <PickerRow>
        <Select
          label="Exercise"
          value={selectedExercise?.id ?? ''}
          options={exercisesQuery.data.map((exercise) => ({ value: exercise.id, label: exercise.name }))}
          onChange={(event) => navigate(`/history/${event.target.value}`)}
        />
      </PickerRow>

      {selectedExercise && (
        <>
          <StatRow>
            <MobileStatsCard>
              <MobileStatRow>
                <StatLabel>Top set</StatLabel>
                <StatValue>{topSet ? `${topSet.weightValue} × ${topSet.reps}` : '—'}</StatValue>
              </MobileStatRow>
              <MobileStatRow>
                <StatLabel>Estimated 1RM</StatLabel>
                <StatValue>{estimated1RM != null ? `${estimated1RM} lb` : '—'}</StatValue>
              </MobileStatRow>
              <MobileStatRow>
                <StatLabel>Last session volume</StatLabel>
                <StatValue>{lastSessionVolume ? `${lastSessionVolume.toLocaleString()} lb` : '—'}</StatValue>
              </MobileStatRow>
            </MobileStatsCard>
            <DesktopStatCard>
              <StatLabel>Top Set</StatLabel>
              <StatValue>{topSet ? `${topSet.weightValue} × ${topSet.reps}` : '—'}</StatValue>
            </DesktopStatCard>
            <DesktopStatCard>
              <StatLabel>Est. 1RM</StatLabel>
              <StatValue>{estimated1RM != null ? `${estimated1RM} lb` : '—'}</StatValue>
            </DesktopStatCard>
            <DesktopStatCard>
              <StatLabel>Last Session Volume</StatLabel>
              <StatValue>{lastSessionVolume ? `${lastSessionVolume.toLocaleString()} lb` : '—'}</StatValue>
            </DesktopStatCard>
          </StatRow>

          <TrendGrid>
            <Card>
              <h2>Strength trend</h2>
              {progressQuery.isLoading ? (
                <MetaText>Loading trend…</MetaText>
              ) : progressQuery.data?.points.length ? (
                <TrendList>
                  {progressQuery.data.points.slice(-5).reverse().map((point) => (
                    <div key={point.sessionId}>
                      <strong>{formatSessionDate(point.localDate)}</strong>
                      <MetaText>
                        {point.estimatedOneRepMax != null ? `${point.estimatedOneRepMax} lb est. 1RM` : 'Need load + reps'} ·{' '}
                        {point.topWeight != null && point.topReps != null ? `top set ${point.topWeight} × ${point.topReps}` : 'no top set'}
                      </MetaText>
                    </div>
                  ))}
                </TrendList>
              ) : (
                <MetaText>
                  No {selectedExercise.name.toLowerCase()} history yet. Complete a workout containing {selectedExercise.name} and your trend will appear here.
                </MetaText>
              )}
            </Card>

            <Card>
              <h2>Volume + PRs</h2>
              {progressQuery.data?.points.length ? (
                <TrendList>
                  {progressQuery.data.points.slice(-5).reverse().map((point) => (
                    <div key={`${point.sessionId}-volume`}>
                      <strong>{formatSessionDate(point.localDate)}</strong>
                      <MetaText>
                        {point.volume.toLocaleString()} lb volume
                        {point.isWeightPr || point.isRepPr
                          ? ` · ${[point.isWeightPr ? 'Weight PR' : null, point.isRepPr ? 'Rep PR' : null].filter(Boolean).join(' + ')}`
                          : ''}
                      </MetaText>
                    </div>
                  ))}
                </TrendList>
              ) : (
                <MetaText>Not enough {selectedExercise.name.toLowerCase()} history yet to show a trend.</MetaText>
              )}
            </Card>
          </TrendGrid>

          {historyQuery.isLoading ? (
            <span>Loading history…</span>
          ) : sessionGroups.length === 0 ? (
            <EmptyState>
              <h2>No {selectedExercise.name.toLowerCase()} history yet</h2>
              <MetaText>
                Complete a workout containing {selectedExercise.name} and your sets, estimated strength trend, and PRs will appear here.
              </MetaText>
              <MetaText>Use Today to start a workout, then come back here to compare future sessions.</MetaText>
            </EmptyState>
          ) : (
            <TrendList>
              {sessionGroups.map((session) => {
                const hasPr = session.items.some((item) => item.isPrWeight || item.isPrReps);
                return (
                  <SessionCard key={session.sessionId}>
                    <SessionHeader>
                      <div>
                        <strong>{session.sessionName}</strong>
                        <MetaText>{formatSessionDate(session.localDate)}</MetaText>
                      </div>
                      {hasPr ? <PRBadge /> : null}
                    </SessionHeader>
                    {session.items.map((item, index) => (
                      <SetLine key={item.setId}>
                        Set {index + 1}: {item.weightValue ?? '—'}
                        {item.weightUnit ? ` ${item.weightUnit}` : ''} × {item.reps ?? '—'}
                        {item.rpe != null ? ` · RPE ${item.rpe}` : ''}
                        {item.isPrWeight ? ' · Weight PR' : ''}
                        {item.isPrReps ? ' · Rep PR' : ''}
                      </SetLine>
                    ))}
                  </SessionCard>
                );
              })}
            </TrendList>
          )}
        </>
      )}
    </Page>
  );
}
