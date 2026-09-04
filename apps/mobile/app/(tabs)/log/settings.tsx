import { SettingsScreen } from '../../../src/screens/SettingsScreen';

/**
 * Settings, pushed inside the Log tab rather than over the whole shell, so
 * the tab bar stays visible and the stack supplies a back arrow.
 */
export default function SettingsRoute() {
  return <SettingsScreen />;
}
