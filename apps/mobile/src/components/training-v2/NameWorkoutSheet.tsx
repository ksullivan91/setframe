import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '@setframe/design-tokens';
import { Sheet } from '../Sheet';
import { Input } from '../Input';
import { Button } from '../Button';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';

/**
 * Names a new workout before it exists.
 *
 * The v2 editor is addressed by `dayTypeId`, so a workout has to be created
 * before it can be opened — and it has no rename control, so creating one
 * called "New workout" and pushing there would strand the user with a name
 * they could not change. Asking first is the smaller surface.
 *
 * Nothing is written until Create is pressed, so backing out leaves no
 * empty workout behind.
 */
export function NameWorkoutSheet({
  visible,
  onCancel,
  onCreate,
  busy,
}: {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const close = () => {
    setName('');
    onCancel();
  };

  return (
    <Sheet visible={visible} onRequestClose={close} backdropTestID="name-workout-backdrop">
      <Text style={[styles.title, { color: theme.text.primary }]}>What is this workout?</Text>
      <Text style={[styles.help, { color: theme.text.secondary }]}>
        A workout is one training day you repeat — the name is how it shows on your calendar
        and in your history.
      </Text>
      <Input
        value={name}
        onChangeText={setName}
        placeholder="Upper A"
        accessibilityLabel="Workout name"
        testID="name-workout-input"
      />
      <View style={styles.actions}>
        <Button
          label="Create"
          onPress={() => onCreate(trimmed)}
          disabled={!trimmed || busy}
          loading={busy}
          testID="name-workout-create"
        />
        <Button label="Cancel" variant="secondary" onPress={close} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  help: { fontSize: typeScale.helper.fontSize, lineHeight: 18 },
  actions: { gap: spacing[8] },
});
