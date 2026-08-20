/**
 * Raw color ramps. Generated as HSL ramps (hue held constant, lightness/
 * saturation stepped) anchored on the exact hexes chosen in the Figma file
 * (`Setline/Color` variable collection) — see
 * docs/design/setline-figma-style-guide.md §1.
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
    error: '#FF647C',
    caution: '#F5A623',
    info: '#3E8FF5',
  },
} as const;

export type AccentStep = keyof typeof colorRamps.accent;
export type NeutralStep = keyof typeof colorRamps.neutral;
