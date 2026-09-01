import { colorRamps } from './color-ramps';

/**
 * Heart-rate zone colours and the geometry of the zone chart (story 45).
 *
 * The ramp is **sequential, single-hue** — accent 300 → 900 — not the
 * blue/green/amber/orange/red every fitness app uses. Five zone colours
 * means five hues that must also read as ordered, and that chart does not
 * survive colour blindness: the usual amber and orange sit ΔE 3.7 apart for
 * a deuteranope, so Zone 3 and Zone 4 become the same colour. 192 candidate
 * ramps were tested against the palette validator and none passed.
 *
 * In a heart-rate chart the zone *is* the height, which makes this magnitude
 * rather than identity — and magnitude takes a sequential ramp. Lightness
 * falls monotonically by 0.08–0.12 OKLab per step, so the ordering survives
 * any colour vision, and a reader who perceives no hue at all still reads
 * the zone off the bar.
 */
export const heartRateZoneColors = {
  1: colorRamps.accent[300],
  2: colorRamps.accent[500],
  3: colorRamps.accent[600],
  4: colorRamps.accent[700],
  5: colorRamps.accent[900],
} as const;

/** Geometry taken from the Figma frames, so the build matches rather than approximates. */
export const heartRateChart = {
  /** Inner content width of a 358pt card with 16pt padding. */
  contentWidth: 326,
  plotHeight: 118,
  plotPadding: 10,
  barGap: 2,
  barRadius: 8,
  /** Tallest a bar may draw, inside the plot's padding. */
  maxBarHeight: 98,
  minBarHeight: 4,
  zoneRow: {
    gap: 8,
    swatch: 11,
    nameWidth: 52,
    labelWidth: 72,
    rangeWidth: 88,
    timeWidth: 46,
  },
} as const;

/** Geometry for the effort-by-exercise bars. */
export const effortChart = {
  contentWidth: 326,
  /** Leaves room for the peak tick past the longest bar. */
  maxBarWidth: 326 - 96,
  barHeight: 10,
  barRadius: 8,
  tickWidth: 2,
  rowGap: 3,
} as const;
