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

/**
 * A component presented as a full screen has the same problem as a screen.
 *
 * `ExercisePickerV2` renders inside a non-transparent `<Modal>` from three
 * call sites. It used a fixed padding token, so Cancel and the search field
 * sat under the Dynamic Island: the picker could be opened but neither used
 * nor closed. The first pass of this audit only looked at `src/screens`,
 * which is exactly why it was missed.
 */
describe('full-screen modals reserve the status bar', () => {
  const componentsDir = path.join(__dirname, '..', 'components');

  /** Files rendering a `<Modal>` that is NOT transparent — i.e. a real
   *  full-screen presentation rather than a bottom sheet. */
  function fullScreenModalFiles(dir: string, acc: string[] = []): string[] {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let isDir = false;
      try {
        fs.readdirSync(full);
        isDir = true;
      } catch {
        isDir = false;
      }
      if (isDir) {
        fullScreenModalFiles(full, acc);
        continue;
      }
      if (!/\.tsx$/.test(name)) continue;
      if (full.includes('__tests__')) continue;
      // Strip comments first: prose describing a `<Modal>` is not one, and
      // the first version of this scan flagged its own explanatory comment.
      const source = fs
        .readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const m of source.matchAll(/<Modal\b[^>]*>/g)) {
        if (!/\btransparent\b/.test(m[0])) {
          acc.push(full);
          break;
        }
      }
    }
    return acc;
  }

  it('the picker presented as a full screen reads the inset', () => {
    const source = fs.readFileSync(
      path.join(componentsDir, 'exercise-picker', 'ExercisePickerV2.tsx'),
      'utf8',
    );
    expect(source).toContain('useScreenTopPadding');
    expect(source).toMatch(/paddingTop:\s*topPadding/);
  });

  it('no component opens a new full-screen modal without being checked here', () => {
    /* Bottom sheets are `transparent` and anchor to the bottom, so a top
       inset does not apply to them. Anything else covers the status bar. */
    const found = fullScreenModalFiles(path.join(__dirname, '..'))
      .map((f) => f.split('/src/')[1])
      .filter((f): f is string => Boolean(f));
    /* Each of these presents ExercisePickerV2 full-screen, and the picker
       reads the inset itself — asserted in the test above. A file appearing
       here that is NOT in this list is a new full-screen modal nobody has
       checked. */
    const known = [
      'screens/WorkoutSessionScreenV2.tsx',
      'screens/WorkoutEditorScreen.tsx',
      'components/guided-setup/GuidedSetupFlow.tsx',
    ];
    expect(found.filter((f) => !known.includes(f))).toEqual([]);
  });
});

/**
 * And every screen with a bottom-anchored bar must clear the home
 * indicator.
 *
 * Same reasoning as above, same blindness in jest: the insets mock returns
 * zero, so a rendered assertion passes whether or not the screen reads
 * them. HealthAccessScreen's Continue button shipped 16pt from the bottom
 * of the glass, crowding the indicator on every home-indicator iPhone.
 */
const SCREENS_WITH_BOTTOM_BAR = ['HealthAccessScreen.tsx', 'WorkoutSessionScreenV2.tsx'];

describe('screens clear the home indicator', () => {
  it.each(SCREENS_WITH_BOTTOM_BAR)('%s reads the safe-area bottom inset', (file) => {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    // Either the shared helper or the raw inset — both clear the indicator.
    expect(source).toMatch(/useStackBottomPadding|insets\.bottom/);
    // And applies it to a paddingBottom, rather than reading and dropping it.
    expect(source).toMatch(/paddingBottom:\s*(bottomPadding|Math\.max\(insets\.bottom)/);
  });
});

/**
 * The Watch cards line up with the exercise cards.
 *
 * The session screen's scroll body centres its children, so a card with no
 * width hugs its content. That is how the Activity card shipped visibly
 * narrower than the set cards directly beneath it — a difference no
 * rendered test would catch either, since jest does no layout.
 */
describe('the completed-session cards align', () => {
  it('pins the Watch block to the same width as the exercise cards', () => {
    const source = fs.readFileSync(path.join(dir, 'WorkoutSessionScreenV2.tsx'), 'utf8');
    expect(source).toMatch(/watchBlock:\s*\{[^}]*width:\s*CARD_WIDTH/);
    // And actually wraps the cards in it.
    expect(source).toContain('style={styles.watchBlock}');
  });
});
