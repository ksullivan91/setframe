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
  /**
   * Optional unit, e.g. "lb" for numeric weight fields. When `label` is
   * also given, folded into the visible label ("Weight (lb)") rather than
   * rendered as an in-field suffix — at narrow widths, an adornment
   * sharing the bordered input box with the value can be pushed outside
   * the field entirely (Story 22). When there's no visible label (the
   * compact inline weight/reps in `SetRow` — deliberately unlabeled to
   * stay scannable, not something this story redesigns), the unit still
   * renders inline as before, but pass `accessibilityLabel` explicitly in
   * that case so screen readers still get a real field name.
   */
  unit?: string;
  /** Overrides the computed accessible name — needed when `label` is
   * omitted for a compact/unlabeled layout, so screen readers still get
   * a real field name instead of just the unit or nothing. */
  accessibilityLabel?: string;
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
  accessibilityLabel,
  keyboardType,
  secureTextEntry,
  errorMessage,
  numeric = false,
  testID,
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const visibleLabel = label && unit ? `${label} (${unit})` : label;
  const computedAccessibilityLabel =
    accessibilityLabel ?? visibleLabel ?? (unit ? `Value, ${unit}` : undefined);

  return (
    <View style={styles.container}>
      {visibleLabel ? (
        <Text style={[styles.label, { color: theme.text.secondary }]}>{visibleLabel}</Text>
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
          accessibilityLabel={computedAccessibilityLabel}
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
        {/* Label already carries the unit once a label exists; this inline
            suffix only remains for the label-less compact case. */}
        {unit && !label ? (
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
