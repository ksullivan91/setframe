declare const __dirname: string;

/* Local shapes and `require`, matching HealthKitAdapter.test.ts: this
   workspace's tsconfig carries no @types/node, and a source-level guard is
   not worth adding them for. */
interface NodeFs {
  readdirSync(dir: string): string[];
  readFileSync(file: string, encoding: string): string;
  statSync(p: string): { isDirectory(): boolean };
}
interface NodePath {
  join(...parts: string[]): string;
}

const fs = require('fs') as NodeFs;
const path = require('path') as NodePath;

/**
 * Copy guards — rules about the words this app puts on a screen.
 *
 * Source-level rather than rendered, because a rendered test only covers
 * the states some test happened to construct: "kcal" was on five separate
 * screens and three of them had no test that read the label at all.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry === 'test-support') continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/** Source with comments removed — a comment is not copy. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('energy is written as "cal", never "kcal"', () => {
  /* The stored value genuinely IS kilocalories and the columns keep that
     name — activeEnergyKcal, caloriesKcal — while HealthKit's own unit
     string 'kcal' is an API contract. What must never reach a screen is
     the word itself: every consumer fitness app, Apple's included, calls
     this a calorie. */
  it('appears in no user-facing string', () => {
    const offenders: string[] = [];

    for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', 'app')]) {
      for (const file of sourceFiles(root)) {
        const lines = code(fs.readFileSync(file, 'utf8')).split('\n');
        lines.forEach((line, i) => {
          for (const literal of line.match(STRING_LITERAL) ?? []) {
            // Interpolations hold expressions, not copy: `${x.caloriesKcal} cal`
            // shows "cal", and the field name is not on screen.
            const shown = literal.slice(1, -1).replace(/\$\{[^}]*\}/g, '');
            if (!/kcal/i.test(shown)) continue;
            /* The bare unit string is allowed ONLY in the adapter, where
               it is HealthKit's API contract. Anywhere else a literal
               'kcal' is a unit about to be printed next to a number —
               which is precisely how it reached five screens. */
            if (shown.trim() === 'kcal' && file.includes('/healthkit/')) continue;
            offenders.push(`${file.split('/apps/mobile/')[1] ?? file}:${i + 1}  ${literal.trim()}`);
          }
        });
      }
    }

    expect(offenders).toEqual([]);
  });
});
