import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, GripVertical } from 'lucide-react-native';
import { estimateOneRepMax, detectWeightPR } from '@setline/domain';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { SetRowEditable } from '../../src/components/SetRow';
import { IconButton } from '../../src/components/IconButton';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

interface EditableSet {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
  previousWeight?: string;
  previousReps?: string;
}

/**
 * `Screen/Mobile/WorkoutLogger` per style guide §9/§17 — the master
 * spec's most emphasized screen. Header (workout name + elapsed time +
 * Finish), one `ExerciseBlock` Card with 3 `SetRow/Editable` rows (ghost
 * "prev X" text per §17 Idea 1, trophy PR badge on the PR-achieving set,
 * computed client-side via `detectWeightPR`/`estimateOneRepMax` from
 * packages/domain for optimistic UI), inline "+ Add set," and a
 * dashed-border "+ Add exercise" affordance.
 *
 * TODO: wire POST /v1/workout-sessions + /v1/workout-exercise-logs/:id/sets
 * (docs/api.md) once the session-start flow exists; sets are local state
 * only for now.
 */
export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [elapsedLabel] = useState('18:42');
  const [sets, setSets] = useState<EditableSet[]>([
    { id: '1', weight: '185', reps: '8', completed: true, previousWeight: '180', previousReps: '8' },
    { id: '2', weight: '185', reps: '8', completed: true, previousWeight: '180', previousReps: '8' },
    { id: '3', weight: '195', reps: '6', completed: false, previousWeight: '175', previousReps: '9' },
  ]);

  const history = [
    { weightValue: 185, reps: 8 },
    { weightValue: 180, reps: 8 },
    { weightValue: 175, reps: 9 },
  ];

  function updateSet(id: string, patch: Partial<EditableSet>) {
    setSets((prev) => prev.map((set) => (set.id === id ? { ...set, ...patch } : set)));
  }

  function duplicateSet(id: string) {
    setSets((prev) => {
      const source = prev.find((set) => set.id === id);
      if (!source) return prev;
      return [...prev, { ...source, id: `${Date.now()}`, completed: false }];
    });
  }

  function removeSet(id: string) {
    setSets((prev) => prev.filter((set) => set.id !== id));
  }

  function addSet() {
    setSets((prev) => [...prev, { id: `${Date.now()}`, weight: '', reps: '', completed: false }]);
  }

  function isPr(set: EditableSet): boolean {
    const weightValue = Number(set.weight);
    if (!weightValue || !set.completed) return false;
    return detectWeightPR({ weightValue, reps: Number(set.reps) || null }, history);
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: theme.text.primary }]}>Push Day A</Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>Elapsed {elapsedLabel}</Text>
        </View>
        <Button
          label="Finish"
          variant="secondary"
          fullWidth={false}
          onPress={() => router.push('/session-summary')}
        />
      </View>

      <Card>
        <View style={styles.exerciseHeader}>
          <GripVertical size={18} color={theme.text.secondary} />
          <Text style={[styles.exerciseTitle, { color: theme.text.primary }]}>Barbell Bench Press</Text>
        </View>
        <Text style={[styles.prescription, { color: theme.text.secondary }]}>
          Target: 3 × 6-8 · Last: 185 × 8 · Suggested: 195 × 6
        </Text>

        {sets.map((set, index) => (
          <SetRowEditable
            key={set.id}
            setLabel={`Set ${index + 1}`}
            weight={set.weight}
            reps={set.reps}
            onChangeWeight={(value) => updateSet(set.id, { weight: value })}
            onChangeReps={(value) => updateSet(set.id, { reps: value })}
            completed={set.completed}
            onToggleCompleted={(completed) => updateSet(set.id, { completed })}
            previousWeight={set.previousWeight}
            previousReps={set.previousReps}
            isPr={isPr(set)}
            onDuplicate={() => duplicateSet(set.id)}
            onRemove={() => removeSet(set.id)}
          />
        ))}

        <View style={styles.addSetRow}>
          <IconButton icon={Plus} accessibilityLabel="Add set" onPress={addSet} />
          <Text style={{ color: theme.action.primary }} onPress={addSet}>
            Add set
          </Text>
        </View>
      </Card>

      <View style={[styles.addExercise, { borderColor: theme.border.default }]}>
        <Plus size={18} color={theme.text.secondary} />
        <Text style={{ color: theme.text.secondary }}>Add exercise</Text>
      </View>

      {sets.some(isPr) ? (
        <Text style={[styles.helperNote, { color: theme.text.secondary }]}>
          Est. 1RM at current top set: {Math.round(estimateOneRepMax(195, 6))} lb
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.compactBody.fontSize,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  exerciseTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  prescription: {
    fontSize: typeScale.compactBody.fontSize,
  },
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  addExercise: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: spacing[12],
    padding: spacing[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
  },
  helperNote: {
    fontSize: typeScale.caption.fontSize,
    textAlign: 'center',
  },
});
