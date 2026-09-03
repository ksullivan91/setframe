import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { Input } from '../Input';
import { Checkbox } from '../Checkbox';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

const MOODS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😐', label: 'Flat' },
  { value: 3, emoji: '🙂', label: 'Fine' },
  { value: 4, emoji: '💪', label: 'Strong' },
  { value: 5, emoji: '🔥', label: 'Excellent' },
];

export interface WeightSheetProps {
  visible: boolean;
  initialValue: string;
  unit: 'lb' | 'kg';
  /** A HealthKit reading for the same day, when there is one. */
  importedValue?: string | null;
  errorMessage?: string | null;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function WeightSheet({
  visible,
  initialValue,
  unit,
  importedValue,
  errorMessage,
  onSave,
  onCancel,
}: WeightSheetProps) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Sheet visible={visible} onRequestClose={onCancel} backdropTestID="weight-sheet-backdrop">
      <Text style={[styles.title, { color: theme.text.primary }]}>Morning weight</Text>
      <Input
        label="Weight"
        value={value}
        onChangeText={setValue}
        numeric
        unit={unit}
        errorMessage={errorMessage ?? undefined}
      />
      {importedValue ? (
        <View style={[styles.note, { backgroundColor: theme.surface.sunken }]}>
          <Text style={[styles.noteTitle, { color: theme.text.primary }]}>
            Apple Health has {importedValue} {unit} for today
          </Text>
          {/* Source precedence, said plainly: manual entries and imported
              ones coexist and neither overwrites the other. */}
          <Text style={[styles.noteBody, { color: theme.text.secondary }]}>
            Yours is kept and shown first. Neither overwrites the other.
          </Text>
        </View>
      ) : null}
      <Button label="Save" testID="save-weight" onPress={() => onSave(value)} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </Sheet>
  );
}

export interface JournalSheetProps {
  visible: boolean;
  initialText: string;
  initialMood: number | null;
  onSave: (text: string, mood: number | null) => void;
  onCancel: () => void;
}

export function JournalSheet({ visible, initialText, initialMood, onSave, onCancel }: JournalSheetProps) {
  const theme = useTheme();
  const [text, setText] = useState(initialText);
  const [mood, setMood] = useState<number | null>(initialMood);
  useEffect(() => {
    if (visible) {
      setText(initialText);
      setMood(initialMood);
    }
  }, [visible, initialText, initialMood]);

  return (
    <Sheet visible={visible} onRequestClose={onCancel} backdropTestID="journal-sheet-backdrop">
      <Text style={[styles.title, { color: theme.text.primary }]}>Journal</Text>
      <TextInput
        multiline
        value={text}
        onChangeText={setText}
        testID="journal-input"
        placeholder="Energy, soreness, sleep, stress, or anything to remember after the workout."
        placeholderTextColor={theme.text.disabled}
        style={[
          styles.textArea,
          { color: theme.text.primary, borderColor: theme.border.default, backgroundColor: theme.surface.canvas },
        ]}
      />
      <Text style={[styles.label, { color: theme.text.secondary }]}>HOW DID IT FEEL?</Text>
      <View style={styles.moodRow}>
        {MOODS.map((option) => {
          const selected = mood === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => setMood(selected ? null : option.value)}
              style={[
                styles.mood,
                {
                  borderColor: selected ? theme.action.primary : theme.border.default,
                  backgroundColor: selected ? theme.action.accentSubtle : theme.surface.raised,
                },
              ]}
            >
              <Text style={styles.moodEmoji}>{option.emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button label="Save entry" testID="save-journal" onPress={() => onSave(text, mood)} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </Sheet>
  );
}

export interface NutritionSheetProps {
  visible: boolean;
  logged: boolean;
  /** True when a tracker already wrote the day, so no confirmation is needed. */
  observed: boolean;
  onToggle: (logged: boolean) => void;
  onClose: () => void;
}

export function NutritionSheet({ visible, logged, observed, onToggle, onClose }: NutritionSheetProps) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onRequestClose={onClose} backdropTestID="nutrition-sheet-backdrop">
      <Text style={[styles.title, { color: theme.text.primary }]}>Nutrition check</Text>
      {observed ? (
        <Text style={[styles.noteBody, { color: theme.text.secondary }]}>
          A nutrition app already wrote today through Apple Health, so there is nothing to confirm.
        </Text>
      ) : (
        <>
          <Text style={[styles.noteBody, { color: theme.text.secondary }]}>
            No macro entry here — just confirm the meal/logging step happened.
          </Text>
          <View style={styles.checkRow}>
            <Checkbox checked={logged} onChange={onToggle} />
            <Text style={[styles.noteTitle, { color: theme.text.primary }]}>Logged in my nutrition app</Text>
          </View>
        </>
      )}
      <Button label="Done" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  label: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
  note: { borderRadius: radius.small, padding: spacing[12], gap: spacing[4] },
  noteTitle: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  noteBody: { fontSize: typeScale.label.fontSize, lineHeight: 17 },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radius.small,
    padding: spacing[12],
    textAlignVertical: 'top',
    fontSize: typeScale.body.fontSize,
  },
  moodRow: { flexDirection: 'row', gap: spacing[8] },
  mood: {
    flex: 1,
    minHeight: 44,
    borderWidth: 2,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: { fontSize: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
});
