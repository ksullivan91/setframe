import { Skeleton, SkeletonStack } from '../Skeleton';
import { training, workoutEditor, exercisePicker, workoutTable, exerciseCardHeight } from '@setframe/design-tokens';
import { Card, CardLabel } from './TrainingCards';

/**
 * Loading placeholders for the Training v2 surfaces.
 *
 * Each is sized from the same tokens as the content it stands in for, so the
 * swap is a fade rather than a reflow — a skeleton that is the wrong height
 * makes the page jump at the exact moment the user starts reading it.
 *
 * These exist because the first version of these screens rendered their
 * *empty* state while their query was still in flight: opening a workout for
 * the first time said "Nothing in here yet" for a second or two before the
 * exercises appeared, which reads as data loss rather than as loading.
 */

/** A row in the workout editor: grip, 36px tile, two lines of text. */
export function EditorRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div data-testid="editor-rows-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: workoutEditor.row.gap,
            height: workoutEditor.row.height,
            padding: `${workoutEditor.row.paddingY}px 0`,
          }}
        >
          <Skeleton $width={`${workoutEditor.row.gripWidth}px`} $height={16} />
          <Skeleton
            $width={`${workoutEditor.row.tileSize}px`}
            $height={workoutEditor.row.tileSize}
          />
          <SkeletonStack $gap={6} style={{ flex: 1 }}>
            <Skeleton $width="55%" $height={14} />
            <Skeleton $width="35%" $height={11} />
          </SkeletonStack>
          <Skeleton $width="44px" $height={19} $rounded />
        </div>
      ))}
    </div>
  );
}

/** Rows in the overview's Workouts card, and in the plans list. */
export function ListRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div data-testid="list-rows-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            height: training.workoutRow.height,
            padding: `${training.workoutRow.paddingY}px 0`,
            justifyContent: 'center',
          }}
        >
          <Skeleton $width="45%" $height={15} />
          <Skeleton $width="60%" $height={12} />
        </div>
      ))}
    </div>
  );
}

/**
 * The week strip, as seven chips.
 *
 * Without this the strip renders every day as "Rest" while the slots load,
 * which is not merely empty — it is *wrong*, and briefly tells a user with a
 * full week that they have nothing scheduled.
 */
export function WeekStripSkeleton() {
  return (
    <div
      data-testid="week-strip-skeleton"
      aria-hidden="true"
      style={{ display: 'flex', gap: training.weekStrip.dayGap }}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          style={{
            width: training.weekStrip.dayWidth,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: training.weekStrip.labelGap,
          }}
        >
          <Skeleton
            $width={`${training.weekStrip.chipSize}px`}
            $height={training.weekStrip.chipSize}
          />
          <Skeleton $width="80%" $height={9} />
        </div>
      ))}
    </div>
  );
}

/** Seven day rows on the schedule. */
export function ScheduleDaysSkeleton() {
  return (
    <div data-testid="schedule-days-skeleton" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 43,
          }}
        >
          <Skeleton $width="90px" $height={15} />
          <Skeleton $width="70px" $height={13} />
        </div>
      ))}
    </div>
  );
}

/** Rows in the exercise picker, at its own full-bleed row height. */
export function PickerRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div data-testid="picker-rows-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: exercisePicker.rowGap,
            height: exercisePicker.rowHeight,
            padding: `${exercisePicker.rowPaddingY}px ${exercisePicker.rowPaddingX}px`,
          }}
        >
          <Skeleton
            $width={`${exercisePicker.tileSize}px`}
            $height={exercisePicker.tileSize}
          />
          <SkeletonStack $gap={6} style={{ flex: 1 }}>
            <Skeleton $width="50%" $height={15} />
            <Skeleton $width="30%" $height={12} />
          </SkeletonStack>
          <Skeleton
            $width={`${exercisePicker.badgeSize}px`}
            $height={exercisePicker.badgeSize}
            $rounded
          />
        </div>
      ))}
    </div>
  );
}

/** A whole card standing in for one that has not loaded. */
export function CardSkeleton({ label, height = 60 }: { label: string; height?: number }) {
  return (
    <Card aria-busy="true">
      <CardLabel>{label}</CardLabel>
      <Skeleton $height={height} />
    </Card>
  );
}

/**
 * Exercise cards in the v2 logger.
 *
 * Sized with `exerciseCardHeight`, the same function the real cards use, so
 * the placeholder occupies exactly the height the content will. The logger is
 * the screen where a reflow matters most — it is the one people look at with
 * a barbell in their hands.
 */
export function ExerciseCardsSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div
      data-testid="exercise-cards-skeleton"
      aria-hidden="true"
      style={{ display: 'flex', flexDirection: 'column', gap: workoutTable.cardGap }}
    >
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton
          key={index}
          $width={`${workoutTable.cardWidth}px`}
          $height={exerciseCardHeight(3)}
        />
      ))}
    </div>
  );
}
