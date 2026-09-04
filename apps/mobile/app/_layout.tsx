import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { PopoverHost } from '../src/components/PopoverHost';
import { env } from '../src/lib/env';
import { tokenCache } from '../src/lib/token-cache';
import { holdSplash } from '../src/lib/appReady';

const queryClient = new QueryClient();

/* Module scope, before the first render: the splash hides on the first
   frame otherwise, and the first frame is the auth gate's `null`. */
holdSplash();

/**
 * Root layout — wires ClerkProvider (bearer-token auth per ADR 0002),
 * react-query, the shared theme provider and the popover host around every
 * route.
 * Auth-gating (SignIn/SignUp vs. the tab shell) happens in
 * `app/(tabs)/_layout.tsx` via `useAuth()`/`<Redirect>`, not here.
 */
export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <StatusBar style="dark" />
              {/* Anchored popovers (MetricInfo help) render here rather than
                  in a modal, so a panel never covers the app and a second
                  trigger stays tappable while one is open. Mounted inside
                  SafeAreaProvider so measured window coordinates and the
                  overlay share one coordinate space. */}
              <PopoverHost>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="sign-in" />
                <Stack.Screen name="sign-up" />
                {/* The program editor is now the Training tab, not a pushed
                    route — `app/program-editor.tsx` no longer exists. */}
                {/* v2 draws its own sticky header — back, title, Finish, and
                    the running meta line — so the native stack header would
                    sit on top of it and cost ~44px of the vertical space this
                    redesign exists to reclaim. It stays outside the tab shell
                    for the same reason: a tab bar under an immersive task
                    invites tapping away from a running workout. */}
                <Stack.Screen name="workout/[sessionId]" options={{ headerShown: false }} />
                {/* Every other app screen now lives inside its tab's own
                    stack (`app/(tabs)/<tab>/`), so the tab bar stays visible
                    and the stack draws a back arrow. Settings, Plans,
                    Schedule and the workout editor used to sit here instead,
                    above the tab navigator with `headerShown: false` — no tab
                    bar and no way back but the invisible edge-swipe.
                    This one remains because the logger, being outside the
                    tabs, needs history to push above it rather than jump into
                    the Progress tab mid-workout. */}
                <Stack.Screen
                  name="exercise-history/[exerciseId]"
                  options={{ headerShown: true, title: 'Exercise History' }}
                />
              </Stack>
              </PopoverHost>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
