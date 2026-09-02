import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@setframe/schemas';
import { useApiClient } from '../src/lib/api-client';

/**
 * Entry route — decides where a launch lands.
 *
 * The onboarding decision is made HERE rather than inside the tab shell's
 * layout, and every authenticated entry routes through it — the auth
 * screens used to `replace('/(tabs)/today')` directly, so a brand-new
 * account mounted Today and watched it be replaced a moment later. The
 * destination must not be the thing that decides whether you belong at
 * the destination. Nothing renders until we know.
 */
export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApiClient();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/me'),
    enabled: isLoaded && isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  /* Hold while we do not know. The splash cap in appReady means this can
     never become an indefinite blank screen. */
  if (me.isPending) return null;
  /* An errored /me falls through to Today rather than trapping the user:
     a first-run flow is worth less than a reachable app, and the tab
     layout re-checks anyway once the query recovers. */
  if (me.data?.onboardedAt == null && me.data) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/today" />;
}
