import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every route that reads or writes user data must scope by `request.userId`.
 *
 * ADR 0002 calls this the load-bearing security invariant of the whole API:
 * there is no per-route authorization layer beyond it, so a query that
 * forgets the scope returns another user's rows and looks perfectly correct
 * in a unit test whose mock never inspects the where clause. That is not
 * hypothetical — the ranged rest-days query added in story 76 passed its
 * own tests with the scope deleted.
 *
 * Source-level because the failure is invisible to a mocked db.
 */
const ROUTES = join(__dirname);

/** Helpers that resolve ownership themselves and throw if it fails. */
const OWNERSHIP_HELPERS = ['getOwnedSession', 'getOwnedProgram', 'getOwnedDayType', 'getOwnedExerciseLog'];

/** Routes that legitimately touch no user data. */
const NOT_USER_SCOPED = new Set(['system.ts']);

function handlerBlocks(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /fastify\.(get|post|patch|put|delete)\(\s*\n?\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // to the start of the next route registration, or end of file
    const next = new RegExp(`fastify\\.(get|post|patch|put|delete)\\(`, 'g');
    next.lastIndex = m.index + m[0].length;
    const found = next.exec(source);
    out.push({ name: `${m[1]!.toUpperCase()} ${m[2]!}`, body: source.slice(m.index, found ? found.index : source.length) });
  }
  return out;
}

describe('every route scopes its queries to the caller', () => {
  const files = readdirSync(ROUTES).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('finds routes to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    if (NOT_USER_SCOPED.has(file)) continue;
    const source = readFileSync(join(ROUTES, file), 'utf8');
    for (const { name, body } of handlerBlocks(source)) {
      const touchesDb = /getDb\(\)|db\s*\n?\s*\.(select|insert|update|delete)|db\.batch/.test(body);
      if (!touchesDb) continue;
      it(`${file} · ${name}`, () => {
        const scoped =
          body.includes('request.userId') ||
          OWNERSHIP_HELPERS.some((h) => body.includes(h));
        expect(scoped).toBe(true);
      });
    }
  }
});
