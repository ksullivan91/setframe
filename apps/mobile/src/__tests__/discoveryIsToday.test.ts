export {};

declare const __dirname: string;
interface NodeFs { readFileSync(f: string, e: string): string }
interface NodePath { join(...p: string[]): string }

const fs = require('fs') as NodeFs;

const path = require('path') as NodePath;
const src = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const code = (...p: string[]) =>
  src(...p)
    .replace(/\/\*[\s\S]*?\*\//g, (m: string) => m.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1');

/**
 * Apple Health discovery is a *today* feature and must not run on any
 * other date.
 *
 * `healthKit.getTodayWorkouts()` takes no date — it is always the device's
 * current day. Before Log could travel between dates that was harmless.
 * Afterwards it offered this morning's Watch walk on every past day of the
 * week, and adding one would have filed a workout against a day it did not
 * happen on. That is data corruption, not a cosmetic bug: the record is the
 * product.
 */
describe('workout discovery', () => {
  it('reads HealthKit only for the current day', () => {
    // If the adapter ever gains a date parameter this can be relaxed — but
    // then the gate has to be replaced, not merely deleted.
    expect(code('healthkit', 'HealthKitAdapter.ts')).toContain('getTodayWorkouts');
  });

  it('does not read at all when the screen is showing another date', () => {
    const hook = code('healthkit', 'useWorkoutDiscovery.ts');
    expect(hook).toMatch(/enabled/);
    expect(hook).toMatch(/if \(!enabled\)/);
  });

  it('is told which date the screen is on', () => {
    const section = code('components', 'TodayAdditionalActivitySection.tsx');
    expect(section).toMatch(/enabled: isToday/);
  });

  it('offers no way to add activity to a past day', () => {
    // Past days are a record (ADR 0013); the only mutable thing is rest.
    const section = code('components', 'TodayAdditionalActivitySection.tsx');
    expect(section).toMatch(/disabled=\{!isToday\}/);
    expect(section).toMatch(/onPress=\{isToday \? openAdd : undefined\}/);
  });
});
