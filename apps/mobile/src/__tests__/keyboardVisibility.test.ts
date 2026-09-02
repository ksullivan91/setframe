export {};

declare const __dirname: string;
interface NodeFs { readFileSync(file: string, encoding: string): string }
interface NodePath { join(...parts: string[]): string }
const fs = require('fs') as NodeFs;
const path = require('path') as NodePath;

/**
 * The logger's fields stay above the keyboard.
 *
 * Source-level, like the safe-area guards: jest does no layout and has no
 * keyboard, so a rendered assertion would pass whether or not the screen
 * reacts to one. What can be checked is that the mechanism is wired.
 */
const src = (...parts: string[]) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

describe('the session screen makes room for the keyboard', () => {
  it('lets iOS inset the scroll view while the keyboard is open', () => {
    /* The native alternative to padding the bottom of the page forever:
       the inset exists only while the keyboard does. */
    expect(src('lib', 'keyboardAwareScroll.tsx')).toContain(
      'automaticallyAdjustKeyboardInsets: true',
    );
    const screen = src('screens', 'WorkoutSessionScreenV2.tsx');
    expect(screen).toContain('useKeyboardAwareScrollProps');
    expect(screen).toContain('{...keyboardScrollProps}');
  });

  it('scrolls a focused field into view, with room for the row below it', () => {
    const aware = src('lib', 'keyboardAwareScroll.tsx');
    expect(aware).toMatch(/const CLEARANCE = \d+/);
    expect(aware).toContain('measureInWindow');
    // Only when actually covered — otherwise every focus yanks the page.
    expect(aware).toMatch(/if \(wanted <= covered\) return;/);
  });

  it('measures against the real keyboard frame, not a guess', () => {
    const aware = src('lib', 'keyboardAwareScroll.tsx');
    expect(aware).toContain('keyboardWillShow');
    expect(aware).toContain('endCoordinates.screenY');
  });

  it('keeps the rows in the page — no modal, popover or floating copy', () => {
    /* The fix must not lift a row out of the document to sit above the
       keyboard. If one of these appears here, the approach has drifted. */
    const aware = src('lib', 'keyboardAwareScroll.tsx');
    for (const hack of ['Modal', 'Popover', 'absolute']) {
      expect(aware).not.toContain(hack);
    }
  });

  it('gives every set field a ref so it can be measured', () => {
    const row = src('components', 'workout-v2', 'SetRowV2.tsx');
    expect(row).toContain('useKeepFieldVisible');
    expect(row).toMatch(/ref=\{ref\}/);
    expect(row).toContain('onFocusKeepVisible()');
  });
});

/**
 * Finishing a workout has to reach Today.
 *
 * Reported from the device: after finishing and reviewing a workout, Today
 * still said "Resume Workout" and still offered the session's Watch
 * activity as unattached, because the session screen only ever invalidated
 * its own query.
 */
describe('the session screen tells Today it changed', () => {
  it('invalidates the today query, not only its own', () => {
    const screen = src('screens', 'WorkoutSessionScreenV2.tsx');
    expect(screen).toContain("queryKey: ['workout-session', sessionId]");
    expect(screen).toContain("queryKey: ['today']");
  });

  it('invalidates Today when a Watch workout is attached or detached', () => {
    /* Today decides what to offer as Additional Activity from the attached
       set, so it goes stale the moment one is attached. */
    const hook = src('healthkit', 'useSessionWatchWorkouts.ts');
    const invalidations = hook.match(/queryKey: \['today'\]/g) ?? [];
    expect(invalidations.length).toBeGreaterThanOrEqual(2);
  });
});
