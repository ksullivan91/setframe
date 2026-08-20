import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

/**
 * Entry route — redirects to the authenticated tab shell or the sign-in
 * screen depending on Clerk auth state.
 */
export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return <Redirect href={isSignedIn ? '/(tabs)/today' : '/sign-in'} />;
}
