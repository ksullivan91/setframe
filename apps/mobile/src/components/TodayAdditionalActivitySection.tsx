import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react-native';
import { spacing, radius } from '@setframe/design-tokens';
import type { AdditionalActivity } from '@setframe/schemas';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { useApiClient } from '../lib/api-client';
import { Card } from './Card';
import { IconButton } from './IconButton';
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

function formatActivityDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  return `${Math.round(seconds / 60)} min`;
}

function formatActivityTime(startedAt: string | null): string | null {
  if (!startedAt) return null;
  return new Date(startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildBody(localDate: string, draft: ActivityDraft) {
  return {
    activityType: draft.activityType,
    durationSeconds: draft.durationMinutes ? Math.round(Number(draft.durationMinutes) * 60) : null,
    distanceValue: draft.distanceValue ? Number(draft.distanceValue) : null,
    distanceUnit: draft.distanceValue ? draft.distanceUnit : null,
    // `${localDate}T${startTime}:00` (no offset) parses as local wall-clock
    // time on-device; converting to an ISO string is both what the API's
    // z.string().datetime() requires and the correct UTC instant.
    startedAt: draft.startTime ? new Date(`${localDate}T${draft.startTime}:00`).toISOString() : null,
    notes: draft.notes || null,
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

  const query = useQuery({
    queryKey: ['additional-activities', localDate],
    queryFn: () => api.get<{ items: AdditionalActivity[] }>(`/additional-activities?localDate=${localDate}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['additional-activities', localDate] });

  function openAdd() {
    setEditTarget(null);
    setDraft(emptyActivityDraft());
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
                {activityTypeLabels[activity.activityType]}
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
