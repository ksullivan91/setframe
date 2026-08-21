import styled from 'styled-components';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { estimateOneRepMax, calculateVolume } from '@setline/domain';
import { spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, PRBadge, Select } from '../components';
import { useApiClient } from '../lib/api-client';

/**
 * ExerciseHistory — web-nav-only per style guide §13/§14. Restrained
 * stat-tile row (top set, est. 1RM via Epley formula, last session
 * volume — deliberately no chart, per spec's "keep charts restrained").
 * Mobile-first: stat tiles stack single-column on narrow viewports, then
 * become a 3-up row from `tablet` up.
 */
const StatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[12]}px;
  margin-bottom: ${spacing[24]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const StatLabel = styled.div`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const StatValue = styled.div`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
`;

const SessionCard = styled(Card)`
  margin-bottom: ${spacing[12]}px;
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing[8]}px;
`;

const SetLine = styled.div`
  font-size: ${typeScale.compactBody.fontSize}px;
  font-variant-numeric: tabular-nums;
  color: ${(p) => p.theme.text.secondary};
`;

const PickerRow = styled.div`
  max-width: 320px;
  margin-bottom: ${spacing[16]}px;
`;

const sessionsGroupKey = (localDate: string) => localDate;

interface HistorySetItem {
  weightValue: number | null;
  reps: number | null;
  sessionLocalDate?: string;
  isPrWeight?: boolean;
  isPrReps?: boolean;
}

interface ExerciseHistoryResponse {
  items: HistorySetItem[];
  nextCursor: string | null;
}

export function ExerciseHistoryPage() {
  const api = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: exercises } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/exercises'),
  });

  const requestedExerciseId = searchParams.get('exerciseId');
  const exercise = useMemo(() => {
    if (!exercises?.length) return null;
    return exercises.find((e) => e.id === requestedExerciseId) ?? exercises[0];
  }, [exercises, requestedExerciseId]);

  const { data: history, isLoading } = useQuery({
    queryKey: ['exercise-history', exercise?.id],
    // TODO: apps/api needs to implement GET /v1/exercises/:exerciseId/history
    // — it's currently a stub that always returns `{ items: [], nextCursor:
    // null }` (see apps/api/src/routes/exercises.ts), so this page shows an
    // empty state until real historical set data is available.
    queryFn: () => api.get<ExerciseHistoryResponse>(`/exercises/${exercise!.id}/history`),
    enabled: !!exercise,
  });

  const sets = history?.items ?? [];
  const topSet = sets.reduce<HistorySetItem | null>((best, s) => {
    if (s.weightValue == null) return best;
    if (!best || (best.weightValue ?? 0) < s.weightValue) return s;
    return best;
  }, null);
  const estimated1RM = topSet?.weightValue != null && topSet.reps != null
    ? Math.round(estimateOneRepMax(topSet.weightValue, topSet.reps))
    : null;

  const sessionsByDate = new Map<string, HistorySetItem[]>();
  for (const set of sets) {
    if (!set.sessionLocalDate) continue;
    const key = sessionsGroupKey(set.sessionLocalDate);
    sessionsByDate.set(key, [...(sessionsByDate.get(key) ?? []), set]);
  }
  const sessionDates = Array.from(sessionsByDate.keys()).sort().reverse();
  const lastSessionSets = sessionDates[0] ? sessionsByDate.get(sessionDates[0])! : [];
  const lastSessionVolume = calculateVolume(lastSessionSets);

  function formatSessionDate(localDate: string) {
    return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  return (
    <div>
      <h1>{exercise?.name ?? 'Exercise history'}</h1>

      <PickerRow>
        <Select
          label="Exercise"
          value={exercise?.id ?? ''}
          options={(exercises ?? []).map((e) => ({ value: e.id, label: e.name }))}
          onChange={(event) => setSearchParams({ exerciseId: event.target.value })}
        />
      </PickerRow>

      <StatRow>
        <Card>
          <StatLabel>Top Set</StatLabel>
          <StatValue>
            {topSet ? `${topSet.weightValue} × ${topSet.reps}` : '—'}
          </StatValue>
        </Card>
        <Card>
          <StatLabel>Est. 1RM</StatLabel>
          <StatValue>{estimated1RM != null ? `${estimated1RM} lb` : '—'}</StatValue>
        </Card>
        <Card>
          <StatLabel>Last Session Volume</StatLabel>
          <StatValue>{lastSessionVolume ? `${lastSessionVolume.toLocaleString()} lb` : '—'}</StatValue>
        </Card>
      </StatRow>

      {isLoading ? (
        <p>Loading history…</p>
      ) : sessionDates.length === 0 ? (
        <p>No logged sessions yet for this exercise.</p>
      ) : (
        sessionDates.map((date) => {
          const sessionSets = sessionsByDate.get(date)!;
          const hasPr = sessionSets.some((s) => s.isPrWeight || s.isPrReps);
          return (
            <SessionCard key={date}>
              <SessionHeader>
                <strong>{formatSessionDate(date)}</strong>
                {hasPr ? <PRBadge /> : null}
              </SessionHeader>
              {sessionSets.map((s, i) => (
                <SetLine key={i}>
                  Set {i + 1}: {s.weightValue} × {s.reps}
                </SetLine>
              ))}
            </SessionCard>
          );
        })
      )}
    </div>
  );
}
