import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { exercisePicker } from '@setframe/design-tokens';
import type { PickableExercise } from '@setframe/domain';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ExercisePickerV2 } from '../components/exercise-picker/ExercisePickerV2';

/**
 * Mobile's half of the exercise-picker contract.
 *
 * `apps/web/e2e/functional/exercise-picker-figma-parity.spec.ts` asserts the
 * same numbers and the same selection behaviour against a real browser. Both
 * sides read the `exercisePicker` tokens and the same domain functions, so
 * what this catches is a component that ignores them — which is how the two
 * builds drift apart in practice.
 */

const flatten = (style: unknown) => StyleSheet.flatten(style) as Record<string, number>;

type Json = { type: string; props: Record<string, unknown>; children: Json[] | null } | string | null;

function findAllByTestIdPrefix(node: Json, prefix: string): Extract<Json, { type: string }>[] {
  if (!node || typeof node === 'string') return [];
  const hits: Extract<Json, { type: string }>[] = [];
  const testID = node.props?.testID;
  if (typeof testID === 'string' && testID.startsWith(prefix)) hits.push(node);
  for (const child of node.children ?? []) hits.push(...findAllByTestIdPrefix(child, prefix));
  return hits;
}

function findByTestId(node: Json, testID: string): Extract<Json, { type: string }> | null {
  return findAllByTestIdPrefix(node, testID).find((n) => n.props.testID === testID) ?? null;
}

/**
 * Concatenated text under a node.
 *
 * Not `JSON.stringify(toJSON())` — the FlatList subtree carries a context
 * Provider that closes a circular reference and throws.
 */
function textOf(node: Json): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  return (node.children ?? []).map(textOf).join('');
}

const CATALOGUE: PickableExercise[] = [
  { id: 'a', name: 'Bench Press', movementPattern: 'horizontal-push', equipment: 'barbell' },
  { id: 'b', name: 'Back Squat', movementPattern: 'squat', equipment: 'barbell' },
  { id: 'c', name: 'Bent Over Row', movementPattern: 'horizontal-pull', equipment: 'barbell' },
];

function renderPicker(onAdd = jest.fn()) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider>
        <ExercisePickerV2
          exercises={CATALOGUE}
          title="Add to Upper A"
          onCancel={jest.fn()}
          onAdd={onAdd}
        />
      </ThemeProvider>,
    );
  });
  return tree;
}

const press = (tree: ReactTestRenderer, testID: string) => {
  const node = tree.root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  )[0];
  if (!node) throw new Error(`no pressable ${testID}`);
  act(() => {
    node.props.onPress();
  });
};

describe('ExercisePickerV2 (mobile)', () => {
  it('renders a row at the design height with the design tile and badge', () => {
    const tree = renderPicker();
    const row = findByTestId(tree.toJSON() as Json, 'picker-row-a')!;
    expect(flatten(row.props.style).height).toBe(exercisePicker.rowHeight);
    expect(flatten(row.props.style).paddingHorizontal).toBe(exercisePicker.rowPaddingX);

    const badge = findByTestId(tree.toJSON() as Json, 'picker-badge-a')!;
    expect(flatten(badge.props.style).width).toBe(exercisePicker.badgeSize);
  });

  it('shows pick ORDER rather than a checkmark, in the order picked', () => {
    /* The footer promises "they are added in the order you picked them"; a
       check would make that promise unverifiable. */
    const tree = renderPicker();
    press(tree, 'picker-row-c');
    press(tree, 'picker-row-a');

    expect(textOf(findByTestId(tree.toJSON() as Json, 'picker-badge-c'))).toBe('1');
    expect(textOf(findByTestId(tree.toJSON() as Json, 'picker-badge-a'))).toBe('2');
  });

  it('renumbers after a deselect, leaving no gap', () => {
    const tree = renderPicker();
    press(tree, 'picker-row-a');
    press(tree, 'picker-row-b');
    press(tree, 'picker-row-c');
    press(tree, 'picker-row-a');

    expect(textOf(findByTestId(tree.toJSON() as Json, 'picker-badge-b'))).toBe('1');
    expect(textOf(findByTestId(tree.toJSON() as Json, 'picker-badge-c'))).toBe('2');
  });

  it('hands back ids in pick order, not catalogue order', () => {
    const onAdd = jest.fn();
    const tree = renderPicker(onAdd);
    press(tree, 'picker-row-c');
    press(tree, 'picker-row-a');
    press(tree, 'picker-add');
    expect(onAdd).toHaveBeenCalledWith(['c', 'a']);
  });

  it('will not add until something is picked', () => {
    const onAdd = jest.fn();
    const tree = renderPicker(onAdd);
    /* findAll returns the host View first, which carries no `disabled` prop —
       the Pressable that does is the one with an onPress handler. */
    const cta = tree.root.findAll(
      (n) => n.props?.testID === 'picker-add' && typeof n.props?.onPress === 'function',
    )[0]!;
    expect(cta.props.disabled).toBe(true);
    expect(textOf(findByTestId(tree.toJSON() as Json, 'picker-add'))).toBe('Add exercises');
  });

  it('offers All plus only the groups present in the catalogue', () => {
    const tree = renderPicker();
    const chips = findAllByTestIdPrefix(tree.toJSON() as Json, 'picker-filter-');
    expect(chips.map((c) => c.props.testID)).toEqual([
      'picker-filter-all',
      'picker-filter-legs',
      'picker-filter-push',
      'picker-filter-pull',
    ]);
  });

  it('keeps the search input at 16px, matching web is zoom threshold', () => {
    const tree = renderPicker();
    const search = findByTestId(tree.toJSON() as Json, 'picker-search')!;
    expect(flatten(search.props.style).fontSize).toBe(16);
  });
});
