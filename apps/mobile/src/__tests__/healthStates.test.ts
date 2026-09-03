export {};

declare const __dirname: string;
interface NodeFs {
  readFileSync(f: string, e: string): string;
  readdirSync(d: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
}
interface NodePath { join(...p: string[]): string }

const fs = require('fs') as NodeFs;

const path = require('path') as NodePath;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test-support') continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/**
 * A refused HealthKit read is undetectable, so no copy may claim one.
 *
 * `getRequestStatusForAuthorization` returns only `not_asked` or `asked` —
 * never granted or denied — because whether a user refused is itself a
 * disclosure about their health. `useHealthConnection` folds a refusal and
 * a granted-but-empty day into one `no_data` state.
 *
 * The rule is easy to lose: "you declined Apple Health" is the obvious
 * sentence to write for an empty card, and it is wrong half the time.
 */
describe('health permission copy', () => {
  const roots = [path.join(__dirname, '..'), path.join(__dirname, '..', '..', 'app')];
  const files = roots.flatMap((r) => sourceFiles(r));

  /**
   * Two places copy lives, and the first version of this test only checked
   * one. A quoted literal covers props and helpers; JSX text between tags
   * is not quoted at all, and is exactly where a sentence like this would
   * be written. Missing it meant the test passed with the accusation
   * rendered on screen.
   */
  const QUOTED = /(["'`])([^"'`\n]{12,})\1/g;
  const JSX_TEXT = />\s*([^<>{}\n][^<>{}]{11,})\s*</g;
  const ACCUSES = /\b(you (denied|declined|refused|blocked|turned (it |us )?down)|permission (was )?(denied|refused))\b/i;

  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never tells the user they denied permission', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      // strip comments so the explanations of *why* we cannot know survive
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const match of code.matchAll(QUOTED)) {
        if (ACCUSES.test(match[2]!)) {
          offenders.push(`${file.split('/apps/mobile/')[1]} · ${match[2]!.slice(0, 60)}`);
        }
      }
      for (const match of code.matchAll(JSX_TEXT)) {
        if (ACCUSES.test(match[1]!)) {
          offenders.push(`${file.split('/apps/mobile/')[1]} · ${match[1]!.trim().slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('renders nothing at all when HealthKit is unavailable', () => {
    // An offer that cannot be accepted is worse than silence: on an iPad or
    // the Simulator there is no Health app to send anyone to.
    const card = fs.readFileSync(path.join(__dirname, '..', 'components', 'AppleHealthCard.tsx'), 'utf8');
    expect(card).toMatch(/state_? === 'unavailable'\)?\s*return null/);
  });

  it('keeps a refusal and an empty day as one state', () => {
    const hook = fs.readFileSync(path.join(__dirname, '..', 'healthkit', 'useHealthConnection.ts'), 'utf8');
    // If these ever become separate states, the copy above becomes a lie.
    expect(hook).not.toMatch(/'denied'|'refused'/);
    expect(hook).toMatch(/hasAnyMetric\(metrics\) \? 'connected' : 'no_data'/);
  });
});
