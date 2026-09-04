export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(file: string, encoding: string): string;
  existsSync(file: string): boolean;
  readdirSync(dir: string): string[];
}
interface NodePath {
  join(...parts: string[]): string;
}

const fs = require('fs') as NodeFs;

const path = require('path') as NodePath;

const app = (...p: string[]) => path.join(__dirname, '..', '..', 'app', ...p);
const read = (...p: string[]) => fs.readFileSync(app(...p), 'utf8');

/**
 * Source with comment bodies blanked, newlines kept.
 *
 * Matching raw source means a comment *describing* the rule satisfies the
 * test for it. That is not hypothetical: the comment explaining why
 * settings needs a sign-in redirect contains the redirect, so the first
 * version of the gate test passed with the gate deleted.
 */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m: string) => m.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1');

/** The tabs that own a stack, and the screens pushed inside each. */
const TAB_STACKS: Record<string, string[]> = {
  log: ['settings'],
  training: ['plans', 'schedule', 'workout-editor'],
  progress: ['session-summary', 'exercise-history/[exerciseId]'],
};

/**
 * The navigation shape from ADR 0013.
 *
 * Source-level because these are route-graph facts, not rendered behaviour:
 * a tab that points at a deleted file, or a screen nothing links to, renders
 * perfectly in isolation and is broken only in the app. That exact failure
 * shipped once already — sign-in and sign-up kept replacing to a route the
 * onboarding gate had moved out from under, and Today flashed before
 * onboarding for every new account.
 */
describe('the navigation shell', () => {
  it('has four tabs: Log, Training, Progress, Trends', () => {
    const layout = read('(tabs)', '_layout.tsx');
    for (const name of ['log', 'training', 'progress', 'trends']) {
      expect(layout).toContain(`name="${name}"`);
    }
    expect(layout).not.toContain('name="today"');
    expect(layout).not.toContain('name="settings"');
  });

  it('has a file or a stack directory for every tab it declares', () => {
    // Read the names out of the layout rather than restating them, or this
    // passes for a tab the layout does not have and misses one it does.
    const layout = read('(tabs)', '_layout.tsx');
    const declared = [...layout.matchAll(/name="([a-z-]+)"/g)].map((m) => m[1]!);
    expect(declared.length).toBeGreaterThan(0);
    const missing = declared.filter(
      (name) =>
        !fs.existsSync(app('(tabs)', `${name}.tsx`)) &&
        !fs.existsSync(app('(tabs)', name, 'index.tsx')),
    );
    expect(missing).toEqual([]);
  });

  it('keeps Settings reachable, now from inside the Log stack', () => {
    // The avatar on Log is the only way in. If this link goes, the delete
    // account flow, unit preferences and notification settings all become
    // unreachable while still passing every one of their own tests.
    expect(fs.existsSync(app('(tabs)', 'log', 'settings.tsx'))).toBe(true);
    expect(read('(tabs)', 'log', 'index.tsx')).toContain("router.push('/log/settings')");
  });

  /**
   * The build 22 bug, structurally.
   *
   * Settings, Plans, Schedule and the workout editor were root-stack routes.
   * The root stack sets `headerShown: false` and sits *above* the tab
   * navigator, so each one lost the tab bar and drew no back control — the
   * only way out was the iOS edge-swipe, which is invisible. Putting them in
   * a tab's own stack is what fixes it, so the test is that they are there
   * and not at the root.
   */
  it('gives every app-chrome screen a tab bar and a way back', () => {
    for (const [tab, screens] of Object.entries(TAB_STACKS)) {
      const layout = code(read('(tabs)', tab, '_layout.tsx'));
      for (const screen of screens) {
        expect(fs.existsSync(app('(tabs)', tab, `${screen}.tsx`))).toBe(true);
        // Registered in the stack, and with a header — that header is what
        // draws the back arrow.
        const registration = new RegExp(
          `name="${screen.replace(/[[\]]/g, '\\$&')}"[\\s\\S]{0,160}?headerShown: true`,
        );
        expect(layout).toMatch(registration);
      }
    }
  });

  it('leaves no app screen stranded on the root stack', () => {
    // A root-stack route is above the tab navigator: no tab bar, and no back
    // control unless it opts into a header. Only the auth and first-run
    // flows, the workout logger and the dev galleries belong there.
    const allowed = new Set([
      '_layout.tsx',
      'index.tsx',
      'sign-in.tsx',
      'sign-up.tsx',
      'onboarding.tsx',
      'guided-setup.tsx',
      'health-access.tsx',
      'dev-log-gallery.tsx',
      'dev-onboarding-gallery.tsx',
      'dev-watch-gallery.tsx',
    ]);
    const stranded = fs
      .readdirSync(app())
      .filter((entry) => entry.endsWith('.tsx'))
      .filter((entry) => !allowed.has(entry));
    expect(stranded).toEqual([]);
  });

  it('routes nothing at the old today path', () => {
    for (const file of ['index.tsx', 'onboarding.tsx']) {
      expect(read(file)).not.toContain('(tabs)/today');
    }
  });

  it('gates the signed-in shell, and Settings inherits that gate', () => {
    /* The tab layout redirects to /sign-in when the session goes. A stack
       route outside it inherits nothing, so signing out leaves the screen
       mounted over a dead session — every query 401s behind a UI that looks
       frozen, and the app has to be force-quit. That shipped in build 17 for
       exactly one screen: settings, which story 75 moved out of the tabs and
       left ungated. It is back inside them now, so the gate covers it by
       construction — but only while it stays there. */
    const shell = code(read('(tabs)', '_layout.tsx'));
    expect(shell).toMatch(/isSignedIn/);
    expect(shell).toMatch(/<Redirect href="\/sign-in"/);
    expect(fs.existsSync(app('settings.tsx'))).toBe(false);
  });

  it('signs out by navigating, not only by clearing the session', () => {
    // Clerk's state takes a frame to propagate. Without an explicit
    // navigation the screen renders at least once signed-out.
    const screen = path.join(__dirname, '..', 'screens', 'SettingsScreen.tsx');
    const source = code(fs.readFileSync(screen, 'utf8'));
    expect(source).toMatch(/await signOut\(\)/);
    expect(source).toMatch(/router\.replace\('\/sign-in'\)/);
  });
});
