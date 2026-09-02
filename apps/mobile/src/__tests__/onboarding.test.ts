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
    /* Rendering tabs first and redirecting later shows the app to someone
       who has never seen it. Asserts that it HOLDS, not what it holds
       with — pinning `return null` broke the moment that became
       <AppLoading />, while the rule was unchanged. */
    const source = layout();
    const gate = source.slice(source.indexOf('if (me.isPending)'));
    expect(gate.slice(0, 60)).toMatch(/return <AppLoading \/>|return null/);
    expect(source.indexOf('if (me.isPending)')).toBeLessThan(source.indexOf('<Tabs'));
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

describe('screens that read Health are skipped together when it is not connected', () => {
  const flow = () => src('screens', 'onboarding', 'OnboardingFlow.tsx');

  it('skips About as well as the payoff when there is no data', () => {
    /* "About you" reads entirely from Health, and Setframe never writes
       back — so with no data it is four rows of "Not set" and no way to
       set any of them. A worse dead end than not showing it. */
    const source = flow();
    expect(source).toMatch(/hasHealthData \? 'about' : 'program'/);
    const notNow = source.slice(source.indexOf('label="Not now"'));
    expect(notNow.slice(0, 120)).toContain("setStep('program')");
  });

  it('does not promise editing the app cannot do', () => {
    /* Settings exposes only preferredUnits; sex, age, height and weight
       are read-only because they come from Health and we never write to
       it. The copy pointed at Settings anyway. */
    const source = flow();
    expect(source).not.toContain('anything that looks wrong in Settings');
    expect(source).toContain('change it there');
  });
});

describe('guided setup writes the week before leaving step 4', () => {
  const flow = () =>
    fs.readFileSync(
      path.join(__dirname, '..', 'components', 'guided-setup', 'GuidedSetupFlow.tsx'),
      'utf8',
    );

  it('commits the days on BOTH exits, not only Done', () => {
    /* "Add another workout" used to reset `days` and jump to step 2 while
       saveDays was wired only to Done — the first workout's schedule was
       silently dropped and only the last one was ever saved. */
    const source = flow();
    expect(source).toContain('onAddAnother={() => commitDays(startAnotherWorkout)}');
    expect(source).toContain('onFinish={() => commitDays(onExit)}');
    expect(source).not.toMatch(/onAddAnother=\{\(\) => \{ setWorkoutName/);
  });
});

describe('the launch path cannot flash, stick, or loop', () => {
  const entry = () => app('index.tsx');
  const flow = () => src('screens', 'onboarding', 'OnboardingFlow.tsx');
  const ready = () => src('lib', 'appReady.ts');

  it('decides before navigating, so Today never renders on the way', () => {
    /* Deciding inside the tab shell meant Today mounted first and was
       visibly replaced a moment later — what a new account actually saw. */
    const source = entry();
    expect(source).toContain("queryKey: ['me']");
    // Holds while pending, whatever it holds with.
    const gate = source.slice(source.indexOf('if (me.isPending)'));
    expect(gate.slice(0, 60)).toMatch(/return <AppLoading \/>|return null/);
    expect(source).toContain('href="/onboarding"');
  });

  it('caps the splash unconditionally, not inside one screen', () => {
    /* The cap first lived in Today's readiness effect, so a user routed to
       onboarding never armed it and sat behind the logo forever. */
    const source = ready();
    const hold = source.slice(source.indexOf('export function holdSplash'));
    expect(hold).toContain('setTimeout(releaseSplash, SPLASH_MAX_MS)');
  });

  it('releases the splash from onboarding too', () => {
    // It is a first surface like Today and the auth screens.
    expect(flow()).toContain('useEffect(releaseSplash, [])');
  });

  it('writes the finished user into cache rather than invalidating', () => {
    /* Invalidating leaves the stale user in cache while it refetches, so
       the gate reads onboardedAt: null, bounces back, and loops. */
    const source = flow();
    const success = source.slice(source.indexOf('const finish = useMutation'));
    expect(success.slice(0, 700)).toContain("setQueryData(['me'], updated)");
    expect(success.slice(0, 700)).not.toContain("invalidateQueries({ queryKey: ['me'] })");
  });
});

describe('no authenticated entry bypasses the decision', () => {
  /* This is the one that actually bit: index.tsx decided correctly, but
     sign-in and sign-up both replaced straight to /(tabs)/today, so a new
     account mounted Today and watched it be replaced. The destination
     must not be what decides whether you belong at the destination. */
  it.each(['sign-in.tsx', 'sign-up.tsx'])('%s routes through / , not the tabs', (file) => {
    const source = app(file);
    expect(source).not.toContain('(tabs)/today');
    expect(source).toMatch(/replace\('\/'\)|href="\/"/);
  });

  it('leaves the tab layout as a backstop for deep links', () => {
    // Belt and braces: a link straight into the shell still gets checked.
    expect(app('(tabs)', '_layout.tsx')).toContain('href="/onboarding"');
  });
});

describe('nothing renders before it knows what to render', () => {
  it('holds with the launch screen, not a blank one', () => {
    /* `return null` is invisible only while the native splash covers it.
       The moment the 2.5s cap fires it becomes a blank screen — splash,
       blank, app. AppLoading is the same background and mark at the same
       size, so the handover cannot be seen. */
    for (const file of [app('index.tsx'), app('(tabs)', '_layout.tsx')]) {
      expect(file).toContain('<AppLoading />');
      expect(file).not.toMatch(/if \([^)]*\) return null;/);
    }
    const loading = src('components', 'AppLoading.tsx');
    expect(loading).toContain('#364bf2');
    expect(loading).toContain('splash-icon.png');
  });

  it('never shows an empty plan list while the plans are loading', () => {
    /* It rendered straight from `data = []`, so a user with four plans was
       told they had none — the same defect the week strip had, reading
       "Rest" every day until the slots arrived. */
    const source = src('screens', 'PlansScreen.tsx');
    expect(source).toContain('programsQuery.isPending ? (');
    expect(source).not.toContain('const { data: programs = [] }');
  });
});
