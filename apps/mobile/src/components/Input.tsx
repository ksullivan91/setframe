import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/getTheme';

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  errorMessage?: string;
  numeric?: boolean;
  testID?: string;
}

/**
 * `TextField/Numeric`-style Input per style guide §6, generalized to
 * also cover text/email/password fields (SignIn/SignUp chrome). `unit`
 * renders a suffix (e.g. "lb") for weight/BP numeric entry per §6/§10 —
 * weight/reps/BP are unitless numbers without it.
 */
export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  keyboardType,
  secureTextEntry,
  errorMessage,
  numeric = false,
  testID,
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.fieldRow,
          {
            borderColor: errorMessage
              ? theme.status.error
              : focused
                ? theme.action.primary
                : theme.border.default,
            backgroundColor: theme.surface.raised,
          },
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.text.disabled}
          keyboardType={numeric ? 'decimal-pad' : keyboardType}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: theme.text.primary,
              fontSize: typeScale.body.fontSize,
            },
          ]}
        />
        {unit ? (
          <Text style={[styles.unit, { color: theme.text.secondary }]}>{unit}</Text>
        ) : null}
      </View>
      {errorMessage ? (
        <Text style={[styles.helper, { color: theme.status.error }]}>{errorMessage}</Text>
      ) : null}
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.small,
    paddingHorizontal: spacing[12],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[12],
  },
  unit: {
    fontSize: typeScale.label.fontSize,
    marginLeft: spacing[8],
  },
  helper: {
    fontSize: typeScale.helper.fontSize,
    lineHeight: typeScale.helper.lineHeight,
  },
});
