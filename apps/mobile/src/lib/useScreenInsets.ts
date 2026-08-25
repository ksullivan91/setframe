import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/getTheme';

/**
 * Top padding for a screen's scroll content.
 *
 * The tab shell runs with `headerShown: false` (`app/(tabs)/_layout.tsx`),
 * so nothing reserves space for the status bar or the Dynamic Island —
 * screen content starts at y=0 and renders *underneath* both. On an
 * iPhone 17 Pro that put Today's date eyebrow behind the clock and clipped
 * the sync-status chip against the island.
 *
 * `react-native-safe-area-context` was already a dependency and already
 * mounted (`app/_layout.tsx` provides it, `Sheet.tsx` consumes it) — no
 * screen had ever read the insets.
 *
 * Returns the inset plus the screen's normal top gutter, so callers spread
 * it over their existing content style rather than doing the arithmetic
 * (and forgetting the gutter) at each call site.
 */
export function useScreenTopPadding(gutter: number = spacing[16]): number {
  const insets = useSafeAreaInsets();
  return insets.top + gutter;
}

/**
 * Bottom padding for a screen that is **not** inside the tab shell.
 *
 * Only for Stack routes running `headerShown: false`, where nothing sits
 * between the content and the home indicator.
 *
 * Deliberately not for tab screens: `BottomTabBar` already applies
 * `paddingBottom: insets.bottom` itself and is not absolutely positioned,
 * so content already ends above both the bar and the indicator. Adding the
 * inset again there produces roughly 50pt of dead space rather than the
 * intended gutter.
 */
export function useStackBottomPadding(gutter: number = spacing[16]): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + gutter;
}
