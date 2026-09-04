import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

/** Progress's stack — the overview plus the two records opened from it. */
export default function ProgressStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: 'Progress',
        headerTintColor: theme.action.primary,
        headerStyle: { backgroundColor: theme.surface.canvas },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="session-summary" options={{ headerShown: true, title: 'Session Summary' }} />
      <Stack.Screen
        name="exercise-history/[exerciseId]"
        options={{ headerShown: true, title: 'Exercise History' }}
      />
    </Stack>
  );
}
