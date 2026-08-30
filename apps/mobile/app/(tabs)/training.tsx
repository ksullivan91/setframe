import { TrainingScreenV2 } from '../../src/screens/TrainingScreenV2';

/**
 * The Training tab.
 *
 * Training v2 (story 76) replaces the three-tab editor that used to live in
 * this file. That editor still exists, at `/training-manage`, until the
 * pushed screens stories 79-81 build replace it surface by surface — the
 * overview's controls point there in the meantime so nothing dead-ends.
 */
export default function TrainingTab() {
  return <TrainingScreenV2 />;
}
