import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AdditionalActivityType } from '@setframe/schemas';
import { getAdditionalActivityFields } from '@setframe/domain';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';
import { activityTypeLabels } from '../AdditionalActivitySheet';

export interface AddActivityValue {
  activityType: AdditionalActivityType;
  /** Only carried for the types whose fields include it — today, `other`. */
  title: string;
  minutes: string;
  /**
   * The activity's exact stored duration, when editing one.
   *
   * The sheet asks for whole minutes, but a Watch-imported activity can be
   * 877 seconds. Rounding that to 900 on every save destroys precision the
   * user never touched — a bug this form had once already. Carried through
   * so an unedited duration is written back exactly as it was.
   */
  originalDurationSeconds?: number | null;
  distanceValue: string;
  distanceUnit: 'mi' | 'km';
  startTime: string;
}

export interface AddActivitySheetProps {
  visible: boolean;
  /** Present when editing an existing activity rather than adding one. */
  initial?: AddActivityValue | null;
  preferredDistanceUnit: 'mi' | 'km';
  saving?: boolean;
  errorMessage?: string | null;
  onSave: (value: AddActivityValue) => void;
  onCancel: () => void;
}

/**
 * Logging something the Watch did not record.
 *
 * The sheet this replaces asked for activity type, a free-text name, a
 * two-part duration, distance with a unit, a start time, notes, and offered
 * to save the whole thing as a reusable preset — for logging a twenty
 * minute walk. Presets exist to speed up a form that is slow; the answer
 * was to stop the form being slow.
 *
 * What is left is what the record actually needs: what it was, how long, and
 * two optional details. Notes went with the presets — a note about the day
 * is the Journal entry directly above this row.
 */
export function AddActivitySheet({
  visible,
  initial = null,
  preferredDistanceUnit,
  saving = false,
  errorMessage,
  onSave,
  onCancel,
}: AddActivitySheetProps) {
  const theme = useTheme();
  const [activityType, setActivityType] = useState<AdditionalActivityType>('walk');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [distanceValue, setDistanceValue] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km'>(preferredDistanceUnit);
  const [startTime, setStartTime] = useState('');

  useEffect(() => {
    if (!visible) return;
    setActivityType(initial?.activityType ?? 'walk');
    setTitle(initial?.title ?? '');
    setMinutes(initial?.minutes ?? '');
    setDistanceValue(initial?.distanceValue ?? '');
    setDistanceUnit(initial?.distanceUnit ?? preferredDistanceUnit);
    setStartTime(initial?.startTime ?? '');
  }, [visible, initial, preferredDistanceUnit]);

  /* Yoga has no distance and a foam-rolling session has no pace. The domain
     already decides which fields a type carries; asking again here would be
     a second answer to the same question. */
  const fields = getAdditionalActivityFields(activityType);
  const showsDistance = fields.includes('distance');
  const showsStartTime = fields.includes('startTime');
  /* "Other" is the one type that cannot describe itself, so it carries a
     name and cannot be saved without one. */
  const showsTitle = fields.includes('title');
  const canSave = minutes.trim().length > 0 && (!showsTitle || title.trim().length > 0) && !saving;

  return (
    <Sheet visible={visible} onRequestClose={onCancel} backdropTestID="add-activity-backdrop">
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {initial ? 'Edit activity' : 'Add activity'}
      </Text>
      <Text style={[styles.intro, { color: theme.text.secondary }]}>
        Anything you did outside your planned workout — a walk, a class, a ride.
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.text.secondary }]}>WHAT WAS IT</Text>
        <View style={styles.types}>
          {(Object.keys(activityTypeLabels) as AdditionalActivityType[]).map((type) => {
            const selected = type === activityType;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`activity-type-${type}`}
                onPress={() => setActivityType(type)}
                style={[
                  styles.type,
                  { backgroundColor: selected ? theme.action.primary : theme.surface.sunken },
                ]}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    { color: selected ? theme.action.primaryText : theme.text.secondary },
                  ]}
                >
                  {activityTypeLabels[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {showsTitle ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>WHAT TO CALL IT</Text>
          <View style={[styles.input, { backgroundColor: theme.surface.canvas, borderColor: theme.border.default }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Climbing, surfing, five-a-side…"
              placeholderTextColor={theme.text.secondary}
              testID="activity-title"
              style={[styles.inputValue, styles.timeValue, { color: theme.text.primary }]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.text.secondary }]}>HOW LONG</Text>
        <View style={[styles.input, { backgroundColor: theme.surface.canvas, borderColor: theme.border.default }]}>
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={theme.text.secondary}
            testID="activity-minutes"
            style={[styles.inputValue, { color: theme.text.primary }]}
          />
          <Text style={[styles.suffix, { color: theme.text.secondary }]}>minutes</Text>
        </View>
      </View>

      {showsDistance ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>HOW FAR · OPTIONAL</Text>
          <View style={[styles.input, { backgroundColor: theme.surface.canvas, borderColor: theme.border.default }]}>
            <TextInput
              value={distanceValue}
              onChangeText={setDistanceValue}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={theme.text.secondary}
              testID="activity-distance"
              style={[styles.inputValue, { color: theme.text.primary }]}
            />
            <View style={styles.units}>
              {(['mi', 'km'] as const).map((unit) => {
                const on = unit === distanceUnit;
                return (
                  <Pressable
                    key={unit}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setDistanceUnit(unit)}
                    style={[styles.unit, { backgroundColor: on ? theme.text.primary : theme.surface.sunken }]}
                  >
                    <Text style={[styles.unitLabel, { color: on ? theme.text.inverse : theme.text.secondary }]}>
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {showsStartTime ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>WHEN · OPTIONAL</Text>
          <View style={[styles.input, { backgroundColor: theme.surface.canvas, borderColor: theme.border.default }]}>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="07:20"
              placeholderTextColor={theme.text.secondary}
              testID="activity-start-time"
              style={[styles.inputValue, styles.timeValue, { color: theme.text.primary }]}
            />
          </View>
        </View>
      ) : null}

      {errorMessage ? (
        <Text style={[styles.error, { color: theme.status.errorText }]}>{errorMessage}</Text>
      ) : null}

      <Button
        label="Save activity"
        testID="save-activity"
        loading={saving}
        disabled={!canSave}
        onPress={() => onSave({ activityType, title, minutes, distanceValue, distanceUnit, startTime })}
      />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  intro: { fontSize: typeScale.compactBody.fontSize, lineHeight: 19 },
  field: { gap: spacing[8] },
  label: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  type: { borderRadius: radius.small, paddingVertical: spacing[12], paddingHorizontal: spacing[12], minHeight: 44, justifyContent: 'center' },
  typeLabel: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
    borderWidth: 1,
    borderRadius: radius.small,
    paddingHorizontal: spacing[16],
    minHeight: 56,
  },
  inputValue: { flex: 1, fontSize: typeScale.pageTitle.fontSize, fontWeight: '600', paddingVertical: spacing[12] },
  timeValue: { fontSize: typeScale.body.fontSize, fontWeight: '400' },
  suffix: { fontSize: typeScale.compactBody.fontSize },
  units: { flexDirection: 'row', gap: spacing[4] },
  unit: { borderRadius: 999, paddingVertical: spacing[8], paddingHorizontal: spacing[12], minHeight: 44, justifyContent: 'center' },
  unitLabel: { fontSize: typeScale.caption.fontSize, fontWeight: '500' },
  error: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
});
