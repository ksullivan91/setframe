import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { env } from '../src/lib/env';
import { tokenCache } from '../src/lib/token-cache';

const queryClient = new QueryClient();

/**
 * Root layout — wires ClerkProvider (bearer-token auth per ADR 0002),
 * react-query, and the shared theme provider around every route.
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
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="sign-in" />
                <Stack.Screen name="sign-up" />
                <Stack.Screen name="program-editor" options={{ headerShown: true, title: 'Program Editor' }} />
                <Stack.Screen name="session-summary" options={{ headerShown: true, title: 'Session Summary' }} />
                <Stack.Screen
                  name="exercise-history/[exerciseId]"
                  options={{ headerShown: true, title: 'Exercise History' }}
                />
              </Stack>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
