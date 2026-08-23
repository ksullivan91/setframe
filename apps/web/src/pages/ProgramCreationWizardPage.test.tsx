import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { ProgramCreationWizardPage } from './ProgramCreationWizardPage';

let mockGet: (path: string) => Promise<unknown> = () => Promise.resolve([]);
let mockPost: (path: string, body: unknown) => Promise<unknown> = () => Promise.resolve({});
let mockPatch: (path: string, body: unknown) => Promise<unknown> = () => Promise.resolve({});
let mockDel: (path: string) => Promise<unknown> = () => Promise.resolve({});

/** Exercises returned by GET /day-types/:id, keyed by day-type id — lets a
 * test give one workout exercises (to trigger the removal-consequences
 * confirm dialog) while others stay empty. */
let dayTypeExercisesById: Record<string, unknown[]> = {};
let dayTypeIdCounter = 0;

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown) => mockPost(path, body),
    patch: (path: string, body: unknown) => mockPatch(path, body),
    del: (path: string) => mockDel(path),
  }),
}));

function renderWizard() {
  dayTypeIdCounter = 0;
  dayTypeExercisesById = {};
  mockGet = (path: string) => {
    if (path === '/programs') return Promise.resolve([]);
    if (path.startsWith('/day-types/')) {
      const id = path.split('/').pop()!;
      return Promise.resolve({ id, name: 'Workout', exercises: dayTypeExercisesById[id] ?? [] });
    }
    return Promise.resolve([]);
  };
  mockPost = (path: string, body: unknown) => {
    if (path === '/programs') {
      return Promise.resolve({ id: 'program-1', name: (body as { name: string }).name, isActive: true, cycleLengthWeeks: null });
    }
    if (path === '/day-types') {
      dayTypeIdCounter += 1;
      return Promise.resolve({ id: `day-type-${dayTypeIdCounter}`, name: (body as { name: string }).name });
    }
    return Promise.resolve({});
  };
  mockPatch = (path: string, body: unknown) => {
    if (path.startsWith('/day-types/')) return Promise.resolve({ id: path.split('/').pop(), name: (body as { name: string }).name });
    return Promise.resolve({});
  };
  mockDel = () => Promise.resolve({});
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/training/new']}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={getTheme('light')}>
          <ToastProvider>
            <ProgramCreationWizardPage />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/**
 * Story 17 — a novice beta tester conflated "workout" with "today's
 * exercise." These assertions guard the specific hierarchy-clarifying copy
 * (and the persistent containment example), not just that some text exists.
 */
describe('ProgramCreationWizardPage hierarchy copy', () => {
  it('shows the persistent Program → Workout → Exercise hierarchy example on every step', () => {
    renderWizard();
    expect(screen.getAllByText(/4-Day Strength Plan/).length).toBeGreaterThan(0);
  });

  it('explains a program is the overall plan, not a single day', () => {
    renderWizard();
    // The Stepper's per-step caption and the step-0 body both use this
    // phrase, deliberately (Story 17) — assert it's present at all.
    expect(screen.getAllByText(/Your overall training plan over time/).length).toBeGreaterThan(0);
  });

  it('tells the user workouts are reusable and exercises come next', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByLabelText('Program name'), 'Fall block');
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() => expect(screen.getByText(/Create your first workouts/)).toBeInTheDocument());
    expect(screen.getByText(/Reusable training days inside your program/)).toBeInTheDocument();
    expect(screen.getByText(/You'll add exercises inside each workout in the next step/)).toBeInTheDocument();
  });

  it('explains exercises live inside the selected workout, once one exists', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByLabelText('Program name'), 'Fall block');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(screen.getByLabelText('Workout name')).toBeInTheDocument());

    // Deliberately not "Upper A" — that name is also the static example in
    // the persistent HierarchyHint, which would make it ambiguous below.
    await user.type(screen.getByLabelText('Workout name'), 'Leg Day');
    await user.click(screen.getByRole('button', { name: /add workout/i }));
    // Also appears in the collapsible "What you've built" recap, so assert
    // presence rather than uniqueness.
    await waitFor(() => expect(screen.getAllByText('Leg Day').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(screen.getByText(/Add exercises/)).toBeInTheDocument());
    expect(screen.getByText(/what you actually perform inside the selected workout/i)).toBeInTheDocument();
  });
});

/**
 * Story 18 — beta feedback: "the add workout highlight disappearing...
 * initially thought I was only able to create one workout," and workouts
 * mistakenly created for exercise names couldn't be removed. This is the
 * regression flow the story's own steering doc names: create → verify Add
 * Workout remains available → create second → rename second → remove
 * first → selection/next-step still valid.
 */
describe('ProgramCreationWizardPage workout create/rename/remove/undo', () => {
  async function reachWorkoutsStep(user: ReturnType<typeof userEvent.setup>) {
    renderWizard();
    await user.type(screen.getByLabelText('Program name'), 'Fall block');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(screen.getByLabelText('Workout name')).toBeInTheDocument());
  }

  it('keeps Add Workout available and usable after creating multiple workouts, and rejects a duplicate name', async () => {
    const user = userEvent.setup();
    await reachWorkoutsStep(user);

    await user.type(screen.getByLabelText('Workout name'), 'Push');
    await user.click(screen.getByRole('button', { name: /add workout/i }));
    await waitFor(() => expect(screen.getAllByText('Push').length).toBeGreaterThan(0));

    // The control a beta tester thought disappeared after the first
    // workout — assert it's still there and usable for a second workout.
    const addButton = screen.getByRole('button', { name: /add workout/i });
    await user.type(screen.getByLabelText('Workout name'), 'Pull');
    expect(addButton).toBeEnabled();
    await user.click(addButton);
    await waitFor(() => expect(screen.getAllByText('Pull').length).toBeGreaterThan(0));

    await user.type(screen.getByLabelText('Workout name'), 'push');
    await user.click(screen.getByRole('button', { name: /add workout/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('renames a workout via its actions menu', async () => {
    const user = userEvent.setup();
    await reachWorkoutsStep(user);

    await user.type(screen.getByLabelText('Workout name'), 'Push');
    await user.click(screen.getByRole('button', { name: /add workout/i }));
    await waitFor(() => expect(screen.getAllByText('Push').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /actions for push/i }));
    await user.click(await screen.findByText('Rename'));

    const renameInput = await screen.findByLabelText('Rename workout');
    await user.clear(renameInput);
    await user.type(renameInput, 'Upper Push');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(screen.getAllByText('Upper Push').length).toBeGreaterThan(0));
    expect(screen.queryByText('Push')).not.toBeInTheDocument();
  });

  it('removes an empty workout immediately, offers undo, and restores it on undo', async () => {
    const user = userEvent.setup();
    await reachWorkoutsStep(user);

    await user.type(screen.getByLabelText('Workout name'), 'Push');
    await user.click(screen.getByRole('button', { name: /add workout/i }));
    await waitFor(() => expect(screen.getAllByText('Push').length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: /actions for push/i }));
    await user.click(await screen.findByText('Remove'));

    // No exercises on this workout, so removal is immediate — no confirm step.
    await waitFor(() => expect(screen.queryByText('Push')).not.toBeInTheDocument());
    expect(await screen.findByText('Workout removed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => expect(screen.getAllByText('Push').length).toBeGreaterThan(0));
  });

  it('warns about exercise loss before removing a workout that has exercises', async () => {
    const user = userEvent.setup();
    await reachWorkoutsStep(user);

    await user.type(screen.getByLabelText('Workout name'), 'Push');
    await user.click(screen.getByRole('button', { name: /add workout/i }));
    await waitFor(() => expect(screen.getAllByText('Push').length).toBeGreaterThan(0));
    dayTypeExercisesById['day-type-1'] = [{ id: 'ex-1' }, { id: 'ex-2' }];

    await user.click(screen.getByRole('button', { name: /actions for push/i }));
    await user.click(await screen.findByText('Remove'));

    expect(await screen.findByText(/Remove Push\?/)).toBeInTheDocument();
    expect(screen.getByText(/has 2 exercises/)).toBeInTheDocument();
    // Not removed yet — still requires confirming inside the dialog.
    expect(screen.getAllByText('Push').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /remove workout/i }));
    await waitFor(() => expect(screen.queryByText(/Remove Push\?/)).not.toBeInTheDocument());
  });
});
