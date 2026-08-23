import { colorRamps } from './color-ramps';

/**
 * Semantic color aliases, one object per theme mode. Mirrors the Figma
 * `Semantic/*` variable aliases (Text, Surface, Border, Action, Status)
 * that flip per mode — see docs/design/setframe-figma-style-guide.md §1.
 * This file is the source of truth (not Figma); as of §23, several of
 * Figma's `Semantic/*` alias bindings (notably `Action/AccentSubtle`, which
 * Figma still points at a vivid ramp step rather than a subtle tint) are
 * known to disagree with these values and haven't been reconciled yet.
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
  /**
   * Data-visualisation palette. Raw observations use the accent purple and
   * the smoothed trend uses the success green, so the two brand colours
   * carry a real meaning rather than being decoration: purple is what you
   * logged, green is the signal underneath it.
   */
  chart: {
    raw: colorRamps.accent[400],
    trend: colorRamps.status.success,
    band: `${colorRamps.accent[500]}24`,
    emphasis: colorRamps.accent[600],
    empty: colorRamps.neutral[200],
    gridline: colorRamps.neutral[200],
    axis: colorRamps.neutral[500],
    series: [
      colorRamps.accent[500],
      colorRamps.status.success,
      colorRamps.status.info,
      colorRamps.status.caution,
    ],
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
  chart: {
    raw: colorRamps.accent[300],
    trend: colorRamps.status.success,
    band: `${colorRamps.accent[400]}2E`,
    emphasis: colorRamps.accent[400],
    empty: colorRamps.neutral[800],
    gridline: colorRamps.neutral[800],
    axis: colorRamps.neutral[400],
    series: [
      colorRamps.accent[400],
      colorRamps.status.success,
      colorRamps.status.info,
      colorRamps.status.caution,
    ],
  },
} as const;

export type ThemeMode = 'light' | 'dark';

export interface ChartTokens {
  /** Raw, unsmoothed observations — the numbers the user actually logged. */
  raw: string;
  /** Smoothed/trend overlay drawn on top of `raw`. */
  trend: string;
  /** Translucent area fill beneath a line or under a trend band. */
  band: string;
  /** Fill for the currently selected or current-period mark. */
  emphasis: string;
  /** Fill for a period with no data, so gaps read as real absences. */
  empty: string;
  gridline: string;
  axis: string;
  /**
   * Ordered categorical palette for multi-series charts. Deliberately leads
   * with the two brand anchors (accent purple, success green) before
   * borrowing the informational blue and caution amber.
   */
  series: readonly string[];
}

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
  chart: ChartTokens;
}

export const themes: Record<ThemeMode, SemanticTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
