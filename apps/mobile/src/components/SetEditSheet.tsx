import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { spacing } from '@setframe/design-tokens';
import type { Prescription, WorkoutSet } from '@setframe/schemas';
import {
  getPrescriptionDefinition,
  getSessionFieldLabel,
  parseOptionalNumber,
  resolveSessionFields,
  validateSessionSet,
  type PrescriptionDefinition,
  type PrescriptionKind,
  type SessionField,
  type SessionFieldErrors,
} from '../lib/prescription';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Sheet } from './Sheet';

const distanceUnitOptions = [
  { value: 'mi', label: 'mi' },
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
] as const;

const setTypeOptions = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'working', label: 'Working' },
  { value: 'top', label: 'Top' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
] as const;

/** Duration is always persisted in seconds; a continuous effort is more
 * natural to type in minutes, so the draft holds the displayed unit. */
function secondsToDisplay(seconds: number | null, definition: PrescriptionDefinition): string {
  if (seconds == null) return '';
  if (definition.units.duration !== 'minutes') return seconds.toString();
  const minutes = seconds / 60;
  return (Number.isInteger(minutes) ? minutes : Number(minutes.toFixed(2))).toString();
}

function displayToSeconds(value: string, definition: PrescriptionDefinition): number | undefined {
  const parsed = parseOptionalNumber(value);
  if (parsed == null) return undefined;
  return definition.units.duration === 'minutes' ? Math.round(parsed * 60) : parsed;
}

interface Draft {
  setType: string;
  weightValue: string;
  reps: string;
  durationSeconds: string;
  distanceValue: string;
  distanceUnit: string;
  rpe: string;
}

function getDraft(set: WorkoutSet, definition: PrescriptionDefinition): Draft {
  return {
    setType: set.setType,
    weightValue: set.weightValue?.toString() ?? '',
    reps: set.reps?.toString() ?? '',
    durationSeconds: secondsToDisplay(set.durationSeconds, definition),
    distanceValue: set.distanceValue?.toString() ?? '',
    distanceUnit: set.distanceUnit ?? definition.units.distance,
    rpe: set.rpe?.toString() ?? '',
  };
}

export interface SetEditPatch {
  setType?: string;
  weightValue?: number;
  weightUnit?: string;
  reps?: number;
  durationSeconds?: number;
  distanceValue?: number;
  distanceUnit?: string;
  rpe?: number;
}

/* Only fields the user can actually see are submitted, mirroring web's
   WorkoutSessionPage buildPatch — a hidden field is omitted, never sent as
   null. */
function buildPatch(existing: WorkoutSet, draft: Draft, visible: SessionField[], definition: PrescriptionDefinition): SetEditPatch {
  const patch: SetEditPatch = {};
  if (visible.includes('setType')) patch.setType = draft.setType;
  if (visible.includes('weight')) {
    const weightValue = parseOptionalNumber(draft.weightValue);
    patch.weightValue = weightValue;
    patch.weightUnit = weightValue != null ? existing.weightUnit ?? 'lb' : undefined;
  }
  if (visible.includes('reps')) patch.reps = parseOptionalNumber(draft.reps);
  if (visible.includes('duration')) patch.durationSeconds = displayToSeconds(draft.durationSeconds, definition);
  if (visible.includes('distance')) {
    const distanceValue = parseOptionalNumber(draft.distanceValue);
    patch.distanceValue = distanceValue;
    patch.distanceUnit = distanceValue != null ? draft.distanceUnit : undefined;
  }
  if (visible.includes('rpe')) patch.rpe = parseOptionalNumber(draft.rpe);
  return patch;
}

function draftToSetValues(draft: Draft, definition: PrescriptionDefinition) {
  return {
    setType: draft.setType,
    weightValue: parseOptionalNumber(draft.weightValue) ?? null,
    reps: parseOptionalNumber(draft.reps) ?? null,
    durationSeconds: displayToSeconds(draft.durationSeconds, definition) ?? null,
    distanceValue: parseOptionalNumber(draft.distanceValue) ?? null,
    rpe: parseOptionalNumber(draft.rpe) ?? null,
  };
}

export interface SetEditSheetProps {
  setLabel: string;
  exerciseName: string;
  set: WorkoutSet;
  prescription: Prescription | PrescriptionKind | null;
  onClose: () => void;
  onSave: (patch: SetEditPatch) => void;
  isSaving?: boolean;
  errorMessage?: string;
}

/**
 * Story 23 — lets a user correct a set's logged values from the completed
 * workout review (`session-summary.tsx`), which previously had no edit
 * affordance at all. Deliberately scoped to value correction: no
 * duplicate/remove/add-set here, matching web's decision to leave those
 * restructuring actions gated on `status === 'completed'` while unblocking
 * only the per-field Save.
 */
export function SetEditSheet({ setLabel, exerciseName, set, prescription, onClose, onSave, isSaving = false, errorMessage }: SetEditSheetProps) {
  const theme = useTheme();
  const definition = getPrescriptionDefinition(prescription);
  const fields = resolveSessionFields(prescription, set);
  const [draft, setDraft] = useState<Draft>(() => getDraft(set, definition));
  const [errors, setErrors] = useState<SessionFieldErrors>({});

  const inlineFields = fields.filter((field) => field === 'weight' || field === 'reps');
  const stackedFields = fields.filter((field) => field !== 'weight' && field !== 'reps');

  // Numeric SessionField names don't match their Draft/WorkoutSet keys
  // 1:1 (`weight` -> `weightValue`, `duration` -> `durationSeconds`,
  // `distance` -> `distanceValue`) — this maps between them.
  const draftKeyByField: Record<'weight' | 'reps' | 'duration' | 'distance' | 'rpe', keyof Draft> = {
    weight: 'weightValue',
    reps: 'reps',
    duration: 'durationSeconds',
    distance: 'distanceValue',
    rpe: 'rpe',
  };

  const setField = (field: SessionField, value: string) => {
    const key = field === 'setType' ? 'setType' : draftKeyByField[field];
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const nextErrors = validateSessionSet(prescription, draftToSetValues(draft, definition));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(buildPatch(set, draft, fields, definition));
  };

  const renderNumeric = (field: 'weight' | 'reps' | 'duration' | 'distance' | 'rpe') => (
    <View key={field} style={{ flex: 1 }}>
      <Input
        label={getSessionFieldLabel(field, definition)}
        value={draft[draftKeyByField[field]]}
        onChangeText={(value) => setField(field, value)}
        numeric
        unit={field === 'weight' ? set.weightUnit ?? 'lb' : undefined}
        errorMessage={errors[field]}
        testID={`set-edit-field-${field}`}
      />
    </View>
  );

  return (
    <Sheet visible onRequestClose={onClose}>
      <>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>{setLabel}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeButton}>
            <X size={20} color={theme.text.secondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {inlineFields.length ? (
            <View style={styles.fieldGroup}>{inlineFields.map(renderNumeric)}</View>
          ) : null}

          {stackedFields.map((field) => {
            if (field === 'setType') {
              return (
                <Select
                  key={field}
                  label="Type"
                  value={draft.setType}
                  options={setTypeOptions.map((option) => ({ ...option }))}
                  onChange={(value) => setField('setType', value)}
                  testID="set-edit-field-setType"
                />
              );
            }
            if (field === 'distance') {
              return (
                <View key={field} style={styles.distanceGroup}>
                  <View style={{ flex: 2 }}>{renderNumeric('distance')}</View>
                  <View style={{ flex: 1, minWidth: 88 }}>
                    <Select
                      label="Unit"
                      value={draft.distanceUnit}
                      options={distanceUnitOptions.map((option) => ({ ...option }))}
                      onChange={(value) => setDraft((prev) => ({ ...prev, distanceUnit: value }))}
                      testID="set-edit-field-distanceUnit"
                    />
                  </View>
                </View>
              );
            }
            return renderNumeric(field);
          })}

          {errorMessage ? <Text style={{ color: theme.status.error }}>{errorMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Save" onPress={handleSave} disabled={isSaving} loading={isSaving} />
        </View>
      </>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[12] },
  title: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  subtitle: { fontSize: typeScale.label.fontSize, marginTop: spacing[4] },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing[12], paddingBottom: spacing[8] },
  fieldGroup: { flexDirection: 'row', gap: spacing[8] },
  distanceGroup: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[8] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[8] },
});
