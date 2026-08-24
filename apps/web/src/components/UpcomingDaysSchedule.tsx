import styled from 'styled-components';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { spacing, radius } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { useLocalDate } from '../lib/useLocalDate';
import { useToast } from './Toast';
import { typeScale } from '../theme/typeScale';

/**
 * Rest days (Story 21) — reuses the exact primitives Today already has for
 * "today": the same `GET /v1/dashboard/today?localDate=` resolution and
 * the same `POST`/`DELETE /v1/rest-days/:localDate` endpoints, generalized
 * to a small window of past/future dates instead of only the current one.
 * No new backend surface, no schema change — see the design decision in
 * `Backlog/completed/21-schedule-rest-days-in-training.md`.
 */
const DAYS_BACK = 3;
const DAYS_FORWARD = 10;

interface DayResolution {
  localDate: string;
  dayLabel: string | null;
  sessions: { status: string }[];
  restDay: { id: string; localDate: string } | null;
}

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const DayRow = styled.div<{ $isToday: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$isToday ? p.theme.action.primary : 'transparent')};
`;

const DateLabel = styled.span`
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.primary};
  min-width: 108px;
`;

const StateLabel = styled.span<{ $rest: boolean }>`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => (p.$rest ? p.theme.status.success : p.theme.text.secondary)};
  flex: 1;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  font-size: ${typeScale.caption.fontSize}px;
  padding: ${spacing[4]}px ${spacing[8]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.status.success : p.theme.border.default)};
  background: ${(p) => (p.$active ? p.theme.status.success : 'transparent')};
  color: ${(p) => (p.$active ? p.theme.action.primaryText : p.theme.text.primary)};
  cursor: pointer;
`;

function addDays(localDate: string, offset: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day!));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(localDate: string, isToday: boolean): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day!));
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return isToday ? `Today · ${monthDay}` : `${weekday} · ${monthDay}`;
}

function DayRowItem({ localDate, isToday }: { localDate: string; isToday: boolean }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => api.get<DayResolution>(`/dashboard/today?localDate=${localDate}`),
  });

  const setRest = useMutation({
    mutationFn: () =>
      api.post('/rest-days', { localDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today'] });
    },
    onError: () => toast.show({ variant: 'error', message: `Couldn't mark ${localDate} as rest.` }),
  });

  const clearRest = useMutation({
    mutationFn: () => api.del(`/rest-days/${localDate}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today'] });
    },
    onError: () => toast.show({ variant: 'error', message: `Couldn't clear rest for ${localDate}.` }),
  });

  // An abandoned-only day is still eligible for rest — training and rest
  // are only contradictory when a *real* (non-abandoned) session exists,
  // matching the same check POST /v1/rest-days makes server-side.
  const trained = (data?.sessions ?? []).some((session) => session.status !== 'abandoned');
  const isRest = Boolean(data?.restDay);

  return (
    <DayRow $isToday={isToday}>
      <DateLabel>{formatDateLabel(localDate, isToday)}</DateLabel>
      <StateLabel $rest={isRest}>
        {isLoading
          ? 'Loading…'
          : trained
            ? 'Trained'
            : isRest
              ? 'Resting'
              : (data?.dayLabel ?? 'Unassigned')}
      </StateLabel>
      {!isLoading && !trained ? (
        <ToggleButton
          type="button"
          $active={isRest}
          disabled={setRest.isPending || clearRest.isPending}
          onClick={() => (isRest ? clearRest.mutate() : setRest.mutate())}
        >
          {isRest ? 'Clear rest' : 'Mark rest'}
        </ToggleButton>
      ) : null}
    </DayRow>
  );
}

export function UpcomingDaysSchedule() {
  const today = useLocalDate();
  const dates = Array.from({ length: DAYS_BACK + DAYS_FORWARD + 1 }, (_, i) => addDays(today, i - DAYS_BACK));

  return (
    <List>
      {dates.map((date) => (
        <DayRowItem key={date} localDate={date} isToday={date === today} />
      ))}
    </List>
  );
}
