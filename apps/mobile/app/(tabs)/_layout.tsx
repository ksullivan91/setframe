import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Home, Dumbbell, TrendingUp, Settings as SettingsIcon } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * `Shell/Mobile/TabBar` per style guide §13/§14/§19 — the 4 fixed mobile
 * tabs: Today, Training, Progress, Settings (History is web-nav-only).
 * Redirects to /sign-in when unauthenticated, matching Clerk's expected
 * auth-gating pattern for Expo Router.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.action.primary,
        tabBarInactiveTintColor: theme.text.secondary,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
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
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} /> }}
      />
    </Tabs>
  );
}
