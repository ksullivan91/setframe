import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import type { OverviewInsight } from '@setframe/domain';
import { getTheme } from '../theme/getTheme';
import { ProgressInsights } from './ProgressInsights';

function insight(patch: Partial<OverviewInsight> = {}): OverviewInsight {
  return {
    metric: 'training_frequency',
    label: 'Training',
    sentence: '2 sessions so far, compared with 3 last week.',
    insight: {
      metric: 'training_frequency',
      range: 'W',
      availability: 'ok',
      current: {
        start: '2026-08-24',
        end: '2026-08-25',
        value: 2,
        sampleCount: 2,
        elapsedDays: 2,
        periodDays: 7,
        isPartial: true,
      },
      previous: {
        start: '2026-08-17',
        end: '2026-08-23',
        value: 3,
        sampleCount: 3,
        elapsedDays: 7,
        periodDays: 7,
        isPartial: false,
      },
      change: { absolute: -1, percent: -33.3 },
      trend: { direction: 'down', slope: null, confidence: 'low' },
      comparisonBasis: 'full_period',
      dataQuality: ['partial_current_period'],
      focus: { metric: 'training_frequency', range: 'W' },
    },
    ...patch,
  } as OverviewInsight;
}

function renderInsights(props: Partial<React.ComponentProps<typeof ProgressInsights>> = {}) {
  return render(
    <ThemeProvider theme={getTheme('light')}>
      <ProgressInsights insights={[insight()]} {...props} />
    </ThemeProvider>,
  );
}

describe('ProgressInsights', () => {
  it('shows the sentence the domain layer produced', () => {
    renderInsights();
    expect(screen.getByTestId('progress-insight-training_frequency')).toHaveTextContent(
      '2 sessions so far, compared with 3 last week.',
    );
  });

  /**
   * The story's whole premise: an insight that cannot say anything useful
   * should say nothing, rather than render an empty card announcing that it
   * has no insight.
   */
  it('renders nothing at all when there are no insights', () => {
    renderInsights({ insights: [] });
    expect(screen.queryByTestId('progress-insights')).not.toBeInTheDocument();
  });

  it('sends the reader to the supporting chart', async () => {
    const onFocus = vi.fn();
    renderInsights({ onFocus });

    await userEvent.click(screen.getByRole('button', { name: /2 sessions so far/ }));

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0]![0].insight.focus).toEqual({
      metric: 'training_frequency',
      range: 'W',
    });
  });

  it('leaves the sentence as plain text when there is nowhere to focus', () => {
    renderInsights();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /**
   * A thin previous period makes the comparison weaker, and the reader has to
   * be told rather than left to trust a confident sentence.
   */
  it('states a caveat when the comparison rests on few readings', () => {
    const sparse = insight({
      metric: 'body_weight',
      label: 'Body weight',
      sentence: 'Your 7-day average is 168.2 lb, 1.1 lb below the previous week.',
    });
    sparse.insight = {
      ...sparse.insight,
      dataQuality: ['sparse_previous_period'],
    };

    renderInsights({ insights: [sparse] });

    expect(screen.getByTestId('progress-insight-body_weight')).toHaveTextContent(
      /treat the comparison loosely/,
    );
  });
});
