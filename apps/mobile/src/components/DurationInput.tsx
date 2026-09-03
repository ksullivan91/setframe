import { StyleSheet, Text, View } from 'react-native';
import { validateDurationDraft, type DurationDraft } from '@setframe/domain';
import { Input } from './Input';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, typeScale } from '../theme/getTheme';

/**
 * Two-field duration entry — the counterpart of web's `DurationInput`.
 *
 * Story 63. A single `Duration (min)` field caused a real user to type
 * `2309` meaning 23:09; the input looked like it took any number while the
 * model meant whole minutes. Two labelled boxes make the model self-evident
 * without a hint, which is the actual fix — a longer helper string under one
 * ambiguous box would not have been.
 *
 * Deliberately no hours field. Minutes stay primary even past an hour
 * (`75 min 20 sec`), because a unit that changes shape at sixty minutes is
 * harder to scan than one that does not.
 */

export interface DurationInputProps {
  value: DurationDraft;
  onChange: (next: DurationDraft) => void;
  label?: string;
  error?: string;
  testID?: string;
}

export function DurationInput({
  value,
  onChange,
  label = 'Duration',
  error,
  testID,
}: DurationInputProps) {
  const theme = useTheme();
  const validation = validateDurationDraft(value);

  return (
    <View style={styles.group} testID={testID}>
      <Text style={[styles.groupLabel, { color: theme.text.secondary }]}>{label}</Text>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Input
            /* Named relative to the group rather than both being "Duration":
               two controls announced identically are indistinguishable to a
               VoiceOver user, who then cannot tell which box they are in. */
            label={`${label} minutes`}
            unit="min"
            value={value.minutes}
            onChangeText={(minutes) => onChange({ ...value, minutes })}
            errorMessage={validation.errors.minutes}
            keyboardType="number-pad"
            testID="duration-minutes"
          />
        </View>
        <View style={styles.field}>
          <Input
            label={`${label} seconds`}
            unit="sec"
            value={value.seconds}
            onChangeText={(seconds) => onChange({ ...value, seconds })}
            errorMessage={validation.errors.seconds}
            keyboardType="number-pad"
            testID="duration-seconds"
          />
        </View>
      </View>
      {error ? (
        <Text style={[styles.error, { color: theme.status.errorText }]} testID="duration-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing[4],
  },
  groupLabel: {
    fontSize: typeScale.label.fontSize,
  },
  /* Two columns at every width. The fields are short and the pairing is the
     whole point — stacking them would read as two unrelated questions, which
     is the ambiguity this component exists to remove. */
  fields: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  field: {
    flex: 1,
  },
  error: {
    fontSize: typeScale.caption.fontSize,
  },
});
