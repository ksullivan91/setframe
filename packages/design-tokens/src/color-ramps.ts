/**
 * Raw color ramps. Generated as HSL ramps (hue held constant, lightness/
 * saturation stepped) anchored on `accent.500` (#6979F8) and `neutral.900`
 * (#151522), originally chosen alongside the Figma file's `Setframe/Color`
 * variable collection — see docs/design/setframe-figma-style-guide.md §1.
 *
 * This file is the source of truth for these values (not Figma): the two
 * drifted independently once, and code won that reconciliation since it's
 * version-controlled and consumed directly by both apps — see
 * docs/design/setframe-figma-style-guide.md §23. Figma should be re-synced
 * (via `use_figma`) whenever a value here changes.
 *
 * Do not hand-edit individual steps without regenerating the whole ramp;
 * these must stay derivable from the two anchor hexes (`accent.500`,
 * `neutral.900`).
 */
export const colorRamps = {
  accent: {
    50: '#f2f3fd',
    100: '#e0e3fb',
    200: '#c3c9f9',
    300: '#9ba6f8',
    400: '#828ff8',
    500: '#6979F8',
    600: '#364bf2',
    700: '#1229de',
    800: '#1122ac',
    900: '#0f1b7b',
    950: '#0c1450',
  },
  neutral: {
    0: '#ffffff',
    50: '#f7f7f8',
    100: '#efeff1',
    200: '#dedee3',
    300: '#c7c7d1',
    400: '#a9a9bc',
    500: '#8585a3',
    600: '#65658b',
    700: '#4d4d6f',
    800: '#373753',
    850: '#28283e',
    900: '#151522',
    950: '#090910',
  },
  status: {
    success: '#00C48C',
    /* Story 42 — a success *surface*, for the completed-exercise and
       workout-complete cards. The solid green is a 4.6:1 accent for icons and
       text; filling a card with it produces the "entire interface turns
       bright green" result that story explicitly rules out. These two are the
       success hue carried down to a tint that body text still reads against:
       roughly 8% of the accent over the light canvas, and a desaturated deep
       green for dark mode (a tint of a light hue goes muddy on dark). */
    successSubtle: '#DFF5EC',
    successSubtleDark: '#11312A',
    error: '#FF647C',
    /* `error` and `success` are surface and icon colours. Measured against
       white they are 2.85:1 and 2.26:1 — both fail WCAG AA for text, and
       both were being used as text anyway. These are the same hues carried
       dark enough to read: 7.1:1 and 5.9:1. */
    errorText: '#A11133',
    successText: '#00674B',
    caution: '#F5A623',
    info: '#3E8FF5',
  },
} as const;

export type AccentStep = keyof typeof colorRamps.accent;
export type NeutralStep = keyof typeof colorRamps.neutral;
