import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Minus } from 'lucide-react-native';
import type { LogWeekDay } from '@setframe/domain';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typeScale } from '../../theme/getTheme';

export interface LogWeekStripProps {
  days: readonly LogWeekDay[];
  onSelect: (localDate: string) => void;
}

/**
 * The week, as adherence.
 *
 * Bar heights drawn from training volume were tried and rejected: volume as
 * height says taller is better, which is false inside a program. A light
 * accessory day is meant to be light, and a short bar would read as failure
 * on a day executed perfectly. What the strip encodes is what the day was —
 * trained, rested, or neither.
 *
 * Today and selected are separate marks (a dot above the letter, and a ring
 * around it) because the moment you browse to another date they are
 * different days.
 */
export function LogWeekStrip({ days, onSelect }: LogWeekStripProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {days.map((day) => (
        <Pressable
          key={day.localDate}
          accessibilityRole="button"
          accessibilityState={{ selected: day.isSelected }}
          accessibilityLabel={accessibleLabel(day)}
          testID={`log-day-${day.localDate}`}
          onPress={() => onSelect(day.localDate)}
          style={styles.day}
        >
          <View style={styles.todayMarker}>
            {day.isToday ? <View style={[styles.todayDot, { backgroundColor: theme.action.primary }]} /> : null}
          </View>
          <Text
            style={[
              styles.letter,
              { color: day.isSelected ? theme.text.primary : theme.text.secondary },
              day.isSelected && styles.letterSelected,
            ]}
          >
            {day.letter}
          </Text>
          <View
            style={[
              styles.ring,
              day.isSelected && { borderColor: theme.action.primary, borderWidth: 2 },
            ]}
          >
            <View
              style={[
                styles.mark,
                day.state === 'trained' && { backgroundColor: theme.action.primary },
                day.state === 'rest' && { backgroundColor: theme.surface.sunken },
                day.state === 'none' && { borderWidth: 1, borderColor: theme.border.default },
              ]}
            >
              {day.state === 'trained' ? <Check size={16} strokeWidth={3} color={theme.text.inverse} /> : null}
              {day.state === 'rest' ? <Minus size={16} strokeWidth={3} color={theme.text.secondary} /> : null}
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function accessibleLabel(day: LogWeekDay): string {
  const what =
    day.state === 'trained' ? 'trained' : day.state === 'rest' ? 'rest day' : day.isFuture ? 'nothing planned yet' : 'no training';
  return `${day.localDate}, ${what}${day.isToday ? ', today' : ''}`;
}

const RING = 40;
const MARK = 32;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  /* Each column is the tap target and divides the row evenly, so the mark
     inside it never has to be the thing you aim at. */
  day: { flex: 1, alignItems: 'center', gap: spacing[8] },
  todayMarker: { height: 6, justifyContent: 'center' },
  todayDot: { width: 4, height: 4, borderRadius: 999 },
  letter: { fontSize: typeScale.caption.fontSize },
  letterSelected: { fontWeight: '600' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
