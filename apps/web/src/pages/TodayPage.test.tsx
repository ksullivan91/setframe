import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getTheme } from '../theme/getTheme';
import { ToastProvider } from '../components/Toast';
import { TodayPage } from './TodayPage';

// TodayPage calls useApiClient() (Clerk-token-authenticated fetch), so we
// mock it here to avoid needing a real ClerkProvider + network in this
// smoke test, per the same pattern used for other API-backed pages.
vi.mock('../lib/api-client', () => ({
  useApiClient: () => ({
    get: () => new Promise(() => {}), // never resolves — page renders its loading state
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}));

/** Smoke test: renders TodayPage inside its required providers without crashing. */
describe('TodayPage', () => {
  it('renders without crashing', () => {
    const queryClient = new QueryClient();
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={getTheme('light')}>
            <ToastProvider>
              <TodayPage />
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
