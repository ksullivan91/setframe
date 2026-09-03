import { useRouter } from 'expo-router';
import { OnboardingFlow } from '../src/screens/onboarding/OnboardingFlow';

/**
 * First run. Reached only by the redirect in `app/(tabs)/_layout.tsx`,
 * never navigated to directly — it is a state of the account, not a place.
 */
export default function OnboardingRoute() {
  const router = useRouter();
  return <OnboardingFlow onFinished={() => router.replace('/(tabs)/log')} />;
}
