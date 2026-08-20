import { themes, type ThemeMode } from '@setline/design-tokens';

/**
 * Resolves the active semantic theme object for styled-components'
 * ThemeProvider. Dark mode is structurally supported (themes.dark exists
 * and is fully wired) but the toggle itself is stubbed/deferred per the
 * style guide's "hold off on dark mode for now" note — `mode` defaults to
 * 'light' and there is currently no UI control to change it.
 */
export function getTheme(mode: ThemeMode = 'light') {
  return themes[mode];
}
