import { createContext, useContext, type ReactNode } from 'react';
import { getTheme } from './getTheme';
import type { SemanticTheme } from '@setframe/design-tokens';

const ThemeContext = createContext<SemanticTheme>(getTheme('light'));

/**
 * Lightweight theme provider (no styled-components on RN) — components
 * read the semantic theme via `useTheme()` and build their StyleSheet
 * with `StyleSheet.create` inside the component so values stay reactive
 * to theme changes even though dark mode isn't switchable yet.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={getTheme('light')}>{children}</ThemeContext.Provider>;
}

export function useTheme(): SemanticTheme {
  return useContext(ThemeContext);
}
