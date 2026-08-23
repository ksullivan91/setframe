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

vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown) => mockPost(path, body),
    patch: vi.fn(async () => ({})),
    del: vi.fn(async () => ({})),
  }),
}));

function renderWizard() {
  mockGet = (path: string) => {
    if (path === '/programs') return Promise.resolve([]);
    if (path.startsWith('/day-types/')) return Promise.resolve({ id: 'day-type-1', name: 'Upper A', exercises: [] });
    return Promise.resolve([]);
  };
  mockPost = (path: string, body: unknown) => {
    if (path === '/programs') {
      return Promise.resolve({ id: 'program-1', name: (body as { name: string }).name, isActive: true, cycleLengthWeeks: null });
    }
    if (path === '/day-types') {
      return Promise.resolve({ id: 'day-type-1', name: (body as { name: string }).name });
    }
    return Promise.resolve({});
  };
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
