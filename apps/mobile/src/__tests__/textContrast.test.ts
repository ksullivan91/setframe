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
 * Three tokens fail WCAG AA as text and are for fills and icons only.
 *
 *   text.disabled   #a9a9bc  2.31:1
 *   status.error    #FF647C  2.85:1
 *   status.success  #00C48C  2.26:1
 *
 * All three were being used as ordinary copy — eyebrows, field labels,
 * notes, a CTA label, and every trend delta. A convention in a document
 * would not have held: the same defect reappeared three times in one
 * design session because new screens copied existing ones.
 *
 * `text.disabled` is still correct where the low contrast IS the signal —
 * a disabled control, a placeholder, an absent value. This checks the
 * cases where it is colouring live copy instead.
 */
describe('text that has to be readable', () => {
  const files = sourceFiles(path.join(__dirname, '..'));

  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never colours a rendered string with a fill-only token', () => {
    const offenders: string[] = [];
    for (const file of files) {
      /* Blank the comment bodies but keep their newlines — stripping them
         outright renumbers every line after, which is how the first run of
         this test reported a dozen offenders that were closing braces. */
      const source = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (m: string) => m.replace(/[^\n]/g, ' '))
        .replace(/^(\s*)\/\/.*$/gm, '$1');
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        const usesFillToken = /theme\.(text\.disabled|status\.(error|success))\b/.test(line);
        if (!usesFillToken) return;
        // A conditional picks it for an empty or disabled state, which is
        // the one legitimate reason to reach for it.
        if (/\?|placeholderTextColor|backgroundColor|borderColor|size=\{/.test(line)) return;
        if (/color[:=]/.test(line)) {
          offenders.push(`${file.split('/apps/mobile/')[1]}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
