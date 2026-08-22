import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../theme/ThemeProvider';
import { WeekScheduleEditor, type WeekScheduleEditorProps } from '../components/WeekScheduleEditor';

const workouts = [
  { id: 'upper-a', name: 'Upper A' },
  { id: 'lower-b', name: 'Lower B — long enough to wrap on a narrow phone' },
];

function renderEditor(overrides: Partial<WeekScheduleEditorProps> = {}) {
  const props: WeekScheduleEditorProps = {
    workouts,
    assignmentsByDay: {},
    selectedWorkoutId: 'upper-a',
    onSelectWorkout: jest.fn(),
    onAssignDay: jest.fn(),
    onClearDay: jest.fn(),
    ...overrides,
  };

  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeProvider>
        <WeekScheduleEditor {...props} />
      </ThemeProvider>,
    );
  });

  return { tree, props };
}

function press(tree: ReactTestRenderer, testID: string) {
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

describe('WeekScheduleEditor (mobile)', () => {
  it('renders all seven days, defaulting to rest', () => {
    const { tree } = renderEditor();

    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach(
      (dayName, dayIndex) => {
        const row = tree.root.findByProps({ testID: `week-schedule-day-${dayIndex}` });
        expect(row.props.accessibilityLabel).toContain(`${dayName}: Rest / unassigned`);
        expect(row.props.accessibilityState.selected).toBe(false);
      },
    );
  });

  it('assigns the selected workout when a day is pressed', () => {
    const { tree, props } = renderEditor();

    press(tree, 'week-schedule-day-1');

    expect(props.onAssignDay).toHaveBeenCalledWith(1, 'upper-a');
  });

  it('changes an assigned day when a different workout is selected first', () => {
    const { tree, props } = renderEditor({
      assignmentsByDay: { 2: 'upper-a' },
      selectedWorkoutId: 'lower-b',
    });

    press(tree, 'week-schedule-day-2');

    expect(props.onAssignDay).toHaveBeenCalledWith(2, 'lower-b');
    expect(props.onClearDay).not.toHaveBeenCalled();
  });

  it('clears a day via the explicit clear control', () => {
    const { tree, props } = renderEditor({ assignmentsByDay: { 3: 'upper-a' } });

    press(tree, 'week-schedule-clear-3');

    expect(props.onClearDay).toHaveBeenCalledWith(3);
  });

  it('clears a day when the already-assigned selected workout is pressed again', () => {
    const { tree, props } = renderEditor({ assignmentsByDay: { 5: 'upper-a' } });

    press(tree, 'week-schedule-day-5');

    expect(props.onClearDay).toHaveBeenCalledWith(5);
    expect(props.onAssignDay).not.toHaveBeenCalled();
  });

  it('marks the selected workout chip as selected and reports selection changes', () => {
    const { tree, props } = renderEditor();

    expect(tree.root.findByProps({ testID: 'week-schedule-workout-upper-a' }).props.accessibilityState.selected).toBe(true);
    expect(tree.root.findByProps({ testID: 'week-schedule-workout-lower-b' }).props.accessibilityState.selected).toBe(false);

    press(tree, 'week-schedule-workout-lower-b');
    expect(props.onSelectWorkout).toHaveBeenCalledWith('lower-b');
  });

  it('keeps the full workout name in the accessibility label even when clamped', () => {
    const { tree } = renderEditor({ assignmentsByDay: { 0: 'lower-b' } });

    const sunday = tree.root.findByProps({ testID: 'week-schedule-day-0' });
    expect(sunday.props.accessibilityLabel).toContain(workouts[1]!.name);
    expect(sunday.props.accessibilityState.selected).toBe(true);
  });

  it('announces assignment changes through a live region', () => {
    const { tree } = renderEditor();

    press(tree, 'week-schedule-day-6');

    const announcement = tree.root.findByProps({ testID: 'week-schedule-announcement' });
    expect(announcement.props.accessibilityLiveRegion).toBe('polite');
    expect(announcement.props.children).toBe('Saturday assigned to Upper A.');
  });

  it('disables day rows until a workout is selected', () => {
    const { tree } = renderEditor({ selectedWorkoutId: null });

    expect(tree.root.findByProps({ testID: 'week-schedule-day-0' }).props.disabled).toBe(true);
  });

  it('disables every control when disabled', () => {
    const { tree } = renderEditor({ assignmentsByDay: { 2: 'upper-a' }, disabled: true });

    expect(tree.root.findByProps({ testID: 'week-schedule-workout-upper-a' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: 'week-schedule-day-2' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: 'week-schedule-clear-2' }).props.disabled).toBe(true);
  });

  it('shows the empty state instead of workout chips when there are none', () => {
    const { tree } = renderEditor({ workouts: [], selectedWorkoutId: null, emptyMessage: 'Add a workout first.' });

    expect(tree.root.findAllByProps({ testID: 'week-schedule-workout-upper-a' })).toHaveLength(0);
    expect(
      tree.root.findAll((node) => node.props.children === 'Add a workout first.').length,
    ).toBeGreaterThan(0);
  });

  it('renders a loading indicator instead of day rows while loading', () => {
    const { tree } = renderEditor({ isLoading: true });

    expect(tree.root.findAllByProps({ testID: 'week-schedule-loading' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'week-schedule-day-0' })).toHaveLength(0);
  });

  it('surfaces an error with a retry action', () => {
    const onRetry = jest.fn();
    const { tree } = renderEditor({ errorMessage: 'Could not update schedule.', onRetry });

    press(tree, 'week-schedule-retry');
    expect(onRetry).toHaveBeenCalled();
  });

  it('marks the day being saved as busy', () => {
    const { tree } = renderEditor({ assignmentsByDay: { 4: 'upper-a' }, pendingDayIndex: 4 });

    expect(tree.root.findByProps({ testID: 'week-schedule-day-4' }).props.accessibilityState.busy).toBe(true);
  });

  it('gives every day row and clear control at least a 44px touch target', () => {
    const { tree } = renderEditor({ assignmentsByDay: { 1: 'upper-a' } });

    const dayStyle = tree.root.findByProps({ testID: 'week-schedule-day-1' }).props.style({ pressed: false });
    expect(dayStyle.flat().some((style: { minHeight?: number }) => style?.minHeight === 44)).toBe(true);

    const clearStyle = tree.root.findByProps({ testID: 'week-schedule-clear-1' }).props.style({ pressed: false });
    expect(clearStyle.flat().some((style: { height?: number }) => style?.height === 44)).toBe(true);
  });
});
