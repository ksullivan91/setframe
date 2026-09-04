import { ExerciseHistoryScreen } from '../../src/screens/ExerciseHistoryScreen';

/**
 * The same history screen, reachable from the workout logger.
 *
 * The logger deliberately sits outside the tab shell (it is an immersive
 * task with its own header), so history opened from it pushes above the
 * logger rather than jumping the user into the Progress tab mid-workout.
 * Progress reaches the same screen at `/progress/exercise-history/:id`.
 */
export default function LoggerExerciseHistoryRoute() {
  return <ExerciseHistoryScreen />;
}
