import { View } from 'react-native';
import {
  exerciseCardHeight,
  exercisePicker,
  training,
  workoutEditor,
  workoutTable,
} from '@setframe/design-tokens';
import { Skeleton, SkeletonStack } from '../Skeleton';

/**
 * Loading placeholders for the Training v2 surfaces. Counterpart of
 * `apps/web/src/components/training-v2/TrainingSkeletons.tsx`.
 *
 * Sized from the same tokens as the content they stand in for, so the swap is
 * a fade rather than a reflow.
 *
 * These exist because the first version of these screens rendered their
 * *empty* state while their query was in flight: opening a workout for the
 * first time said "Nothing in here yet" for a second or two, which reads as
 * data loss rather than as loading.
 */

export function EditorRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View testID="editor-rows-skeleton" accessibilityElementsHidden>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: workoutEditor.row.gap,
            height: workoutEditor.row.height,
            paddingVertical: workoutEditor.row.paddingY,
          }}
        >
          <Skeleton width={workoutEditor.row.gripWidth} height={16} />
          <Skeleton width={workoutEditor.row.tileSize} height={workoutEditor.row.tileSize} />
          <SkeletonStack gap={6} style={{ flex: 1 }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={11} />
          </SkeletonStack>
          <Skeleton width={44} height={19} rounded />
        </View>
      ))}
    </View>
  );
}

export function ListRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View testID="list-rows-skeleton" accessibilityElementsHidden>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={{
            gap: 6,
            height: training.workoutRow.height,
            paddingVertical: training.workoutRow.paddingY,
            justifyContent: 'center',
          }}
        >
          <Skeleton width="45%" height={15} />
          <Skeleton width="60%" height={12} />
        </View>
      ))}
    </View>
  );
}

/**
 * Without this the strip renders every day as "Rest" while the slots load,
 * which is not merely empty — it briefly tells a user with a full week that
 * they have nothing scheduled.
 */
export function WeekStripSkeleton() {
  return (
    <View
      testID="week-strip-skeleton"
      accessibilityElementsHidden
      style={{ flexDirection: 'row', gap: training.weekStrip.dayGap }}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <View
          key={index}
          style={{
            width: training.weekStrip.dayWidth,
            alignItems: 'center',
            gap: training.weekStrip.labelGap,
          }}
        >
          <Skeleton width={training.weekStrip.chipSize} height={training.weekStrip.chipSize} />
          <Skeleton width="80%" height={9} />
        </View>
      ))}
    </View>
  );
}

export function ScheduleDaysSkeleton() {
  return (
    <View testID="schedule-days-skeleton" accessibilityElementsHidden>
      {Array.from({ length: 7 }, (_, index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 43,
          }}
        >
          <Skeleton width={90} height={15} />
          <Skeleton width={70} height={13} />
        </View>
      ))}
    </View>
  );
}

export function PickerRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View testID="picker-rows-skeleton" accessibilityElementsHidden>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: exercisePicker.rowGap,
            height: exercisePicker.rowHeight,
            paddingHorizontal: exercisePicker.rowPaddingX,
            paddingVertical: exercisePicker.rowPaddingY,
          }}
        >
          <Skeleton width={exercisePicker.tileSize} height={exercisePicker.tileSize} />
          <SkeletonStack gap={6} style={{ flex: 1 }}>
            <Skeleton width="50%" height={15} />
            <Skeleton width="30%" height={12} />
          </SkeletonStack>
          <Skeleton width={exercisePicker.badgeSize} height={exercisePicker.badgeSize} rounded />
        </View>
      ))}
    </View>
  );
}

/**
 * Exercise cards in the v2 logger.
 *
 * Sized with `exerciseCardHeight`, the same function the real cards use, so
 * the placeholder occupies exactly the height the content will. The logger is
 * the screen where a reflow matters most.
 */
export function ExerciseCardsSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <View
      testID="exercise-cards-skeleton"
      accessibilityElementsHidden
      style={{ gap: workoutTable.cardGap }}
    >
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton key={index} width={workoutTable.cardWidth} height={exerciseCardHeight(3)} />
      ))}
    </View>
  );
}
