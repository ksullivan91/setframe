import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SeriesPoint } from '@setframe/domain';
import { getTheme } from '../theme/getTheme';
import { ColumnChart, LineChart } from './Charts';

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

/**
 * Story 48 — dragging across the plot must move the selection continuously,
 * not just on discrete taps. ADR 0008 flagged the failure mode this guards:
 * if the element holding pointer capture is re-created by the re-render that
 * selection triggers, the browser ends the gesture and the drag dies after
 * a single datum.
 */
describe('LineChart scrub', () => {
  /* jsdom 25 ships no PointerEvent, so testing-library silently degrades to a
     bare Event carrying no clientX and React never sees a usable pointer
     event. MouseEvent already models the coordinates we read. */
  beforeAll(() => {
    if (typeof window.PointerEvent === 'undefined') {
      class TestPointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, props: PointerEventInit = {}) {
          super(type, props);
          this.pointerId = props.pointerId ?? 0;
        }
      }
      window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
    }
  });

  const series: SeriesPoint[] = [
    { localDate: '2026-01-01', value: 180 },
    { localDate: '2026-01-02', value: 181 },
    { localDate: '2026-01-03', value: 182 },
    { localDate: '2026-01-04', value: 183 },
  ];

  function renderLine(onSelectPoint?: (point: { index: number }) => void) {
    const view = render(
      <ThemeProvider theme={getTheme('light')}>
        <LineChart
          series={series}
          formatValue={(v) => `${v} lb`}
          label="Body weight"
          onSelectPoint={onSelectPoint}
        />
      </ThemeProvider>,
    );
    const surface = screen.getByTestId('chart-scrub-surface');
    /* jsdom gives every element a zero-sized box and implements no capture
       API, so the geometry the component reads has to be supplied here. A
       350px plot inset 40px from the left mirrors the real layout. */
    surface.getBoundingClientRect = () =>
      ({ left: 40, top: 0, width: 350, height: 128, right: 390, bottom: 128, x: 40, y: 0 }) as DOMRect;
    const captured = new Set<number>();
    surface.setPointerCapture = (id: number) => void captured.add(id);
    surface.releasePointerCapture = (id: number) => void captured.delete(id);
    surface.hasPointerCapture = (id: number) => captured.has(id);
    return { ...view, surface, captured };
  }

  /* Maps a fraction across the plot to a clientX inside the stubbed box. */
  const atFraction = (fraction: number) => 40 + 350 * fraction;

  it('selects the nearest point on pointer down', () => {
    const { surface } = renderLine();
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: atFraction(0) });
    expect(screen.getByTestId('chart-readout')).toHaveTextContent('180 lb');
  });

  it('moves the readout through every datum during one continuous drag', () => {
    const { surface } = renderLine();
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: atFraction(0) });

    const seen: string[] = [];
    for (let step = 0; step <= 20; step += 1) {
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: atFraction(step / 20) });
      const text = screen.getByTestId('chart-readout').textContent ?? '';
      if (seen.at(-1) !== text) seen.push(text);
    }

    /* All four values, in order. A drag that died after the first selection
       would leave a single entry here. */
    expect(seen).toHaveLength(4);
    expect(seen[0]).toContain('180 lb');
    expect(seen.at(-1)).toContain('183 lb');
  });

  it('holds pointer capture for the whole drag and releases it at the end', () => {
    const { surface, captured } = renderLine();
    fireEvent.pointerDown(surface, { pointerId: 7, clientX: atFraction(0) });
    expect(captured.has(7)).toBe(true);

    fireEvent.pointerMove(surface, { pointerId: 7, clientX: atFraction(0.9) });
    /* The re-render that selection triggers must not have replaced the
       capturing node: same element instance, capture still held. */
    expect(screen.getByTestId('chart-scrub-surface')).toBe(surface);
    expect(captured.has(7)).toBe(true);

    fireEvent.pointerUp(surface, { pointerId: 7 });
    expect(captured.has(7)).toBe(false);
  });

  it('commits once per datum crossed rather than once per pointer move', () => {
    const selections: number[] = [];
    const { surface } = renderLine((point) => selections.push(point.index));

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: atFraction(0) });
    for (let step = 0; step <= 40; step += 1) {
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: atFraction(step / 40) });
    }

    /* 41 moves across 4 points: a naive implementation notifies on every
       move, which is both wrong for consumers and the reason a scrub feels
       heavy. Exactly one commit per datum, in order. */
    expect(selections).toEqual([0, 1, 2, 3]);
  });

  it('ignores pointer movement when no drag is in progress', () => {
    const { surface } = renderLine();
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: atFraction(0.9) });
    expect(screen.getByTestId('chart-readout')).toHaveTextContent(
      'Select a point to see its date and value.',
    );
  });
});

/**
 * Story 49 — the smoothed line carries the actual signal, but it lived only
 * in the drawing: the text equivalent listed the raw measurements alone, so a
 * screen-reader user was never told a trend existed, let alone which number
 * was measured and which was derived.
 */
describe('LineChart trend accessibility', () => {
  const raw: SeriesPoint[] = [
    { localDate: '2026-01-01', value: 180 },
    { localDate: '2026-01-02', value: 182 },
    { localDate: '2026-01-03', value: 181 },
  ];
  // Starts a day late, as a real smoothed series does before it has history.
  const trend: SeriesPoint[] = [
    { localDate: '2026-01-02', value: 181 },
    { localDate: '2026-01-03', value: 181.4 },
  ];

  function renderLine(trendSeries?: SeriesPoint[]) {
    return render(
      <ThemeProvider theme={getTheme('light')}>
        <LineChart
          series={raw}
          trendSeries={trendSeries}
          formatValue={(v) => `${v.toFixed(1)} lb`}
          label="Body weight"
        />
      </ThemeProvider>,
    );
  }

  it('names the measured and derived columns separately', () => {
    renderLine(trend);
    expect(screen.getByRole('columnheader', { name: 'Measured' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Trend' })).toBeTruthy();
  });

  it('gives each period both its measurement and its trend value', () => {
    renderLine(trend);
    const row = screen.getByRole('row', { name: /Jan 3/ });
    expect(row.textContent).toContain('181.0 lb');
    expect(row.textContent).toContain('181.4 lb');
  });

  it('says so rather than implying a value where the trend has not started', () => {
    renderLine(trend);
    expect(screen.getByRole('row', { name: /Jan 1/ }).textContent).toContain('no trend yet');
  });

  it('omits the trend column entirely when no trend is drawn', () => {
    renderLine(undefined);
    expect(screen.queryByRole('columnheader', { name: 'Trend' })).toBeNull();
  });
});
