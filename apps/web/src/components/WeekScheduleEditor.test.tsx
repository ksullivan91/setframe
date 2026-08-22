import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { WeekScheduleEditor, type WeekScheduleEditorProps } from './WeekScheduleEditor';

const workouts = [
  { id: 'upper-a', name: 'Upper A' },
  { id: 'lower-b', name: 'Lower B — long enough to wrap on a narrow phone' },
];

function renderEditor(overrides: Partial<WeekScheduleEditorProps> = {}) {
  const props: WeekScheduleEditorProps = {
    workouts,
    assignmentsByDay: {},
    selectedWorkoutId: 'upper-a',
    onSelectWorkout: vi.fn(),
    onAssignDay: vi.fn(),
    onClearDay: vi.fn(),
    ...overrides,
  };

  render(
    <ThemeProvider theme={getTheme('light')}>
      <WeekScheduleEditor {...props} />
    </ThemeProvider>,
  );

  return props;
}

/** Stateful harness so "assign then change" reflects real re-rendering. */
function StatefulEditor() {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>('upper-a');
  const [assignmentsByDay, setAssignmentsByDay] = useState<Record<number, string | null>>({});

  return (
    <ThemeProvider theme={getTheme('light')}>
      <WeekScheduleEditor
        workouts={workouts}
        assignmentsByDay={assignmentsByDay}
        selectedWorkoutId={selectedWorkoutId}
        onSelectWorkout={setSelectedWorkoutId}
        onAssignDay={(dayIndex, workoutId) =>
          setAssignmentsByDay((current) => ({ ...current, [dayIndex]: workoutId }))
        }
        onClearDay={(dayIndex) => setAssignmentsByDay((current) => ({ ...current, [dayIndex]: null }))}
      />
    </ThemeProvider>
  );
}

describe('WeekScheduleEditor', () => {
  it('lists all seven days with their assignment, defaulting to rest', () => {
    renderEditor();

    for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${day}: Rest / unassigned`) })).toBeInTheDocument();
    }
  });

  it('assigns the selected workout to a day when the day is activated', async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    await user.click(screen.getByRole('button', { name: /^Monday:/ }));

    expect(props.onAssignDay).toHaveBeenCalledWith(1, 'upper-a');
  });

  it('changes an assigned day to a different workout after picking another one', async () => {
    const user = userEvent.setup();
    render(<StatefulEditor />);

    await user.click(screen.getByRole('button', { name: /^Tuesday:/ }));
    expect(screen.getByRole('button', { name: /^Tuesday: Upper A/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: workouts[1]!.name }));
    await user.click(screen.getByRole('button', { name: /^Tuesday: Upper A/ }));

    expect(screen.getByRole('button', { name: new RegExp(`^Tuesday: ${workouts[1]!.name}`) })).toBeInTheDocument();
  });

  it('clears a day via the explicit clear control', async () => {
    const user = userEvent.setup();
    const props = renderEditor({ assignmentsByDay: { 3: 'upper-a' } });

    await user.click(screen.getByRole('button', { name: 'Clear Wednesday (currently Upper A)' }));

    expect(props.onClearDay).toHaveBeenCalledWith(3);
  });

  it('clears a day when the already-assigned selected workout is tapped again', async () => {
    const user = userEvent.setup();
    const props = renderEditor({ assignmentsByDay: { 5: 'upper-a' }, selectedWorkoutId: 'upper-a' });

    await user.click(screen.getByRole('button', { name: /^Friday: Upper A/ }));

    expect(props.onClearDay).toHaveBeenCalledWith(5);
    expect(props.onAssignDay).not.toHaveBeenCalled();
  });

  it('marks the currently selected workout with aria-pressed', async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    expect(screen.getByRole('button', { name: 'Upper A' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: workouts[1]!.name })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: workouts[1]!.name }));
    expect(props.onSelectWorkout).toHaveBeenCalledWith('lower-b');
  });

  it('exposes assigned state and the full workout name to assistive tech', () => {
    renderEditor({ assignmentsByDay: { 0: 'lower-b' } });

    const sunday = screen.getByRole('button', { name: new RegExp(`^Sunday: ${workouts[1]!.name}`) });
    expect(sunday).toHaveAttribute('aria-pressed', 'true');
    // The visible label is line-clamped, so the untruncated name must stay
    // reachable via `title` for pointer users too.
    expect(sunday).toHaveAttribute('title', workouts[1]!.name);
    expect(screen.getByRole('button', { name: /^Monday:/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('announces assignment changes in a live region', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /^Saturday:/ }));

    expect(screen.getByRole('status')).toHaveTextContent('Saturday assigned to Upper A.');
  });

  it('disables day activation until a workout is selected', () => {
    renderEditor({ selectedWorkoutId: null });

    expect(screen.getByRole('button', { name: /^Sunday:/ })).toBeDisabled();
    expect(screen.getByText('Choose a workout above, then tap the days it should run on.')).toBeInTheDocument();
  });

  it('disables every control when disabled', () => {
    renderEditor({ assignmentsByDay: { 2: 'upper-a' }, disabled: true });

    expect(screen.getByRole('button', { name: 'Upper A' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Tuesday:/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Clear Tuesday/ })).toBeDisabled();
  });

  it('shows an empty-state message when there are no workouts yet', () => {
    renderEditor({ workouts: [], selectedWorkoutId: null, emptyMessage: 'Add a workout first.' });

    expect(screen.getByText('Add a workout first.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upper A' })).not.toBeInTheDocument();
  });

  it('renders loading placeholders instead of day rows while loading', () => {
    renderEditor({ isLoading: true });

    expect(screen.getByLabelText('Loading schedule')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button', { name: /^Sunday:/ })).not.toBeInTheDocument();
  });

  it('surfaces an error with a retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderEditor({ errorMessage: 'Could not update schedule.', onRetry });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not update schedule.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('marks the day being saved as busy', () => {
    renderEditor({ assignmentsByDay: { 4: 'upper-a' }, pendingDayIndex: 4 });

    expect(screen.getByRole('button', { name: /^Thursday:/ })).toHaveAttribute('aria-busy', 'true');
  });
});
