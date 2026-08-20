import 'styled-components';
import type { SemanticTheme } from '@setline/design-tokens';

/**
 * Extends styled-components' DefaultTheme with Setline's semantic theme
 * shape so `props.theme.text.primary` etc. is typed everywhere.
 */
declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface DefaultTheme extends SemanticTheme {}
}
