import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildLogWeek } from '@setframe/domain';
import { LogHeader } from '../src/components/log/LogHeader';
import { LogWeekStrip } from '../src/components/log/LogWeekStrip';
import { LogHero } from '../src/components/log/LogHero';
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
const HERO_PHONE = { width: 390, height: 620 };

const TODAY = '2026-09-03';

/** The frames' own top padding: safe-area on a 390×844 device, plus the
 *  screen gutter the real screen applies through useScreenTopPadding. */
const FRAME_TOP = 47 + spacing[16];

export default function DevLogGallery() {
  const theme = useTheme();
  if (!__DEV__) return null;

  return (
    <ScrollView contentContainerStyle={styles.row}>
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


      <HeroFrame label="78 · Hero — scheduled">
        <LogHero
          state="scheduled"
          eyebrow="TODAY’S TRAINING"
          chip="~52 min"
          title="Upper Body"
          titleAccent="Push"
          chips={['Bench', 'Incline DB', 'Dips', '+2']}
          primary={{ label: 'Start workout', onPress: () => {} }}
          secondary={{ label: 'Take a rest day instead', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="78 · Hero — in progress">
        <LogHero
          state="in-progress"
          eyebrow="IN PROGRESS"
          chip="Started 18 min ago"
          title="Upper Body"
          titleAccent="Push"
          progress={{ done: 6, total: 14 }}
          primary={{ label: 'Resume workout', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="78 · Hero — completed">
        <LogHero
          state="completed"
          eyebrow="DONE TODAY"
          chip="61 min"
          title="Upper Body"
          titleAccent="Push"
          stats={[
            { value: '14', label: 'sets' },
            { value: '8,240', label: 'volume lb' },
            { value: '2', label: 'PRs', highlight: true },
          ]}
          primary={{ label: 'Review workout', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="78 · Hero — rest day">
        <LogHero
          state="rested"
          eyebrow="REST DAY"
          chip="Planned"
          title="Nothing scheduled"
          body="Four days trained this week. Rest is part of the plan — the record counts it."
          primary={{ label: 'Train anyway', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="78 · Hero — no program">
        <LogHero
          state="no-program"
          eyebrow="NO PLAN YET"
          title="Nothing scheduled"
          body="Set up a plan and Log will know what comes next. It takes about two minutes, and you can change all of it later."
          primary={{ label: 'Set up my training', onPress: () => {} }}
          secondary={{ label: 'Just start a workout', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="78 · Hero — plan is empty">
        <LogHero
          state="program-empty"
          eyebrow="UPPER / LOWER 4-DAY"
          chip="No workouts"
          title="Your plan is empty"
          body="The plan exists but has no workouts in it yet. Add one and it can start landing on your week."
          primary={{ label: 'Add a workout', onPress: () => {} }}
          secondary={{ label: 'Just start a workout', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="78 · Hero — nothing scheduled today">
        <LogHero
          state="unscheduled"
          eyebrow="NOTHING ON THE SCHEDULE"
          title="Your call today"
          body="Wednesday is not a training day in Upper / Lower 4-day. Pick a workout anyway, or take the day."
          primary={{ label: 'Choose a workout', onPress: () => {} }}
          secondary={{ label: 'Take a rest day instead', onPress: () => {} }}
        />
      </HeroFrame>

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

function HeroFrame({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.frame}>
      <Text style={[styles.label, { color: theme.text.disabled }]}>{label.toUpperCase()}</Text>
      <View style={[styles.heroPhone, { borderColor: theme.border.subtle, backgroundColor: theme.surface.canvas }]}>
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24] }}>{children}</View>
      </View>
    </View>
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[24],
    padding: spacing[24],
    alignItems: 'flex-start',
  },
  frame: { gap: spacing[8] },
  label: { fontSize: 10, letterSpacing: 1, fontWeight: '500' },
  phone: { ...PHONE, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  heroPhone: { ...HERO_PHONE, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pill: { borderRadius: 999, paddingVertical: spacing[4], paddingHorizontal: spacing[8] },
  pillLabel: { fontSize: 11 },
});
