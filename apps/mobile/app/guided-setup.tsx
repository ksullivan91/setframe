import { useRouter } from 'expo-router';
import { GuidedSetupFlow } from '../src/components/guided-setup/GuidedSetupFlow';

/**
 * Guided setup, opened from Training.
 *
 * The same flow onboarding will embed — the only difference is the `host`
 * prop, which decides the chrome. Replaces `/program-wizard` and its
 * four-tab layout, which asked the user to understand Program → Workout →
 * Exercise before doing anything.
 */
export default function GuidedSetupRoute() {
  const router = useRouter();
  return (
    <GuidedSetupFlow
      host="training"
      /* "Save & exit" and "Done" land in the same place, because whatever
         exists is already written either way. */
      onExit={() => router.replace('/(tabs)/training')}
    />
  );
}
