export {};

declare const __dirname: string;
interface NodeFs { readFileSync(f: string, e: string): string }
interface NodePath { join(...p: string[]): string }

const fs = require('fs') as NodeFs;

const path = require('path') as NodePath;
const log = () => fs.readFileSync(path.join(__dirname, '..', '..', 'app', '(tabs)', 'log.tsx'), 'utf8');

/**
 * Log is about a date, and a past date is a record (ADR 0013).
 *
 * Source-level because the failure is a missing guard rather than a wrong
 * render: an editor left ungated on a past date looks completely normal
 * until someone travels back and overwrites a day they cannot see they are
 * overwriting. Rendering every date to check would need the whole query
 * stack mocked per date.
 */
describe('the day view', () => {
  it('reads its date from state, not straight from the clock', () => {
    const s = log();
    // useLocalDate is today; the screen must be able to show another day.
    expect(s).toMatch(/const \[localDate, setLocalDate\] = useState\(today\)/);
    expect(s).toContain("queryKey: ['today', localDate]");
  });

  it('will not travel to a date that has not happened', () => {
    expect(log()).toMatch(/if \(date <= today\) setLocalDate\(date\)/);
  });

  it('gates every manual editor behind isPast', () => {
    const s = log();
    // Every editor must have an isPast branch opened shortly before it.
    // Counting gates against editors was the first attempt and was too
    // loose — it stayed green with a gate removed, because the totals still
    // balanced. Proximity is the actual rule: this editor, that guard.
    const ungated: string[] = [];
    const re = /<(Input|TextInput)[\s>]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const preceding = s.slice(Math.max(0, m.index - 600), m.index);
      if (!preceding.includes('isPast')) ungated.push(`${m[1]} at ${m.index}`);
    }
    expect(re.lastIndex).toBeGreaterThanOrEqual(0);
    expect(ungated).toEqual([]);
  });

  it('keeps the mood picker disabled on a past date', () => {
    expect(log()).toContain('disabled={isPast}');
  });
});
