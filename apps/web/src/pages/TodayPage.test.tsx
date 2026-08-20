import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { getTheme } from '../theme/getTheme';
import { TodayPage } from './TodayPage';

/** Smoke test: renders TodayPage inside its required providers without crashing. */
describe('TodayPage', () => {
  it('renders without crashing', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={getTheme('light')}>
          <TodayPage />
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Today's Workout")).toBeInTheDocument();
  });
});
