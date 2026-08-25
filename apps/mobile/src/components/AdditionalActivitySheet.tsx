import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '@setframe/design-tokens';
import type { AdditionalActivity, AdditionalActivityType } from '@setframe/schemas';
import { getAdditionalActivityFields } from '@setframe/domain';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Sheet } from './Sheet';

export const activityTypeLabels: Record<AdditionalActivityType, string> = {
  walk: 'Walk',
  yoga: 'Yoga',
  mobility: 'Mobility',
  foam_rolling: 'Foam rolling',
  outdoor_cycle: 'Outdoor cycle',
  indoor_cycle: 'Indoor cycle',
  run: 'Run',
  stretching: 'Stretching',
  other: 'Other',
};

const activityTypeOptions = (Object.keys(activityTypeLabels) as AdditionalActivityType[]).map((value) => ({
  value,
  label: activityTypeLabels[value],
}));

export interface ActivityDraft {
  activityType: AdditionalActivityType;
  title: string;
  durationMinutes: string;
  distanceValue: string;
  distanceUnit: 'm' | 'km' | 'mi';
  startTime: string;
  notes: string;
}

export function emptyActivityDraft(preferredDistanceUnit: 'km' | 'mi' = 'mi'): ActivityDraft {
  return { activityType: 'walk', title: '', durationMinutes: '', distanceValue: '', distanceUnit: preferredDistanceUnit, startTime: '', notes: '' };
}

// The start-time field works in local wall-clock time, but `startedAt` is
// stored/returned as a UTC ISO string — slicing its UTC hour directly
// (rather than converting) would show/re-save the wrong time whenever the
// device's timezone isn't UTC.
export function draftFromActivity(activity: AdditionalActivity): ActivityDraft {
  const local = activity.startedAt ? new Date(activity.startedAt) : null;
  return {
    activityType: activity.activityType,
    title: activity.title ?? '',
    durationMinutes: activity.durationSeconds != null ? String(Math.round(activity.durationSeconds / 60)) : '',
    distanceValue: activity.distanceValue != null ? String(activity.distanceValue) : '',
    distanceUnit: activity.distanceUnit ?? 'mi',
    startTime: local ? `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}` : '',
    notes: activity.notes ?? '',
  };
}

/** Conservative minimum, per the story's steering doc: duration alone is
 * enough for most activities; "Other" additionally needs a name. */
export function canSaveActivityDraft(draft: ActivityDraft): boolean {
  const fields = new Set(getAdditionalActivityFields(draft.activityType));
  return draft.durationMinutes.trim() !== '' && (!fields.has('title') || draft.title.trim() !== '');
}

export interface AdditionalActivitySheetProps {
  visible: boolean;
  isEditing: boolean;
  draft: ActivityDraft;
  onChange: (draft: ActivityDraft) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

/**
 * Story 41 — add/edit sheet. Story 42 — shows only the fields relevant to
 * the selected activity type (packages/domain's shared
 * additionalActivityFieldsByType, not a duplicated form), and requires
 * only duration (plus a name for "Other") to save.
 */
export function AdditionalActivitySheet({
  visible,
  isEditing,
  draft,
  onChange,
  onClose,
  onSave,
  isSaving = false,
}: AdditionalActivitySheetProps) {
  const theme = useTheme();
  const [localDraft, setLocalDraft] = useState(draft);

  useEffect(() => setLocalDraft(draft), [draft]);

  function update(patch: Partial<ActivityDraft>) {
    const next = { ...localDraft, ...patch };
    setLocalDraft(next);
    onChange(next);
  }

  const fields = new Set(getAdditionalActivityFields(localDraft.activityType));

  return (
    <Sheet visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{isEditing ? 'Edit activity' : 'Add activity'}</Text>
      </View>
      <Select label="Activity" value={localDraft.activityType} options={activityTypeOptions} onChange={(value) => update({ activityType: value })} />
      {fields.has('title') ? (
        <Input label="Activity name" value={localDraft.title} onChangeText={(value) => update({ title: value })} />
      ) : null}
      {fields.has('duration') ? (
        <Input label="Duration" unit="min" value={localDraft.durationMinutes} keyboardType="numeric" numeric onChangeText={(value) => update({ durationMinutes: value })} />
      ) : null}
      {fields.has('distance') ? (
        <Input label="Distance" unit={localDraft.distanceUnit} value={localDraft.distanceValue} keyboardType="decimal-pad" numeric onChangeText={(value) => update({ distanceValue: value })} />
      ) : null}
      {fields.has('startTime') ? (
        <Input label="Start time" placeholder="HH:MM" value={localDraft.startTime} onChangeText={(value) => update({ startTime: value })} />
      ) : null}
      {fields.has('notes') ? <Input label="Notes" value={localDraft.notes} onChangeText={(value) => update({ notes: value })} /> : null}
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onClose} />
        <Button label="Save" onPress={onSave} loading={isSaving} disabled={!canSaveActivityDraft(localDraft)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[8] },
});
