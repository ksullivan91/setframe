import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing } from '@setframe/design-tokens';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';

/**
 * The confirmation before an account is deleted.
 *
 * Figma `⚙️ Settings › 352:11`. It names what goes rather than saying
 * "your data", because the point of a destructive confirmation is that
 * the person can picture what they are about to lose.
 *
 * The Apple Health line is load-bearing: someone deleting an account
 * should not be left wondering whether years of Health history went with
 * it. Setframe only ever read that data and never wrote to it.
 */
export function DeleteAccountSheet({
  visible,
  onCancel,
  onConfirm,
  busy,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();

  return (
    <Sheet
      visible={visible}
      onRequestClose={busy ? () => {} : onCancel}
      backdropTestID="delete-account-backdrop"
      /* The confirm sheet sits wider off the edges than Sheet's default 16,
         and lifts further off the home indicator -- Figma 352:11. */
      padding={{ top: spacing[24], bottom: spacing[40], left: spacing[24], right: spacing[24] }}
    >
      <Text style={[styles.title, { color: theme.text.primary }]}>Delete your account?</Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        This removes everything, permanently. There is no export and no way back.
      </Text>

      <View style={[styles.list, { backgroundColor: theme.surface.sunken }]}>
        <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>WHAT IS DELETED</Text>
        {[
          'Every workout and set you have logged',
          'Your plans, workouts and schedule',
          'Health data Setframe has stored',
          'Your sign-in — the email is freed for reuse',
        ].map((line) => (
          <Text key={line} style={[styles.item, { color: theme.text.primary }]}>
            ·  {line}
          </Text>
        ))}
      </View>

      <Text style={[styles.note, { color: theme.text.secondary }]}>
        Nothing is removed from Apple Health. Setframe only ever read it.
      </Text>

      <Button
        label="Delete everything"
        variant="destructive"
        onPress={onConfirm}
        loading={busy}
        disabled={busy}
        testID="confirm-delete-account"
      />
      <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
  list: { borderRadius: radius.small + 2, padding: spacing[12] + 2, gap: spacing[4] + 2 },
  eyebrow: { fontSize: 10, fontWeight: '500', letterSpacing: 0.6 },
  item: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: typeScale.caption.fontSize, lineHeight: 17 },
});
