import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import { getTheme } from '../theme/getTheme';
import { ExerciseEditModal, type EditState } from './ExerciseEditModal';

const state: EditState = {
  dayTypeId: 'day-1',
  exerciseId: 'dte-1',
  exerciseName: 'Barbell Incline Press',
  prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 } as Prescription,
  notes: '',
};

function renderModal(overrides: Partial<Parameters<typeof ExerciseEditModal>[0]> = {}) {
  const props = {
    state,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };

  render(
    <ThemeProvider theme={getTheme('light')}>
      <ExerciseEditModal {...props} />
    </ThemeProvider>,
  );

  return props;
}

describe('ExerciseEditModal', () => {
  it('saves a corrected prescription without leaving guided setup', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderModal({ onSave });

    const sets = screen.getByLabelText('Sets');
    await user.clear(sets);
    await user.type(sets, '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      exerciseId: 'dte-1',
      prescription: { kind: 'sets_reps', sets: 5, repsMin: 8 },
    });
  });

  it('uses the caller-supplied removal label so guided setup can say "Remove"', async () => {
    const user = userEvent.setup();
    const props = renderModal({ deleteLabel: 'Remove' });

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(props.onDelete).toHaveBeenCalledOnce();
  });

  it('omits the advanced planned-sets editor unless a slot is supplied', () => {
    renderModal();
    expect(screen.queryByTestId('advanced-slot')).not.toBeInTheDocument();

    renderModal({ advancedSlot: <div data-testid="advanced-slot">Planned sets</div> });
    expect(screen.getAllByTestId('advanced-slot')).toHaveLength(1);
  });
});
