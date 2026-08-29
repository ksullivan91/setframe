#!/usr/bin/env node
/**
 * Transforms `yuhonas/free-exercise-db` into a curation worklist for the
 * Setframe system exercise catalog.
 *
 * This does NOT produce a seed file, and deliberately so. The source is a
 * good source of *muscle mappings* and a poor source of *names* — see
 * `docs/design/exercise-catalog-import.md` §3.2 for the three ways a
 * mechanical import was measured to fail. The workflow it supports is:
 *
 *     author our catalog family by family
 *       → match into the source
 *       → inherit primaryMuscles / secondaryMuscles
 *       → hand-fill the misses
 *
 * So the output is a worklist a person rules on, not a catalog.
 *
 * Usage, from the repo root:
 *
 *     node scripts/exercise-catalog/transform-source.mjs
 *
 * The source JSON is cached in `.cache/` (gitignored) after the first run.
 * Outputs land in `scripts/exercise-catalog/out/`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache', 'free-exercise-db.json');
const OUT = join(HERE, 'out');
const SOURCE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

// ---------------------------------------------------------------------------
// Settled decisions — docs/design/exercise-catalog-import.md §1 and §2
// ---------------------------------------------------------------------------

/** Source equipment value → our token. Anything absent here is dropped. */
const EQUIPMENT = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  'body only': 'bodyweight',
  kettlebells: 'kettlebell',
  bands: 'band',
  // Deliberately absent, per decision: 'e-z curl bar', 'other', 'medicine ball',
  // 'exercise ball', 'foam roll', and null.
};

const KEEP_CATEGORIES = new Set(['strength', 'powerlifting']);

/** Smith machine variants are excluded entirely, not folded into `machine`. */
const EXCLUDE_NAME = /\bsmith\b/i;

/** `muscle_group` — 19 names across 6 regions. */
const MUSCLE_GROUPS = [
  { name: 'chest', region: 'Chest' },
  { name: 'lats', region: 'Back' },
  { name: 'middle back', region: 'Back' },
  { name: 'lower back', region: 'Back' },
  { name: 'traps', region: 'Back' },
  { name: 'front delts', region: 'Shoulders' },
  { name: 'side delts', region: 'Shoulders' },
  { name: 'rear delts', region: 'Shoulders' },
  { name: 'biceps', region: 'Arms' },
  { name: 'triceps', region: 'Arms' },
  { name: 'forearms', region: 'Arms' },
  { name: 'abdominals', region: 'Core' },
  { name: 'quadriceps', region: 'Legs' },
  { name: 'hamstrings', region: 'Legs' },
  { name: 'glutes', region: 'Legs' },
  { name: 'calves', region: 'Legs' },
  { name: 'adductors', region: 'Legs' },
  { name: 'abductors', region: 'Legs' },
  { name: 'neck', region: 'Core' },
];

/**
 * Best-effort delt-head assignment. The source has a single `shoulders`
 * value and no field that distinguishes the heads, so this reads the name.
 * Measured coverage is about a third — everything else is left for a human,
 * which is the point of a worklist.
 */
const DELT_RULES = [
  ['rear delts', /rear[- ]delt|reverse fly|reverse machine fly|face pull|bent[- ]?over (lateral|reverse)|rear lateral|reverse pec|band pull apart|scarecrow/i],
  ['side delts', /lateral raise|side lateral|lateral machine|upright row|side raise|deltoid raise|scaption|lu raise/i],
  ['front delts', /front raise|shoulder press|overhead press|military press|arnold|push press|front delt|behind the neck press|bradford|cuban press|z press|landmine press/i],
];

const assignDelt = (name) => DELT_RULES.find(([, re]) => re.test(name))?.[0] ?? null;

/**
 * `canonicalSlug` is a pure function of the name — never hand-written.
 *
 * Parentheses are treated as SEPARATORS, not as content to discard. An earlier
 * version dropped them, which silently deleted the equipment from every slug:
 * "Bench Press (Barbell)" and "Bench Press (Dumbbell)" both became
 * `bench-press`. Since the seed upserts on canonicalSlug with
 * ON CONFLICT DO NOTHING, the second would have been dropped without an error
 * — a whole equipment variant missing from the catalog, silently.
 */
export const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Reduces a name to its underlying movement so variants cluster for review.
 *
 * Strips only what is decorative for grouping: equipment, laterality, grip
 * width, and stance. It deliberately KEEPS the words that define a distinct
 * movement — incline/decline, bench/floor, front/rear/side, overhead, leg —
 * because those are exactly the qualifiers our split rule says can separate
 * two exercises, and folding them together produces useless mega-families.
 * A first pass stripped them and collapsed 32 unrelated records into one
 * `press` family.
 *
 * This groups for review; it never decides a merge. §3.2 records why
 * automated merging was measured not to work at all.
 */
const QUALIFIERS =
  /\b(barbell|dumbbell|dumbell|cable|machine|kettlebell|kettlebells|band|bands|db|standing|seated|kneeling|close|closed|wide|medium|narrow|neutral|alternate|alternating|alternated|one|single|two|double|with|without|chains|powerlifting|to|a|an|the|on|in|of|and|or|style|grip|palms|version|exercise)\b/gi;

const familyOf = (name) =>
  name
    .toLowerCase()
    .split(/\s+-\s+/)[0]
    .replace(/\([^)]*\)/g, ' ')
    .replace(QUALIFIERS, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Qualifiers that name the DEFAULT form of a movement rather than a departure
 * from it. "Medium grip" is how a bench press is gripped unless stated
 * otherwise, so carrying it in the name implies a variant that does not exist.
 * Dropping these is what makes a bare canonical name available at all — the
 * source has no plain "Bench Press", only "Barbell Bench Press - Medium Grip".
 *
 * Departures from default (close-grip, palms-up, decline) are NOT here. They
 * survive into the proposed name and then face the split test on their own
 * merits — close-grip bench is triceps-primary and earns its own row; wide-grip
 * bench is not and does not.
 */
const DEFAULT_QUALIFIERS = [
  /\s*-\s*medium grip\b/i,
  /\bmedium[- ]grip\s*/i,
  /\s*-\s*powerlifting\b/i,
  /\s*-\s*version\b/i,
  /\bwith (a )?neutral grip\b/i,
];

const TITLE_MINOR = new Set(['a', 'an', 'the', 'to', 'of', 'on', 'in', 'with', 'and', 'or', 'over']);
const titleCase = (s) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) =>
      i > 0 && TITLE_MINOR.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');

/** Equipment words to lift out of the name, since it moves into the suffix. */
const EQUIPMENT_WORDS =
  /\b(barbell|dumbbell|dumbell|db|cable|machine|kettlebell|kettlebells|band|bands|barbells)\b/gi;

/**
 * A MECHANICAL FIRST DRAFT of our name for a source record — never the answer.
 * Curation overrides it. Its job is to make slug collisions visible, because a
 * collision is exactly the merge decision a human needs to confirm or reject.
 */
function proposeName(sourceName, equipment) {
  let n = sourceName;
  for (const re of DEFAULT_QUALIFIERS) n = n.replace(re, ' ');
  n = n
    .replace(EQUIPMENT_WORDS, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Stripping an equipment word can strand its preposition: "Bench Press - With
  // Bands" would otherwise propose "Bench Press with (Band)".
  n = n.replace(/\s+(with|using|on|over)\s*$/i, '').replace(/\s+/g, ' ').trim();
  if (!n) n = sourceName.trim();
  return `${titleCase(n)} (${titleCase(equipment)})`;
}

// ---------------------------------------------------------------------------

async function loadSource() {
  if (existsSync(CACHE)) {
    return JSON.parse(await readFile(CACHE, 'utf8'));
  }
  process.stdout.write(`Fetching ${SOURCE_URL}\n`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Source fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, text);
  return JSON.parse(text);
}

function transform(all) {
  const steps = { all: all.length };
  const byCategory = all.filter((e) => KEEP_CATEGORIES.has(e.category));
  steps.category = byCategory.length;
  const byEquipment = byCategory.filter((e) => EQUIPMENT[e.equipment]);
  steps.equipment = byEquipment.length;
  const pool = byEquipment.filter((e) => !EXCLUDE_NAME.test(e.name));
  steps.final = pool.length;

  const records = pool.map((e) => {
    const primary = (e.primaryMuscles ?? []).flatMap((m) =>
      m === 'shoulders' ? [assignDelt(e.name) ?? 'shoulders:UNASSIGNED'] : [m],
    );
    const secondary = (e.secondaryMuscles ?? []).flatMap((m) =>
      m === 'shoulders' ? [assignDelt(e.name) ?? 'shoulders:UNASSIGNED'] : [m],
    );
    return {
      sourceName: e.name,
      equipment: EQUIPMENT[e.equipment],
      primary,
      secondary,
      // Primary and secondary are tracked apart on purpose: getting the
      // primary head right is the whole point of splitting the delts, while a
      // secondary head is a much lower-stakes call on far more rows.
      needsPrimaryDelt: primary.some((m) => m.endsWith('UNASSIGNED')),
      needsSecondaryDelt: secondary.some((m) => m.endsWith('UNASSIGNED')),
      proposedName: proposeName(e.name, EQUIPMENT[e.equipment]),
      proposedSlug: slugify(proposeName(e.name, EQUIPMENT[e.equipment])),
      family: familyOf(e.name) || '(unclassified)',
      force: e.force ?? null,
      mechanic: e.mechanic ?? null,
    };
  });

  const families = new Map();
  for (const r of records) {
    if (!families.has(r.family)) families.set(r.family, []);
    families.get(r.family).push(r);
  }

  return { steps, records, families };
}

function renderWorklist({ steps, records, families }) {
  const sorted = [...families.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const multi = sorted.filter(([, v]) => v.length > 1);
  const single = sorted.filter(([, v]) => v.length === 1);
  const needPrimary = records.filter((r) => r.needsPrimaryDelt);
  const needSecondary = records.filter((r) => r.needsSecondaryDelt && !r.needsPrimaryDelt);

  const L = [];
  L.push('# Exercise Catalog — Curation Worklist');
  L.push('');
  L.push('> Generated by `scripts/exercise-catalog/transform-source.mjs`. Do not hand-edit —');
  L.push('> re-run the script. Decisions live in `docs/design/exercise-catalog-import.md`.');
  L.push('');
  L.push('This is a worklist, not a catalog. Rule on each family: pick the variants that');
  L.push('survive, name them `Movement (Equipment)`, and drop the rest. The split test is');
  L.push('**does the load differ materially, or do the primary muscles differ?**');
  L.push('');
  L.push('## Funnel');
  L.push('');
  L.push('| Step | Records |');
  L.push('|---|---:|');
  L.push(`| All source records | ${steps.all} |`);
  L.push(`| \`strength\` + \`powerlifting\` | ${steps.category} |`);
  L.push(`| …equipment we keep | ${steps.equipment} |`);
  L.push(`| …Smith machine dropped | **${steps.final}** |`);
  L.push('');
  L.push(
    `**${families.size} movement families** — ${multi.length} multi-variant, ${single.length} singletons.`,
  );
  L.push('');
  L.push(
    `**${needPrimary.length} records need a PRIMARY delt head assigned by hand**, plus ` +
      `${needSecondary.length} more where only a secondary head is unresolved ` +
      '(all marked `shoulders:UNASSIGNED`).',
  );
  L.push('');
  L.push('---');
  L.push('');
  L.push(`## Part 1 — multi-variant families (${multi.length})`);
  L.push('');
  L.push('Rule on each. Most of the duplication lives here.');
  L.push('');
  for (const [family, variants] of multi) {
    L.push(`### ${family} — ${variants.length}`);
    L.push('');
    L.push('| Source name | Equipment | Primary | Secondary |');
    L.push('|---|---|---|---|');
    for (const v of variants) {
      L.push(
        `| ${v.sourceName} | ${v.equipment} | ${v.primary.join(', ') || '—'} | ${v.secondary.join(', ') || '—'} |`,
      );
    }
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push(`## Part 2 — singletons (${single.length})`);
  L.push('');
  L.push('Keep/drop scan. This is where the obscure entries live.');
  L.push('');
  L.push('| Source name | Equipment | Primary | Secondary |');
  L.push('|---|---|---|---|');
  for (const [, [v]] of single) {
    L.push(
      `| ${v.sourceName} | ${v.equipment} | ${v.primary.join(', ') || '—'} | ${v.secondary.join(', ') || '—'} |`,
    );
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push(`## Part 3a — PRIMARY delt assignments needed (${needPrimary.length})`);
  L.push('');
  L.push('These matter. The primary head is what per-muscle volume would be counted against,');
  L.push('and it is the reason the delts were split at all. Assign while curating the family.');
  L.push('');
  L.push('| Source name | Equipment |');
  L.push('|---|---|');
  for (const r of needPrimary) L.push(`| ${r.sourceName} | ${r.equipment} |`);
  L.push('');
  L.push(`## Part 3b — secondary-only delt assignments (${needSecondary.length})`);
  L.push('');
  L.push('Lower stakes and far more numerous. Most are pressing movements where the front');
  L.push('delt is the assisting head; a bulk default is defensible here in a way it is not');
  L.push('for Part 3a. Only rows surviving curation need doing at all.');
  L.push('');
  L.push('| Source name | Equipment | Primary |');
  L.push('|---|---|---|');
  for (const r of needSecondary) L.push(`| ${r.sourceName} | ${r.equipment} | ${r.primary.join(', ')} |`);
  L.push('');

  // Part 4 — where the source contradicts itself. The same movement can carry
  // a different primary muscle in different records: `Floor Press` is triceps,
  // `Alternating Floor Press` is chest. Treat every primary as advisory.
  const conflicted = multi.filter(([, v]) => {
    const sigs = new Set(v.map((r) => [...r.primary].sort().join('+')));
    return sigs.size > 1;
  });
  L.push('---');
  L.push('');
  L.push(`## Part 4 — primary-muscle labels to verify (${conflicted.length} families, ${conflicted.reduce((a, [, v]) => a + v.length, 0)} records)`);
  L.push('');
  L.push('Families whose variants disagree about the primary muscle. Some disagreements');
  L.push('are **correct** — close-grip bench really is triceps-primary. Others are the');
  L.push('source contradicting itself: `Floor Press` is triceps while `Alternating Floor');
  L.push('Press` is chest, for the same movement.');
  L.push('');
  L.push('Treat every inherited primary as **advisory**, not authoritative. This is the');
  L.push('triage list.');
  L.push('');
  for (const [family, variants] of conflicted) {
    L.push(`### ${family}`);
    L.push('');
    L.push('| Source name | Equipment | Primary |');
    L.push('|---|---|---|');
    for (const v of variants) {
      L.push(`| ${v.sourceName} | ${v.equipment} | **${v.primary.join(', ')}** |`);
    }
    L.push('');
  }
  // Part 5 — where the mechanical draft names collide. A collision is a merge
  // decision, not a bug: two source records reduce to one exercise. The human
  // confirms or rejects each one.
  const bySlug = new Map();
  for (const r of records) {
    if (!bySlug.has(r.proposedSlug)) bySlug.set(r.proposedSlug, []);
    bySlug.get(r.proposedSlug).push(r);
  }
  const collisions = [...bySlug.entries()].filter(([, v]) => v.length > 1);
  L.push('---');
  L.push('');
  L.push(`## Part 5 — proposed-name collisions (${collisions.length})`);
  L.push('');
  L.push('Mechanically dropping default qualifiers and moving equipment into a suffix');
  L.push('makes some records reduce to the same name. **That is the point** — a collision');
  L.push('is a merge decision surfaced for confirmation, not a bug.');
  L.push('');
  L.push('Confirm each: do these differ in load or primary muscles? If not, they merge.');
  L.push('');
  for (const [slug, group] of collisions) {
    L.push(`### ${group[0].proposedName}  \`${slug}\``);
    L.push('');
    L.push('| Source name | Primary |');
    L.push('|---|---|');
    for (const g of group) L.push(`| ${g.sourceName} | ${g.primary.join(', ')} |`);
    L.push('');
  }
  return L.join('\n');
}

function renderMuscleGroups() {
  return [
    '/**',
    ' * Settled muscle vocabulary — docs/design/exercise-catalog-import.md §1.',
    ' *',
    ' * Generated by scripts/exercise-catalog/transform-source.mjs. Not yet wired',
    ' * into the boot seed; see Backlog/68 and the seeding note in §5 of that doc.',
    ' *',
    " * 19 names across 6 regions. `region` drives the picker's coarse filter chips,",
    ' * `name` drives the detail screen\'s muscle chips — both columns already exist.',
    ' */',
    'export const MUSCLE_GROUPS: Array<{ name: string; region: string }> = [',
    ...MUSCLE_GROUPS.map((m) => `  { name: '${m.name}', region: '${m.region}' },`),
    '];',
    '',
  ].join('\n');
}

const source = await loadSource();
const result = transform(source);
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'worklist.md'), renderWorklist(result));
await writeFile(join(OUT, 'candidates.json'), JSON.stringify(result.records, null, 2));
await writeFile(join(OUT, 'muscle-groups.ts'), renderMuscleGroups());

const needPrimary = result.records.filter((r) => r.needsPrimaryDelt).length;
const needSecondary = result.records.filter((r) => r.needsSecondaryDelt && !r.needsPrimaryDelt).length;
process.stdout.write(
  [
    `Source records        ${result.steps.all}`,
    `After curation filter ${result.steps.final}`,
    `Movement families     ${result.families.size}`,
    `Delt · primary TODO   ${needPrimary}`,
    `Delt · secondary TODO ${needSecondary}`,
    `Name collisions       ${new Set(result.records.map((r) => r.proposedSlug)).size < result.records.length ? result.records.length - new Set(result.records.map((r) => r.proposedSlug)).size : 0} records in collision groups`,
    '',
    `Wrote ${join('scripts/exercise-catalog/out', 'worklist.md')}`,
    `Wrote ${join('scripts/exercise-catalog/out', 'candidates.json')}`,
    `Wrote ${join('scripts/exercise-catalog/out', 'muscle-groups.ts')}`,
    '',
  ].join('\n'),
);
