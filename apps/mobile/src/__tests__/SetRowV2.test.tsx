import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { workoutTable } from '@setframe/design-tokens';
import { ThemeProvider } from '../theme/ThemeProvider';
import { SetRowV2, type SetRowStatus } from '../components/workout-v2/SetRowV2';

/**
 * Mobile's half of the Figma geometry contract.
 *
 * `apps/web/e2e/functional/workout-v2-figma-parity.spec.ts` asserts the same
 * numbers against computed layout in a real browser. Both sides read
 * `workoutTable`, so this cannot pass while web fails on the same value — but
 * it does catch a component that ignores the token and hardcodes its own,
 * which is how the two builds would drift apart in practice.
 *
 * Web/mobile parity is a repo rule, and the failure mode it guards against is
 * silent: columns stop lining up on one platform and nothing errors.
 */

const VALUES = { weight: '225', reps: '8', duration: '', distance: '', rpe: '' };

function renderRow(status: SetRowStatus = 'saved') {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider>
        <SetRowV2
          setId="set-1"
          label="1"
          status={status}
          values={VALUES}
          targets={{}}
          previous="225 × 8"
          fields={['weight', 'reps']}
          exerciseName="Bench Press"
          onCommit={jest.fn()}
          onOpenSetType={jest.fn()}
          onCopyPrevious={jest.fn()}
          onRetry={jest.fn()}
        />
      </ThemeProvider>,
    );
  });
  return tree;
}

/** Resolves a style prop, which may be an array or a registered style id. */
const flatten = (style: unknown) => StyleSheet.flatten(style) as Record<string, number>;

type Json = { type: string; props: Record<string, unknown>; children: Json[] | null } | string | null;

/**
 * Reads the rendered HOST tree rather than the composite one.
 *
 * `root.findByProps({ testID })` returns the composite element, whose only
 * child is the host View — so its children are the row itself, not the
 * columns. Walking toJSON() gets the actual rendered nodes.
 */
function findByTestId(node: Json, testID: string): Extract<Json, { type: string }> | null {
  if (!node || typeof node === 'string') return null;
  if (node.props?.testID === testID) return node;
  for (const child of node.children ?? []) {
    const hit = findByTestId(child, testID);
    if (hit) return hit;
  }
  return null;
}

function columnWidths(tree: ReactTestRenderer): number[] {
  const row = findByTestId(tree.toJSON() as Json, 'set-row-set-1');
  if (!row) throw new Error('row not rendered');
  return (row.children ?? [])
    .filter((child): child is Extract<Json, { type: string }> => typeof child === 'object' && child !== null)
    .map((child) => {
      const width = flatten(child.props.style).width;
      /* A column with no explicit width is the bug this asserts against, so
         fail loudly here rather than comparing an array full of undefined. */
      if (typeof width !== 'number') {
        throw new Error('column rendered without an explicit width: ' + String(child.props.testID));
      }
      return width;
    });
}

describe('SetRowV2 — Figma geometry', () => {
  it('sizes the row to the design', () => {
    const tree = renderRow();
    const row = findByTestId(tree.toJSON() as Json, 'set-row-set-1');
    const style = flatten(row!.props.style);

    expect(style.width).toBe(workoutTable.rowWidth);
    expect(style.height).toBe(workoutTable.rowHeight);
    expect(style.gap).toBe(workoutTable.columnGap);
    expect(style.paddingHorizontal).toBe(workoutTable.rowPaddingX);
    expect(style.borderRadius).toBe(workoutTable.rowRadius);
  });

  it('sizes every column to the design, and they sum to the row', () => {
    const tree = renderRow();
    const widths = columnWidths(tree);

    const { setChip, previous, prSlot, input, mark } = workoutTable.columns;
    expect(widths).toEqual([setChip, previous, prSlot, input, input, mark]);

    /* The arithmetic the layout turns on — the same assertion web makes. */
    const total =
      workoutTable.rowPaddingX * 2 +
      widths.reduce((a, b) => a + b, 0) +
      workoutTable.columnGap * (widths.length - 1);
    expect(total).toBe(workoutTable.rowWidth);
  });

  it('renders inputs at the shared font size', () => {
    /* 16px is the iOS Safari zoom threshold on web (story 28). Native has no
       zoom to avoid, but the two must match or the same design renders at two
       different sizes. */
    const tree = renderRow();
    const input = findByTestId(tree.toJSON() as Json, 'set-input-weight-set-1');
    const style = flatten(input!.props.style);
    expect(style.fontSize).toBe(workoutTable.inputFontSize);
    expect(style.width).toBe(workoutTable.columns.input);
    expect(style.height).toBe(workoutTable.inputHeight);
  });

  it('reserves the PR slot whether or not the set is a PR', () => {
    /* The reason the badge has a slot at all: a record must not shift
       PREVIOUS, LB and REPS out of line with the rows around it. */
    const widthsFor = (status: SetRowStatus) => columnWidths(renderRow(status));

    expect(widthsFor('pr')).toEqual(widthsFor('saved'));
    expect(widthsFor('empty')).toEqual(widthsFor('saved'));
  });

  it('shows the mark as a readout, and only makes it pressable on error', () => {
    /* The component is most likely to be got wrong by being built as a
       checkbox. It reports the result of a write; it never causes one. */
    const saved = renderRow('saved');
    expect(saved.root.findAllByProps({ accessibilityLabel: 'Retry saving set 1' })).toHaveLength(0);

    const failed = renderRow('error');
    expect(
      failed.root.findAllByProps({ accessibilityLabel: 'Retry saving set 1' }).length,
    ).toBeGreaterThan(0);
  });
});

describe('the logger has no RPE column', () => {
  const read = (...p: string[]) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('fs') as { readFileSync(f: string, e: string): string }).readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('path') as { join(...x: string[]): string }).join(__dirname, '..', ...p),
      'utf8',
    );

  /* Removed deliberately: RPE was an opt-in extra column, toggled per
     exercise from the ⋯ sheet. It is off in the design now and the toggle is
     gone, so the only way it comes back is by accident. RPE itself is still
     a stored field and is still editable from the session summary's set
     sheet — this is about the logger's table, not the data. */
  it('offers no way to turn one on from the exercise actions sheet', () => {
    const sheet = read('components', 'workout-v2', 'ExerciseActionsSheet.tsx');
    expect(sheet).not.toMatch(/rpe/i);
  });

  it('never puts rpe in the columns the table renders', () => {
    const screen = read('screens', 'WorkoutSessionScreenV2.tsx');
    // `visibleFields` is what feeds ExerciseTableCard's `fields`.
    expect(screen).toMatch(/filter\(\(field\) => field !== 'rpe'\)/);
    expect(screen).not.toMatch(/rpeShownFor/);
  });
});

describe('every logger mutation says something when it fails', () => {
  const read = (...p: string[]) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('fs') as { readFileSync(f: string, e: string): string }).readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('path') as { join(...x: string[]): string }).join(__dirname, '..', ...p),
      'utf8',
    );

  /* addSet, changeSetType, deleteSet and removeExercise each rolled the
     optimistic cache back and reported nothing, so a failure looked exactly
     like the app undoing the action on purpose. Same class as the 14
     mutations fixed in 4077d01. The guard is per-mutation rather than a
     count, so adding a ninth silent one fails here. */
  it.each([
    'saveSet',
    'addSet',
    'addExercises',
    'changeSetType',
    'deleteSet',
    'removeExercise',
    'saveAsWorkout',
    'finish',
  ])('%s has an onError that reaches the user', (mutation) => {
    const source = read('screens', 'WorkoutSessionScreenV2.tsx');
    const start = source.indexOf(`const ${mutation} = useMutation({`);
    expect(start).toBeGreaterThan(-1);
    // The mutation's own body, up to the next mutation. Searching from
    // `start` + a fixed offset finds this mutation's own `= useMutation({`
    // whenever the name is long enough, which slices an empty body and
    // passes nothing — measure from the end of its own opener instead.
    const opener = source.indexOf('= useMutation({', start) + '= useMutation({'.length;
    const next = source.indexOf('= useMutation({', opener);
    const body = source.slice(start, next === -1 ? start + 2000 : next);
    expect(body).toMatch(/onError/);
    // saveSet marks the row itself; the rest raise a message.
    expect(body).toMatch(mutation === 'saveSet' ? /setSync\(/ : /feedback\.report\(/);
  });
});
