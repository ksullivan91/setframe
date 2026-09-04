import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildLogWeek, sessionHeadlineStats } from '@setframe/domain';
import { LogHeader } from '../src/components/log/LogHeader';
import { LogWeekStrip } from '../src/components/log/LogWeekStrip';
import { LogHero } from '../src/components/log/LogHero';
import { LogEntryRow } from '../src/components/log/LogEntryRow';
import { TrendMetricCard } from '../src/components/log/TrendMetricCard';
import { HeartRateZoneCard } from '../src/components/log/HeartRateZoneCard';
import { zoneBands } from '@setframe/domain';
import { DaySignals } from '../src/components/log/DaySignals';
import type { DayType } from '@setframe/schemas';
import { AddActivitySheet } from '../src/components/log/AddActivitySheet';
import { ChooseWorkoutSheet } from '../src/components/log/ChooseWorkoutSheet';
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

/* A resting rate of 54 and a max of 190 — the shape the app derives from
   HealthKit plus an age estimate. */
const ZONE_BANDS = zoneBands({ restingBpm: 54, maxBpm: 190 });

/** A real month: a light week, a big week, then a taper. */
const ZONE_WEEKS_30 = [
  { label: 'Aug 10', minutes: [44, 38, 18, 8, 1] as const },
  { label: 'Aug 17', minutes: [36, 52, 31, 16, 4] as const },
  { label: 'Aug 24', minutes: [28, 34, 29, 24, 8] as const },
  { label: 'Aug 31', minutes: [21, 24, 18, 23, 5] as const },
];

/* A training week: two hard days, two easy, two rest, one long. The rest
   days are the point — at daily resolution an empty column is a real
   reading, not a gap. */
const ZONE_DAYS_7 = [
  { label: 'M', minutes: [12, 18, 9, 4, 0] as const },
  { label: 'T', minutes: [8, 11, 16, 14, 5] as const },
  { label: 'W', minutes: [0, 0, 0, 0, 0] as const },
  { label: 'T', minutes: [14, 22, 7, 2, 0] as const },
  { label: 'F', minutes: [6, 9, 15, 17, 7] as const },
  { label: 'S', minutes: [0, 0, 0, 0, 0] as const },
  { label: 'S', minutes: [31, 44, 12, 3, 0] as const },
];

/** Twelve months, labelled every third so the axis stays readable. */
const ZONE_MONTHS_12 = Array.from({ length: 12 }, (_, i) => {
  const season = 0.7 + 0.45 * Math.sin(((i + 2) / 12) * Math.PI * 2);
  return {
    label: i % 3 === 0 ? ['Jan', 'Apr', 'Jul', 'Oct'][i / 3]! : '',
    minutes: [
      Math.round(150 * season), Math.round(190 * season), Math.round(120 * season),
      Math.round(70 * season), Math.round(18 * season),
    ] as unknown as readonly [number, number, number, number, number],
  };
});

/** Thirteen weeks, labelled every fourth so the axis stays readable. */
const ZONE_WEEKS_90 = Array.from({ length: 13 }, (_, i) => {
  const d = i / 12;
  const swell = 0.7 + 0.5 * Math.sin((i / 12) * Math.PI);
  return {
    label: i % 4 === 0 ? `W${i + 1}` : '',
    minutes: [
      Math.round((40 - 14 * d) * swell), Math.round((32 + 6 * d) * swell),
      Math.round((20 + 8 * d) * swell), Math.round((10 + 14 * d) * swell),
      Math.round((2 + 6 * d) * swell),
    ] as unknown as readonly [number, number, number, number, number],
  };
});

const PICKER_WORKOUTS = [
  { id: 'day-1', name: 'Upper A', exerciseCount: 5, plannedSetCount: 14, estimatedDurationMinutes: 52 },
  { id: 'day-2', name: 'Lower B', exerciseCount: 6, plannedSetCount: 18, estimatedDurationMinutes: 61 },
  { id: 'day-3', name: 'Full Body', exerciseCount: 7, plannedSetCount: 21, estimatedDurationMinutes: 70 },
] as unknown as DayType[];

const HEALTH_CONNECTED = {
              state: 'connected',
              metrics: { steps: 8412, activeEnergyKcal: 540, exerciseMinutes: 32, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
              recovery: { sleepMinutes: 430, hrvMs: 68, restingHeartRateBpm: 54, vo2Max: 48.2 },
              body: { weightKg: 76.5, heightCm: null, bodyFatPercent: null, biologicalSex: null, dateOfBirth: null, ageYears: null },
              nutritionSource: null,
              lastSyncedAt: null,
              hasMoreToGrant: false,
              unaskedGroups: [],
              connecting: false,
              connect: async () => {},
              refresh: async () => {},
              openHealthApp: async () => {},
            } as never;
const HEALTH_NOT_CONNECTED = {
              state: 'not_connected',
              metrics: { steps: 8412, activeEnergyKcal: 540, exerciseMinutes: 32, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
              recovery: { sleepMinutes: 430, hrvMs: 68, restingHeartRateBpm: 54, vo2Max: 48.2 },
              body: { weightKg: 76.5, heightCm: null, bodyFatPercent: null, biologicalSex: null, dateOfBirth: null, ageYears: null },
              nutritionSource: null,
              lastSyncedAt: null,
              hasMoreToGrant: false,
              unaskedGroups: [],
              connecting: false,
              connect: async () => {},
              refresh: async () => {},
              openHealthApp: async () => {},
            } as never;
const HEALTH_NO_DATA = {
              state: 'no_data',
              metrics: { steps: 8412, activeEnergyKcal: 540, exerciseMinutes: 32, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
              recovery: { sleepMinutes: 430, hrvMs: 68, restingHeartRateBpm: 54, vo2Max: 48.2 },
              body: { weightKg: 76.5, heightCm: null, bodyFatPercent: null, biologicalSex: null, dateOfBirth: null, ageYears: null },
              nutritionSource: null,
              lastSyncedAt: null,
              hasMoreToGrant: false,
              unaskedGroups: [],
              connecting: false,
              connect: async () => {},
              refresh: async () => {},
              openHealthApp: async () => {},
            } as never;

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
            onPressAccount={() => {}}
          />
        </View>
      </Frame>

      <Frame label="75 · Header — a past date">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24] }}>
          <LogHeader
            title="Sat 30 Aug"
            dateLabel="Saturday, 30 August"
            onPressAccount={() => {}}
          />
        </View>
      </Frame>

      <Frame label="76 · Week — a normal week">
        <View style={{ paddingTop: FRAME_TOP, paddingHorizontal: spacing[24], gap: spacing[24] }}>
          <LogHeader title="Today" dateLabel="Wednesday, 3 September" onPressAccount={() => {}} />
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
          <LogHeader title="Sat 30 Aug" dateLabel="Saturday, 30 August" onPressAccount={() => {}} />
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
          <LogHeader title="Tue 25 Aug" dateLabel="Tuesday, 25 August" onPressAccount={() => {}} />
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
          <LogHeader title="Today" dateLabel="Wednesday, 3 September" onPressAccount={() => {}} />
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

      <HeroFrame label="78 · Hero — in progress, nothing logged">
        <LogHero
          state="in-progress"
          eyebrow="IN PROGRESS"
          chip="Just started"
          title="Lower Body"
          titleAccent="Squat"
          body="Nothing logged yet — pick up where you left off."
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

      <HeroFrame label="79 · Hero — a recovery walk">
        <LogHero
          state="completed"
          eyebrow="DONE TODAY"
          chip="finished 07:12"
          title="Treadmill"
          titleAccent="Walk"
          stats={sessionHeadlineStats({
            totalVolume: 0,
            loggedSetCount: 1,
            personalRecordCount: 0,
            volumeDelta: null,
            comparedExerciseCount: 0,
            summaryMetric: 'duration',
            totalDurationSeconds: 2530,
            totalDistanceMiles: 2.1,
            totalReps: 0,
          })}
          primary={{ label: 'Review workout', onPress: () => {} }}
        />
      </HeroFrame>

      <HeroFrame label="79 · Hero — bodyweight session">
        <LogHero
          state="completed"
          eyebrow="DONE TODAY"
          title="Pull-ups"
          titleAccent="& Dips"
          stats={sessionHeadlineStats({
            totalVolume: 0,
            loggedSetCount: 6,
            personalRecordCount: 1,
            volumeDelta: null,
            comparedExerciseCount: 0,
            summaryMetric: 'reps',
            totalDurationSeconds: 0,
            totalDistanceMiles: 0,
            totalReps: 62,
          })}
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


      <Frame label="82 · Day signals — connected">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24] }}>
          <DaySignals
            signals={[
              { label: 'steps', value: '8,412' },
              { label: 'sleep', value: '7h 10m' },
              { label: 'cal', value: '540' },
              { label: 'rest HR', value: '54' },
            ]}
            health={HEALTH_CONNECTED}
            onOpenTrends={() => {}}
          />
        </View>
      </Frame>

      <Frame label="82 · Day signals — never connected">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24] }}>
          <DaySignals signals={[]} health={HEALTH_NOT_CONNECTED} onOpenTrends={() => {}} />
        </View>
      </Frame>

      <Frame label="82 · Day signals — asked, nothing arrived">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24] }}>
          <DaySignals signals={[]} health={HEALTH_NO_DATA} onOpenTrends={() => {}} />
        </View>
      </Frame>

      {/* Sheets render `inline` here. RN's Modal is a window-level overlay
          with no way to scope it to a parent, so a `visible` sheet in the
          gallery painted over every other frame and the gallery could not be
          scrolled past it. */}
      {/* Trends' only distribution card. Every other card is one number with
          a change; this is five numbers a week, so it is a stacked column per
          week rather than a line. */}
      <Frame label="Trends · time in zones, week">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[16] }}>
          <HeartRateZoneCard
            bands={ZONE_BANDS}
            bucketUnit="day"
            changeMinutes={-12}
            buckets={ZONE_DAYS_7}
          />
        </View>
      </Frame>

      <Frame label="Trends · time in zones, 30 days">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[16] }}>
          <HeartRateZoneCard bands={ZONE_BANDS} changeMinutes={38} buckets={ZONE_WEEKS_30} />
        </View>
      </Frame>

      <Frame label="Trends · time in zones, 90 days">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[16] }}>
          <HeartRateZoneCard bands={ZONE_BANDS} changeMinutes={84} buckets={ZONE_WEEKS_90} />
        </View>
      </Frame>

      <Frame label="Trends · time in zones, 1 year">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[16] }}>
          <HeartRateZoneCard
            bands={ZONE_BANDS}
            bucketUnit="month"
            changeMinutes={214}
            buckets={ZONE_MONTHS_12}
          />
        </View>
      </Frame>

      <Frame label="Trends · zones, nothing recorded">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[16] }}>
          <HeartRateZoneCard bands={ZONE_BANDS} buckets={[]} unavailable="no-data" />
        </View>
      </Frame>

      <Frame label="Trends · zones, no model">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[16] }}>
          <HeartRateZoneCard bands={[]} buckets={[]} unavailable="no-model" />
        </View>
      </Frame>

      <Frame label="Sheet · Add activity">
        <AddActivitySheet
          visible
          inline
          preferredDistanceUnit="mi"
          onSave={() => {}}
          onCancel={() => {}}
        />
      </Frame>

      <Frame label="Sheet · Choose a workout — pick one">
        <ChooseWorkoutSheet
          visible
          inline
          workouts={PICKER_WORKOUTS}
          onStart={() => {}}
          onCancel={() => {}}
        />
      </Frame>

      <Frame label="Sheet · Choose a workout — start it?">
        <ChooseWorkoutSheet
          visible
          inline
          initialSelectedId={PICKER_WORKOUTS[0]!.id}
          workouts={PICKER_WORKOUTS}
          onStart={() => {}}
          onCancel={() => {}}
        />
      </Frame>

      <Frame label="80 · Log rows — the three save states">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24], gap: spacing[8] }}>
          <LogEntryRow label="Morning weight" value="168.6 lb" emptyLabel="Not recorded" onPress={() => {}} />
          <LogEntryRow
            label="Morning weight"
            value="169.2 lb"
            emptyLabel="Not recorded"
            state="pending"
            onPress={() => {}}
          />
          <LogEntryRow
            label="Morning weight"
            value="168.6 lb"
            emptyLabel="Not recorded"
            state="error"
            onPress={() => {}}
            onRetry={() => {}}
          />
          <LogEntryRow label="Activity" value={null} emptyLabel="Nothing added" onPress={() => {}} />
          <LogEntryRow
            label="Journal"
            value="Felt strong. Bar speed good on the top set."
            emptyLabel="Write an entry"
            onPress={() => {}}
          />
          <LogEntryRow label="Journal" value={null} emptyLabel="Write an entry" onPress={() => {}} />
        </View>
      </Frame>

      <Frame label="80 · Log rows — a past date, read only">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24], gap: spacing[8] }}>
          <LogEntryRow label="Morning weight" value="169.1 lb" emptyLabel="Not recorded" />
          <LogEntryRow label="Activity" value="Walk · 32 min" emptyLabel="Nothing added" />
          <LogEntryRow label="Journal" value="Easy day. Legs felt heavy from Monday." emptyLabel="Nothing written" />
        </View>
      </Frame>

      <Frame label="77 · Trends — metric cards">
        <View style={{ paddingTop: spacing[24], paddingHorizontal: spacing[24], gap: spacing[8] }}>
          <TrendMetricCard
            label="Weight"
            unit="lb"
            lowerIsBetter
            series={{
              key: 'weight',
              points: [
                { localDate: '2026-08-05', value: 169.8 },
                { localDate: '2026-08-20', value: 169.1 },
                { localDate: '2026-09-03', value: 168.6 },
              ],
              latest: 168.6,
              change: -1.2,
            }}
          />
          <TrendMetricCard
            label="Resting heart rate"
            unit="bpm"
            lowerIsBetter
            series={{
              key: 'restingHeartRate',
              points: [
                { localDate: '2026-08-05', value: 56 },
                { localDate: '2026-09-03', value: 54 },
              ],
              latest: 54,
              change: -2,
            }}
          />
          <TrendMetricCard
            label="VO₂ max"
            unit="ml/kg·min"
            series={{ key: 'vo2Max', points: [], latest: null, change: null }}
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
