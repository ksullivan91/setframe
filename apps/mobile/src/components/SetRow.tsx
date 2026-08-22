import { View, Text, StyleSheet } from 'react-native';
import { Copy, Minus } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { IconButton } from './IconButton';
import { PrBadge } from './Badge';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

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

export interface SetRowEditableProps {
  setLabel: string;
  weight: string;
  reps: string;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  completed: boolean;
  onToggleCompleted: (completed: boolean) => void;
  /** Ghost "prev X" text per style guide §17 Idea 1 — reduces recall burden mid-workout. */
  previousWeight?: string;
  previousReps?: string;
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
  weight,
  reps,
  onChangeWeight,
  onChangeReps,
  completed,
  onToggleCompleted,
  previousWeight,
  previousReps,
  isPr,
  onDuplicate,
  onRemove,
}: SetRowEditableProps) {
  const theme = useTheme();
  return (
    <View style={styles.editableRow}>
      <Checkbox checked={completed} onChange={onToggleCompleted} />
      <Text style={[styles.setLabel, { color: theme.text.secondary, width: 44 }]}>{setLabel}</Text>
      <View style={styles.fieldGroup}>
        <View style={{ flex: 1 }}>
          <Input value={weight} onChangeText={onChangeWeight} numeric unit="lb" />
          {previousWeight ? (
            <Text style={[styles.ghost, { color: theme.text.disabled }]}>prev {previousWeight}</Text>
          ) : null}
        </View>
        <Text style={[styles.times, { color: theme.text.secondary }]}>×</Text>
        <View style={{ flex: 1 }}>
          <Input value={reps} onChangeText={onChangeReps} numeric />
          {previousReps ? (
            <Text style={[styles.ghost, { color: theme.text.disabled }]}>prev {previousReps}</Text>
          ) : null}
        </View>
      </View>
      {isPr ? <PrBadge /> : null}
      <View style={styles.actions}>
        <IconButton icon={Copy} accessibilityLabel="Duplicate set" size={28} onPress={onDuplicate} />
        <IconButton icon={Minus} accessibilityLabel="Remove set" size={28} onPress={onRemove} variant="subtle" />
      </View>
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
  editableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
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
