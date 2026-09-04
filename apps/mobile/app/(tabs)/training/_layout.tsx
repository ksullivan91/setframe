import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

/** Training's stack — the overview plus the three editors pushed from it. */
export default function TrainingStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: 'Training',
        headerTintColor: theme.action.primary,
        headerStyle: { backgroundColor: theme.surface.canvas },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="plans" options={{ headerShown: true, title: 'Your plans' }} />
      <Stack.Screen name="schedule" options={{ headerShown: true, title: 'Schedule' }} />
      <Stack.Screen name="workout-editor" options={{ headerShown: true, title: 'Edit workout' }} />
    </Stack>
  );
}
