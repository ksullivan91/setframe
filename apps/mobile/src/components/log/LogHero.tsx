import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';
import { Button } from '../Button';

/**
 * The seven states the day's headline can be in.
 *
 * `unscheduled` in the original six conflated two different situations —
 * a program with no workouts in it at all, and a program whose schedule has
 * nothing on this date. The copy was wrong for the first ("Choose workout",
 * when there are none to choose), so it is split.
 */
export type LogHeroState =
  | 'in-progress'
  | 'completed'
  | 'rested'
  | 'no-program'
  | 'program-empty'
  | 'scheduled'
  | 'unscheduled';

export interface LogHeroStat {
  value: string;
  label: string;
  /** PRs are the one stat worth colouring. */
  highlight?: boolean;
}

export interface LogHeroAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
}

export interface LogHeroProps {
  state: LogHeroState;
  eyebrow: string;
  /** Rendered in two lines: the second takes the accent. */
  title: string;
  titleAccent?: string;
  chip?: string;
  body?: string;
  stats?: readonly LogHeroStat[];
  /** Exercise names, shown as chips on a scheduled day. */
  chips?: readonly string[];
  primary?: LogHeroAction;
  /** Quiet action under the primary — rest, or an escape hatch. */
  secondary?: LogHeroAction;
  /** Marks the day as a closed training step, rest included. */
  doneBadge?: React.ReactNode;
  /** Progress through a running session. */
  progress?: { done: number; total: number };
  /**
   * Composed under the actions. Log uses it for the rest-day prompt, whose
   * explanatory copy is a research-backed invariant — offering rest with no
   * account of what it does was a reported defect, and LogScreen.test.tsx
   * pins the wording. The Figma hero omits it; the test wins.
   */
  footer?: React.ReactNode;
}

/**
 * The day's single decision, and the only thing on Log with a primary
 * button. Everything below it on the screen is the record of the day.
 *
 * Dark on a light canvas so the screen has a centre of gravity — the
 * previous Today rendered fourteen cards of equal weight, which is why it
 * read as unrelated things stacked up.
 */
export function LogHero({
  state,
  eyebrow,
  title,
  titleAccent,
  chip,
  body,
  stats,
  chips,
  primary,
  secondary,
  progress,
  footer,
  doneBadge,
}: LogHeroProps) {
  const theme = useTheme();

  return (
    <View testID={`workout-card-${state}`} style={[styles.hero, { backgroundColor: theme.inverse.surface }]}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLeft}>
          {doneBadge}
          <Text style={[styles.eyebrow, { color: theme.inverse.textMuted }]}>{eyebrow}</Text>
        </View>
        {chip ? (
          <View style={[styles.chip, { backgroundColor: theme.inverse.raised }]}>
            <Text style={[styles.chipLabel, { color: theme.inverse.textMuted }]}>{chip}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.inverse.text }]}>{title}</Text>
        {titleAccent ? (
          <Text style={[styles.title, { color: theme.inverse.accent }]}>{titleAccent}</Text>
        ) : null}
        {body ? <Text style={[styles.body, { color: theme.inverse.textMuted }]}>{body}</Text> : null}
      </View>

      {progress ? (
        <View style={styles.progressBlock}>
          <View style={[styles.track, { backgroundColor: theme.inverse.raised }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: theme.inverse.accent,
                  width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: theme.inverse.textMuted }]}>
            {progress.done} of {progress.total} sets logged
          </Text>
        </View>
      ) : null}

      {chips?.length ? (
        <View style={styles.chipRow}>
          {chips.map((label) => (
            <View key={label} style={[styles.exerciseChip, { backgroundColor: theme.inverse.raised }]}>
              <Text style={[styles.exerciseChipLabel, { color: theme.inverse.text }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {stats?.length ? (
        <View style={styles.statRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text
                style={[
                  styles.statValue,
                  { color: stat.highlight ? theme.inverse.success : theme.text.inverse },
                ]}
              >
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: theme.inverse.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {footer}

      {primary || secondary ? (
        <View style={styles.actions}>
          {primary ? (
            <Button
              label={primary.label}
              onPress={primary.onPress}
              loading={primary.loading}
              testID={primary.testID}
              variant="onDark"
            />
          ) : null}
          {secondary ? (
            <Button
              label={secondary.label}
              onPress={secondary.onPress}
              loading={secondary.loading}
              testID={secondary.testID}
              variant="ghostOnDark"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.large, padding: spacing[24], gap: spacing[24] },
  eyebrowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  eyebrow: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
  chip: { borderRadius: 999, paddingVertical: spacing[4], paddingHorizontal: spacing[8] },
  chipLabel: { fontSize: typeScale.caption.fontSize },
  titleBlock: { gap: spacing[8] },
  title: { fontSize: typeScale.display.fontSize, lineHeight: typeScale.display.lineHeight, fontWeight: '600' },
  body: { fontSize: typeScale.compactBody.fontSize, lineHeight: 19 },
  progressBlock: { gap: spacing[8] },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 999 },
  progressLabel: { fontSize: typeScale.caption.fontSize },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  exerciseChip: { borderRadius: 999, paddingVertical: spacing[8], paddingHorizontal: spacing[12] },
  exerciseChipLabel: { fontSize: typeScale.caption.fontSize },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, gap: spacing[4] },
  statValue: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  statLabel: { fontSize: typeScale.caption.fontSize },
  actions: { gap: spacing[8] },
});
