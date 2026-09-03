export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(file: string, encoding: string): string;
  existsSync(file: string): boolean;
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
const code = (...p: string[]) =>
  read(...p)
    .replace(/\/\*[\s\S]*?\*\//g, (m: string) => m.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1');

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

  it('has a file for every tab it declares', () => {
    // Read the names out of the layout rather than restating them, or this
    // passes for a tab the layout does not have and misses one it does.
    const layout = read('(tabs)', '_layout.tsx');
    const declared = [...layout.matchAll(/name="([a-z-]+)"/g)].map((m) => m[1]!);
    expect(declared.length).toBeGreaterThan(0);
    const missing = declared.filter((name) => !fs.existsSync(app('(tabs)', `${name}.tsx`)));
    expect(missing).toEqual([]);
  });

  it('keeps Settings reachable now that it has left the tab bar', () => {
    // The avatar on Log is the only way in. If this link goes, the delete
    // account flow, unit preferences and notification settings all become
    // unreachable while still passing every one of their own tests.
    expect(fs.existsSync(app('settings.tsx'))).toBe(true);
    expect(read('(tabs)', 'log.tsx')).toContain("router.push('/settings')");
  });

  it('routes nothing at the old today path', () => {
    for (const file of ['index.tsx', 'onboarding.tsx', 'session-summary.tsx']) {
      expect(read(file)).not.toContain('(tabs)/today');
    }
  });

  it('gates every signed-in stack route, not just the tabs', () => {
    /* The tab layout redirects to /sign-in when the session goes. A stack
       route outside it inherits nothing, so signing out leaves the screen
       mounted over a dead session — every query 401s behind a UI that looks
       frozen, and the app has to be force-quit. That shipped in build 17
       for exactly one screen: settings, which story 75 moved out of the
       tabs and left ungated. */
    const stackRoutes = ['settings.tsx'];
    for (const route of stackRoutes) {
      const source = code(route);
      expect(source).toMatch(/isSignedIn/);
      expect(source).toMatch(/<Redirect href="\/sign-in"/);
    }
  });

  it('signs out by navigating, not only by clearing the session', () => {
    // Clerk's state takes a frame to propagate. Without an explicit
    // navigation the screen renders at least once signed-out.
    const source = code('settings.tsx');
    expect(source).toMatch(/await signOut\(\)/);
    expect(source).toMatch(/router\.replace\('\/sign-in'\)/);
  });
});
