import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

/**
 * Entry route — redirects to the authenticated tab shell or the sign-in
 * screen depending on Clerk auth state.
 */

/**
 * Dev-only landing override.
 *
 * The iOS Simulator has no tap primitive: `simctl` cannot press a tab,
 * `osascript` needs an Accessibility grant that CI and sandboxed shells
 * don't have, and `simctl openurl` raises an undismissable "Open in
 * Setframe?" dialog. Verifying any screen other than the default therefore
 * meant hand-editing this file, reinstalling to clear expo-router's
 * persisted navigation state, and reverting afterwards — which is how a
 * screen with its title under the Dynamic Island reached the product owner
 * unnoticed.
 *
 * Set `EXPO_PUBLIC_DEV_INITIAL_ROUTE` (e.g. `/(tabs)/training`,
 * `/session-summary?sessionId=…`) and restart Metro to land there directly.
 *
 * Guarded on `__DEV__`, so a production bundle can never honour it however
 * the variable is set. It also only applies when signed in — an override
 * must not skip the auth gate.
 */
const devInitialRoute =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_INITIAL_ROUTE
    ? process.env.EXPO_PUBLIC_DEV_INITIAL_ROUTE
    : null;

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return <Redirect href={(devInitialRoute ?? '/(tabs)/today') as '/(tabs)/today'} />;
}
