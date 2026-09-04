import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typeScale } from '../../theme/getTheme';

export interface LogHeaderProps {
  /** "Today" when the selected date is today, otherwise "Sat 30 Aug". */
  title: string;
  /** The full date, always spelled out under the title. */
  dateLabel: string;
  onPressAccount: () => void;
}

/**
 * The Log header: a date control and the way into the account.
 *
 * The date is a control, not the screen's name (ADR 0013). "Today" as a
 * title means nothing to someone with no context for the app; the same
 * word labelling the day you are standing on explains itself.
 *
 * Extracted from the screen so `dev-log-gallery` can render it against the
 * Figma frame without an authenticated session — these are first-run and
 * date-dependent states that are otherwise awkward to reach twice.
 */
export function LogHeader({ title, dateLabel, onPressAccount }: LogHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {/* No chevron until there is a picker behind it. An affordance that
          does nothing is worse than none: it invites a tap and answers with
          silence. The week strip is how you change date today. */}
      <View style={styles.dateControl} testID="log-date-control">
        <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
        <Text style={[styles.date, { color: theme.text.secondary }]}>{dateLabel}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          testID="account-avatar"
          onPress={onPressAccount}
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: theme.surface.sunken, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <UserRound size={20} color={theme.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[12] },
  dateControl: { flex: 1, gap: spacing[4] },
  title: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  date: { fontSize: typeScale.label.fontSize },
  /* 44 is the iOS minimum target, and this is the only way to reach Settings
     now that it has left the tab bar. */
  avatar: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
});
