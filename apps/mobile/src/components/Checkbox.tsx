import { Pressable, View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '@setline/design-tokens';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  testID?: string;
}

/**
 * Circular Checkbox per style guide §6 ("Checkbox/Checked" +
 * "Checkbox/Unchecked" for §13's inline set-row quick completion) —
 * matches the web fix noted in the style guide: fixed 24x24 square,
 * centered content (not an auto-sized frame that hugs the glyph
 * asymmetrically).
 */
export function Checkbox({ checked, onChange, testID }: CheckboxProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={[
        styles.base,
        {
          backgroundColor: checked ? theme.action.primary : 'transparent',
          borderColor: checked ? theme.action.primary : theme.border.default,
        },
      ]}
    >
      {checked ? (
        <View style={styles.iconWrap}>
          <Check size={14} color={theme.action.primaryText} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
