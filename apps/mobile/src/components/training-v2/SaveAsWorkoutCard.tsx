import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { describeDerivedExercise, type DerivedExercise } from '@setframe/domain';
import { training } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * "Do this one again?" — the offer to turn a performed session into a
 * reusable workout. Counterpart of
 * `apps/web/src/components/training-v2/SaveAsWorkoutCard.tsx`.
 *
 * Figma: `Just 4 · Finished, save it?` (168:834) and `Just 5 · Name and save
 * it` (169:838).
 *
 * The offer sits UNDER the completion banner, never over it: the workout is
 * already recorded, so this must not block the acknowledgement of what was
 * just done.
 */

export interface SaveAsWorkoutCardProps {
  derived: readonly (DerivedExercise & { name: string })[];
  /** True when the user has no plan yet — the plan is then named first. */
  needsProgram?: boolean;
  onSave: (input: { workoutName: string; programName?: string }) => void;
  onDismiss: () => void;
  busy?: boolean;
}

export function SaveAsWorkoutCard({
  derived,
  needsProgram = false,
  onSave,
  onDismiss,
  busy,
}: SaveAsWorkoutCardProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'offer' | 'program' | 'workout'>('offer');
  const [name, setName] = useState('');
  const [programName, setProgramName] = useState('');

  const card = [
    styles.card,
    { backgroundColor: theme.inverse.raised, borderColor: theme.inverse.accent },
  ];

  if (step === 'offer') {
    return (
      <View style={card} testID="save-as-workout">
        <Text style={[styles.title, { color: theme.inverse.text }]}>Do this one again?</Text>
        <Text style={[styles.body, { color: theme.inverse.textMuted }]}>
          Save it as a workout and it becomes something you can start with one tap, or put on a day
          of the week.
        </Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setStep(needsProgram ? 'program' : 'workout')}
            testID="save-as-workout-open"
            accessibilityRole="button"
            style={[styles.primary, { backgroundColor: theme.inverse.accent }]}
          >
            <Text style={[styles.primaryLabel, { color: theme.inverse.text }]}>
              Save as a workout
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            testID="save-as-workout-dismiss"
            accessibilityRole="button"
            style={[styles.secondary, { backgroundColor: theme.inverse.surface }]}
          >
            <Text style={[styles.secondaryLabel, { color: theme.inverse.textMuted }]}>Not now</Text>
          </Pressable>
        </View>
        <Text style={[styles.note, { color: theme.inverse.textMuted }]}>
          Either way, this workout is already saved to your history.
        </Text>
      </View>
    );
  }

  if (step === 'program') {
    return (
      <View style={card} testID="save-as-program-form">
        <Text style={[styles.title, { color: theme.inverse.text }]}>First, name your plan</Text>
        {/* Says what a plan IS and why the step exists. Asking someone to name
            something they have never heard of, with no explanation, is the
            kind of wall this flow was designed to avoid. */}
        <Text style={[styles.body, { color: theme.inverse.textMuted }]}>
          A plan is where your workouts live. It is what puts them on days of the week, so Today
          knows what is next and your history stays grouped with the training it came from.
        </Text>
        <Text style={[styles.label, { color: theme.inverse.textMuted }]}>PLAN NAME</Text>
        <TextInput
          value={programName}
          onChangeText={setProgramName}
          placeholder="My training"
          placeholderTextColor={theme.inverse.textMuted + '80'}
          accessibilityLabel="Plan name"
          testID="save-as-program-name"
          style={[styles.input, { borderColor: theme.inverse.accent, color: theme.inverse.text }]}
        />
        <Text style={[styles.note, { color: theme.inverse.textMuted }]}>
          You only do this once. You can rename it, or add more plans, whenever you like.
        </Text>
        <Pressable
          disabled={!programName.trim()}
          onPress={() => setStep('workout')}
          testID="save-as-program-continue"
          accessibilityRole="button"
          style={[
            styles.primary,
            styles.fullWidth,
            { backgroundColor: programName.trim() ? theme.inverse.accent : theme.inverse.surface },
          ]}
        >
          <Text
            style={[
              styles.primaryLabel,
              { color: programName.trim() ? theme.inverse.text : theme.inverse.textMuted + '80' },
            ]}
          >
            Continue
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={card} testID="save-as-workout-form">
      <Text style={[styles.title, { color: theme.inverse.text }]}>What is this workout?</Text>
      <Text style={[styles.label, { color: theme.inverse.textMuted }]}>WORKOUT NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Leg Day"
        placeholderTextColor={theme.inverse.textMuted + '80'}
        accessibilityLabel="Workout name"
        testID="save-as-workout-name"
        style={[styles.input, { borderColor: theme.inverse.accent, color: theme.inverse.text }]}
      />

      {/* Shows exactly what is copied — "save as a workout" is otherwise an
          opaque promise. */}
      <Text style={[styles.label, { color: theme.inverse.textMuted }]}>WHAT GETS SAVED</Text>
      {derived.map((item) => (
        <View key={item.exerciseId} style={styles.previewRow}>
          <Text style={[styles.previewName, { color: theme.inverse.text }]}>{item.name}</Text>
          <Text style={[styles.previewMeta, { color: theme.inverse.textMuted }]}>
            {describeDerivedExercise(item)}
          </Text>
        </View>
      ))}
      <Text style={[styles.note, { color: theme.inverse.textMuted }]}>
        Weights are not saved as targets — you will log those fresh each time.
      </Text>

      <Pressable
        disabled={!name.trim() || busy}
        onPress={() =>
          onSave({
            workoutName: name.trim(),
            programName: needsProgram ? programName.trim() : undefined,
          })
        }
        testID="save-as-workout-confirm"
        accessibilityRole="button"
        style={[
          styles.primary,
          styles.fullWidth,
          { backgroundColor: name.trim() && !busy ? theme.inverse.accent : theme.inverse.surface },
        ]}
      >
        <Text
          style={[
            styles.primaryLabel,
            { color: name.trim() && !busy ? theme.inverse.text : theme.inverse.textMuted + '80' },
          ]}
        >
          Save workout
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: training.cardWidth,
    maxWidth: '100%',
    padding: 16,
    borderRadius: training.cardRadius,
    borderWidth: 1.5,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  primary: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flex: 1 },
  fullWidth: { flex: 0, width: '100%' },
  primaryLabel: { fontSize: 14, fontWeight: '600' },
  secondary: { height: 44, width: 104, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontSize: 14, fontWeight: '600' },
  note: { fontSize: 12 },
  label: { fontSize: 10, fontWeight: '500', letterSpacing: 0.6 },
  input: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  previewRow: { gap: 2 },
  previewName: { fontSize: 15, fontWeight: '500' },
  previewMeta: { fontSize: 12 },
});
