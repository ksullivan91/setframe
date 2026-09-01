export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(file: string, encoding: string): string;
  readdirSync(dir: string, opts: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
}
interface NodePath {
  join(...parts: string[]): string;
}
 
const fs = require('fs') as NodeFs;
 
const path = require('path') as NodePath;

/**
 * Every mutation must be able to tell the user it failed.
 *
 * An audit found 14 with no `onError` and no pending state — Finish
 * workout, Start workout, Add exercises, Save prescription, Assign day,
 * Change units among them. A failed request produced nothing at all, which
 * is indistinguishable from a control that was never wired up. Three bugs
 * reported from the device were exactly this ("clicking add to today DOES
 * NOTHING", "Use this plan doesn't do anything", "Could not remove
 * activity" being the rare one that *did* say something).
 *
 * Source-level, because the failure is structural: a rendered test would
 * have to drive all 66 mutations to find the silent ones.
 */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test-support') continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Extracts each `useMutation({ ... })` options object. */
function mutationBlocks(source: string): { block: string; name: string }[] {
  const out: { block: string; name: string }[] = [];
  const re = /useMutation\(\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    let depth = 0;
    let end = source.length;
    for (let i = m.index + m[0].length - 1; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const before = source.slice(0, m.index).trimEnd();
    const nameMatch = /const\s+(\w+)\s*=\s*$/.exec(before);
    out.push({ block: source.slice(m.index, end), name: nameMatch ? nameMatch[1]! : 'anonymous' });
  }
  return out;
}

const roots = [
  path.join(__dirname, '..', '..', 'src'),
  path.join(__dirname, '..', '..', 'app'),
];

/**
 * Known exceptions, each with a reason. `mutateAsync` inside a try/catch is
 * a legitimate alternative — the call site handles the failure and drives
 * its own status UI.
 */
const HANDLED_AT_CALL_SITE = new Set(['saveMutation']);

it('every mutation reports failure somehow', () => {
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { block, name } of mutationBlocks(source)) {
        if (block.includes('onError')) continue;
        if (HANDLED_AT_CALL_SITE.has(name)) continue;
        offenders.push(`${file.split('/apps/mobile/')[1]} · ${name}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

it('a screen that reports errors also renders the surface', () => {
  /* Capturing an error into state and never rendering it is worse than not
     capturing it: the failure is recorded and still invisible. */
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('useActionFeedback')) continue;
      if (!source.includes('feedback.node')) {
        offenders.push(file.split('/apps/mobile/')[1]!);
      }
    }
  }
  expect(offenders).toEqual([]);
});
