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
});
