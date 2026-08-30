import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeekStripDay } from '@setframe/domain';
import { training } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The seven-day strip. Counterpart of
 * `apps/web/src/components/training-v2/WeekStrip.tsx`.
 *
 * Seven 42px chips with a 6px gap sum to 330, exactly the card's inner width.
 * Day order comes from `buildWeekStrip`, which derives it from the product's
 * own `WEEK_START_DAY` — see `packages/domain/src/training-overview.ts`.
 *
 * **State never rides on colour alone**: every chip carries a caption naming
 * the workout, or the word "Rest".
 */

export interface WeekStripProps {
  days: readonly WeekStripDay[];
  onSelectDay?: (day: WeekStripDay) => void;
}

export function WeekStrip({ days, onSelectDay }: WeekStripProps) {
  const theme = useTheme();

  return (
    <View style={styles.strip} accessibilityRole="list">
      {days.map((day) => (
        <Pressable
          key={day.localDate}
          style={styles.day}
          onPress={() => onSelectDay?.(day)}
          /* The letter alone is ambiguous — two days read "T". */
          accessibilityLabel={`${day.dayName}, ${day.caption}`}
          accessibilityRole="button"
          testID={`week-day-${day.localDate}`}
        >
          <View
            style={[
              styles.chip,
              {
                backgroundColor:
                  day.state === 'done'
                    ? theme.status.success + '33'
                    : day.state === 'today'
                      ? theme.action.primary
                      : theme.surface.sunken,
              },
            ]}
          >
            <Text
              style={[
                styles.letter,
                {
                  color:
                    day.state === 'today' ? theme.action.primaryText : theme.text.primary,
                },
              ]}
            >
              {day.letter}
            </Text>
          </View>
          <Text style={[styles.caption, { color: theme.text.secondary }]} numberOfLines={1}>
            {day.caption}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: training.weekStrip.dayGap },
  day: {
    width: training.weekStrip.dayWidth,
    alignItems: 'center',
    gap: training.weekStrip.labelGap,
  },
  chip: {
    width: training.weekStrip.chipSize,
    height: training.weekStrip.chipSize,
    borderRadius: training.weekStrip.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontSize: training.weekStrip.dayLetterSize, fontWeight: '600' },
  caption: { fontSize: training.weekStrip.workoutNameSize, maxWidth: training.weekStrip.dayWidth },
});
