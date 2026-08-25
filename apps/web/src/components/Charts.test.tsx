import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import type { SeriesPoint } from '@setframe/domain';
import { getTheme } from '../theme/getTheme';
import { ColumnChart } from './Charts';

function renderChart(series: SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[]) {
  return render(
    <ThemeProvider theme={getTheme('light')}>
      <ColumnChart series={series} formatValue={(v) => `${v}`} label="Sessions" />
    </ThemeProvider>,
  );
}

/**
 * Story 33 — the current/incomplete period must be labeled semantically,
 * not only by its distinct fill color.
 */
describe('ColumnChart current-week labeling', () => {
  it('marks the current column in its accessible name', () => {
    renderChart([
      { localDate: '2026-01-05', value: 3 },
      { localDate: '2026-01-12', value: 4, meta: { isCurrent: true } },
    ]);

    const points = screen.getAllByRole('button');
    expect(points[1]).toHaveAccessibleName(/current week/);
    expect(points[0]).not.toHaveAccessibleName(/current week/);
  });

  it('shows "Current week" in the readout once that column is selected', () => {
    renderChart([
      { localDate: '2026-01-05', value: 3 },
      { localDate: '2026-01-12', value: 4, meta: { isCurrent: true } },
    ]);

    fireEvent.click(screen.getAllByRole('button')[1]!);
    expect(screen.getByTestId('chart-current-label')).toHaveTextContent('Current week');
  });

  it('does not show the current-week label for a non-current selection', () => {
    renderChart([
      { localDate: '2026-01-05', value: 3 },
      { localDate: '2026-01-12', value: 4, meta: { isCurrent: true } },
    ]);

    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(screen.queryByTestId('chart-current-label')).not.toBeInTheDocument();
  });
});
