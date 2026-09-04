import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoggerHeader } from '../src/components/workout-v2/LoggerHeader';
import { LoggerCompleteBanner } from '../src/components/workout-v2/LoggerCompleteBanner';
import { ExerciseTableCard } from '../src/components/workout-v2/ExerciseTableCard';
import { SetRowV2, type SetRowStatus, type SetRowValues } from '../src/components/workout-v2/SetRowV2';
import { SetTypeSheet } from '../src/components/workout-v2/SetTypeSheet';
import { ExerciseActionsSheet } from '../src/components/workout-v2/ExerciseActionsSheet';
import { ExerciseCardsSkeleton } from '../src/components/training-v2/TrainingSkeletons';
import { EmptySessionCard } from '../src/components/workout-v2/EmptySessionCard';
import { SaveAsWorkoutCard } from '../src/components/training-v2/SaveAsWorkoutCard';
import { WatchAttachCard } from '../src/components/watch/WatchAttachCard';
import { WatchSummaryCard } from '../src/components/watch/WatchSummaryCard';
import { HeartRateCard } from '../src/components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../src/components/watch/EffortByExerciseCard';
import { SERIES, WORKOUT, EFFORTS, CANDIDATES } from '../src/dev/watchFixtures';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme/getTheme';

/**
 * Every workout-logger surface, side by side, from fixtures.
 *
 * The logger is the hardest screen in the app to reach in a given state: a
 * PR row needs history, a failed save needs the network to fail, and the
 * completion banner needs a finished workout. Rendering each from a fixture
 * is the only way to hold one against its Figma frame while the redesign is
 * in flight.
 *
 * Mirrors the nine frames in Figma's "Shipped — Workout logger v2" section,
 * because that is the contract this reskin must not quietly drop. The four
 * Watch cards that appear after completion have their own gallery
 * (`/dev-watch-gallery`) and are not duplicated here.
 *
 * Dev-guarded, linked from nowhere.
 */

const PHONE = { width: 390 };

const ROW_STATES: SetRowStatus[] = ['empty', 'pending', 'saved', 'pr', 'error'];

const VALUES: Record<SetRowStatus, SetRowValues> = {
  empty: { weight: '', reps: '', duration: '', distance: '', rpe: '' },
  pending: { weight: '225', reps: '8', duration: '', distance: '', rpe: '' },
  saved: { weight: '225', reps: '8', duration: '', distance: '', rpe: '' },
  pr: { weight: '235', reps: '8', duration: '', distance: '', rpe: '' },
  error: { weight: '235', reps: '6', duration: '', distance: '', rpe: '' },
};

/** A row that keeps its own typed values, so the gallery is actually usable. */
function LiveRow({
  status,
  label,
  fields = ['weight', 'reps'],
}: {
  status: SetRowStatus;
  label: string;
  fields?: readonly ('weight' | 'reps')[];
}) {
  const [values, setValues] = useState<SetRowValues>(VALUES[status]);
  return (
    <SetRowV2
      setId={`${label}-${status}`}
      label={label}
      status={status}
      values={values}
      targets={{ weight: '225', reps: '8' }}
      previous={status === 'error' ? '225 × 6' : '225 × 8'}
      fields={fields}
      exerciseName="Bench Press"
      onCommit={setValues}
      onOpenSetType={() => {}}
      onCopyPrevious={() => {}}
      onRetry={() => {}}
    />
  );
}

export default function WorkoutLoggerGallery() {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.surface.sunken }} contentContainerStyle={styles.row}>
      <Frame label="Header · workout running" height={150}>
        <LoggerHeader totalVolume={5480} loggedSets={3} plannedSets={11} onBack={() => {}} onFinish={() => {}} />
      </Frame>

      <Frame label="Header · finishing" height={150}>
        <LoggerHeader totalVolume={5480} loggedSets={3} plannedSets={11} finishing onBack={() => {}} onFinish={() => {}} />
      </Frame>

      <Frame label="Header · loading" height={420}>
        <LoggerHeader totalVolume={0} loggedSets={0} plannedSets={0} statusLine="Loading…" onBack={() => {}} onFinish={() => {}} />
        <View style={styles.pad}>
          <ExerciseCardsSkeleton />
        </View>
      </Frame>

      <Frame label="Header · failed to load" height={150}>
        <LoggerHeader
          totalVolume={0}
          loggedSets={0}
          plannedSets={0}
          statusLine="Couldn't load this workout."
          onBack={() => {}}
          onFinish={() => {}}
        />
      </Frame>

      <Frame label="Banner · workout complete" height={190}>
        <LoggerCompleteBanner
          total="12,640"
          totalUnit="lb moved"
          loggedSets={14}
          personalRecordCount={2}
          duration="52 min"
          onDone={() => {}}
        />
      </Frame>

      <Frame label="Banner · no PRs, no duration" height={190}>
        <LoggerCompleteBanner
          total="640"
          totalUnit="reps"
          loggedSets={9}
          personalRecordCount={0}
          duration={null}
          onDone={() => {}}
        />
      </Frame>

      {/* Reachable since the workout picker started offering "Start an
          empty workout" — before that, this rendered as a blank screen. */}
      <Frame label="Session · nothing logged yet" height={330}>
        <View style={styles.pad}>
          <EmptySessionCard onAddExercise={() => {}} />
        </View>
      </Frame>

      <Frame label="Exercise · logging">
        <View style={styles.pad}>
          <ExerciseTableCard
            exerciseName="Bench Press"
            planLabel="Plan 3 × 8"
            resultLabel={null}
            resultTone="neutral"
            complete={false}
            fields={['weight', 'reps']}
            onAddSet={() => {}}
            onOpenActions={() => {}}
          >
            <LiveRow status="saved" label="1" />
            <LiveRow status="pending" label="2" />
            <LiveRow status="empty" label="3" />
          </ExerciseTableCard>
        </View>
      </Frame>

      {/* The v2 contract: a finished exercise stays a full table — every set
          row still on screen, still editable, "+ Add set" still there. It is
          marked complete, never collapsed into a summary. */}
      <Frame label="Exercise · complete (stays expanded)">
        <View style={styles.pad}>
          <ExerciseTableCard
            exerciseName="Bench Press"
            planLabel="Plan 3 × 8"
            resultLabel="5,480 lb · +80 lb"
            resultTone="up"
            complete
            fields={['weight', 'reps']}
            onAddSet={() => {}}
            onOpenActions={() => {}}
          >
            <LiveRow status="saved" label="1" />
            <LiveRow status="saved" label="2" />
            <LiveRow status="pr" label="3" />
          </ExerciseTableCard>
        </View>
      </Frame>

      <Frame label="Exercise · result down" height={330}>
        <View style={styles.pad}>
          <ExerciseTableCard
            exerciseName="Incline DB Press"
            planLabel="Plan 3 × 10"
            resultLabel="1,680 lb · −120 lb"
            resultTone="down"
            complete
            fields={['weight', 'reps']}
            onAddSet={() => {}}
            onOpenActions={() => {}}
          >
            <LiveRow status="saved" label="1" />
            <LiveRow status="saved" label="2" />
          </ExerciseTableCard>
        </View>
      </Frame>

      <Frame label="Exercise · warmup set">
        <View style={styles.pad}>
          <ExerciseTableCard
            exerciseName="Bench Press"
            planLabel="Plan 3 × 8"
            resultLabel={null}
            resultTone="neutral"
            complete={false}
            fields={['weight', 'reps']}
            onAddSet={() => {}}
            onOpenActions={() => {}}
          >
            <LiveRow status="saved" label="W" />
            <LiveRow status="saved" label="1" />
            <LiveRow status="empty" label="2" />
          </ExerciseTableCard>
        </View>
      </Frame>

      <Frame label="Set row · every state">
        <View style={styles.pad}>
          <ExerciseTableCard
            exerciseName="Bench Press"
            planLabel="Plan 3 × 8"
            resultLabel={null}
            resultTone="neutral"
            complete={false}
            fields={['weight', 'reps']}
            onAddSet={() => {}}
            onOpenActions={() => {}}
          >
            {ROW_STATES.map((status, index) => (
              <LiveRow key={status} status={status} label={String(index + 1)} />
            ))}
          </ExerciseTableCard>
          <Text style={[styles.legend, { color: theme.text.secondary }]}>
            1 empty · 2 pending · 3 saved · 4 PR · 5 error
          </Text>
        </View>
      </Frame>

      {/* Everything below the banner once a workout is finished. These are
          part of the logger's own flow — the Apple Watch workout the session
          overlapped, what attaching it buys, and the heart-rate record that
          comes with it — not a separate feature. Shown here in the order the
          screen renders them. */}
      <Frame label="Complete · save this as a workout" height={430}>
        <View style={styles.pad}>
          <SaveAsWorkoutCard
            derived={[
              { exerciseId: 'e1', sortOrder: 0, prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 }, name: 'Bench Press' },
              { exerciseId: 'e2', sortOrder: 1, prescription: { kind: 'sets_reps', sets: 3, repsMin: 10 }, name: 'Incline DB Press' },
            ]}
            onSave={() => {}}
            onDismiss={() => {}}
          />
        </View>
      </Frame>

      <Frame label="Complete · Watch workouts found" height={430}>
        <View style={styles.pad}>
          <WatchAttachCard
            candidates={CANDIDATES}
            onAttach={() => {}}
            onAttachAll={() => {}}
            onDismiss={() => {}}
            pendingId={null}
          />
        </View>
      </Frame>

      <Frame label="Complete · Watch workout attached" height={330}>
        <View style={styles.pad}>
          <WatchSummaryCard workouts={[WORKOUT]} onRemove={() => {}} removingId={null} />
        </View>
      </Frame>

      <Frame label="Complete · heart rate" height={430}>
        <View style={styles.pad}>
          <HeartRateCard
            series={SERIES}
            model={{ maxBpm: 190, restingBpm: 54 }}
            startedAt={WORKOUT.startedAt}
            endedAt={WORKOUT.endedAt}
            avgBpm={WORKOUT.avgHeartRateBpm}
            peakBpm={WORKOUT.peakHeartRateBpm}
          />
        </View>
      </Frame>

      <Frame label="Complete · effort by exercise" height={430}>
        <View style={styles.pad}>
          <EffortByExerciseCard efforts={EFFORTS} />
        </View>
      </Frame>

      <Frame label="Sheet · set type">
        <SetTypeSheet
          inline
          exerciseName="Bench Press"
          setLabel="3"
          currentType="working"
          onClose={() => {}}
          onSelect={() => {}}
          onDelete={() => {}}
        />
      </Frame>

      <Frame label="Sheet · exercise actions">
        <ExerciseActionsSheet
          inline
          exerciseName="Bench Press"
          context="3 of 3 sets · 5,480 lb"
          onClose={() => {}}
          onViewHistory={() => {}}
          onRemove={() => {}}
        />
      </Frame>

    </ScrollView>
  );
}

/**
 * One phone-width frame.
 *
 * `height` is per-frame rather than fixed: a header is 130px of content and
 * a fixed 620 left most of the gallery as empty boxes, which makes the whole
 * page harder to scan than the screens it is showing.
 */
function Frame({
  label,
  height = 620,
  children,
}: {
  label: string;
  height?: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.frame}>
      <Text style={[styles.label, { color: theme.text.disabled }]}>{label.toUpperCase()}</Text>
      <View
        style={[
          styles.phone,
          { height, borderColor: theme.border.subtle, backgroundColor: theme.surface.canvas },
        ]}
      >
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
  phone: { width: PHONE.width, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pad: { paddingTop: spacing[16], paddingHorizontal: spacing[16], gap: spacing[8] },
  legend: { fontSize: 11 },
});
