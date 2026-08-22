import { Fragment } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Copy, Minus } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { IconButton } from './IconButton';
import { PrBadge } from './Badge';
import { Select } from './Select';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';
import { getSessionFieldLabel, type PrescriptionDefinition, type SessionField, type SessionFieldErrors } from '../lib/prescription';

export interface SetRowReadOnlyProps {
  setLabel: string;
  valueLabel: string;
  isPr?: boolean;
}

/** Read-only `SetRow` (history/log display variant) per style guide §5/§9 — used in ExerciseHistory/SessionSummary. */
export function SetRowReadOnly({ setLabel, valueLabel, isPr }: SetRowReadOnlyProps) {
  const theme = useTheme();
  return (
    <View style={styles.readOnlyRow}>
      <Text style={[styles.setLabel, { color: theme.text.secondary }]}>{setLabel}</Text>
      <Text
        style={[
          styles.valueLabel,
          {
            color: theme.text.primary,
            fontSize: typeScale.numericWorkoutSet.fontSize,
            lineHeight: typeScale.numericWorkoutSet.lineHeight,
          },
        ]}
      >
        {valueLabel}
      </Text>
      {isPr ? <PrBadge /> : null}
    </View>
  );
}

/** Draft string values keyed by the shared `SessionField` identifiers. */
export type SetRowValues = Partial<Record<SessionField, string>>;

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

export interface SetRowEditableProps {
  setLabel: string;
  /** Which inputs to render, from `resolveSessionFields` — never a hardcoded list. */
  fields: SessionField[];
  definition: PrescriptionDefinition;
  values: SetRowValues;
  onChangeField: (field: SessionField, value: string) => void;
  /** Distance unit is a companion control to the distance value, not a field of its own. */
  distanceUnit?: string;
  onChangeDistanceUnit?: (value: string) => void;
  weightUnit?: string;
  errors?: SessionFieldErrors;
  completed: boolean;
  onToggleCompleted: (completed: boolean) => void;
  /** Ghost "prev X" text per style guide §17 Idea 1 — reduces recall burden mid-workout. */
  previous?: Partial<Record<SessionField, string>>;
  isPr?: boolean;
  onDuplicate?: () => void;
  onRemove?: () => void;
}

/**
 * `SetRow/Editable` per style guide §6/§9 — the master spec's flagged
 * "most important component." Checkbox + set number + weight input + "×"
 * + reps input + duplicate/remove icons in one inline row; ghost
 * "prev 185"/"prev 8" text and a trophy PR badge per §17.
 */
export function SetRowEditable({
  setLabel,
  fields,
  definition,
  values,
  onChangeField,
  distanceUnit = 'mi',
  onChangeDistanceUnit,
  weightUnit = 'lb',
  errors,
  completed,
  onToggleCompleted,
  previous,
  isPr,
  onDuplicate,
  onRemove,
}: SetRowEditableProps) {
  const theme = useTheme();

  // The classic weight × reps pairing stays on one inline row so a plain
  // strength set is no taller than it was before prescriptions drove the
  // layout. Everything else stacks below it.
  const inlineFields: SessionField[] = fields.filter((field) => field === 'weight' || field === 'reps');
  const stackedFields = fields.filter((field) => field !== 'weight' && field !== 'reps');

  const renderNumeric = (field: SessionField) => (
    <View key={field} style={{ flex: 1 }}>
      <Input
        label={inlineFields.includes(field) ? undefined : getSessionFieldLabel(field, definition)}
        value={values[field] ?? ''}
        onChangeText={(value) => onChangeField(field, value)}
        numeric
        unit={field === 'weight' ? weightUnit : undefined}
        errorMessage={errors?.[field]}
        testID={`set-field-${field}`}
      />
      {previous?.[field] ? (
        <Text style={[styles.ghost, { color: theme.text.disabled }]}>prev {previous[field]}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.editableWrapper}>
      <View style={styles.editableRow}>
        <Checkbox checked={completed} onChange={onToggleCompleted} />
        <Text style={[styles.setLabel, { color: theme.text.secondary, width: 44 }]}>{setLabel}</Text>
        {inlineFields.length ? (
          <View style={styles.fieldGroup}>
            {inlineFields.map((field, index) => (
              <Fragment key={field}>
                {index > 0 ? (
                  <Text testID="set-inline-separator" style={[styles.times, { color: theme.text.secondary }]}>
                    ×
                  </Text>
                ) : null}
                {renderNumeric(field)}
              </Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.fieldGroup} />
        )}
        {isPr ? <PrBadge /> : null}
        <View style={styles.actions}>
          <IconButton icon={Copy} accessibilityLabel="Duplicate set" size={28} onPress={onDuplicate} />
          <IconButton icon={Minus} accessibilityLabel="Remove set" size={28} onPress={onRemove} variant="subtle" />
        </View>
      </View>

      {stackedFields.length ? (
        <View style={styles.stackedFields}>
          {stackedFields.map((field) => {
            if (field === 'setType') {
              return (
                <View key={field} style={{ flex: 1, minWidth: 130 }}>
                  <Select
                    label="Type"
                    value={values.setType ?? 'working'}
                    options={setTypeOptions.map((option) => ({ ...option }))}
                    onChange={(value) => onChangeField('setType', value)}
                    testID="set-field-setType"
                  />
                </View>
              );
            }
            if (field === 'distance') {
              return (
                <View key={field} style={styles.distanceGroup}>
                  <View style={{ flex: 2 }}>{renderNumeric('distance')}</View>
                  <View style={{ flex: 1, minWidth: 88 }}>
                    <Select
                      label="Unit"
                      value={distanceUnit}
                      options={distanceUnitOptions.map((option) => ({ ...option }))}
                      onChange={(value) => onChangeDistanceUnit?.(value)}
                      testID="set-field-distanceUnit"
                    />
                  </View>
                </View>
              );
            }
            return (
              <View key={field} style={{ flex: 1, minWidth: 130 }}>
                {renderNumeric(field)}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  setLabel: {
    fontSize: typeScale.label.fontSize,
  },
  valueLabel: {
    fontWeight: '600',
  },
  editableWrapper: {
    gap: spacing[8],
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
  },
  stackedFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
    paddingLeft: spacing[8],
  },
  distanceGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
    flexGrow: 1,
    minWidth: 200,
  },
  fieldGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  times: {
    fontSize: typeScale.body.fontSize,
    marginTop: spacing[12],
  },
  ghost: {
    fontSize: typeScale.caption.fontSize,
    marginTop: spacing[4],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[4],
  },
});
