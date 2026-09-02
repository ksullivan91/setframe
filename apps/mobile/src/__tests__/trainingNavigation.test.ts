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
  /* The four-tab wizard is gone; these now hold against the shared flow
     that replaced it. Both defects it had must stay fixed: it had no exit
     of its own, and it refused to finish without a schedule. */
  const flow = () => read('components', 'guided-setup', 'GuidedSetupFlow.tsx');
  const chrome = () => read('components', 'guided-setup', 'SetupChrome.tsx');

  it('offers a way out from every step', () => {
    // The chrome renders the exit, so it exists on all four steps rather
    // than only on the last one.
    expect(chrome()).toContain('testID="setup-exit"');
    expect(chrome()).toContain('Save & exit');
    expect(chrome()).toContain("'Skip'");
  });

  it('finishes without requiring a schedule', () => {
    /* A program with workouts and no schedule is valid — you train from it
       ad hoc. Requiring one, with no exit, trapped the user on the last
       step of the old wizard. */
    const source = flow();
    expect(source).toMatch(/days\.length \? saveDays\.mutate\(days\) : onExit\(\)/);
  });

  it('does not gate the exercises step on having added any', () => {
    /* A workout with no exercises is a valid thing to come back to.
       Reading the returned Button itself rather than a slice of the file —
       the first version of this ran past the block into the next one. */
    const source = flow();
    const step3 = source.slice(source.indexOf('if (step === 3)'));
    const returned = step3.slice(step3.indexOf('return <Button'), step3.indexOf('/>') + 2);
    expect(returned).toContain('onPress={onExercisesDone}');
    expect(returned).not.toContain('disabled');
  });
});

describe('guided setup is one flow with two hosts', () => {
  it('branches on the host in the chrome and nowhere else', () => {
    /* Building it per-flow is how this codebase ended up with two
       divergent exercise pickers before story 78 unified them. */
    const flowSource = read('components', 'guided-setup', 'GuidedSetupFlow.tsx');
    const code = flowSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain("'onboarding'");
    expect(code).not.toContain("host ===");
  });

  it('lets the chrome differ in exactly the three ways the spec allows', () => {
    const source = read('components', 'guided-setup', 'SetupChrome.tsx');
    expect(source).toContain('Step ${step} of ${totalSteps}');
    expect(source).toContain("planName ?? 'New plan'");
  });
});
