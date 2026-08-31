export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(file: string, encoding: string): string;
  readdirSync(dir: string): string[];
}
interface NodePath {
  join(...parts: string[]): string;
}
const fs = require('fs') as NodeFs;
const path = require('path') as NodePath;

/**
 * Every screen that draws its own header must reserve the status bar.
 *
 * The tab shell and these stack routes run with `headerShown: false`, so
 * nothing reserves space for the status bar or the Dynamic Island: content
 * starts at y=0 and renders *underneath* both. On the Training, Workout and
 * Program screens that put the back chevron under the island, where it
 * could not be tapped — the screens were unexitable.
 *
 * A source-level check rather than a render one, deliberately. The insets
 * are zero in jest (`react-native-safe-area-context`'s official mock), so a
 * rendered assertion would pass whether or not the screen reads them and
 * would have caught none of this. What can be verified here is that the
 * screen asks for the inset at all.
 */
const SCREENS_WITH_OWN_HEADER = [
  'TrainingScreenV2.tsx',
  'WorkoutEditorScreen.tsx',
  'ScheduleScreen.tsx',
  'PlansScreen.tsx',
  'HealthAccessScreen.tsx',
];

const dir = path.join(__dirname, '..', 'screens');

describe('screens reserve the status bar', () => {
  it.each(SCREENS_WITH_OWN_HEADER)('%s reads the safe-area top inset', (file) => {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    expect(source).toContain('useScreenTopPadding');
    // And actually applies it, rather than importing it and forgetting.
    expect(source).toMatch(/paddingTop:\s*topPadding/);
  });

  it('the session screen reserves it too, via raw insets', () => {
    /* WorkoutSessionScreenV2 predates the helper and computes
       `insets.top + 16` inline at each of its three header variants. Named
       here so the audit covers every self-headered screen rather than
       silently skipping the one that solved it differently. */
    const source = fs.readFileSync(path.join(dir, 'WorkoutSessionScreenV2.tsx'), 'utf8');
    expect(source).toMatch(/paddingTop:\s*insets\.top/);
  });

  it('covers every screen that draws its own header', () => {
    /* Guards the list itself: a new screen with a hand-rolled header should
       fail here rather than ship unexitable. */
    const withOwnHeader = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => {
        const source = fs.readFileSync(path.join(dir, file), 'utf8');
        return /styles\.header\b/.test(source) || /header:\s*\{/.test(source);
      });
    const known = [...SCREENS_WITH_OWN_HEADER, 'WorkoutSessionScreenV2.tsx', 'WorkoutSessionScreenV1.tsx'];
    expect(withOwnHeader.filter((f) => !known.includes(f))).toEqual([]);
  });
});
