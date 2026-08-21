/**
 * Seeds a baseline catalog of system exercises (`is_system = true`,
 * `created_by_user_id = null`). System exercises are visible to every
 * user (see `apps/api/src/routes/exercises.ts` list query). Safe to
 * run repeatedly — uses `canonicalSlug` as an upsert key via
 * ON CONFLICT DO NOTHING, so it will never duplicate rows.
 *
 * Usage: DATABASE_URL=... npx tsx packages/database/src/seed-exercises.ts
 */
import { createDb } from './client';
import { exercise } from './schema/exercise';

const SYSTEM_EXERCISES: Array<{
  name: string;
  canonicalSlug: string;
  movementPattern: string;
  equipment: string;
}> = [
  { name: 'Barbell Back Squat', canonicalSlug: 'barbell-back-squat', movementPattern: 'squat', equipment: 'barbell' },
  { name: 'Barbell Front Squat', canonicalSlug: 'barbell-front-squat', movementPattern: 'squat', equipment: 'barbell' },
  { name: 'Barbell Bench Press', canonicalSlug: 'barbell-bench-press', movementPattern: 'horizontal-push', equipment: 'barbell' },
  { name: 'Barbell Overhead Press', canonicalSlug: 'barbell-overhead-press', movementPattern: 'vertical-push', equipment: 'barbell' },
  { name: 'Barbell Deadlift', canonicalSlug: 'barbell-deadlift', movementPattern: 'hinge', equipment: 'barbell' },
  { name: 'Barbell Romanian Deadlift', canonicalSlug: 'barbell-romanian-deadlift', movementPattern: 'hinge', equipment: 'barbell' },
  { name: 'Barbell Row', canonicalSlug: 'barbell-row', movementPattern: 'horizontal-pull', equipment: 'barbell' },
  { name: 'Barbell Hip Thrust', canonicalSlug: 'barbell-hip-thrust', movementPattern: 'hinge', equipment: 'barbell' },
  { name: 'Pull-Up', canonicalSlug: 'pull-up', movementPattern: 'vertical-pull', equipment: 'bodyweight' },
  { name: 'Chin-Up', canonicalSlug: 'chin-up', movementPattern: 'vertical-pull', equipment: 'bodyweight' },
  { name: 'Dip', canonicalSlug: 'dip', movementPattern: 'vertical-push', equipment: 'bodyweight' },
  { name: 'Push-Up', canonicalSlug: 'push-up', movementPattern: 'horizontal-push', equipment: 'bodyweight' },
  { name: 'Dumbbell Bench Press', canonicalSlug: 'dumbbell-bench-press', movementPattern: 'horizontal-push', equipment: 'dumbbell' },
  { name: 'Dumbbell Shoulder Press', canonicalSlug: 'dumbbell-shoulder-press', movementPattern: 'vertical-push', equipment: 'dumbbell' },
  { name: 'Dumbbell Row', canonicalSlug: 'dumbbell-row', movementPattern: 'horizontal-pull', equipment: 'dumbbell' },
  { name: 'Dumbbell Romanian Deadlift', canonicalSlug: 'dumbbell-romanian-deadlift', movementPattern: 'hinge', equipment: 'dumbbell' },
  { name: 'Dumbbell Lateral Raise', canonicalSlug: 'dumbbell-lateral-raise', movementPattern: 'isolation-shoulder', equipment: 'dumbbell' },
  { name: 'Dumbbell Bicep Curl', canonicalSlug: 'dumbbell-bicep-curl', movementPattern: 'isolation-arm', equipment: 'dumbbell' },
  { name: 'Goblet Squat', canonicalSlug: 'goblet-squat', movementPattern: 'squat', equipment: 'dumbbell' },
  { name: 'Walking Lunge', canonicalSlug: 'walking-lunge', movementPattern: 'squat', equipment: 'dumbbell' },
  { name: 'Bulgarian Split Squat', canonicalSlug: 'bulgarian-split-squat', movementPattern: 'squat', equipment: 'dumbbell' },
  { name: 'Leg Press', canonicalSlug: 'leg-press', movementPattern: 'squat', equipment: 'machine' },
  { name: 'Lat Pulldown', canonicalSlug: 'lat-pulldown', movementPattern: 'vertical-pull', equipment: 'machine' },
  { name: 'Seated Cable Row', canonicalSlug: 'seated-cable-row', movementPattern: 'horizontal-pull', equipment: 'cable' },
  { name: 'Cable Tricep Pushdown', canonicalSlug: 'cable-tricep-pushdown', movementPattern: 'isolation-arm', equipment: 'cable' },
  { name: 'Leg Curl', canonicalSlug: 'leg-curl', movementPattern: 'isolation-leg', equipment: 'machine' },
  { name: 'Leg Extension', canonicalSlug: 'leg-extension', movementPattern: 'isolation-leg', equipment: 'machine' },
  { name: 'Plank', canonicalSlug: 'plank', movementPattern: 'core', equipment: 'bodyweight' },
  { name: 'Hanging Leg Raise', canonicalSlug: 'hanging-leg-raise', movementPattern: 'core', equipment: 'bodyweight' },
  { name: 'Kettlebell Swing', canonicalSlug: 'kettlebell-swing', movementPattern: 'hinge', equipment: 'kettlebell' },
  { name: 'Running (Treadmill)', canonicalSlug: 'running-treadmill', movementPattern: 'cardio', equipment: 'machine' },
  { name: 'Rowing (Erg)', canonicalSlug: 'rowing-erg', movementPattern: 'cardio', equipment: 'machine' },
  { name: 'Stationary Bike', canonicalSlug: 'stationary-bike', movementPattern: 'cardio', equipment: 'machine' },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run this seed script');
  }
  const db = createDb(databaseUrl);
  const rows = SYSTEM_EXERCISES.map((e) => ({
    name: e.name,
    canonicalSlug: e.canonicalSlug,
    movementPattern: e.movementPattern,
    equipment: e.equipment,
    isSystem: true,
  }));

  const inserted = await db
    .insert(exercise)
    .values(rows)
    .onConflictDoNothing({ target: exercise.canonicalSlug })
    .returning({ id: exercise.id });

  console.log(`Seed complete: ${inserted.length} new exercise(s) inserted (of ${rows.length} candidates).`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
