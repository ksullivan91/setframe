import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setline/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

export interface SelectProps<T extends string> {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  testID?: string;
}

/**
 * `Select/Dropdown` per style guide §8 — a fixed-option native-select
 * substitute (e.g. ProgramEditor's progression-rule picker: linear /
 * double-progression / percentage-based), not free-text entry.
 */
export function Select<T extends string>({ label, value, options, onChange, testID }: SelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>
      ) : null}
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderColor: theme.border.default, backgroundColor: theme.surface.raised }]}
      >
        <Text style={{ color: theme.text.primary, fontSize: typeScale.body.fontSize }}>
          {selected?.label ?? 'Select...'}
        </Text>
        <ChevronDown size={18} color={theme.text.secondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.surface.raised }]}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={styles.option}
                >
                  <Text style={{ color: theme.text.primary, fontSize: typeScale.body.fontSize }}>
                    {item.label}
                  </Text>
                  {item.value === value ? <Check size={18} color={theme.action.primary} /> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  label: {
    fontSize: typeScale.label.fontSize,
    lineHeight: typeScale.label.lineHeight,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.small,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[12],
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    maxHeight: '60%',
    paddingVertical: spacing[8],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
});
