import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

/**
 * The Log tab's own stack.
 *
 * Settings used to be a root-stack route, which put it *above* the tab
 * navigator: the tab bar disappeared and, because the root stack sets
 * `headerShown: false`, nothing drew a back control either. The only way out
 * was the iOS edge-swipe, which is invisible. Pushing within the tab instead
 * is the platform's own answer — the tab bar stays put and the native header
 * supplies the back arrow.
 */
export default function LogStackLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: 'Log',
        headerTintColor: theme.action.primary,
        headerStyle: { backgroundColor: theme.surface.canvas },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
    </Stack>
  );
}
