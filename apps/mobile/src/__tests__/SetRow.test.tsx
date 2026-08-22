import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { SetRowEditable, type SetRowEditableProps } from '../components/SetRow';
import {
  getPrescriptionDefinition,
  resolveSessionFields,
  type PrescriptionKind,
} from '../lib/prescription';

function renderRow(kind: PrescriptionKind | null, values: SetRowEditableProps['values'] = {}) {
  const definition = getPrescriptionDefinition(kind);
  const props: SetRowEditableProps = {
    setLabel: 'Set 1',
    fields: resolveSessionFields(kind, {}),
    definition,
    values,
    onChangeField: jest.fn(),
    completed: false,
    onToggleCompleted: jest.fn(),
  };

  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider>
        <SetRowEditable {...props} />
      </ThemeProvider>,
    );
  });
  return tree;
}

function fieldTestIds(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('set-field-'), {
      deep: true,
    })
    .map((node) => node.props.testID as string);
}

/**
 * Story 09 — the mobile logger previously offered only weight × reps for
 * every exercise, so timed and distance work could not be logged at all.
 * Fields now come from the same shared prescription definition the web app
 * uses, so the two platforms cannot drift.
 */
describe('SetRowEditable prescription-aware fields', () => {
  it('renders only weight, reps, type and RPE for sets + reps', () => {
    const ids = fieldTestIds(renderRow('sets_reps'));
    expect(ids).toContain('set-field-weight');
    expect(ids).toContain('set-field-reps');
    expect(ids).toContain('set-field-setType');
    expect(ids).toContain('set-field-rpe');
    expect(ids).not.toContain('set-field-duration');
    expect(ids).not.toContain('set-field-distance');
  });

  it('renders distance, its unit and duration for a distance + duration effort', () => {
    const ids = fieldTestIds(renderRow('distanceDuration'));
    expect(ids).toContain('set-field-distance');
    expect(ids).toContain('set-field-distanceUnit');
    expect(ids).toContain('set-field-duration');
    expect(ids).not.toContain('set-field-weight');
    expect(ids).not.toContain('set-field-reps');
    expect(ids).not.toContain('set-field-setType');
  });

  it('renders reps but never external weight for bodyweight reps', () => {
    const ids = fieldTestIds(renderRow('bodyweight_reps'));
    expect(ids).toContain('set-field-reps');
    expect(ids).not.toContain('set-field-weight');
  });

  it('renders duration alone for timed sets', () => {
    const ids = fieldTestIds(renderRow('timed'));
    expect(ids).toContain('set-field-duration');
    expect(ids).not.toContain('set-field-weight');
    expect(ids).not.toContain('set-field-reps');
  });

  it('falls back to every field when an exercise has no prescription', () => {
    const ids = fieldTestIds(renderRow(null));
    for (const field of ['weight', 'reps', 'duration', 'distance', 'rpe', 'setType']) {
      expect(ids).toContain(`set-field-${field}`);
    }
  });

  // `findAll` reports both the composite and its host element, so count only
  // host nodes to get the number actually rendered on screen.
  function countInlineSeparators(tree: ReactTestRenderer): number {
    return tree.root.findAll(
      (node) => typeof node.type === 'string' && node.props.testID === 'set-inline-separator',
      { deep: true },
    ).length;
  }

  it('keeps the weight × reps pairing inline so a strength set stays compact', () => {
    expect(countInlineSeparators(renderRow('sets_reps'))).toBe(1);
  });

  it('renders no inline separator when only one inline field is present', () => {
    expect(countInlineSeparators(renderRow('bodyweight_reps'))).toBe(0);
    expect(countInlineSeparators(renderRow('timed'))).toBe(0);
  });
});
