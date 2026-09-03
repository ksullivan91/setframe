import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { deleteAccountTables } from './delete-account.js';

/**
 * The real hazard in account deletion is not the order.
 *
 * A wrong order fails loudly with a foreign key violation. What fails
 * quietly is someone adding a table that belongs to a user in six months
 * and not adding it here — the account then "deletes" while leaving rows
 * behind, or the delete starts failing for everyone.
 *
 * So this reads the schema and checks the list against it, rather than
 * trusting that the list was complete on the day it was written.
 */
const schemaDir = join(
  dirname(new URL(import.meta.url).pathname),
  '..', '..', '..', '..', 'packages', 'database', 'src', 'schema',
);

function schemaSource(): string {
  return readdirSync(schemaDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(join(schemaDir, f), 'utf8'))
    .join('\n');
}

/** `constName` -> sql name, and the table constants each one references. */
function schemaGraph(): { sqlName: Map<string, string>; refs: Map<string, string[]> } {
  const source = schemaSource();
  const sqlName = new Map<string, string>();
  const refs = new Map<string, string[]>();
  const blocks = source.matchAll(
    /export const ([a-zA-Z]+) = pgTable\(\s*'([a-z_]+)'([\s\S]*?)(?=export const [a-zA-Z]+ = pgTable\(|$)/g,
  );
  for (const block of blocks) {
    const [, constName, table, body] = block as unknown as [string, string, string, string];
    sqlName.set(constName, table);
    const referenced = [...body.matchAll(/references\(\(\)\s*=>\s*([a-zA-Z]+)\./g)].map((m) => m[1]!);
    refs.set(constName, [...new Set(referenced)]);
  }
  return { sqlName, refs };
}

/**
 * Every table reachable from `user` by following foreign keys.
 *
 * Direct references are the obvious half. The half that would slip through
 * is a GRANDCHILD — a new table hanging off workout_session, say, which
 * carries user data without ever naming the user. `workout_set` is already
 * exactly that shape, and a check that only looked one level deep would
 * happily miss its successor.
 *
 * Shared tables are excluded by construction: muscle_group and
 * progression_rule reference nothing user-owned, so nothing reaches them.
 */
function tablesOwnedByAUser(): string[] {
  const { sqlName, refs } = schemaGraph();
  const owned = new Set<string>(['user']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [constName, referenced] of refs) {
      if (owned.has(constName)) continue;
      if (referenced.some((r) => owned.has(r))) {
        owned.add(constName);
        grew = true;
      }
    }
  }
  return [...owned].map((c) => sqlName.get(c)!).filter(Boolean);
}

describe('account deletion covers the whole schema', () => {
  it('deletes from every table that references a user', () => {
    const owned = tablesOwnedByAUser();
    expect(owned.length).toBeGreaterThan(10);

    const missing = owned.filter((t) => !deleteAccountTables.includes(t as never));
    expect(missing, `tables owned by a user but never deleted: ${missing.join(', ')}`).toEqual([]);
  });

  it('deletes the user row itself, last', () => {
    expect(deleteAccountTables.at(-1)).toBe('user');
  });

  it('deletes children before their parents', () => {
    /* A wrong order fails loudly rather than silently, but it fails at
       runtime on a real account — which is a bad place to find out. */
    const at = (t: string) => deleteAccountTables.indexOf(t as never);
    const childFirst: [string, string][] = [
      ['workout_set', 'workout_exercise_log'],
      ['workout_exercise_log', 'workout_session'],
      ['session_watch_series', 'session_watch_workout'],
      ['session_watch_workout', 'workout_session'],
      ['day_type_exercise_planned_set', 'day_type_exercise'],
      ['day_type_exercise', 'day_type'],
      ['program_schedule_slot', 'program_version'],
      ['program_version', 'training_program'],
      ['program_day_type', 'training_program'],
      ['schedule_override', 'day_type'],
      ['exercise_muscle', 'exercise'],
      ['workout_session', 'day_type'],
      ['workout_session', 'training_program'],
    ];
    for (const [child, parent] of childFirst) {
      expect(at(child), `${child} must be deleted before ${parent}`).toBeLessThan(at(parent));
    }
  });

  it('names no table that does not exist', () => {
    // A rename would otherwise leave a dead entry that deletes nothing.
    /* Whitespace-tolerant: the tables are declared as
       `pgTable(\n  'workout_set',` so a literal string match misses all
       of them — which is how the first version of this failed against a
       list that was entirely correct. */
    const source = schemaSource();
    for (const table of deleteAccountTables) {
      const declared = new RegExp(`pgTable\\(\\s*'${table}'`);
      expect(declared.test(source), `${table} is in the delete list but not in the schema`).toBe(true);
    }
  });
});
