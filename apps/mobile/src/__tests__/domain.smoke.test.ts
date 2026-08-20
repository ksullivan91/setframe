import { detectWeightPR } from '@setline/domain';

/**
 * Smoke test verifying `packages/domain`'s PR-detection function
 * (used by the WorkoutLogger/SessionSummary trophy badge, style guide
 * §17) is importable and behaves as expected from within apps/mobile.
 */
describe('detectWeightPR (mobile smoke test)', () => {
  it('flags a new heaviest weight as a PR', () => {
    const isPr = detectWeightPR(
      { weightValue: 195, reps: 6 },
      [
        { weightValue: 185, reps: 8 },
        { weightValue: 180, reps: 8 },
      ],
    );
    expect(isPr).toBe(true);
  });

  it('does not flag a lighter set as a PR', () => {
    const isPr = detectWeightPR(
      { weightValue: 175, reps: 8 },
      [{ weightValue: 185, reps: 8 }],
    );
    expect(isPr).toBe(false);
  });
});
