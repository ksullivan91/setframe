import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
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
export function TodayAdditionalActivitySection({ localDate }: { localDate: string }) {
  const theme = useTheme();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdditionalActivity | null>(null);
  const [draft, setDraft] = useState<ActivityDraft>(emptyActivityDraft());
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const [presetTitleDraft, setPresetTitleDraft] = useState('');

  const query = useQuery({
    queryKey: ['additional-activities', localDate],
    queryFn: () => api.get<{ items: AdditionalActivity[] }>(`/additional-activities?localDate=${localDate}`),
  });

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
        <IconButton icon={Plus} variant="subtle" accessibilityLabel="Add activity" onPress={openAdd} />
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
        const detailBits = [
          formatActivityDuration(activity.durationSeconds),
          activity.distanceValue != null ? `${activity.distanceValue} ${activity.distanceUnit ?? 'mi'}` : null,
          formatActivityTime(activity.startedAt),
          activity.source === 'apple_health' ? 'Apple Health' : null,
        ].filter(Boolean);
        return (
          <View key={activity.id} style={[styles.row, { backgroundColor: theme.surface.raised }]}>
            <View style={styles.rowMeta}>
              <Text style={{ color: theme.text.primary, fontSize: typeScale.compactBody.fontSize }}>
                {activity.title || activityTypeLabels[activity.activityType]}
              </Text>
              {detailBits.length ? (
                <Text style={{ color: theme.text.secondary, fontSize: typeScale.helper.fontSize }}>{detailBits.join(' · ')}</Text>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <IconButton icon={Pencil} size={28} variant="subtle" accessibilityLabel={`Edit ${activityTypeLabels[activity.activityType]}`} onPress={() => openEdit(activity)} />
              <IconButton icon={Trash2} size={28} variant="subtle" accessibilityLabel={`Delete ${activityTypeLabels[activity.activityType]}`} onPress={() => confirmDelete(activity)} />
            </View>
          </View>
        );
      })}

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

const styles = StyleSheet.create({
  card: { gap: spacing[12] },
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
});
