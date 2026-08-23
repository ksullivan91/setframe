// react-native-safe-area-context needs a <SafeAreaProvider> ancestor to
// resolve insets; the real app root provides one (app/_layout.tsx), but
// most component tests render in isolation without it. Its own official
// jest mock returns safe zero insets instead of throwing (Story 20 —
// introduced by the shared `Sheet` primitive's `useSafeAreaInsets` call).
jest.mock('react-native-safe-area-context', () => {
  // The package ships this mock as an ESM default export; flatten it so
  // named imports (`useSafeAreaInsets`, `SafeAreaProvider`, ...) resolve.
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});
