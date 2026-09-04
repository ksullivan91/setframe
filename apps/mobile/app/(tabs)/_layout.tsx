import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@setframe/schemas';
import { Home, Dumbbell, TrendingUp, HeartPulse } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { AppLoading } from '../../src/components/AppLoading';
import { useApiClient } from '../../src/lib/api-client';
import { useHealthReconciler } from '../../src/healthkit/useHealthReconciler';

/**
 * `Shell/Mobile/TabBar` per style guide §13/§14/§19 — the 4 fixed mobile
 * tabs: Today, Training, Progress, Settings (History is web-nav-only).
 * Redirects to /sign-in when unauthenticated, matching Clerk's expected
 * auth-gating pattern for Expo Router.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApiClient();

  /* The run-once gate, and it reads SERVER state deliberately. A device
     flag would walk an established user through first-run again on a new
     phone, and inferring it from whether they have a program or a Health
     connection would re-run forever for anyone who declined both — which
     is exactly what onboarding offers them the right to do. */
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/me'),
    enabled: isLoaded && isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  /* Mounted on the shell, not on Trends: architecture §5 says every
     foreground event reconciles, and a user who never opens Trends is
     exactly the one whose history would otherwise never be written. Runs
     below the hooks so the rules of hooks hold on the gated returns. */
  useHealthReconciler();

  if (!isLoaded) return <AppLoading />;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  /* Hold rather than guess. Rendering the tabs first and redirecting once
     `me` lands would flash Today at someone who has never seen the app. */
  if (me.isPending) return <AppLoading />;
  if (me.data && me.data.onboardedAt == null) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.action.primary,
        tabBarInactiveTintColor: theme.text.secondary,
      }}
    >
      <Tabs.Screen
        name="log"
        options={{ title: 'Log', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="training"
        options={{ title: 'Training', tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="trends"
        options={{ title: 'Trends', tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} /> }}
      />
    </Tabs>
  );
}
