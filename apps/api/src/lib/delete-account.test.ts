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

/** Every table declaring a foreign key to `user.id`, by SQL name. */
function tablesOwnedByAUser(): string[] {
  const source = schemaSource();
  const owned: string[] = [];
  // pgTable('name', { ... }) blocks, matched non-greedily to the next one.
  const blocks = source.matchAll(/pgTable\(\s*'([a-z_]+)'[\s\S]*?(?=pgTable\(|$)/g);
  for (const block of blocks) {
    const [body, name] = [block[0], block[1]!];
    if (/references\(\(\)\s*=>\s*user\.id\)/.test(body)) owned.push(name);
  }
  return [...new Set(owned)];
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
