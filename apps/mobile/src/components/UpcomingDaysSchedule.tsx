import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typeScale } from '../theme/getTheme';
import { Toast } from './Toast';

/**
 * Rest days on mobile — the counterpart of web's `UpcomingDaysSchedule`,
 * closing the last capability gap in story 55.
 *
 * Story 21 built this for web only, and recorded the reason honestly at the
 * time: mobile's program editor was read-only by an existing (if undocumented)
 * boundary, so schedule editing was already web-only. That boundary is gone —
 * Training *is* the program editor now — so the rationale no longer holds and
 * the divergence is just a gap.
 *
 * Reuses exactly the primitives Today already uses for "today": the same
 * `GET /v1/dashboard/today?localDate=` resolution and the same
 * `POST`/`DELETE /v1/rest-days/:localDate` endpoints, generalised to a small
 * window of dates. No new backend surface and no schema change.
 *
 * The `['today', localDate]` query key is shared with Today's own screen, so
 * toggling rest here updates that screen and vice versa — which is the
 * cache-coherence requirement story 21 called out.
 */

const DAYS_BACK = 3;
const DAYS_FORWARD = 10;

interface DayResolution {
  localDate: string;
  dayLabel: string | null;
  sessions: { status: string }[];
  restDay: { id: string; localDate: string } | null;
}

function addDays(localDate: string, offset: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(localDate: string, isToday: boolean): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  const monthDay = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return isToday ? `Today · ${monthDay}` : `${weekday} · ${monthDay}`;
}

function DayRow({
  localDate,
  isToday,
  onError,
}: {
  localDate: string;
  isToday: boolean;
  onError: (message: string) => void;
}) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => api.get<DayResolution>(`/dashboard/today?localDate=${localDate}`),
  });

  const setRest = useMutation({
    mutationFn: () =>
      api.post('/rest-days', {
        localDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
    onError: () => onError(`Couldn't mark ${localDate} as rest.`),
  });

  const clearRest = useMutation({
    mutationFn: () => api.del(`/rest-days/${localDate}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
    onError: () => onError(`Couldn't clear rest for ${localDate}.`),
  });

  /* An abandoned-only day is still eligible for rest — training and rest are
     only contradictory when a *real* session exists, matching the same check
     `POST /v1/rest-days` makes server-side. */
  const trained = (data?.sessions ?? []).some((session) => session.status !== 'abandoned');
  const isRest = Boolean(data?.restDay);
  const pending = setRest.isPending || clearRest.isPending;

  const state = isLoading
    ? 'Loading…'
    : trained
      ? 'Trained'
      : isRest
        ? 'Resting'
        : (data?.dayLabel ?? 'Unassigned');

  return (
    <View
      testID="upcoming-day-row"
      style={[
        styles.row,
        {
          borderColor: isToday ? theme.action.primary : 'transparent',
          backgroundColor: theme.surface.sunken,
        },
      ]}
    >
      <Text style={[styles.date, { color: theme.text.primary }]}>
        {formatDateLabel(localDate, isToday)}
      </Text>
      <Text
        style={[styles.state, { color: isRest ? theme.status.success : theme.text.secondary }]}
        testID="upcoming-day-state"
      >
        {state}
      </Text>
      {!isLoading && !trained ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isRest ? `Clear rest for ${localDate}` : `Mark ${localDate} as a rest day`
          }
          accessibilityState={{ disabled: pending }}
          testID="upcoming-day-toggle"
          disabled={pending}
          onPress={() => (isRest ? clearRest.mutate() : setRest.mutate())}
          style={[
            styles.toggle,
            {
              borderColor: theme.border.default,
              backgroundColor: isRest ? theme.status.success : 'transparent',
              opacity: pending ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.toggleLabel,
              { color: isRest ? theme.action.primaryText : theme.text.primary },
            ]}
          >
            {isRest ? 'Clear rest' : 'Mark rest'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function UpcomingDaysSchedule({ localDate }: { localDate: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const dates = Array.from({ length: DAYS_BACK + DAYS_FORWARD + 1 }, (_, index) =>
    addDays(localDate, index - DAYS_BACK),
  );

  return (
    <View style={styles.list} testID="upcoming-days">
      {dates.map((date) => (
        <DayRow
          key={date}
          localDate={date}
          isToday={date === localDate}
          onError={setToast}
        />
      ))}
      {toast ? (
        <Toast variant="error" message={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    borderRadius: radius.small,
    borderWidth: 1,
  },
  date: {
    fontSize: typeScale.body.fontSize,
    flexShrink: 1,
  },
  state: {
    fontSize: typeScale.caption.fontSize,
    flexShrink: 1,
  },
  toggle: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleLabel: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
  },
});
