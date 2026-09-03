import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ActivityIndicator } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react-native';
import { spacing, radius } from '@setframe/design-tokens';
import type { AdditionalActivity, AdditionalActivityPreset, User } from '@setframe/schemas';
import {
  deriveRecentActivitySuggestions,
  formatActivityDuration,
  getAdditionalActivityFields,
  secondsToDurationParts,
  validateDurationDraft,
  type DurationDraft,
} from '@setframe/domain';
import { useWorkoutDiscovery } from '../healthkit/useWorkoutDiscovery';
import { toCreateBody, type DiscoveredWorkout, type LoggedSession } from '../healthkit/workout-discovery';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { useApiClient } from '../lib/api-client';
import { Card } from './Card';
import { IconButton } from './IconButton';

/** Canonical seconds -> the two form fields, with empty for "no duration". */
function toDurationDraft(totalSeconds: number | null | undefined): DurationDraft {
  if (totalSeconds == null || totalSeconds <= 0) return { minutes: '', seconds: '' };
  const parts = secondsToDurationParts(totalSeconds);
  return {
    minutes: String(parts.minutes),
    // Blank rather than "0" so a whole-minute activity looks exactly as it
    // did before seconds existed.
    seconds: parts.seconds === 0 ? '' : String(parts.seconds),
  };
}

import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { Toast } from './Toast';
import {
  AdditionalActivitySheet,
  activityTypeLabels,
  draftFromActivity,
  emptyActivityDraft,
  type ActivityDraft,
} from './AdditionalActivitySheet';

function formatActivityTime(startedAt: string | null): string | null {
  if (!startedAt) return null;
  return new Date(startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function daysAgo(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildBody(localDate: string, draft: ActivityDraft) {
  // A field the current activity type doesn't show is omitted entirely
  // (undefined, dropped by JSON.stringify) rather than forced to null. On
  // create that's equivalent — an absent column still inserts null — but
  // on update it's essential: the PATCH route only touches a field when
  // its key is present at all, so sending an explicit `null` for an
  // excluded-but-currently-populated field (e.g. editing a `walk` that
  // already has a `title` from when it was created as `other`) would
  // silently wipe data the user never asked to change.
  const fields = new Set(getAdditionalActivityFields(draft.activityType));
  return {
    activityType: draft.activityType,
    title: fields.has('title') ? draft.title || null : undefined,
    durationSeconds: fields.has('duration')
      ? (validateDurationDraft(draft.duration).totalSeconds ?? undefined)
      : undefined,
    distanceValue: fields.has('distance') && draft.distanceValue ? Number(draft.distanceValue) : undefined,
    distanceUnit: fields.has('distance') && draft.distanceValue ? draft.distanceUnit : undefined,
    // `${localDate}T${startTime}:00` (no offset) parses as local wall-clock
    // time on-device; converting to an ISO string is both what the API's
    // z.string().datetime() requires and the correct UTC instant.
    startedAt: fields.has('startTime') && draft.startTime ? new Date(`${localDate}T${draft.startTime}:00`).toISOString() : undefined,
    notes: fields.has('notes') ? draft.notes || null : undefined,
  };
}

/**
 * Story 41 — a distinct, visually-secondary section for supplemental
 * movement outside the scheduled workout. Fetches independently of
 * Today's main dashboard query, so a failed activity request degrades
 * this section alone and never blocks the scheduled workout card.
 */
/**
 * This section's own data, as shared query options — the native counterpart
 * to web's export of the same name.
 *
 * Exported so Today can wait for it before rendering anything. The section
 * used to paint its card the instant the screen mounted, because it fetches
 * separately from the dashboard, so a finished "Additional activity" card sat
 * above content that had not loaded. React Query dedupes on the key, so the
 * screen subscribing to this costs no extra request.
 */
export function additionalActivitiesQuery(api: ReturnType<typeof useApiClient>, localDate: string) {
  return {
    queryKey: ['additional-activities', localDate] as const,
    queryFn: () => api.get<{ items: AdditionalActivity[] }>(`/additional-activities?localDate=${localDate}`),
  };
}

export function TodayAdditionalActivitySection({
  localDate,
  sessions = [],
  attachedWatchExternalIds = [],
}: {
  localDate: string;
  /** Today's logged sessions, so a Watch recording of one is not offered
   *  back as "additional" activity. See workout-discovery.ts. */
  sessions?: LoggedSession[];
  /** HealthKit ids already attached to one of the day's sessions in the
   *  logger. Comes from the dashboard so it reflects every session, not
   *  just the one this screen happens to know about. */
  attachedWatchExternalIds?: readonly string[];
}) {
  const theme = useTheme();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdditionalActivity | null>(null);
  const [draft, setDraft] = useState<ActivityDraft>(emptyActivityDraft());
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const [presetTitleDraft, setPresetTitleDraft] = useState('');

  const query = useQuery(additionalActivitiesQuery(api, localDate));

  // Story 42 — a new activity's distance unit defaults to the user's
  // preference; editing an existing one still preserves its own stored
  // unit (see draftFromActivity).
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => api.get<User>('/me') });
  const preferredDistanceUnit = meQuery.data?.preferredUnits === 'metric' ? 'km' : 'mi';

  // Story 43 — recent suggestions only matter while adding something new,
  // so this only fetches once the sheet is actually open, and never for an
  // edit. A 30-day window is enough recency without pulling a user's whole
  // history for a dedup pass that only keeps 3.
  const recentsQuery = useQuery({
    queryKey: ['additional-activities', 'recents', localDate],
    queryFn: () =>
      api.get<{ items: AdditionalActivity[] }>(
        `/additional-activities?from=${daysAgo(localDate, 30)}&to=${localDate}`,
      ),
    enabled: sheetOpen && !editTarget,
  });
  // Only fetched while the sheet that would show them is actually open —
  // otherwise every Today screen load would fetch shortcuts nobody asked for.
  const presetsQuery = useQuery({
    queryKey: ['additional-activity-presets'],
    queryFn: () => api.get<{ items: AdditionalActivityPreset[] }>('/additional-activity-presets'),
    enabled: sheetOpen && !editTarget,
  });
  const recentSuggestions = recentsQuery.data?.items ? deriveRecentActivitySuggestions(recentsQuery.data.items) : [];

  /* Story 44 — what Apple Health already knows about today. The external
     ids of what we have imported feed straight back in, so an activity
     added from a suggestion is never offered a second time. */
  const importedExternalIds = useMemo(
    () => [
      ...(query.data?.items ?? [])
        .filter((item) => item.source === 'apple_health' && item.externalSourceId)
        .map((item) => item.externalSourceId as string),
      /* And anything already attached to one of the day's workout sessions.
         A Watch workout attached in the logger is already recorded against
         the session; offering it again here invites logging the same hour
         twice and double-counting the day. */
      ...attachedWatchExternalIds,
    ],
    [query.data?.items, attachedWatchExternalIds],
  );
  const discovery = useWorkoutDiscovery({ localDate, sessions, importedExternalIds });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['additional-activities', localDate] });
  const refreshPresets = () => queryClient.invalidateQueries({ queryKey: ['additional-activity-presets'] });

  function openAdd() {
    setEditTarget(null);
    setDraft(emptyActivityDraft(preferredDistanceUnit));
    setPresetTitleDraft('');
    setSheetOpen(true);
  }

  function openEdit(activity: AdditionalActivity) {
    setEditTarget(activity);
    setDraft(draftFromActivity(activity));
    setSheetOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/additional-activities', {
        localDate,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...buildBody(localDate, draft),
      }),
    onSuccess: async () => {
      await refresh();
      setSheetOpen(false);
      setToast({ variant: 'success', message: `${activityTypeLabels[draft.activityType]} added.` });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not save activity.' }),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/additional-activities/${editTarget!.id}`, buildBody(localDate, draft)),
    onSuccess: async () => {
      await refresh();
      setSheetOpen(false);
      setToast({ variant: 'success', message: 'Activity updated.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not update activity.' }),
  });

  const importMutation = useMutation({
    mutationFn: (workout: DiscoveredWorkout) =>
      api.post(
        '/additional-activities',
        toCreateBody(workout, localDate, Intl.DateTimeFormat().resolvedOptions().timeZone),
      ),
    onSuccess: async () => {
      await refresh();
      setToast({ variant: 'success', message: 'Added from Apple Health.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not add that activity.' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/additional-activities/${id}`),
    onSuccess: refresh,
    onError: () => setToast({ variant: 'error', message: 'Could not remove activity.' }),
  });

  const savePresetMutation = useMutation({
    mutationFn: () => {
      const fields = new Set(getAdditionalActivityFields(draft.activityType));
      return api.post('/additional-activity-presets', {
        title: presetTitleDraft.trim(),
        activityType: draft.activityType,
        defaultDurationSeconds: fields.has('duration')
          ? (validateDurationDraft(draft.duration).totalSeconds ?? undefined)
          : undefined,
        defaultDistanceValue: fields.has('distance') && draft.distanceValue ? Number(draft.distanceValue) : undefined,
        defaultDistanceUnit: fields.has('distance') && draft.distanceValue ? draft.distanceUnit : undefined,
        defaultNotes: fields.has('notes') ? draft.notes || undefined : undefined,
      });
    },
    onSuccess: async () => {
      await refreshPresets();
      setPresetTitleDraft('');
      setToast({ variant: 'success', message: 'Quick activity saved.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not save quick activity.' }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: string) => api.del(`/additional-activity-presets/${id}`),
    onSuccess: refreshPresets,
    onError: () => setToast({ variant: 'error', message: 'Could not remove quick activity.' }),
  });

  // Story 43 — a tapped shortcut prefills the sheet for review, it never
  // saves directly: the user still has to hit Save, and can change
  // anything first.
  function applySuggestion(suggestion: { activityType: ActivityDraft['activityType']; title: string | null; durationSeconds: number | null; distanceValue: number | null; distanceUnit: ActivityDraft['distanceUnit'] | null }) {
    setDraft((prev) => ({
      ...prev,
      activityType: suggestion.activityType,
      title: suggestion.title ?? '',
      duration: toDurationDraft(suggestion.durationSeconds),
      distanceValue: suggestion.distanceValue != null ? String(suggestion.distanceValue) : '',
      distanceUnit: suggestion.distanceUnit ?? prev.distanceUnit,
    }));
  }

  function confirmDelete(activity: AdditionalActivity) {
    Alert.alert(
      `Remove ${activityTypeLabels[activity.activityType]}?`,
      'This will be removed from today.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(activity.id) },
      ],
    );
  }

  const items = query.data?.items ?? [];

  return (
    <Card style={[styles.card, { backgroundColor: theme.surface.sunken, borderColor: theme.border.subtle, borderStyle: 'dashed' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Additional activity</Text>
        <IconButton icon={Plus} size={28} variant="raised" accessibilityLabel="Add activity" onPress={openAdd} />
      </View>

      {query.isLoading ? <Skeleton height={40} /> : null}

      {query.isError ? (
        <View style={styles.errorRow}>
          <Text style={{ color: theme.text.secondary }}>Couldn&apos;t load additional activity.</Text>
          <Button label="Retry" variant="secondary" onPress={() => query.refetch()} />
        </View>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <>
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.compactBody.fontSize }}>
            Add walks, mobility, yoga, or anything else you do outside today&apos;s planned workout.
          </Text>
          <Button label="Add activity" variant="secondary" onPress={openAdd} />
        </>
      ) : null}

      {items.map((activity) => {
        /* Figma 211:867. Time first, then duration, then distance — the
           order the design reads in; ours had duration before time. And
           "Apple Health" is a tinted badge beside the detail line, not a
           fourth item joined into it with a middle dot. */
        const detailBits = [
          formatActivityTime(activity.startedAt),
          formatActivityDuration(activity.durationSeconds),
          activity.distanceValue != null ? `${activity.distanceValue} ${activity.distanceUnit ?? 'mi'}` : null,
        ].filter(Boolean);
        const fromHealth = activity.source === 'apple_health';
        return (
          <View key={activity.id} style={[styles.row, { backgroundColor: theme.surface.raised }]}>
            <View style={styles.rowMeta}>
              <Text style={{ color: theme.text.primary, fontSize: typeScale.compactBody.fontSize }}>
                {activity.title || activityTypeLabels[activity.activityType]}
              </Text>
              {detailBits.length || fromHealth ? (
                <View style={styles.rowDetail}>
                  {detailBits.length ? (
                    <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
                      {detailBits.join(' · ')}
                    </Text>
                  ) : null}
                  {fromHealth ? (
                    <View
                      testID={`activity-source-${activity.id}`}
                      style={[styles.sourceBadge, { backgroundColor: tint(theme.status.info, 0.14) }]}
                    >
                      <Text style={[styles.sourceBadgeLabel, { color: theme.text.secondary }]}>
                        Apple Health
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <IconButton icon={Pencil} size={28} variant="subtle" accessibilityLabel={`Edit ${activityTypeLabels[activity.activityType]}`} onPress={() => openEdit(activity)} />
              <IconButton icon={Trash2} size={28} variant="subtle" accessibilityLabel={`Delete ${activityTypeLabels[activity.activityType]}`} onPress={() => confirmDelete(activity)} />
            </View>
          </View>
        );
      })}

      {/* Story 44. Suggestions sit BELOW what is already logged — what you
          did is the record, what we found is an offer. They look
          deliberately unlike a logged row: a tinted block with its own
          actions, so "we found this" never reads as "we saved this" and
          Dismiss never reads as Delete. */}
      {discovery.suggestions.map((workout) => (
        <View
          key={workout.externalId}
          testID={`workout-suggestion-${workout.externalId}`}
          style={[styles.suggestion, { backgroundColor: tint(theme.status.info, 0.08) }]}
        >
          <Text style={[styles.suggestionEyebrow, { color: theme.text.secondary }]}>
            FOUND IN APPLE HEALTH
          </Text>
          <Text style={[styles.suggestionTitle, { color: theme.text.primary }]}>{workout.title}</Text>
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.helper.fontSize }}>
            {describeWorkout(workout)}
          </Text>
          {/* Raw Pressables, not <Button>: Button forces width 100% by
              default, which pushed Dismiss clean off the screen, and it
              accepts no style prop to size the 62/34 split the design
              calls for. */}
          <View style={styles.suggestionActions}>
            <Pressable
              testID={`workout-add-${workout.externalId}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${workout.title} to today`}
              disabled={importMutation.isPending}
              onPress={() => importMutation.mutate(workout)}
              style={({ pressed }) => [
                styles.suggestionAdd,
                { backgroundColor: theme.action.primary, opacity: pressed || importMutation.isPending ? 0.85 : 1 },
              ]}
            >
              {importMutation.isPending && importMutation.variables?.externalId === workout.externalId ? (
                <ActivityIndicator color={theme.action.primaryText} />
              ) : (
                <Text style={[styles.suggestionActionLabel, { color: theme.action.primaryText }]}>
                  Add to today
                </Text>
              )}
            </Pressable>
            <Pressable
              testID={`workout-dismiss-${workout.externalId}`}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${workout.title}`}
              onPress={() => discovery.dismiss(workout.externalId)}
              style={({ pressed }) => [
                styles.suggestionDismiss,
                { backgroundColor: theme.surface.raised, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.suggestionActionLabel, { color: theme.text.secondary }]}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      {discovery.suggestions.length > 0 ? (
        <Text
          testID="suggestion-hint"
          style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}
        >
          {suggestionHint(discovery.suggestions.length)}
        </Text>
      ) : null}

      {/* Said out loud on purpose. Silently dropping the one workout the
          user definitely did looks like the feature is broken. */}
      {discovery.suppressed.map(({ workout, reason }) => (
        <View
          key={workout.externalId}
          testID={`workout-suppressed-${workout.externalId}`}
          style={[styles.suppressed, { backgroundColor: theme.surface.raised }]}
        >
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.helper.fontSize }}>
            {workout.title} · {formatActivityDuration(workout.durationSeconds)}
          </Text>
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
            {reason}
          </Text>
        </View>
      ))}

      {/* Workouts are their own Apple Health permission, so "connected"
          does not imply "discoverable" — and someone who granted
          everything last week still has to grant this. */}
      {discovery.canRead === false ? (
        <View style={[styles.permission, { backgroundColor: theme.surface.raised }]} testID="workout-permission">
          <Text style={{ color: theme.text.primary, fontSize: typeScale.compactBody.fontSize, fontWeight: '600' }}>
            Your Watch workouts are not shared yet
          </Text>
          <Text style={{ color: theme.text.secondary, fontSize: typeScale.helper.fontSize }}>
            Workouts are a separate Apple Health permission from the steps and calories you already
            share. Turn it on and Setframe can offer your walks and rides here.
          </Text>
          <Button label="Share workouts" onPress={() => void discovery.grant()} loading={discovery.granting} />
        </View>
      ) : null}

      <AdditionalActivitySheet
        visible={sheetOpen}
        isEditing={editTarget != null}
        draft={draft}
        onChange={setDraft}
        onClose={() => setSheetOpen(false)}
        onSave={() => (editTarget ? updateMutation.mutate() : createMutation.mutate())}
        isSaving={createMutation.isPending || updateMutation.isPending}
        presets={presetsQuery.data?.items ?? []}
        recentSuggestions={recentSuggestions}
        onApplySuggestion={applySuggestion}
        onRemovePreset={(id) => deletePresetMutation.mutate(id)}
        presetTitleDraft={presetTitleDraft}
        onPresetTitleChange={setPresetTitleDraft}
        onSavePreset={() => savePresetMutation.mutate()}
        isSavingPreset={savePresetMutation.isPending}
      />

      {toast ? <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </Card>
  );
}

/**
 * The line under the suggestions. Figma says two different things: with one
 * suggestion it reassures (211:836), with several it counts them (211:857).
 * Spelled out to match the frames — "Two more found today", not "2 more".
 */
const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
function suggestionHint(count: number): string {
  if (count <= 1) return 'Setframe never adds these on its own.';
  const word = COUNT_WORDS[count] ?? String(count);
  return `${word} more found today. Add the ones you want.`;
}

/** A token colour at partial strength. `status.info` has no subtle variant,
 *  and the suggestion is drawn as an 8% tint of it. */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1]!, 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

/** "12:42 PM · 17 min · 0.8 mi", skipping whatever Health did not record. */
function describeWorkout(workout: DiscoveredWorkout): string {
  return [
    formatActivityTime(workout.startedAt),
    formatActivityDuration(workout.durationSeconds),
    workout.distanceValue != null ? `${workout.distanceValue} ${workout.distanceUnit ?? 'mi'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const styles = StyleSheet.create({
  card: { gap: spacing[12] },
  suggestion: { borderRadius: radius.small, padding: spacing[12], gap: spacing[4] },
  suggestionEyebrow: { fontSize: typeScale.caption.fontSize, letterSpacing: 0.8, fontWeight: '500' },
  suggestionTitle: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
  suggestionActions: { flexDirection: 'row', gap: spacing[8], marginTop: spacing[4] },
  // 62/34 of the row, as drawn.
  suggestionAdd: { flexGrow: 62, flexBasis: 0, height: 36, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  suggestionDismiss: { flexGrow: 34, flexBasis: 0, height: 36, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  suggestionActionLabel: { fontSize: typeScale.helper.fontSize, fontWeight: '600' },
  suppressed: { borderRadius: radius.small, padding: spacing[12], gap: 2 },
  permission: { borderRadius: radius.small, padding: spacing[12], gap: spacing[8] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  errorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[8],
    borderRadius: radius.small,
    gap: spacing[8],
  },
  rowMeta: { flex: 1, gap: spacing[4] },
  rowActions: { flexDirection: 'row', gap: spacing[4] },
  rowDetail: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], flexWrap: 'wrap' },
  sourceBadge: { borderRadius: radius.full, paddingVertical: 1, paddingHorizontal: spacing[4] },
  sourceBadgeLabel: { fontSize: 9 },
});
