import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildLogWeek } from '@setframe/domain';
import { LogHeader } from '../src/components/log/LogHeader';
import { LogWeekStrip } from '../src/components/log/LogWeekStrip';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/getTheme';

/**
 * Every Log surface, side by side, from fixtures.
 *
 * Exists so each piece can be measured against its Figma frame without an
 * authenticated session and without waiting for the right day to come
 * round — a rest day, an abandoned session and a brand-new account cannot
 * all be reached from one account on one afternoon.
 *
 * Dev-guarded, linked from nowhere. Grows a frame per story: 75 is the
 * header, 76 adds the week strip, 78 the hero states.
 */
const PHONE = { width: 390, height: 500 };

const TODAY = '2026-09-03';

/** The frames' own top padding: safe-area on a 390×844 device, plus the
 *  screen gutter the real screen applies through useScreenTopPadding. */
const FRAME_TOP = 47 + spacing[16];

export default function DevLogGallery() {
  const theme = useTheme();
  if (!__DEV__) return null;

  return (
    <ScrollView horizontal contentContainerStyle={styles.row}>
      <Frame label="75 · Header — today">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24] }}>
          <LogHeader
            title="Today"
            dateLabel="Wednesday, 3 September"
            onPressDate={() => {}}
            onPressAccount={() => {}}
          />
        </View>
      </Frame>

      <Frame label="75 · Header — a past date">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24] }}>
          <LogHeader
            title="Sat 30 Aug"
            dateLabel="Saturday, 30 August"
            onPressDate={() => {}}
            onPressAccount={() => {}}
          />
        </View>
      </Frame>

      <Frame label="76 · Week — a normal week">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24], gap: spacing[24] }}>
          <LogHeader title="Today" dateLabel="Wednesday, 3 September" onPressDate={() => {}} onPressAccount={() => {}} />
          <LogWeekStrip
            days={buildLogWeek({
              selectedDate: TODAY,
              today: TODAY,
              trainedDates: ['2026-08-30', '2026-08-31', '2026-09-01'],
              restDates: ['2026-09-04'],
            })}
            onSelect={() => {}}
          />
        </View>
      </Frame>

      <Frame label="76 · Week — a past date selected">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24], gap: spacing[24] }}>
          <LogHeader title="Sat 30 Aug" dateLabel="Saturday, 30 August" onPressDate={() => {}} onPressAccount={() => {}} />
          <LogWeekStrip
            days={buildLogWeek({
              selectedDate: '2026-08-30',
              today: TODAY,
              trainedDates: ['2026-08-30', '2026-08-31', '2026-09-01'],
              restDates: ['2026-09-04'],
            })}
            onSelect={() => {}}
          />
        </View>
      </Frame>

      <Frame label="76 · Week — an earlier week (no today)">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24], gap: spacing[24] }}>
          <LogHeader title="Tue 25 Aug" dateLabel="Tuesday, 25 August" onPressDate={() => {}} onPressAccount={() => {}} />
          <LogWeekStrip
            days={buildLogWeek({
              selectedDate: '2026-08-25',
              today: TODAY,
              trainedDates: ['2026-08-24', '2026-08-26', '2026-08-28'],
              restDates: ['2026-08-27'],
            })}
            onSelect={() => {}}
          />
        </View>
      </Frame>

      <Frame label="76 · Week — nothing logged yet">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24], gap: spacing[24] }}>
          <LogHeader title="Today" dateLabel="Wednesday, 3 September" onPressDate={() => {}} onPressAccount={() => {}} />
          <LogWeekStrip
            days={buildLogWeek({ selectedDate: TODAY, today: TODAY, trainedDates: [], restDates: [] })}
            onSelect={() => {}}
          />
        </View>
      </Frame>

      <Frame label="75 · Header — syncing">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24] }}>
          <LogHeader
            title="Today"
            dateLabel="Wednesday, 3 September"
            onPressDate={() => {}}
            onPressAccount={() => {}}
            status={
              <View style={[styles.pill, { backgroundColor: theme.surface.sunken }]}>
                <Text style={[styles.pillLabel, { color: theme.text.secondary }]}>Syncing</Text>
              </View>
            }
          />
        </View>
      </Frame>
    </ScrollView>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.frame}>
      <Text style={[styles.label, { color: theme.text.disabled }]}>{label.toUpperCase()}</Text>
      <View style={[styles.phone, { borderColor: theme.border.subtle, backgroundColor: theme.surface.canvas }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[24], padding: spacing[24], alignItems: 'flex-start' },
  frame: { gap: spacing[8] },
  label: { fontSize: 10, letterSpacing: 1, fontWeight: '500' },
  phone: { ...PHONE, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pill: { borderRadius: 999, paddingVertical: spacing[4], paddingHorizontal: spacing[8] },
  pillLabel: { fontSize: 11 },
});
