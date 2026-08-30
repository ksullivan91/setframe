/**
 * Geometry for the Training v2 surface, shared by web and mobile.
 *
 * Same reason `workout-table.ts` exists: the two platforms render this page
 * with entirely different primitives, and the only way their layouts cannot
 * drift is for both to read the numbers from one place. Every value here was
 * read out of the Figma frames programmatically, not transcribed by eye.
 *
 * Figma: `Explore/Mobile/Training 7 · Set up, and training` (node `146:709`)
 * and its siblings in section `146:708`.
 */

export const training = {
  /** The design viewport. Everything below is derived from it. */
  screenWidth: 390,
  /** Horizontal padding on the scrolling body. */
  bodyPaddingX: 16,
  bodyPaddingTop: 4,
  bodyPaddingBottom: 16,
  /** Gap between the stacked cards. */
  cardGap: 12,

  /** A card: 390 - 2*16. */
  cardWidth: 358,
  cardPadding: 14,
  cardRadius: 16,
  /** Usable width inside a card: 358 - 2*14. */
  cardInnerWidth: 330,
  /** Gap between a card's own rows. */
  cardRowGap: 10,

  header: {
    paddingTop: 20,
    paddingBottom: 12,
    gap: 4,
    titleSize: 28,
    subtitleSize: 13,
  },

  /** The small uppercase card label ("YOUR PLAN", "THIS WEEK"). */
  labelSize: 10,
  labelLetterSpacingPercent: 6,

  activeProgram: {
    nameSize: 18,
    metaSize: 12,
    /** The "Change" button. */
    buttonHeight: 32,
    buttonPaddingX: 12,
    buttonRadius: 8,
    buttonLabelSize: 13,
    /** Block progress. Full-round so a 0% fill is invisible, not a dot. */
    trackHeight: 6,
    trackRadius: 999,
  },

  weekStrip: {
    /** Seven days across the card's inner width: 7*42 + 6*6 = 330. */
    dayWidth: 42,
    dayGap: 6,
    chipSize: 42,
    chipRadius: 8,
    /** Gap between the chip and the workout name beneath it. */
    labelGap: 4,
    dayLetterSize: 13,
    /** The name under the chip. Deliberately tiny — it is a reminder, not a
        label you read across. State never rides on colour alone, so this
        line carries "Rest" in words as well. */
    workoutNameSize: 9,
  },

  workoutRow: {
    height: 55,
    paddingY: 10,
    gap: 10,
    nameSize: 15,
    metaSize: 12,
    nameGap: 6,
    chevronSize: 18,
    /** The "Next up" pill. */
    pillPaddingX: 7,
    pillPaddingY: 2,
    pillRadius: 999,
    pillLabelSize: 10,
  },
} as const;

/**
 * Geometry for the shared exercise picker.
 *
 * Figma: `Explore/Mobile/Build 5 · Search and pick exercises` (node
 * `163:708`) and `Explore/Mobile/ExercisePicker` (`129:513`).
 *
 * Rows are **full-bleed** — 390 wide, not 358 — because the picker is a
 * full-screen surface rather than a card on one. That is why the row carries
 * its own 16px horizontal padding instead of inheriting a card's.
 */
export const exercisePicker = {
  rowHeight: 64,
  rowPaddingX: 16,
  rowPaddingY: 10,
  rowGap: 12,
  /** The illustration tile. The picker is a *choosing* surface, which is
      where the teardown said the tile earns its space. */
  tileSize: 44,
  tileRadius: 8,
  nameSize: 15,
  metaSize: 12,
  textGap: 1,
  /** The pick-order badge. Shows a NUMBER, not a check. */
  badgeSize: 26,
  badgeRadius: 999,
  badgeLabelSize: 12,
  /** Selected rows take a 6% accent wash. */
  selectedTintAlpha: 0.06,

  header: { paddingX: 16, paddingTop: 16, paddingBottom: 12, gap: 12, titleSize: 16, subtitleSize: 11 },
  search: { height: 38, radius: 8, paddingX: 12, gap: 8, fontSize: 15 },
  filter: { height: 27, paddingX: 12, radius: 999, gap: 6, labelSize: 12 },
  footer: { paddingX: 16, paddingTop: 12, paddingBottom: 20, gap: 8, ctaHeight: 48, ctaRadius: 8, ctaLabelSize: 15, hintSize: 12 },
} as const;

/**
 * Geometry for the pushed workout editor and its prescription sheet.
 *
 * Figma: `Explore/Mobile/Training 3 · Build a workout` (`147:708`) and
 * `Training 4 · Set an exercise's targets` (`152:708`).
 *
 * Master/detail on a phone is a **push, not an accordion** — the page this
 * replaces appended the editor below the list, so you scrolled past the list
 * you had just used to reach what you selected.
 */
export const workoutEditor = {
  header: { paddingTop: 16, paddingBottom: 12, paddingX: 16, gap: 6, titleSize: 18, metaSize: 12, backSize: 22, moreSize: 18 },
  /** The list card. Narrower padding than an overview card so a 334px row
      sits inside a 358px card. */
  listPaddingX: 12,
  listPaddingY: 4,
  listRadius: 16,
  row: {
    width: 334,
    height: 64,
    paddingY: 10,
    gap: 10,
    gripWidth: 18,
    gripSize: 15,
    tileSize: 36,
    tileRadius: 8,
    nameSize: 15,
    metaSize: 11,
    textGap: 1,
    pillPaddingX: 8,
    pillPaddingY: 3,
    pillRadius: 999,
    pillLabelSize: 11,
    moreWidth: 22,
    moreSize: 16,
  },
  addButton: { height: 46, radius: 8, labelSize: 14 },
  hintSize: 12,

  sheet: {
    paddingTop: 10,
    paddingBottom: 24,
    grabberWidth: 36,
    grabberHeight: 4,
    header: { paddingTop: 8, paddingBottom: 12, paddingX: 16, gap: 4, titleSize: 17, subtitleSize: 12 },
    kind: { paddingBottom: 12, gap: 8, pillPaddingX: 10, pillPaddingY: 4, pillLabelSize: 12, noteSize: 11 },
    field: { width: 104, gap: 10, labelGap: 6, labelSize: 10, inputHeight: 44, inputRadius: 8, valueSize: 16 },
    hintSize: 12,
    actionHeight: 50,
    actionPaddingY: 14,
    actionLabelSize: 15,
  },
} as const;

/**
 * Height of the workouts card for a given number of workouts.
 *
 * Padding + label row + n rows + the gaps between them. Exposed so a test can
 * assert the rendered card matches the design at any count, rather than only
 * at the four the Figma frame happens to show.
 */
export function workoutsCardHeight(workoutCount: number): number {
  const label = 15;
  const rows = workoutCount * training.workoutRow.height;
  const gaps = workoutCount * training.cardRowGap;
  return training.cardPadding * 2 + label + gaps + rows;
}
