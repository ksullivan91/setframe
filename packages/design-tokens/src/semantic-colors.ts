import { colorRamps } from './color-ramps';

/**
 * Semantic color aliases, one object per theme mode. Mirrors the Figma
 * `Semantic/*` variable aliases (Text, Surface, Border, Action, Status)
 * that flip per mode — see docs/design/setframe-figma-style-guide.md §1.
 *
 * Consumers (web `styled-components` theme, mobile RN theme) should
 * always reference these semantic tokens, never raw ramp steps, so
 * light/dark switches stay a single object swap.
 */
export const lightTheme = {
  text: {
    primary: colorRamps.neutral[900],
    secondary: colorRamps.neutral[600],
    inverse: colorRamps.neutral[0],
    disabled: colorRamps.neutral[400],
  },
  surface: {
    canvas: colorRamps.neutral[50],
    raised: colorRamps.neutral[0],
    sunken: colorRamps.neutral[100],
  },
  border: {
    default: colorRamps.neutral[200],
    subtle: colorRamps.neutral[100],
  },
  action: {
    primary: colorRamps.accent[600],
    primaryHover: colorRamps.accent[700],
    primaryText: colorRamps.neutral[0],
    accentSubtle: colorRamps.accent[100],
    destructive: colorRamps.status.error,
  },
  status: {
    success: colorRamps.status.success,
    error: colorRamps.status.error,
    caution: colorRamps.status.caution,
    info: colorRamps.status.info,
  },
} as const;

export const darkTheme = {
  text: {
    primary: colorRamps.neutral[0],
    secondary: colorRamps.neutral[300],
    inverse: colorRamps.neutral[900],
    disabled: colorRamps.neutral[600],
  },
  surface: {
    canvas: colorRamps.neutral[900],
    raised: colorRamps.neutral[850],
    sunken: colorRamps.neutral[950],
  },
  border: {
    default: colorRamps.neutral[700],
    subtle: colorRamps.neutral[800],
  },
  action: {
    primary: colorRamps.accent[500],
    primaryHover: colorRamps.accent[400],
    primaryText: colorRamps.neutral[900],
    accentSubtle: colorRamps.accent[900],
    destructive: colorRamps.status.error,
  },
  status: {
    success: colorRamps.status.success,
    error: colorRamps.status.error,
    caution: colorRamps.status.caution,
    info: colorRamps.status.info,
  },
} as const;

export type ThemeMode = 'light' | 'dark';

export interface SemanticTheme {
  text: { primary: string; secondary: string; inverse: string; disabled: string };
  surface: { canvas: string; raised: string; sunken: string };
  border: { default: string; subtle: string };
  action: {
    primary: string;
    primaryHover: string;
    primaryText: string;
    accentSubtle: string;
    destructive: string;
  };
  status: { success: string; error: string; caution: string; info: string };
}

export const themes: Record<ThemeMode, SemanticTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
