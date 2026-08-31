import 'styled-components';
import type { SemanticTheme } from '@setframe/design-tokens';

/**
 * Extends styled-components' DefaultTheme with Setframe's semantic theme
 * shape so `props.theme.text.primary` etc. is typed everywhere.
 */
declare module 'styled-components' {

  export interface DefaultTheme extends SemanticTheme {}
}
