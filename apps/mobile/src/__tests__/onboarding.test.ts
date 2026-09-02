export {};

declare const __dirname: string;
interface NodeFs { readFileSync(file: string, encoding: string): string }
interface NodePath { join(...parts: string[]): string }
const fs = require('fs') as NodeFs;
const path = require('path') as NodePath;

const src = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const app = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', 'app', ...p), 'utf8');

/**
 * Onboarding must run exactly once, and never for an established account.
 *
 * Source-level: the alternative is mounting the tab layout with a mocked
 * Clerk session AND a mocked API, which would assert the mock rather than
 * the rule.
 */
describe('the run-once gate', () => {
  const layout = () => app('(tabs)', '_layout.tsx');

  it('reads server state, not a device flag', () => {
    /* A device flag walks an established user through first-run again on a
       new phone. */
    const source = layout();
    expect(source).toContain("queryKey: ['me']");
    expect(source).toContain('onboardedAt == null');
    for (const local of ['AsyncStorage', 'SecureStore', 'hasSeenOnboarding']) {
      expect(source).not.toContain(local);
    }
  });

  it('holds rather than flashing Today before it knows', () => {
    // Rendering tabs first and redirecting later shows the app to someone
    // who has never seen it.
    expect(layout()).toContain('if (me.isPending) return null;');
  });

  it('does not infer completion from having a program or Health', () => {
    /* Someone who declined both is indistinguishable from a new account,
       so inference re-runs the flow forever for exactly the users who
       exercised the right to skip. */
    const source = layout();
    expect(source).not.toContain('programs');
    expect(source).not.toContain('healthKit');
  });
});

describe('finishing onboarding', () => {
  const flow = () => src('screens', 'onboarding', 'OnboardingFlow.tsx');

  it('marks it finished when skipped, not only when completed', () => {
    /* Skipping is a decision. Treating it as "not done" re-runs the flow
       for everyone who declined. */
    const source = flow();
    expect(source).toContain("api.post<User>('/me/onboarded'");
    const skip = source.slice(source.indexOf('onSkipProgram'));
    expect(skip.slice(0, 200)).toContain("setStep('done')");
  });

  it('never traps the user when the write fails', () => {
    // Worst case it runs once more; that beats an unreachable app.
    const source = flow();
    expect(source).toMatch(/onError: \(\) => onFinished\(\)/);
  });
});

describe('the Apple Health step', () => {
  const flow = () => src('screens', 'onboarding', 'OnboardingFlow.tsx');

  it('skips the payoff screen when nothing came through', () => {
    /* Step 4 with no data is an empty promise. iOS never tells us
       "denied", so absence is the only signal there is. */
    const source = flow();
    expect(source).toContain('hasHealthData');
    expect(source).toMatch(/hasHealthData \? 'measured' : 'program'/);
  });

  it('states that Setframe never writes to Health', () => {
    expect(flow()).toContain('never writes anything to Apple Health');
  });
});
