export {};

declare const __dirname: string;
interface NodeFs { readFileSync(file: string, encoding: string): string }
interface NodePath { join(...parts: string[]): string }
const fs = require('fs') as NodeFs;
const path = require('path') as NodePath;

const read = (...parts: string[]) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

/**
 * Where the Training screens send you.
 *
 * Source-level: these are route strings, and a rendered test would need
 * the whole navigator plus a mocked API to assert the same thing.
 */
describe('Training v2 no longer falls back to the retired editor', () => {
  it('creates a workout in place rather than pushing /training-manage', () => {
    /* Stories 79-81 shipped the pushed v2 surfaces, but "+ New" was never
       repointed, so creating a workout dropped the user into the old
       three-tab editor. */
    const screen = read('screens', 'TrainingScreenV2.tsx');
    const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('/training-manage');
    expect(code).toContain('/workout-editor?dayTypeId=');
  });

  it('asks for a name first, so the new workout is never unnamed', () => {
    // The v2 editor is addressed by id and has no rename control.
    const screen = read('screens', 'TrainingScreenV2.tsx');
    expect(screen).toContain('NameWorkoutSheet');
    expect(screen).toContain("api.post<DayType>('/day-types'");
  });

  it('sends a tapped week day to the schedule, not to Today', () => {
    /* It used to discard the day argument and push Today, so every tile
       went to the same unrelated place. */
    const screen = read('screens', 'TrainingScreenV2.tsx');
    const strip = screen.slice(screen.indexOf('<WeekStrip'));
    expect(strip.slice(0, 600)).toContain("router.push('/schedule')");
    expect(strip.slice(0, 600)).not.toContain("'/(tabs)/today'");
  });
});

describe('guided setup is not a dead end', () => {
  const wizard = () =>
    fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'program-wizard.tsx'), 'utf8');

  it('offers a way out that keeps what was created', () => {
    /* Every other Cancel on that screen belongs to a sub-sheet, so the
       only exit was the OS back gesture. */
    const source = wizard();
    expect(source).toContain('testID="wizard-leave"');
    expect(source).toContain('Save & exit');
  });

  it('lets you finish without a schedule', () => {
    /* A program with workouts and no schedule is valid — you train from it
       ad hoc. Requiring one, with no exit, trapped the user on the last
       step. */
    const source = wizard();
    expect(source).toMatch(/label="Finish"[^/]*disabled=\{!programId\}/);
    expect(source).not.toMatch(/label="Finish"[^/]*hasSchedule/);
  });
});
