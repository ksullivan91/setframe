import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@setframe/schemas';
import { getTheme } from '../theme/getTheme';
import { AddExercisePicker } from './AddExercisePicker';

const exerciseA: Exercise = {
  id: 'exercise-a',
  name: 'Barbell Back Squat',
  isCustom: false,
  ownerUserId: null,
} as unknown as Exercise;

const exerciseB: Exercise = {
  id: 'exercise-b',
  name: 'Cable Face Pull',
  isCustom: true,
  ownerUserId: 'user-1',
} as unknown as Exercise;

function renderPicker(overrides: Partial<Parameters<typeof AddExercisePicker>[0]> = {}) {
  const props = {
    exercises: [exerciseA],
    exercisesLoading: false,
    exercisesError: false,
    onRetryExercises: vi.fn(),
    onClose: vi.fn(),
    onCreateExercise: vi.fn(async () => exerciseB),
    isCreatingExercise: false,
    onAddExercise: vi.fn(),
    isAddingExercise: false,
    ...overrides,
  };

  render(
    <ThemeProvider theme={getTheme('light')}>
      <AddExercisePicker {...props} />
    </ThemeProvider>,
  );

  return props;
}

describe('AddExercisePicker', () => {
  it('adds the custom exercise the user created, never a previously highlighted catalog exercise', async () => {
    const user = userEvent.setup();
    const props = renderPicker();

    // The gym-test failure mode: the user first taps an existing catalog
    // exercise, backs out, then creates a custom one. The old cluster kept
    // the stale catalog selection and added *that* instead.
    await user.click(screen.getByRole('button', { name: /Barbell Back Squat/ }));
    expect(await screen.findByText('Barbell Back Squat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.click(screen.getByRole('button', { name: /Create custom exercise/ }));
    await user.type(screen.getByLabelText('Exercise name'), 'Cable Face Pull');
    await user.click(screen.getByRole('button', { name: /Create & add/ }));

    await waitFor(() => expect(props.onCreateExercise).toHaveBeenCalledWith('Cable Face Pull'));

    await user.click(await screen.findByRole('button', { name: 'Add to workout' }));

    expect(props.onAddExercise).toHaveBeenCalledTimes(1);
    expect(props.onAddExercise).toHaveBeenCalledWith('exercise-b', expect.objectContaining({ kind: 'sets_reps' }));
  });

  it('carries the search text into the custom-exercise form', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByLabelText('Search exercises'), 'Sled Push');
    await user.click(screen.getByRole('button', { name: /Create custom exercise/ }));

    expect(screen.getByLabelText('Exercise name')).toHaveValue('Sled Push');
  });

  it('preserves the typed name and surfaces an error when creation fails', async () => {
    const user = userEvent.setup();
    const props = renderPicker({
      onCreateExercise: vi.fn(async () => {
        throw new Error('network');
      }),
    });

    await user.click(screen.getByRole('button', { name: /Create custom exercise/ }));
    await user.type(screen.getByLabelText('Exercise name'), 'Sled Push');
    await user.click(screen.getByRole('button', { name: /Create & add/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't create that exercise/);
    expect(screen.getByLabelText('Exercise name')).toHaveValue('Sled Push');
    expect(props.onAddExercise).not.toHaveBeenCalled();
  });

  it('prevents duplicate submits while an add is in flight', async () => {
    const user = userEvent.setup();
    renderPicker({ isAddingExercise: true });

    await user.click(screen.getByRole('button', { name: /Barbell Back Squat/ }));

    expect(await screen.findByRole('button', { name: 'Add to workout' })).toBeDisabled();
  });

  it('shows a retry affordance when the catalog fails to load', async () => {
    const user = userEvent.setup();
    const props = renderPicker({ exercises: [], exercisesError: true });

    expect(screen.getByText(/Couldn't load exercises/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetryExercises).toHaveBeenCalledOnce();
  });
});
