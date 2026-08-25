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
 * Bottom padding for a screen's scroll content.
 *
 * The tab bar floats over the content, and on a home-indicator device the
 * indicator sits below it, so the last element in a scroll view is
 * otherwise unreachable behind both.
 */
export function useScreenBottomPadding(gutter: number = spacing[16]): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + gutter;
}
