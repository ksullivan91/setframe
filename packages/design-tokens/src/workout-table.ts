/**
 * Geometry for the v2 workout logger's set table.
 *
 * Read out of Figma programmatically (`SetRow/Mobile`, node 96:57, and
 * `Screen/Mobile/WorkoutLoggerV2 — Active`, node 99:2) rather than
 * transcribed by eye, and shared rather than duplicated.
 *
 * Web and mobile build this table independently — there is no shared UI
 * package, by design — but these numbers are not component logic, they are
 * the design contract. Both platforms render the same table at the same
 * width, so the moment the two sets of constants drift the columns stop
 * lining up on one of them and nothing fails until someone looks. Sharing
 * them removes that failure mode entirely.
 *
 * The arithmetic the whole layout turns on:
 *
 *     4 + (34 + 74 + 24 + 70 + 70 + 24) + (5 x 6 gaps) + 4 = 334
 *
 * Change any of it in Figma first, then here, then re-run
 * `apps/web/e2e/functional/workout-v2-figma-parity.spec.ts`, which asserts
 * these against computed layout in a real browser.
 *
 * See docs/design/workout-logging-table.md §2.1.
 */
export const workoutTable = {
  /** Card width at a 390px viewport: 390 minus the 16px screen padding each side. */
  cardWidth: 358,
  /** Card padding, so the table inside is 358 - 24 = 334. */
  cardPadding: 12,
  cardRadius: 16,
  cardGap: 8,

  rowWidth: 334,
  rowHeight: 44,
  rowRadius: 10,
  rowPaddingX: 4,
  rowGap: 4,
  columnGap: 6,

  columns: {
    setChip: 34,
    previous: 74,
    /** Reserved in every row, occupied only on a PR, so columns never shift. */
    prSlot: 24,
    input: 70,
    mark: 24,
  },

  setChipSize: 34,
  setChipRadius: 8,
  inputHeight: 40,
  inputRadius: 8,
  /**
   * Not a style choice: below 16px iOS Safari zooms the viewport on focus and
   * never zooms back (story 28). Mobile matches it so the two platforms render
   * identically.
   */
  inputFontSize: 16,
  markSize: 24,
  columnHeaderHeight: 14,
  addSetHeight: 34,

  /** A three-set exercise, and the number the redesign turns on. */
  threeSetCardHeight: 264,
  /** Each additional set adds a row plus its gap. */
  perSetHeight: 48,
} as const;

/** Height of an exercise card for a given set count, from the same constants. */
export function exerciseCardHeight(setCount: number): number {
  return workoutTable.threeSetCardHeight + (setCount - 3) * workoutTable.perSetHeight;
}
